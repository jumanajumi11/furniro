import Order   from '../../models/order.js';
import User    from '../../models/user.js';
import Product from '../../models/product.js';
import ReturnRequest from '../../models/returnRequest.js';
import mongoose from 'mongoose';
import WalletTransaction from '../../models/walletTransaction.js';
import { calculateOrderStatus, calculateItemRefund, processPendingRefunds } from '../../utils/order-helper.js';
import { logger } from '../../utils/logger.js';

const ALLOWED_STATUSES = [
    'Pending',
    'Pending Payment',
    'Payment Failed',
    'Processing',
    'Shipped',
    'Out For Delivery',
    'Delivered',
    'Cancelled',
    'Partially Cancelled',
    'Partially Delivered',
    'Return Requested',
    'Returned',
    'Return Rejected',
    'Partially Returned'
];

const IMMUTABLE_STATUSES = ['Cancelled', 'Returned', 'Return Rejected'];

export const loadOrders = async (req, res) => {
    try {
        const ITEMS_PER_PAGE = 10;
        const page           = Math.max(1, parseInt(req.query.page) || 1);
        const skip           = (page - 1) * ITEMS_PER_PAGE;

        const currentStatus = req.query.status || 'All';   
        const currentSort   = req.query.sortBy || req.query.sort || 'newest'; 
        const search        = (req.query.search || '').trim();

        const query = {};

        if (
            currentStatus === 'All' ||
            currentStatus === 'all' ||
            currentStatus === 'All Statuses' ||
            currentStatus === 'active'
        ) {
            
        } else if (currentStatus === 'Pending') {
            query.status = { $in: ['Pending', 'Pending Payment'] };
        } else if (currentStatus === 'Return Requested') {
            const reqs = await ReturnRequest.find({ status: { $in: ['Requested', 'Return Requested', 'Pending'] } }).select('orderId');
            query._id = { $in: reqs.map(r => r.orderId) };
        } else if (currentStatus === 'Return Approved') {
            const reqs = await ReturnRequest.find({ status: 'Approved' }).select('orderId');
            query._id = { $in: reqs.map(r => r.orderId) };
        } else if (currentStatus === 'Return Rejected') {
            const reqs = await ReturnRequest.find({ status: 'Rejected' }).select('orderId');
            query._id = { $in: reqs.map(r => r.orderId) };
        } else {
            query.status = currentStatus;
        }

        if (search) {
            const matchedUsers = await User.find({
                $or: [
                    { name:  { $regex: search, $options: 'i' } },
                    { email: { $regex: search, $options: 'i' } },
                ],
            }).select('_id');

            const userIds = matchedUsers.map(u => u._id);

            const searchConditions = [
                { orderNumber: { $regex: search, $options: 'i' } },
                { userId:      { $in: userIds }                  }
            ];

            if (mongoose.isValidObjectId(search)) {
                searchConditions.push({ _id: search });
            }

            query.$or = searchConditions;
        }

        let sortOption = { createdAt: -1 }; 
        if (currentSort === 'Oldest' || currentSort === 'oldest') {
            sortOption = { createdAt: 1 };
        } else if (currentSort === 'highAmount') {
            sortOption = { grandTotal: -1 };
        } else if (currentSort === 'lowAmount') {
            sortOption = { grandTotal: 1 };
        }

        const [orders, totalOrders] = await Promise.all([
            Order.find(query)
                .populate('userId', 'name email phone image')   
                .sort(sortOption)
                .skip(skip)
                .limit(ITEMS_PER_PAGE)
                .lean(),
            Order.countDocuments(query),
        ]);

        const orderIds = orders.map(o => o._id);
        const returnRequests = await ReturnRequest.find({ orderId: { $in: orderIds } }).lean();
        const returnRequestsMap = {};
        returnRequests.forEach(req => {
            returnRequestsMap[req.orderId.toString()] = req;
        });

        orders.forEach(order => {
            order.returnRequest = returnRequestsMap[order._id.toString()] || null;
        });

        if (orders.length > 0) {
            const o = orders[0];
            logger.debug('[DEBUG] First Order User Details — userId:', o.userId);
        }

        const totalPages = Math.ceil(totalOrders / ITEMS_PER_PAGE);

        const [total, pending, shipped, delivered, cancelled] = await Promise.all([
            Order.countDocuments(),
            Order.countDocuments({ status: { $in: ['Pending', 'Pending Payment'] } }),
            Order.countDocuments({ status: 'Shipped' }),
            Order.countDocuments({ status: 'Delivered' }),
            Order.countDocuments({ status: 'Cancelled' }),
        ]);

        const counts = { total, pending, shipped, delivered, cancelled };

        return res.render('admin/orders', {
            page:          'orders',
            orders,
            search,
            status:        currentStatus,   
            sort:          currentSort,     
            currentStatus,
            currentSort,
            currentPage:   page,
            totalPages,
            totalOrders,
            counts,
        });

    } catch (error) {
        console.error('[Admin] loadOrders Error:', error);
        return res.status(500).send('Internal Server Error');
    }
};

