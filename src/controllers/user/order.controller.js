import Order from '../../models/order.js';
import User from '../../models/user.js';
import Product from '../../models/product.js';
import Cart from '../../models/cart.js';
import Coupon from '../../models/coupon.js';
import ReturnRequest from '../../models/returnRequest.js';
import WalletTransaction from '../../models/walletTransaction.js';
import cartService from '../../services/user/cart.service.js';
import { applyOffers } from '../../services/user/offer.service.js';
import { calculateOrderStatus, calculateItemRefund } from '../../utils/order-helper.js';
import razorpayInstance from '../../config/razorpay.js';
import { COD_LIMIT } from '../../config/constants.js';

export const placeOrder = async (req, res) => {
    try {
        const userId = req.session.user_id || (req.session.user ? req.session.user._id : null);
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Please login to place order' });
        }

        const { addressId, paymentMethod } = req.body;
        if (!addressId || !paymentMethod) {
            return res.status(400).json({ success: false, message: 'Shipping address and payment method are required.' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const selectedAddress = user.addresses.id(addressId);
        if (!selectedAddress) {
            return res.status(400).json({ success: false, message: 'Invalid shipping address selected.' });
        }

        const isBuyNow = req.query.buyNow === 'true' && !!req.session.buyNowItem;
        let items = [];
        let totals = {};

        if (isBuyNow) {
            const buyNow = req.session.buyNowItem;
            const product = await Product.findById(buyNow.productId).populate('category');
            await applyOffers(product);
            
            if (!product || product.isDeleted || !product.isListed) {
                return res.status(400).json({ success: false, message: 'Product is no longer available' });
            }

            let availableStock = product.stock;
            if (product.variants && product.variants.length > 0 && buyNow.variantId) {
                const variant = product.variants.id(buyNow.variantId);
                if (!variant) {
                    return res.status(400).json({ success: false, message: 'Invalid variant' });
                }
                availableStock = variant.stock;
            }

            if (availableStock <= 0 || buyNow.quantity > availableStock) {
                return res.status(400).json({ success: false, message: 'Requested quantity is out of stock' });
            }

            items = [{
                productId: product,
                variantId: buyNow.variantId,
                quantity: buyNow.quantity
            }];
            totals = cartService.calculateCartTotals(items);
        } else {
            const cart = await cartService.getCart(userId);
            if (!cart || !cart.items.length) {
                return res.status(400).json({ success: false, message: 'Your cart is empty' });
            }

            for (const item of cart.items) {
                const product = item.productId;
                if (!product || product.isDeleted || !product.isListed) {
                    return res.status(400).json({ success: false, message: `Product "${product ? product.productName : 'Unknown'}" is unavailable.` });
                }

                let availableStock = product.stock;
                if (product.variants && product.variants.length > 0 && item.variantId) {
                    const variant = product.variants.id(item.variantId);
                    if (!variant) {
                        return res.status(400).json({ success: false, message: 'Invalid variant selected' });
                    }
                    availableStock = variant.stock;
                }

                if (availableStock <= 0 || item.quantity > availableStock) {
                    return res.status(400).json({ success: false, message: `Product "${product.productName}" is out of stock.` });
                }
            }

            items = cart.items;
            totals = cartService.calculateCartTotals(items);
        }

        const couponCode = req.session.appliedCouponCode;
        if (couponCode) {
            const coupon = await Coupon.findOne({ code: couponCode, isActive: true });
            if (!coupon || coupon.expiryDate <= new Date()) {
                return res.status(400).json({ success: false, message: 'Applied coupon is invalid or expired' });
            }

            if (coupon.usageLimit !== null && coupon.usageLimit !== undefined) {
                const usageCount = await Order.countDocuments({ couponCode: coupon.code, paymentStatus: { $ne: 'Failed' } });
                if (usageCount >= coupon.usageLimit) {
                    return res.status(400).json({ success: false, message: 'Coupon usage limit has been reached' });
                }
            }

            const userUsed = await Order.findOne({ userId, couponCode: coupon.code, paymentStatus: { $ne: 'Failed' } });
            if (userUsed) {
                return res.status(400).json({ success: false, message: 'You have already used this coupon' });
            }

            const netCost = Math.max(0, totals.subtotal - totals.discount);
            if (netCost >= coupon.minPurchase) {
                let couponDiscount = 0;
                if (coupon.discountType === 'flat') {
                    couponDiscount = coupon.discountValue;
                } else if (coupon.discountType === 'percentage') {
                    couponDiscount = Math.round((netCost * coupon.discountValue) / 100);
                    if (coupon.maxDiscount && couponDiscount > coupon.maxDiscount) {
                        couponDiscount = coupon.maxDiscount;
                    }
                }
                totals.couponDiscount = couponDiscount;
                totals.grandTotal = Math.max(0, totals.grandTotal - couponDiscount);
            } else {
                return res.status(400).json({ success: false, message: `Minimum purchase of ₹${coupon.minPurchase.toLocaleString('en-IN')} is required to use this coupon` });
            }
        }

        if (paymentMethod === 'COD' && totals.grandTotal > COD_LIMIT) {
            return res.status(400).json({ success: false, message: "Cash on Delivery is available only for orders up to ₹50,000" });
        }

        if (paymentMethod === 'Wallet' && (user.wallet || 0) <= 0) {
            return res.status(400).json({ success: false, message: 'Wallet balance is 0. Please choose another payment method.' });
        }

        const orderNumber = 'FUR-' + Date.now().toString().slice(-6) + '-' + Math.floor(100 + Math.random() * 900);

        const orderItems = items.map(item => {
            const prod = item.productId;
            let originalPrice = prod.regularPrice;
            let size = '';
            let color = '';
            let image = prod.images[0] || '';

            if (prod.variants && prod.variants.length > 0 && item.variantId) {
                const variant = prod.variants.id(item.variantId);
                if (variant) {
                    originalPrice = variant.price;
                    size = variant.size;
                    color = variant.color;
                    if (color && prod.colors && prod.colors.length > 0) {
                        const selectedColor = prod.colors.find(c => c.name.toLowerCase() === color.toLowerCase());
                        if (selectedColor && selectedColor.images && selectedColor.images.length > 0) {
                            image = selectedColor.images[0];
                        }
                    }
                }
            } else if (prod.colors && prod.colors.length > 0) {
                const defaultColor = prod.colors.find(c => c.isDefault) || prod.colors[0];
                if (defaultColor) {
                    color = defaultColor.name;
                    if (defaultColor.images && defaultColor.images.length > 0) {
                        image = defaultColor.images[0];
                    }
                }
            }

            let itemPrice = prod.salePrice || originalPrice;
            if (prod.variants && prod.variants.length > 0 && item.variantId) {
                const variant = prod.variants.id(item.variantId);
                if (variant) {
                    itemPrice = variant.salePrice || variant.price || itemPrice;
                }
            }

            return {
                productId: prod._id,
                variantId: item.variantId || null,
                quantity: item.quantity,
                price: itemPrice,
                color: color || null,
                size: size || null,
                image: image || null,
                status: 'Pending', 
                returnStatus: 'None'
            };
        });

        let walletDeduction = 0;
        let payableAmount = totals.grandTotal;

        if (paymentMethod === 'Wallet') {
            walletDeduction = Math.min(user.wallet || 0, totals.grandTotal);
            payableAmount = totals.grandTotal - walletDeduction;
        }

        const newOrderData = {
            userId,
            orderNumber,
            items: orderItems,
            shippingAddress: {
                name: selectedAddress.name,
                phone: selectedAddress.phone,
                house: selectedAddress.house,
                locality: selectedAddress.locality,
                area: selectedAddress.area,
                city: selectedAddress.city,
                state: selectedAddress.state,
                pincode: selectedAddress.pincode
            },
            paymentMethod,
            paymentStatus: payableAmount === 0 ? 'Paid' : 'Pending',
            subtotal: totals.subtotal,
            tax: totals.tax,
            shippingCharge: totals.shippingCharge,
            discount: totals.discount,
            couponDiscount: totals.couponDiscount,
            grandTotal: totals.grandTotal,
            walletDeduction: walletDeduction,
            payableAmount: payableAmount,
            couponCode: couponCode || null,
            status: payableAmount === 0 ? 'Pending' : 'Pending Payment'
        };

        const order = new Order(newOrderData);
        await order.save();

        delete req.session.appliedCouponCode;

        if (walletDeduction > 0 && payableAmount === 0) {
            user.wallet = (user.wallet || 0) - walletDeduction;
            await user.save();

            await WalletTransaction.create({
                userId,
                amount: walletDeduction,
                type: 'debit',
                description: `Payment for Order #${orderNumber} (Wallet Deduction)`,
                orderId: order._id,
                status: 'completed',
                transactionDate: new Date()
            });
        }

        // Adjust stocks and clear cart immediately ONLY if the order is fully paid or is COD
        if (payableAmount === 0 || paymentMethod === 'COD') {
            // Adjust stocks
            for (const item of items) {
                const product = await Product.findById(item.productId._id);
                if (product) {
                    if (product.variants && product.variants.length > 0 && item.variantId) {
                        const variant = product.variants.id(item.variantId);
                        if (variant) {
                            variant.stock = Math.max(0, variant.stock - item.quantity);
                        }
                    } else {
                        product.stock = Math.max(0, product.stock - item.quantity);
                    }
                    await product.save();
                }
            }

            if (!isBuyNow) {
                await Cart.updateOne({ userId }, { $set: { items: [] } });
            }
        }

        let razorpayOrderDetails = null;
        if (payableAmount > 0 && (paymentMethod === 'Razorpay' || paymentMethod === 'Wallet')) {
            const options = {
                amount: Math.round(payableAmount * 100),
                currency: "INR",
                receipt: "" + orderNumber
            };
            
            try {
                const rzpOrder = await razorpayInstance.orders.create(options);
                order.razorpayOrderId = rzpOrder.id;
                await order.save();
                
                razorpayOrderDetails = {
                    key: process.env.RAZORPAY_KEY_ID || 'rzp_test_521479843260-8fbrcfhrf7ic3n1rnp1582qqkjlnp057',
                    amount: rzpOrder.amount,
                    currency: rzpOrder.currency,
                    id: rzpOrder.id,
                    name: "Furniture E-Commerce",
                    description: "Order Payment",
                    prefill: {
                        name: selectedAddress.name,
                        contact: selectedAddress.phone,
                        email: user.email || ""
                    }
                };
            } catch (err) {
                console.error('Razorpay Order Creation Error:', err);
                return res.status(500).json({ success: false, message: 'Failed to initialize payment gateway' });
            }
        }

        return res.json({
            success: true,
            orderId: order._id,
            orderNumber: order.orderNumber,
            paymentMethod: paymentMethod,
            razorpayOrder: razorpayOrderDetails
        });

    } catch (error) {
        console.error('Place Order Error:', error.message);
        return res.status(500).json({ success: false, message: 'Failed to place order. Internal server error.' });
    }
};

export const loadOrders = async (req, res) => {
    try {
        const userId = req.session.user_id || (req.session.user ? req.session.user._id : null);
        if (!userId) {
            return res.redirect('/login?error=Please login to view your orders');
        }

        const orders = await Order.find({ userId })
            .populate({
                path: 'items.productId',
                select: 'productName images description variants'
            })
            .sort({ createdAt: -1 });

        const user = await User.findById(userId);

        res.render('user/orders', {
            orders,
            user,
            page: 'orders'
        });
    } catch (error) {
        console.error('Load Orders Error:', error.message);
        res.redirect('/profile?error=Could not load orders');
    }
};

export const loadOrderDetails = async (req, res) => {
    try {
        const orderId = req.params.id;

        const order = await Order.findById(orderId).populate({
            path: 'items.productId',
            select: 'productName images description variants'
        });

        if (!order) {
            return res.redirect('/orders?error=Order not found');
        }

        const computedStatus = calculateOrderStatus(order);
        if (order.status !== computedStatus) {
            order.status = computedStatus;
            await order.save();
        }

        const estDelivery = new Date(order.createdAt);
        estDelivery.setDate(estDelivery.getDate() + 5);

        const userId = req.session.user_id || (req.session.user ? req.session.user._id : null);
        const user   = await User.findById(userId);

        const returnRequest = await ReturnRequest.findOne({ orderId }).lean();

        res.render('user/order-details', {
            order,
            user,
            returnRequest: returnRequest || null,
            estimatedDeliveryDate: estDelivery.toLocaleDateString('en-IN', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
            }),
            page: 'orders'
        });
    } catch (error) {
        console.error('Load Order Details Error:', error.message);
        res.redirect('/orders?error=Could not load order details');
    }
};

export const cancelOrder = async (req, res) => {
    try {
        const userId = req.session.user_id || (req.session.user ? req.session.user._id : null);
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Please login to perform this action' });
        }

        const orderId = req.params.id;
        const order = await Order.findOne({ _id: orderId, userId });

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        if (order.status === 'Cancelled') {
            return res.status(400).json({ success: false, message: 'Order is already cancelled' });
        }
        if (order.status === 'Delivered') {
            return res.status(400).json({ success: false, message: 'Delivered orders cannot be cancelled' });
        }

        const cancellableItems = order.items.filter(item => ['Pending', 'Processing', 'Shipped', 'Out For Delivery'].includes(item.status || 'Pending'));
        if (cancellableItems.length === 0) {
            return res.status(400).json({ success: false, message: 'No cancellable items in this order' });
        }

        const { reason } = req.body;
        if (!reason) {
            return res.status(400).json({ success: false, message: 'Cancellation reason is required' });
        }

        let totalRefund = 0;
        const isOnlinePayment = ['Wallet', 'Razorpay'].includes(order.paymentMethod);
        const isPaid = order.paymentStatus === 'Paid';

        for (const item of cancellableItems) {
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

            let itemRefund = 0;
            if (isOnlinePayment && isPaid) {
                itemRefund = calculateItemRefund(order, item);
                totalRefund += itemRefund;
                order.refundedAmount = (order.refundedAmount || 0) + itemRefund;
            }

            item.status = 'Cancelled';
            item.cancelledAt = new Date();
            item.cancellationReason = reason;
            item.refundAmount = itemRefund;
        }

        if (totalRefund > 0) {
            const user = await User.findById(userId);
            if (user) {
                const existingOrderRefund = await WalletTransaction.findOne({
                    userId,
                    orderId: order._id,
                    type: 'credit',
                    description: `Refund for Cancelled Order #${order.orderNumber} (All Items)`
                });

                if (!existingOrderRefund) {
                    user.wallet = (user.wallet || 0) + totalRefund;
                    await user.save();

                    order.refundDate = new Date();

                    await WalletTransaction.create({
                        userId,
                        amount: totalRefund,
                        type: 'credit',
                        description: `Refund for Cancelled Order #${order.orderNumber} (All Items)`,
                        orderId: order._id,
                        status: 'completed',
                        transactionDate: new Date()
                    });
                }
            }
            const allItemsCancelled = order.items.every(i => i.status === 'Cancelled');
            if (allItemsCancelled) {
                order.paymentStatus = 'Refunded';
                order.refundStatus = 'Processed';
            }
        }

        order.status = calculateOrderStatus(order);
        order.cancellationReason = reason;
        order.markModified('items');
        await order.save();

        return res.json({ success: true, message: 'Order cancelled successfully.' });

    } catch (error) {
        console.error('Cancel Order Error:', error.message);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

export const cancelOrderItem = async (req, res) => {
    try {
        const userId = req.session.user_id || (req.session.user ? req.session.user._id : null);
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Please login to perform this action' });
        }

        const { orderId, itemId } = req.params;
        const { reason } = req.body;

        if (!reason) {
            return res.status(400).json({ success: false, message: 'Cancellation reason is required' });
        }

        const order = await Order.findOne({ _id: orderId, userId });
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        if (order.status === 'Cancelled') {
            return res.status(400).json({ success: false, message: 'Order is already cancelled' });
        }
        if (order.status === 'Delivered') {
            return res.status(400).json({ success: false, message: 'Delivered orders cannot be cancelled' });
        }

        const item = order.items.id(itemId) || order.items.find(i => i._id.toString() === itemId || i.productId.toString() === itemId);
        if (!item) {
            return res.status(404).json({ success: false, message: 'Item not found in this order' });
        }

        if (!['Pending', 'Processing', 'Shipped', 'Out For Delivery'].includes(item.status || 'Pending')) {
            return res.status(400).json({ success: false, message: `Items with status "${item.status}" cannot be cancelled` });
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

        if ((order.paymentMethod === 'Wallet' || order.paymentMethod === 'Razorpay') && order.paymentStatus === 'Paid') {
            const activeItems = order.items.filter(i => i._id.toString() !== item._id.toString() && i.status !== 'Cancelled' && i.status !== 'Returned');
            if (activeItems.length === 0) {
                order.paymentStatus = 'Refunded';
                order.refundStatus = 'Processed';
                order.refundDate = new Date();
            }
            const user = await User.findById(userId);
            if (user && refundAmount > 0) {
                const prodName = product ? product.productName : 'Item';
                const refundDescription = `Refund for Cancelled Item: ${prodName} (#${order.orderNumber})`;
                
                const existingItemRefund = await WalletTransaction.findOne({
                    userId,
                    orderId: order._id,
                    type: 'credit',
                    description: refundDescription
                });
                if (!existingItemRefund) {
                    user.wallet = (user.wallet || 0) + refundAmount;
                    await user.save();
                    order.refundedAmount = (order.refundedAmount || 0) + refundAmount;
                    order.refundDate = new Date();
                    
                    await WalletTransaction.create({
                        userId,
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
        item.cancellationReason = reason;
        item.cancelledAt = new Date();
        item.refundAmount = refundAmount;

        order.markModified('items');
        order.status = calculateOrderStatus(order);
        await order.save();

        return res.json({
            success: true,
            message: 'Item cancelled successfully and refund processed.',
            refundAmount
        });

    } catch (error) {
        console.error('Cancel Order Item Error:', error.message);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

export const returnOrder = async (req, res) => {
    try {
        const userId = req.session.user_id || (req.session.user ? req.session.user._id : null);
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Please login to perform this action' });
        }

        const orderId = req.params.id;
        const { reason } = req.body;

        if (!reason || !reason.trim()) {
            return res.status(400).json({ success: false, message: 'Return reason is required' });
        }

        const order = await Order.findOne({ _id: orderId, userId });
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        const now = new Date();
        const eligibleItems = order.items.filter(item => {
            if (item.status !== 'Delivered') return false;
            if (['Return Requested', 'Returned', 'Return Rejected'].includes(item.status)) return false;
            if (['Requested', 'Approved', 'Rejected', 'Returned'].includes(item.returnStatus)) return false;

            const deliveryDate = item.deliveredAt || order.updatedAt || now;
            const daysSinceDelivery = Math.floor((now - deliveryDate) / (1000 * 60 * 60 * 24));
            return daysSinceDelivery <= 10;
        });

        if (eligibleItems.length === 0) {
            return res.status(400).json({ success: false, message: 'No eligible delivered items found to return.' });
        }

        let createdCount = 0;
        for (const item of eligibleItems) {
            const existingRequest = await ReturnRequest.findOne({ orderId: order._id, itemId: item._id });
            if (!existingRequest) {
                const returnRequest = new ReturnRequest({
                    orderId: order._id,
                    userId: userId,
                    itemId: item._id,
                    reason: reason.trim(),
                    status: 'Requested',
                    items: [{
                        productId: item.productId,
                        variantId: item.variantId || null,
                        quantity: item.quantity,
                        price: item.price,
                        color: item.color || null,
                        size: item.size || null,
                        image: item.image || null
                    }]
                });
                await returnRequest.save();
                createdCount++;
            }

            item.status = 'Return Requested';
            item.returnRequestDate = new Date();
            item.returnReason = reason.trim();
            item.returnStatus = 'Requested';
        }

        order.markModified('items');
        order.status = calculateOrderStatus(order);
        await order.save();

        return res.json({
            success: true,
            message: `Return request submitted successfully for ${createdCount} remaining item(s).`
        });

    } catch (error) {
        console.error('Return Order Error:', error.message);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

export const returnOrderItem = async (req, res) => {
    try {
        const userId = req.session.user_id || (req.session.user ? req.session.user._id : null);
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Please login to perform this action' });
        }

        const { orderId, itemId } = req.params;
        const { reason } = req.body;

        if (!reason || !reason.trim()) {
            return res.status(400).json({ success: false, message: 'Return reason is required' });
        }

        const order = await Order.findOne({ _id: orderId, userId });
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        const item = order.items.id(itemId);
        if (!item) {
            return res.status(404).json({ success: false, message: 'Item not found in this order' });
        }

        if (item.status !== 'Delivered') {
            return res.status(400).json({ success: false, message: 'Only delivered items can be returned' });
        }

        const deliveryDate = item.deliveredAt || order.updatedAt;
        const now = new Date();
        const daysSinceDelivery = Math.floor((now - deliveryDate) / (1000 * 60 * 60 * 24));
        if (daysSinceDelivery > 10) {
            return res.status(400).json({ success: false, message: 'The 10-day return window has expired for this item' });
        }

        const existingRequest = await ReturnRequest.findOne({ orderId, itemId });
        if (existingRequest) {
            return res.status(400).json({ 
                success: false, 
                message: `A return request for this item has already been ${existingRequest.status.toLowerCase()}.` 
            });
        }

        const returnRequest = new ReturnRequest({
            orderId: order._id,
            userId: userId,
            itemId: item._id,
            reason: reason.trim(),
            status: 'Requested',
            items: [{
                productId: item.productId,
                variantId: item.variantId || null,
                quantity: item.quantity,
                price: item.price,
                color: item.color || null,
                size: item.size || null,
                image: item.image || null
            }]
        });

        await returnRequest.save();

        item.status = 'Return Requested';
        item.returnRequestDate = new Date();
        item.returnReason = reason.trim();
        item.returnStatus = 'Requested';

        order.markModified('items');
        order.status = calculateOrderStatus(order);
        await order.save();

        return res.json({
            success: true,
            message: 'Return request submitted successfully for this item.'
        });

    } catch (error) {
        console.error('Return Item Error:', error.message);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

export const loadInvoice = async (req, res) => {
    try {
        const orderId = req.params.id;
        const order = await Order.findById(orderId).populate('items.productId');
        if (!order) {
            return res.status(404).send('Invoice not found');
        }

        res.render('user/invoice', { order });
    } catch (error) {
        console.error('Load Invoice Error:', error.message);
        res.status(500).send('Error loading invoice');
    }
};
