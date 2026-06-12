import Order   from '../../models/order.js';
import User    from '../../models/user.js';
import Product from '../../models/product.js';
import ReturnRequest from '../../models/returnRequest.js';
import mongoose from 'mongoose';



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
    'Return Requested',
    'Returned',
    'Return Rejected'
];

const IMMUTABLE_STATUSES = ['Cancelled', 'Returned', 'Return Rejected'];


export const loadOrders = async (req, res) => {
    try {
        // ── Pagination ────────────────────────────────────────────────────────
        const ITEMS_PER_PAGE = 10;
        const page           = Math.max(1, parseInt(req.query.page) || 1);
        const skip           = (page - 1) * ITEMS_PER_PAGE;

        // ── Read query params (normalise to match EJS tab hrefs) ─────────────
        const currentStatus = req.query.status || 'active';   // 'active' = default clean view
        const currentSort   = req.query.sortBy || req.query.sort || 'newest'; // accept both keys
        const search        = (req.query.search || '').trim();

        const query = {};


        if (currentStatus === 'active') {
            query.status = { $ne: 'Cancelled' };
        } else if (
            currentStatus === 'All' ||
            currentStatus === 'all' ||
            currentStatus === 'All Statuses'
        ) {
        } else if (currentStatus === 'Pending') {
            query.status = { $in: ['Pending', 'Pending Payment'] };
        } else if (currentStatus === 'Return Requested') {
            const reqs = await ReturnRequest.find({ status: 'Requested' }).select('orderId');
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

        let sortOption = { createdAt: -1 }; // default: Newest
        if (currentSort === 'Oldest' || currentSort === 'oldest') {
            sortOption = { createdAt: 1 };
        } else if (currentSort === 'highAmount') {
            sortOption = { grandTotal: -1 };
        } else if (currentSort === 'lowAmount') {
            sortOption = { grandTotal: 1 };
        }

        const [orders, totalOrders] = await Promise.all([
            Order.find(query)
                .populate('userId', 'name email phone image')   // Security: NO password field
                .sort(sortOption)
                .skip(skip)
                .limit(ITEMS_PER_PAGE)
                .lean(),
            Order.countDocuments(query),
        ]);

        // Fetch corresponding return requests for the loaded page's orders
        const orderIds = orders.map(o => o._id);
        const returnRequests = await ReturnRequest.find({ orderId: { $in: orderIds } }).lean();
        const returnRequestsMap = {};
        returnRequests.forEach(req => {
            returnRequestsMap[req.orderId.toString()] = req;
        });

        // Add returnRequest object to order
        orders.forEach(order => {
            order.returnRequest = returnRequestsMap[order._id.toString()] || null;
        });

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

// ─────────────────────────────────────────────────────────────────────────────
// 2a. GET  /admin/orders/:id/detail  — Full-Page Order Detail View (getAdminOrderDetail)
//     Renders the standalone admin/order-details EJS page.
//     Deep-populates both items.productId AND userId (password excluded).
// ─────────────────────────────────────────────────────────────────────────────

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

        // ── Auto-repair: sync stale item statuses for all order statuses ──
        let needsSave = false;
        if (['Cancelled', 'Returned', 'Return Rejected'].includes(order.status)) {
            for (const item of order.items) {
                if (item.status !== order.status && item.status !== 'Cancelled') {
                    item.status = order.status;
                    if (order.status === 'Cancelled') {
                        item.cancelledAt = item.cancelledAt || new Date();
                    }
                    needsSave = true;
                }
            }
        } else if (['Processing', 'Shipped', 'Out For Delivery', 'Delivered'].includes(order.status)) {
            for (const item of order.items) {
                if (item.status !== order.status && !['Cancelled', 'Returned', 'Return Requested', 'Return Rejected'].includes(item.status)) {
                    item.status = order.status;
                    needsSave = true;
                }
            }
        }
        if (needsSave) await order.save();

        // Convert to lean object for the template
        order = order.toObject();

        return res.render('admin/order-details', { order, page: 'orders' });

    } catch (error) {
        console.error('[Admin] getAdminOrderDetail Error:', error);
        return res.status(500).send('Internal Server Error');
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// 2b. GET  /admin/orders/:id  — Single Order Detail JSON (getOrderDetails)
//     Returns JSON for any programmatic consumers (kept for backward compat).
// ─────────────────────────────────────────────────────────────────────────────

export const getOrderDetails = async (req, res) => {
    try {
        const orderId = req.params.id;

        if (!orderId) {
            return res.status(400).json({ success: false, message: 'Order ID is required.' });
        }

        /*
         * Deep population:
         *   1. items.productId  → full product document (name, images, prices)
         *   2. userId           → customer details, password strictly excluded
         */
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

// ─────────────────────────────────────────────────────────────────────────────
// 3a. PATCH /admin/orders/update-status  — AJAX Status Update (body: {orderId, status})
//     This wrapper reads from req.body and delegates to the core handler.
// ─────────────────────────────────────────────────────────────────────────────

export const updateOrderStatusPost = async (req, res) => {
    try {
        const { orderId, status } = req.body;

        if (!orderId || !status) {
            return res.status(400).json({
                success: false,
                message: 'Both orderId and status fields are required.',
            });
        }

        // Delegate to core handler by injecting into req.params
        req.params.id = orderId;
        return await updateOrderStatus(req, res);

    } catch (error) {
        console.error('[Admin] updateOrderStatusPost Error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// 3b. PATCH /admin/orders/:id/status  — Core Status Update Handler
//     Also reachable directly via URL param from other admin tools.
//     Includes full business logic: wallet refund on cancel, stock restore,
//     COD payment mark-as-paid on delivery, and state-machine guards.
// ─────────────────────────────────────────────────────────────────────────────

export const updateOrderStatus = async (req, res) => {
    try {
        const orderId   = req.params.id;
        const { status } = req.body;

        // ── Input validation ──────────────────────────────────────────────────
        if (!orderId) {
            return res.status(400).json({ success: false, message: 'Order ID is required.' });
        }

        if (!status || !ALLOWED_STATUSES.includes(status)) {
            return res.status(400).json({
                success: false,
                message: `Invalid status. Allowed values: ${ALLOWED_STATUSES.join(', ')}.`,
            });
        }

        // ── Fetch current order ───────────────────────────────────────────────
        const order = await Order.findById(orderId);

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found.' });
        }

        // ── State-machine guards (immutable terminal states) ──────────────────
        if (IMMUTABLE_STATUSES.includes(order.status)) {
            return res.status(400).json({
                success: false,
                message: `Cannot modify a "${order.status}" order. This status is final.`,
            });
        }

        if (order.status === status) {
            return res.status(400).json({
                success: false,
                message: `Order status is already "${status}". No changes were made.`,
            });
        }

        // ── Enforce strict sequential status transitions ──────────────────────
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

        // ── Business Logic: Transition to CANCELLED ───────────────────────────
        if (status === 'Cancelled') {
            // Refund to wallet for paid online orders
            const isOnlinePayment = ['Wallet', 'Razorpay'].includes(order.paymentMethod);

            if (isOnlinePayment && order.paymentStatus === 'Paid') {
                order.paymentStatus = 'Refunded';
            }

            // Restore stock for each item AND set all items to Cancelled
            for (const item of order.items) {
                if (item.status === 'Cancelled') continue; // already cancelled, stock already restored

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

                // Cancel every item to prevent mixed statuses
                item.status = 'Cancelled';
                item.cancelledAt = new Date();
            }

            // Set cancellation reason if not already provided
            if (!order.cancellationReason) {
                order.cancellationReason = 'Cancelled by Administrator';
            }
        }

        // ── Business Logic: Transition to DELIVERED ───────────────────────────
        if (status === 'Delivered') {
            // Auto-mark COD orders as Paid on delivery
            if (order.paymentMethod === 'COD' && order.paymentStatus === 'Pending') {
                order.paymentStatus = 'Paid';
            }
        }

        // ── Business Logic: Transition to Returned (Return Approved) ─────────
        if (status === 'Returned') {
            // Refund to wallet for paid orders
            if (order.paymentStatus === 'Paid') {
                order.paymentStatus = 'Refunded';
            }

            // Restore stock for each item
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

        // ── Business Logic: Transition to Return Rejected ─────────────────────
        if (status === 'Return Rejected') {
            for (const item of order.items) {
                if (item.status === 'Return Requested') {
                    item.status = 'Return Rejected';
                }
            }
        }

        // ── Sync all item statuses to match the order status ──────────────────
        // Prevent mixed statuses: every active item follows the order status
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

        // ── Persist status change ─────────────────────────────────────────────
        order.status = status;
        await order.save();

        // ── JSON response for client-side Fetch API ───────────────────────────
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

// ── GET RETURN REQUEST DETAILS ───────────────────────────────────────────────
export const getReturnRequestDetails = async (req, res) => {
    try {
        const orderId = req.params.id;
        const returnRequest = await ReturnRequest.findOne({ orderId })
            .populate('userId', 'name email phone')
            .populate({
                path: 'items.productId',
                select: 'productName images regularPrice salePrice variants'
            });

        if (!returnRequest) {
            return res.status(404).render('admin/orders', { error: 'Return request not found.' });
        }

        const order = await Order.findById(orderId).populate({
            path: 'items.productId',
            select: 'productName images regularPrice salePrice variants'
        });

        return res.render('admin/return-details', { returnRequest, order, page: 'orders' });
    } catch (error) {
        console.error('[Admin] getReturnRequestDetails Error:', error);
        return res.status(500).send('Internal Server Error');
    }
};

// ── APPROVE RETURN REQUEST ───────────────────────────────────────────────────
export const approveReturnRequest = async (req, res) => {
    try {
        const orderId = req.params.id;
        const returnRequest = await ReturnRequest.findOne({ orderId, status: 'Requested' });
        if (!returnRequest) {
            return res.status(404).json({ success: false, message: 'Active return request not found or already processed.' });
        }

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found.' });
        }

        // 1. Update status
        returnRequest.status = 'Approved';
        await returnRequest.save();

        order.status = 'Returned';
        
        // Update each item status
        order.items.forEach(item => {
            if (item.status === 'Return Requested' || item.status === 'Delivered' || !item.status) {
                item.status = 'Returned';
            }
        });

        // 2. Online payments refund
        const isOnlinePayment = ['Wallet', 'Razorpay'].includes(order.paymentMethod);
        if (isOnlinePayment && order.paymentStatus === 'Paid') {
            order.paymentStatus = 'Refunded';
        }

        await order.save();

        // 3. Restore stock
        for (const item of returnRequest.items) {
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
        }

        return res.status(200).json({ success: true, message: 'Return request approved successfully. Stock restored and refund processed.' });
    } catch (error) {
        console.error('[Admin] approveReturnRequest Error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

// ── REJECT RETURN REQUEST ───────────────────────────────────────────────────
export const rejectReturnRequest = async (req, res) => {
    try {
        const orderId = req.params.id;
        const { reason } = req.body;
        if (!reason || !reason.trim()) {
            return res.status(400).json({ success: false, message: 'Rejection reason is required.' });
        }

        const returnRequest = await ReturnRequest.findOne({ orderId, status: 'Requested' });
        if (!returnRequest) {
            return res.status(404).json({ success: false, message: 'Active return request not found or already processed.' });
        }

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found.' });
        }

        // Update return request
        returnRequest.status = 'Rejected';
        returnRequest.rejectionReason = reason.trim();
        returnRequest.rejectedAt = new Date();
        await returnRequest.save();

        // Order status remains Delivered
        order.status = 'Delivered';
        order.cancellationReason = reason.trim(); // store rejection reason as order-level fallback

        order.items.forEach(item => {
            if (item.status === 'Return Requested') {
                item.status = 'Return Rejected';
            }
        });

        await order.save();

        return res.status(200).json({ success: true, message: 'Return request rejected successfully.' });
    } catch (error) {
        console.error('[Admin] rejectReturnRequest Error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};