export const getAdminOrderDetail = async (req, res) => {
    try {
        const orderId = req.params.id;

        if (!orderId) {
            return res.status(400).render('admin/orders', { error: 'Order ID is required.' });
        }

        let order = await Order.findById(orderId)
            .populate({
                path:   'items.productId',
                select: 'productName images regularPrice salePrice variants',
            })
            .populate('userId', '-password');

        if (!order) {
            return res.status(404).render('admin/orders', { error: 'Order not found.' });
        }

        await processPendingRefunds(order);
        const computedStatus = calculateOrderStatus(order);
        if (order.status !== computedStatus || order.isModified()) {
            order.status = computedStatus;
            await order.save();
        }

        order = order.toObject();

        return res.render('admin/order-details', { order, page: 'orders' });

    } catch (error) {
        console.error('[Admin] getAdminOrderDetail Error:', error);
        return res.status(500).send('Internal Server Error');
    }
};

export const getOrderDetails = async (req, res) => {
    try {
        const orderId = req.params.id;

        if (!orderId) {
            return res.status(400).json({ success: false, message: 'Order ID is required.' });
        }

        const order = await Order.findById(orderId)
            .populate({
                path:   'items.productId',
                select: 'productName images regularPrice salePrice variants',
            })
            .populate('userId', 'name email phone image')
            .lean();

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found.' });
        }

        return res.status(200).json({ success: true, order });

    } catch (error) {
        console.error('[Admin] getOrderDetails Error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

export const updateOrderStatusPost = async (req, res) => {
    try {
        const { orderId, status } = req.body;

        if (!orderId || !status) {
            return res.status(400).json({
                success: false,
                message: 'Both orderId and status fields are required.',
            });
        }

        req.params.id = orderId;
        return await updateOrderStatus(req, res);

    } catch (error) {
        console.error('[Admin] updateOrderStatusPost Error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

export const updateOrderStatus = async (req, res) => {
    try {
        const orderId   = req.params.id;
        const { status } = req.body;

        if (!orderId) {
            return res.status(400).json({ success: false, message: 'Order ID is required.' });
        }

        if (!status || !ALLOWED_STATUSES.includes(status)) {
            return res.status(400).json({
                success: false,
                message: `Invalid status. Allowed values: ${ALLOWED_STATUSES.join(', ')}.`,
            });
        }

        const order = await Order.findById(orderId);

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found.' });
        }

        if (IMMUTABLE_STATUSES.includes(order.status)) {
            return res.status(400).json({
                success: false,
                message: `Cannot modify a "${order.status}" order. This status is final.`,
            });
        }

        // Prevent delivery/processing of unpaid online/wallet payment orders
        if (status !== 'Cancelled') {
            if (['Razorpay', 'Wallet'].includes(order.paymentMethod) && order.paymentStatus !== 'Paid') {
                return res.status(400).json({
                    success: false,
                    message: 'Cannot update status. Payment is not completed successfully for this online/wallet order.'
                });
            }
        }

        if (order.status === status) {
            return res.status(400).json({
                success: false,
                message: `Order status is already "${status}". No changes were made.`,
            });
        }

        const nextStatusMap = {
            'Pending': 'Processing',
            'Pending Payment': 'Processing',
            'Processing': 'Shipped',
            'Shipped': 'Out For Delivery',
            'Out For Delivery': 'Delivered'
        };

        const allowedNext = nextStatusMap[order.status];

        if (status === 'Cancelled') {
            if (['Shipped', 'Out For Delivery', 'Delivered', 'Returned', 'Cancelled'].includes(order.status)) {
                return res.status(400).json({
                    success: false,
                    message: `Cannot cancel an order that is already "${order.status}".`,
                });
            }
        } else if (status === 'Returned' || status === 'Return Rejected') {
            if (order.status !== 'Return Requested') {
                return res.status(400).json({
                    success: false,
                    message: `Can only mark as "${status}" when return is requested.`,
                });
            }
        } else {
            if (!allowedNext || allowedNext !== status) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid status transition. From "${order.status === 'Pending Payment' ? 'Pending' : order.status}", you can only transition to "${allowedNext || 'none'}".`,
                });
            }
        }

        if (status === 'Cancelled') {
            const isOnlinePayment = ['Wallet', 'Razorpay'].includes(order.paymentMethod);

            if (isOnlinePayment && order.paymentStatus === 'Paid') {
                const existingRefund = await WalletTransaction.findOne({
                    userId: order.userId,
                    orderId: order._id,
                    type: 'credit',
                    description: { $regex: /^Refund for Cancelled Order/ }
                });
                if (!existingRefund) {
                    order.paymentStatus = 'Refunded';
                    order.refundStatus = 'Processed';
                    order.refundedAmount = order.grandTotal;
                    order.refundDate = new Date();
                    const user = await User.findById(order.userId);
                    if (user) {
                        user.wallet = (user.wallet || 0) + order.grandTotal;
                        await user.save();
                        await WalletTransaction.create({
                            userId: order.userId,
                            amount: order.grandTotal,
                            type: 'credit',
                            description: `Refund for Cancelled Order #${order.orderNumber} (by Admin)`,
                            orderId: order._id,
                            status: 'completed',
                            transactionDate: new Date()
                        });
                    }
                }
            }

            for (const item of order.items) {
                if (item.status === 'Cancelled') continue;

                const product = await Product.findById(item.productId);
                if (product) {
                    if (product.variants?.length > 0 && item.variantId) {
                        const variant = product.variants.id(item.variantId);
                        if (variant) {
                            variant.stock += item.quantity;
                        }
                    } else {
                        product.stock += item.quantity;
                    }
                    await product.save();
                }

                item.status = 'Cancelled';
                item.cancelledAt = new Date();
            }

            if (!order.cancellationReason) {
                order.cancellationReason = 'Cancelled by Administrator';
            }
        }

        if (status === 'Delivered') {
            if (order.paymentMethod === 'COD' && order.paymentStatus === 'Pending') {
                order.paymentStatus = 'Paid';
            }
        }

        if (status === 'Returned') {
            const isOnlinePayment = ['Wallet', 'Razorpay'].includes(order.paymentMethod);
            if (isOnlinePayment && order.paymentStatus === 'Paid') {
                const existingRefund = await WalletTransaction.findOne({
                    userId: order.userId,
                    orderId: order._id,
                    type: 'credit',
                    description: { $regex: /^Refund for Returned Order/ }
                });
                if (!existingRefund) {
                    order.paymentStatus = 'Refunded';
                    order.refundStatus = 'Processed';
                    order.refundedAmount = order.grandTotal;
                    order.refundDate = new Date();
                    const user = await User.findById(order.userId);
                    if (user) {
                        user.wallet = (user.wallet || 0) + order.grandTotal;
                        await user.save();
                        await WalletTransaction.create({
                            userId: order.userId,
                            amount: order.grandTotal,
                            type: 'credit',
                            description: `Refund for Returned Order #${order.orderNumber} (by Admin)`,
                            orderId: order._id,
                            status: 'completed',
                            transactionDate: new Date()
                        });
                    }
                }
            }

            for (const item of order.items) {
                if (item.status === 'Cancelled') continue;
                const product = await Product.findById(item.productId);
                if (!product) continue;

                if (product.variants?.length > 0 && item.variantId) {
                    const variant = product.variants.id(item.variantId);
                    if (variant) {
                        variant.stock += item.quantity;
                    }
                } else {
                    product.stock += item.quantity;
                }
                await product.save();
                item.status = 'Returned';
            }
        }

        if (status === 'Return Rejected') {
            for (const item of order.items) {
                if (item.status === 'Return Requested') {
                    item.status = 'Return Rejected';
                }
            }
        }

        const itemStatusMap = {
            'Processing': 'Processing',
            'Shipped': 'Shipped',
            'Out For Delivery': 'Out For Delivery',
            'Delivered': 'Delivered',
            'Cancelled': 'Cancelled',
            'Returned': 'Returned',
            'Return Rejected': 'Return Rejected',
        };
        const newItemStatus = itemStatusMap[status];
        if (newItemStatus && status !== 'Cancelled' && status !== 'Returned' && status !== 'Return Rejected') {
            for (const item of order.items) {
                if (!['Cancelled', 'Returned', 'Return Requested', 'Return Rejected'].includes(item.status)) {
                    item.status = newItemStatus;
                }
            }
        }

        await processPendingRefunds(order);
        order.status = status;
        await order.save();

        return res.status(200).json({
            success: true,
            message: `Order status successfully updated to "${status}".`,
            updatedStatus: status,
            orderId: order._id,
        });

    } catch (error) {
        console.error('[Admin] updateOrderStatus Error:', error.message);
        return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

export const getReturnRequestDetails = async (req, res) => {
    try {
        const { requestId } = req.params;
        const returnRequest = await ReturnRequest.findById(requestId)
            .populate('userId', 'name email phone image')
            .populate({
                path: 'items.productId',
                select: 'productName images regularPrice salePrice variants'
            });

        if (!returnRequest) {
            return res.status(404).render('admin/orders', { error: 'Return request not found.' });
        }

        const order = await Order.findById(returnRequest.orderId).populate({
            path: 'items.productId',
            select: 'productName images regularPrice salePrice variants'
        });

        return res.render('admin/return-details', { returnRequest, order, page: 'orders' });
    } catch (error) {
        console.error('[Admin] getReturnRequestDetails Error:', error);
        return res.status(500).send('Internal Server Error');
    }
};

export const approveReturnRequest = async (req, res) => {
    try {
        const { requestId } = req.params;
        const returnRequest = await ReturnRequest.findById(requestId);
        if (!returnRequest) {
            return res.status(404).json({ success: false, message: 'Return request not found.' });
        }

        if (['Approved', 'Rejected'].includes(returnRequest.status)) {
            return res.status(400).json({ success: false, message: 'Active return request not found or already processed.' });
        }

        const order = await Order.findById(returnRequest.orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found.' });
        }

        let item = null;
        if (returnRequest.itemId) {
            item = order.items.id(returnRequest.itemId);
        }
        if (!item) {
            item = order.items.find(i => 
                i.productId.toString() === returnRequest.items[0].productId.toString() &&
                (!i.variantId || (returnRequest.items[0].variantId && i.variantId.toString() === returnRequest.items[0].variantId.toString()))
            );
        }

        if (!item) {
            return res.status(404).json({ success: false, message: 'Item not found in order.' });
        }

        const orderId = order._id;
        const itemId = item._id;
        logger.debug('[approveReturn] orderId:', orderId, '| itemId:', itemId, '| returnStatus:', item.returnStatus);

        returnRequest.status = 'Approved';
        await returnRequest.save();

        item.returnStatus = "Returned";
        item.status = "Returned";
        item.returnedAt = new Date();

        for (const reqItem of returnRequest.items) {
            const product = await Product.findById(reqItem.productId);
            if (product) {
                if (product.variants && product.variants.length > 0 && reqItem.variantId) {
                    const variant = product.variants.id(reqItem.variantId);
                    if (variant) {
                        variant.stock += reqItem.quantity;
                    }
                } else {
                    product.stock += reqItem.quantity;
                }
                await product.save();
            }
        }

        logger.info(`[Return Approved] Return request approved for Order #${order.orderNumber}. itemId: ${item._id}`);
        await processPendingRefunds(order);

        order.markModified('items');
        order.status = calculateOrderStatus(order);
        await order.save();

        return res.status(200).json({ success: true, message: 'Return request approved successfully. Stock restored and refund processed.' });
    } catch (error) {
        console.error('[Admin] approveReturnRequest Error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

export const rejectReturnRequest = async (req, res) => {
    try {
        const { requestId } = req.params;
        const { reason } = req.body;
        if (!reason || !reason.trim()) {
            return res.status(400).json({ success: false, message: 'Rejection reason is required.' });
        }

        const returnRequest = await ReturnRequest.findById(requestId);
        if (!returnRequest) {
            return res.status(404).json({ success: false, message: 'Return request not found.' });
        }

        if (['Approved', 'Rejected'].includes(returnRequest.status)) {
            return res.status(400).json({ success: false, message: 'Active return request not found or already processed.' });
        }

        const order = await Order.findById(returnRequest.orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found.' });
        }

        let item = null;
        if (returnRequest.itemId) {
            item = order.items.id(returnRequest.itemId);
        }
        if (!item) {
            item = order.items.find(i => 
                i.productId.toString() === returnRequest.items[0].productId.toString() &&
                (!i.variantId || (returnRequest.items[0].variantId && i.variantId.toString() === returnRequest.items[0].variantId.toString()))
            );
        }

        if (!item) {
            return res.status(404).json({ success: false, message: 'Item not found in order.' });
        }

        const orderId = order._id;
        const itemId = item._id;
        logger.debug('[rejectReturn] orderId:', orderId, '| itemId:', itemId, '| returnStatus:', item.returnStatus);

        returnRequest.status = 'Rejected';
        returnRequest.rejectionReason = reason.trim();
        returnRequest.rejectedAt = new Date();
        await returnRequest.save();

        item.status = 'Return Rejected';
        item.returnStatus = 'Rejected';
        item.returnReason = reason.trim();

        order.markModified('items');
        order.status = calculateOrderStatus(order);
        await order.save();

        return res.status(200).json({ success: true, message: 'Return request rejected successfully.' });
    } catch (error) {
        console.error('[Admin] rejectReturnRequest Error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

export const getReturnRequests = async (req, res) => {
    try {
        const ITEMS_PER_PAGE = 10;
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const skip = (page - 1) * ITEMS_PER_PAGE;

        const search = (req.query.search || '').trim();
        const status = req.query.status || 'All'; 
        const sortBy = req.query.sortBy || 'newest';

        const filter = {};

        if (status !== 'All') {
            if (status === 'Requested') {
                filter.status = { $in: ['Requested', 'Return Requested', 'Pending'] };
            } else {
                filter.status = status;
            }
        }

        if (search) {
            const User = (await import('../../models/user.js')).default;
            const users = await User.find({ name: { $regex: search, $options: 'i' } }).select('_id');
            const userIds = users.map(u => u._id);

            const orders = await Order.find({
                $or: [
                    { orderNumber: { $regex: search, $options: 'i' } },
                    { _id: mongoose.Types.ObjectId.isValid(search) ? search : new mongoose.Types.ObjectId() }
                ]
            }).select('_id');
            const orderIds = orders.map(o => o._id);

            filter.$or = [
                { userId: { $in: userIds } },
                { orderId: { $in: orderIds } }
            ];
        }

        let sort = { createdAt: -1 };
        if (sortBy === 'oldest') {
            sort = { createdAt: 1 };
        }

        const returnRequests = await ReturnRequest.find(filter)
            .populate('userId', 'name email phone image')
            .populate({
                path: 'orderId',
                select: 'orderNumber grandTotal status'
            })
            .populate({
                path: 'items.productId',
                select: 'productName'
            })
            .sort(sort)
            .skip(skip)
            .limit(ITEMS_PER_PAGE)
            .lean();

        const totalRequests = await ReturnRequest.countDocuments(filter);
        const totalPages = Math.ceil(totalRequests / ITEMS_PER_PAGE);

        res.render('admin/returns', {
            returnRequests,
            search,
            status,
            sortBy,
            currentPage: page,
            totalPages,
            activePage: 'returns'
        });
    } catch (error) {
        console.error('[Admin] getReturnRequests Error:', error);
        res.status(500).send('Internal Server Error');
    }
};

export const updateOrderItemStatus = async (req, res) => {
    try {
        const orderId = req.body.orderId || req.params.orderId;
        const itemId = req.body.itemId || req.params.itemId;
        const newStatus = req.body.newStatus || req.body.status;

        logger.debug('[updateOrderItemStatus]', { orderId, itemId, newStatus });

        if (!orderId || !itemId) {
            return res.status(400).json({ success: false, message: 'Order ID and Item ID are required.' });
        }

        if (!newStatus || !ALLOWED_STATUSES.includes(newStatus)) {
            return res.status(400).json({
                success: false,
                message: `Invalid status. Allowed values: ${ALLOWED_STATUSES.join(', ')}.`,
            });
        }

        if (['Return Requested', 'Returned', 'Return Rejected'].includes(newStatus)) {
            return res.status(400).json({
                success: false,
                message: 'Return requests and status changes must originate from the user side and be processed via Return Request Management.',
            });
        }

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found.' });
        }

        const itemIndex = order.items.findIndex(i => i._id.toString() === itemId.toString());
        if (itemIndex === -1) {
            return res.status(404).json({ success: false, message: 'Order item not found.' });
        }

        const item = order.items[itemIndex];
        const oldStatus = item.status;
        const status = newStatus;

        logger.debug('[DEBUG Status Update] details:', { orderId, itemId, oldStatus, newStatus });

        if (oldStatus === status) {
            return res.status(400).json({
                success: false,
                message: `Item status is already "${status}". No changes were made.`,
            });
        }

        if (['Cancelled', 'Returned'].includes(oldStatus)) {
            return res.status(400).json({
                success: false,
                message: `Cannot modify status of a "${oldStatus}" item. This status is final.`,
            });
        }

        const allowedTransitions = {
            'Pending': ['Processing'],
            'Processing': ['Shipped'],
            'Shipped': ['Out For Delivery', 'Out for Delivery'],
            'Out For Delivery': ['Delivered'],
            'Out for Delivery': ['Delivered']
        };

        const nextAllowed = allowedTransitions[oldStatus];
        if (!nextAllowed || !nextAllowed.includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid Status Transition'
            });
        }

        if (status === 'Cancelled' || status === 'Returned') {
            const product = await Product.findById(item.productId);
            if (product) {
                if (product.variants && product.variants.length > 0 && item.variantId) {
                    const variant = product.variants.id(item.variantId);
                    if (variant) {
                        variant.stock += item.quantity;
                    }
                } else {
                    product.stock += item.quantity;
                }
                await product.save();
            }

            const isOnlinePayment = ['Wallet', 'Razorpay'].includes(order.paymentMethod);
            const isCODPaid = order.paymentMethod === 'COD' && order.paymentStatus === 'Paid';
            const shouldRefund = (isOnlinePayment && order.paymentStatus === 'Paid') || isCODPaid;
            
            let refundAmount = 0;
            if (shouldRefund) {
                refundAmount = calculateItemRefund(order, item);
                if (refundAmount > 0) {
                    const prodName = product ? product.productName : 'Item';
                    const refundDescription = `Refund for ${status} Item: ${prodName} (#${order.orderNumber})`;
                    const existingRefund = await WalletTransaction.findOne({
                        userId: order.userId,
                        orderId: order._id,
                        type: 'credit',
                        description: refundDescription
                    });

                    if (!existingRefund) {
                        const user = await User.findById(order.userId);
                        if (user) {
                            user.wallet = (user.wallet || 0) + refundAmount;
                            await user.save();

                            order.refundedAmount = (order.refundedAmount || 0) + refundAmount;
                            order.refundDate = new Date();

                            await WalletTransaction.create({
                                userId: order.userId,
                                amount: refundAmount,
                                type: 'credit',
                                description: refundDescription,
                                orderId: order._id,
                                status: 'completed',
                                transactionDate: new Date()
                            });
                        }
                    }
                }
            }

            item.refundAmount = shouldRefund ? refundAmount : 0;
            item.refundStatus = (shouldRefund && refundAmount > 0) ? 'Refunded' : (status === 'Returned' ? 'Pending' : 'None');
            if (status === 'Cancelled') {
                item.cancelledAt = new Date();
                item.cancellationReason = 'Cancelled by Administrator';
            } else if (status === 'Returned') {
                item.returnedAt = new Date();
                item.returnStatus = 'Approved';
            }
        }

        if (status === 'Delivered') {
            item.deliveredAt = new Date();
            const allResolved = order.items.every(i => {
                const s = i._id.toString() === item._id.toString() ? 'Delivered' : i.status;
                return ['Delivered', 'Cancelled', 'Returned'].includes(s);
            });
            if (order.paymentMethod === 'COD' && order.paymentStatus === 'Pending' && allResolved) {
                order.paymentStatus = 'Paid';
            }
        }

        logger.info(`[Admin Status Update] Updating item status: Order ${orderId}, Item ${itemId} from ${item.status} to ${status}`);

        item.status = status;

        await processPendingRefunds(order);
        order.markModified('items');
        order.status = calculateOrderStatus(order);

        await order.save();

        return res.status(200).json({
            success: true,
            message: `Item status updated to "${status}".`,
            updatedStatus: status,
            orderStatus: order.status,
        });

    } catch (error) {
        console.error('[Admin] updateOrderItemStatus Error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

export const cancelOrderItem = async (req, res) => {
    try {
        const orderId = req.params.orderId || req.body.orderId;
        const itemId = req.params.itemId || req.body.itemId;

        logger.debug('[cancelOrderItem] orderId:', orderId, '| itemId:', itemId);

        if (!orderId || !itemId) {
            return res.status(400).json({ success: false, message: 'Order ID and Item ID are required.' });
        }

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found.' });
        }

        const itemIndex = order.items.findIndex(i => i._id.toString() === itemId.toString());
        if (itemIndex === -1) {
            return res.status(404).json({ success: false, message: 'Item not found in this order.' });
        }

        const item = order.items[itemIndex];
        const currentStatus = item.status || 'Pending';

        logger.debug('[cancelOrderItem] userId:', order.userId, '| currentStatus:', currentStatus);

        if (['Cancelled', 'Returned', 'Return Rejected', 'Delivered'].includes(currentStatus)) {
            return res.status(400).json({
                success: false,
                message: `Cannot cancel an item that is already "${currentStatus}".`
            });
        }

        const product = await Product.findById(item.productId);
        if (product) {
            if (product.variants && product.variants.length > 0 && item.variantId) {
                const variant = product.variants.id(item.variantId);
                if (variant) {
                    variant.stock += item.quantity;
                }
            } else {
                product.stock += item.quantity;
            }
            await product.save();
        }

        const refundAmount = calculateItemRefund(order, item);
        
        const isOnlinePayment = ['Wallet', 'Razorpay'].includes(order.paymentMethod);
        const isCODPaid = order.paymentMethod === 'COD' && order.paymentStatus === 'Paid';
        const shouldRefund = (isOnlinePayment && order.paymentStatus === 'Paid') || isCODPaid;

        if (shouldRefund && refundAmount > 0) {
            const user = await User.findById(order.userId);
            if (user) {
                const prodName = product ? product.productName : 'Item';
                const refundDescription = `Refund for Cancelled Item: ${prodName} (#${order.orderNumber})`;
                
                const existingRefund = await WalletTransaction.findOne({
                    userId: order.userId,
                    orderId: order._id,
                    type: 'credit',
                    description: refundDescription
                });

                if (!existingRefund) {
                    user.wallet = (user.wallet || 0) + refundAmount;
                    await user.save();

                    order.refundedAmount = (order.refundedAmount || 0) + refundAmount;
                    order.refundDate = new Date();

                    await WalletTransaction.create({
                        userId: order.userId,
                        amount: refundAmount,
                        type: 'credit',
                        description: refundDescription,
                        orderId: order._id,
                        status: 'completed',
                        transactionDate: new Date()
                    });
                }
            }
        }

        item.status = 'Cancelled';
        item.cancelledAt = new Date();
        item.cancellationReason = 'Cancelled by Administrator';
        item.refundAmount = shouldRefund ? refundAmount : 0;
        item.refundStatus = (shouldRefund && refundAmount > 0) ? 'Refunded' : 'None';

        order.markModified('items');
        order.status = calculateOrderStatus(order);

        await order.save();

        logger.debug('[cancelOrderItem] Admin Item Cancellation Completed. Recalculated status:', order.status);

        return res.json({
            success: true,
            message: 'Item cancelled successfully'
        });

    } catch (error) {
        console.error('Admin Cancel Order Item Error:', error);
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};
