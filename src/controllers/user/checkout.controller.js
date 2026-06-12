import Order from '../../models/order.js';
import User from '../../models/user.js';
import Product from '../../models/product.js';
import Cart from '../../models/cart.js';
import Coupon from '../../models/coupon.js';
import ReturnRequest from '../../models/returnRequest.js';
import cartService from '../../services/user/cart.service.js';
import { addressSchema } from '../../validators/address.validator.js';
import mongoose from 'mongoose';



/**
 * GET Checkout Page
 */
export const loadCheckout = async (req, res) => {
    try {
        const userId = req.session.user_id || (req.session.user ? req.session.user._id : null);
        if (!userId) {
            return res.redirect('/login?error=Please login to proceed');
        }

        const isBuyNow = req.query.buyNow === 'true' && !!req.session.buyNowItem;
        if (!isBuyNow) {
            delete req.session.buyNowItem;
        }

        let items = [];
        let totals = {};

        if (isBuyNow) {
            const buyNow = req.session.buyNowItem;
            const product = await Product.findById(buyNow.productId).populate('category');
            
            if (!product || product.isDeleted || !product.isListed) {
                delete req.session.buyNowItem;
                return res.redirect('/shop?error=This product is currently unavailable');
            }

            let availableStock = product.stock;
            if (product.variants && product.variants.length > 0 && buyNow.variantId) {
                const variant = product.variants.id(buyNow.variantId);
                if (!variant) {
                    delete req.session.buyNowItem;
                    return res.redirect('/shop?error=Invalid variant selected');
                }
                availableStock = variant.stock;
            }

            if (availableStock <= 0) {
                delete req.session.buyNowItem;
                return res.redirect(`/shop?error=${product.productName} is out of stock`);
            }

            if (buyNow.quantity > availableStock) {
                buyNow.quantity = availableStock;
            }

            items = [{
                productId: product,
                variantId: buyNow.variantId,
                quantity: buyNow.quantity
            }];
            totals = cartService.calculateCartTotals(items);
        } else {
            // Real-time cleanup and validation (stock levels, deleted/unlisted items)
            const warnings = await cartService.cleanUnavailableItems(userId);
            if (warnings.length > 0) {
                return res.redirect('/cart?error=Some items in your cart were updated or are unavailable');
            }

            const cart = await cartService.getCart(userId);
            if (!cart || !cart.items.length) {
                return res.redirect('/cart?error=Your cart is empty');
            }

            // Validate stock availability
            for (const item of cart.items) {
                const product = item.productId;
                if (!product || product.isDeleted || !product.isListed) {
                    return res.redirect('/cart?error=One or more products in your cart are currently unavailable');
                }

                let availableStock = product.stock;
                if (product.variants && product.variants.length > 0 && item.variantId) {
                    const variant = product.variants.id(item.variantId);
                    if (!variant) {
                        return res.redirect('/cart?error=Invalid variant selected');
                    }
                    availableStock = variant.stock;
                }

                if (availableStock <= 0) {
                    return res.redirect(`/cart?error=${product.productName} is out of stock`);
                }

                if (item.quantity > availableStock) {
                    return res.redirect(`/cart?error=Requested quantity for ${product.productName} exceeds available stock`);
                }
            }
            items = cart.items;
            totals = cartService.calculateCartTotals(items);
        }

        const user = await User.findById(userId);

        // Coupons are static UI-only. No backend functionality or database lookup.
        let couponDiscount = 0;
        let couponCode = '';
        let couponError = null;
        const coupons = [];

        res.render('user/checkout', {
            user,
            items,
            totals,
            addresses: user.addresses || [],
            coupons,
            appliedCouponCode: couponCode,
            couponError,
            walletBalance: 5000
        });

    } catch (error) {
        console.error('Load Checkout Page Error:', error.message);
        res.redirect('/cart?error=Could not load checkout');
    }
};

/**
 * POST Apply Coupon (AJAX)
 */
export const applyCoupon = async (req, res) => {
    try {
        const userId = req.session.user_id || (req.session.user ? req.session.user._id : null);
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Please login to apply coupon' });
        }

        const { code } = req.body;
        if (!code) {
            return res.status(400).json({ success: false, message: 'Coupon code is required' });
        }

        const coupon = await Coupon.findOne({ code: code.trim().toUpperCase(), isActive: true });
        if (!coupon) {
            return res.status(400).json({ success: false, message: 'Invalid or inactive coupon code' });
        }

        if (coupon.expiryDate < new Date()) {
            return res.status(400).json({ success: false, message: 'Coupon has expired' });
        }

        let items = [];
        const isBuyNow = !!req.session.buyNowItem;
        if (isBuyNow) {
            const buyNow = req.session.buyNowItem;
            const product = await Product.findById(buyNow.productId).populate('category');
            items = [{
                productId: product,
                variantId: buyNow.variantId,
                quantity: buyNow.quantity
            }];
        } else {
            const cart = await cartService.getCart(userId);
            if (!cart || !cart.items.length) {
                return res.status(400).json({ success: false, message: 'Cart is empty' });
            }
            items = cart.items;
        }

        const totals = cartService.calculateCartTotals(items);
        const netCost = Math.max(0, totals.subtotal - totals.discount);

        if (netCost < coupon.minPurchase) {
            return res.status(400).json({
                success: false,
                message: `Minimum purchase of ₹${coupon.minPurchase.toLocaleString('en-IN')} is required for this coupon.`
            });
        }

        let couponDiscount = 0;
        if (coupon.discountType === 'flat') {
            couponDiscount = coupon.discountValue;
        } else if (coupon.discountType === 'percentage') {
            couponDiscount = Math.round((netCost * coupon.discountValue) / 100);
            if (coupon.maxDiscount && couponDiscount > coupon.maxDiscount) {
                couponDiscount = coupon.maxDiscount;
            }
        }

        req.session.appliedCouponCode = coupon.code;

        // Recalculate totals
        totals.couponDiscount = couponDiscount;
        totals.grandTotal = Math.max(0, totals.grandTotal - couponDiscount);

        return res.json({
            success: true,
            message: `Coupon "${coupon.code}" applied successfully! You saved ₹${couponDiscount.toLocaleString('en-IN')}`,
            couponCode: coupon.code,
            couponDiscount,
            totals
        });

    } catch (error) {
        console.error('Apply Coupon Error:', error.message);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

/**
 * POST Remove Coupon (AJAX)
 */
export const removeCoupon = async (req, res) => {
    try {
        const userId = req.session.user_id || (req.session.user ? req.session.user._id : null);
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Please login to remove coupon' });
        }

        delete req.session.appliedCouponCode;

        let items = [];
        const isBuyNow = !!req.session.buyNowItem;
        if (isBuyNow) {
            const buyNow = req.session.buyNowItem;
            const product = await Product.findById(buyNow.productId).populate('category');
            items = [{
                productId: product,
                variantId: buyNow.variantId,
                quantity: buyNow.quantity
            }];
        } else {
            const cart = await cartService.getCart(userId);
            items = cart ? cart.items : [];
        }
        const totals = cartService.calculateCartTotals(items);

        return res.json({
            success: true,
            message: 'Coupon removed successfully',
            totals
        });

    } catch (error) {
        console.error('Remove Coupon Error:', error.message);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

/**
 * POST Place Order (AJAX)
 */
export const placeOrder = async (req, res) => {
    try {
        const userId = req.session.user_id || (req.session.user ? req.session.user._id : null);
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Please login to place an order' });
        }

        const { addressId, paymentMethod } = req.body;

        if (!addressId) {
            return res.status(400).json({ success: false, message: 'Please select a shipping address' });
        }
        if (!paymentMethod) {
            return res.status(400).json({ success: false, message: 'Please select a payment method' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(400).json({ success: false, message: 'User not found' });
        }

        const selectedAddress = user.addresses.id(addressId);
        if (!selectedAddress) {
            return res.status(400).json({ success: false, message: 'Selected address not found' });
        }

        let items = [];
        const isBuyNow = !!req.session.buyNowItem;
        if (isBuyNow) {
            const buyNow = req.session.buyNowItem;
            const product = await Product.findById(buyNow.productId).populate('category');
            if (!product || product.isDeleted || !product.isListed) {
                return res.status(400).json({ success: false, message: 'Product is no longer available.' });
            }

            let availableStock = product.stock;
            if (product.variants && product.variants.length > 0 && buyNow.variantId) {
                const variant = product.variants.id(buyNow.variantId);
                if (!variant) {
                    return res.status(400).json({ success: false, message: 'Invalid product variant selected.' });
                }
                availableStock = variant.stock;
            }

            if (availableStock <= 0) {
                return res.status(400).json({ success: false, message: `"${product.productName}" is out of stock.` });
            }
            if (buyNow.quantity > availableStock) {
                return res.status(400).json({
                    success: false,
                    message: `Requested quantity for "${product.productName}" exceeds available stock (${availableStock} left).`
                });
            }

            items = [{
                productId: product,
                variantId: buyNow.variantId,
                quantity: buyNow.quantity
            }];
        } else {
            const cart = await cartService.getCart(userId);
            if (!cart || !cart.items.length) {
                return res.status(400).json({ success: false, message: 'Your cart is empty' });
            }

            // Validate stock availability
            for (const item of cart.items) {
                const product = item.productId;
                if (!product || product.isDeleted || !product.isListed) {
                    return res.status(400).json({
                        success: false,
                        message: `Product "${product ? product.productName : 'Unknown'}" is no longer available.`
                    });
                }

                let availableStock = product.stock;
                if (product.variants && product.variants.length > 0 && item.variantId) {
                    const variant = product.variants.id(item.variantId);
                    if (!variant) {
                        return res.status(400).json({ success: false, message: 'Invalid product variant in cart.' });
                    }
                    availableStock = variant.stock;
                }

                if (availableStock <= 0) {
                    return res.status(400).json({ success: false, message: `"${product.productName}" is out of stock.` });
                }
                if (item.quantity > availableStock) {
                    return res.status(400).json({
                        success: false,
                        message: `Requested quantity for "${product.productName}" exceeds available stock (${availableStock} left).`
                    });
                }
            }
            items = cart.items;
        }

        // Calculate totals
        const totals = cartService.calculateCartTotals(items);
        let couponDiscount = 0;
        let couponCode = req.session.appliedCouponCode || null;

        if (couponCode) {
            const coupon = await Coupon.findOne({ code: couponCode, isActive: true });
            if (coupon && coupon.expiryDate > new Date()) {
                const netCost = Math.max(0, totals.subtotal - totals.discount);
                if (netCost >= coupon.minPurchase) {
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
                    couponCode = null;
                }
            } else {
                couponCode = null;
            }
        }

        let paymentStatus = 'Pending';
        let orderStatus = 'Pending Payment';

        if (paymentMethod === 'Wallet') {
            paymentStatus = 'Paid';
            orderStatus = 'Processing';
        } else if (paymentMethod === 'Razorpay') {
            // Razorpay: order is saved first, payment verified after.
            // Status will be updated to Processing after successful payment verification.
            paymentStatus = 'Pending';
            orderStatus = 'Pending Payment';
        } else if (paymentMethod === 'COD') {
            paymentStatus = 'Pending';
            orderStatus = 'Processing';
        } else {
            return res.status(400).json({ success: false, message: 'Invalid payment method selected.' });
        }

        // Generate unique order number
        const now = new Date();
        const year = now.getFullYear();
        const rand = Math.floor(100000 + Math.random() * 900000);
        const orderNumber = `ORD-${year}-${rand}`;

        // Map items to order items
        const orderItems = items.map(item => {
            const prod = item.productId;
            let price = prod.salePrice || prod.regularPrice || 0;
            if (prod.variants && prod.variants.length > 0 && item.variantId) {
                const variant = prod.variants.id(item.variantId);
                if (variant) {
                    price = variant.price || price;
                }
            }
            return {
                productId: prod._id,
                variantId: item.variantId || null,
                quantity: item.quantity,
                price: price
            };
        });

        // Create the order document
        const order = new Order({
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
            paymentStatus,
            subtotal: totals.subtotal,
            tax: totals.tax,
            shippingCharge: totals.shippingCharge,
            discount: totals.discount,
            couponDiscount: totals.couponDiscount,
            grandTotal: totals.grandTotal,
            couponCode,
            status: orderStatus
        });

        await order.save();

        // Reduce stocks only for confirmed orders (COD or Wallet paid)
        if (orderStatus === 'Processing') {
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
        }

        if (isBuyNow) {
            // Clear temporary checkout session item
            delete req.session.buyNowItem;
        } else if (orderStatus === 'Processing') {
            // Clear cart only for confirmed orders
            await Cart.updateOne({ userId }, { $set: { items: [] } });
        }

        // Clean up applied coupon from session
        delete req.session.appliedCouponCode;

        return res.json({
            success: true,
            orderId: order._id,
            orderNumber: order.orderNumber
        });

    } catch (error) {
        console.error('Place Order Error:', error.message);
        return res.status(500).json({ success: false, message: 'Failed to place order. Internal server error.' });
    }
};


/**
 * GET Order Success Page
 */
export const loadSuccess = async (req, res) => {
    try {
        const orderId = req.params.id;
        const order = await Order.findById(orderId).populate('items.productId');
        if (!order) {
            return res.redirect('/shop?error=Order not found');
        }

        // Generate an estimated delivery date (e.g. 5-7 days from order date)
        const estDelivery = new Date(order.createdAt);
        estDelivery.setDate(estDelivery.getDate() + 5);

        res.render('user/order-success', {
            order,
            estimatedDeliveryDate: estDelivery.toLocaleDateString('en-IN', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
            })
        });
    } catch (error) {
        console.error('Load Success Page Error:', error.message);
        res.redirect('/shop?error=Something went wrong');
    }
};

/**
 * GET My Orders list
 */
export const loadOrders = async (req, res) => {
    try {
        const userId = req.session.user_id || (req.session.user ? req.session.user._id : null);
        if (!userId) {
            return res.redirect('/login?error=Please login to view your orders');
        }

        // Populate product fields needed by the orders.ejs template:
        // productName, images (for display), description (for truncated preview)
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

/**
 * GET Order Details
 */
export const loadOrderDetails = async (req, res) => {
    try {
        const orderId = req.params.id;

        // Populate all product fields needed by order-details.ejs:
        // productName, images, description (truncated), variants (for size/color)
        const order = await Order.findById(orderId).populate({
            path: 'items.productId',
            select: 'productName images description variants'
        });

        if (!order) {
            return res.redirect('/orders?error=Order not found');
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

        // Estimated delivery: 5 days from order creation
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

/**
 * POST Cancel Order (AJAX)
 */
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
        if (order.status === 'Shipped') {
            return res.status(400).json({ success: false, message: 'Shipped orders cannot be cancelled. Please contact support.' });
        }

        const { reason } = req.body;
        if (!reason) {
            return res.status(400).json({ success: false, message: 'Cancellation reason is required' });
        }

        // Process Refund to wallet if order was paid using online payment or wallet
        if ((order.paymentMethod === 'Wallet' || order.paymentMethod === 'Razorpay') && order.paymentStatus === 'Paid') {
            order.paymentStatus = 'Refunded';
        }

        // Restore Stock levels only if order was actually confirmed (stock was deducted)
        const confirmedStatuses = ['Processing', 'Shipped', 'Partially Cancelled'];
        if (confirmedStatuses.includes(order.status)) {
            for (const item of order.items) {
                if (item.status === 'Cancelled') continue; // already restored
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
        }

        // Cancel ALL items to prevent mixed statuses
        for (const item of order.items) {
            if (item.status !== 'Cancelled') {
                item.status = 'Cancelled';
                item.cancelledAt = new Date();
                item.cancellationReason = reason;
            }
        }

        order.status = 'Cancelled';
        order.cancellationReason = reason;
        await order.save();

        return res.json({ success: true, message: 'Order cancelled successfully.' });

    } catch (error) {
        console.error('Cancel Order Error:', error.message);

        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

/**
 * POST Cancel Order Item (AJAX)
 */
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

        // Locate the specific item
        const item = order.items.id(itemId) || order.items.find(i => i._id.toString() === itemId || i.productId.toString() === itemId);
        if (!item) {
            return res.status(404).json({ success: false, message: 'Item not found in this order' });
        }

        if (item.status === 'Cancelled') {
            return res.status(400).json({ success: false, message: 'Item is already cancelled' });
        }
        if (item.status === 'Delivered') {
            return res.status(400).json({ success: false, message: 'Delivered items cannot be cancelled' });
        }
        if (item.status === 'Shipped') {
            return res.status(400).json({ success: false, message: 'Shipped items cannot be cancelled' });
        }

        // Restore Stock for this item
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

        // Proportional Refund calculation
        const itemTotal = item.price * item.quantity;
        const orderSubtotal = order.subtotal || order.items.reduce((sum, i) => sum + (i.price * i.quantity), 0);
        const itemContributionRatio = orderSubtotal > 0 ? (itemTotal / orderSubtotal) : 0;

        const couponDiscountShare = Math.round((order.couponDiscount || 0) * itemContributionRatio);
        const taxShare = Math.round((order.tax || 0) * itemContributionRatio);

        let refundAmount = Math.max(0, itemTotal - couponDiscountShare + taxShare);

        // Check active items (excluding current item)
        const activeItems = order.items.filter(i => i._id.toString() !== item._id.toString() && i.status !== 'Cancelled');
        if (activeItems.length === 0) {
            refundAmount += (order.shippingCharge || 0);
        }

        // Wallet Refund
        if ((order.paymentMethod === 'Wallet' || order.paymentMethod === 'Razorpay') && order.paymentStatus === 'Paid') {
            if (activeItems.length === 0) {
                order.paymentStatus = 'Refunded';
            }
        }

        // Update Item Details
        item.status = 'Cancelled';
        item.cancellationReason = reason;
        item.cancelledAt = new Date();
        item.refundAmount = refundAmount;

        // Update overall Order Status
        if (activeItems.length === 0) {
            order.status = 'Cancelled';
            order.cancellationReason = 'All items cancelled';
        } else {
            order.status = 'Partially Cancelled';
        }

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

/**
 * POST Return Order (AJAX)
 */
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

        if (order.status !== 'Delivered') {
            return res.status(400).json({ success: false, message: 'Only delivered orders can be returned' });
        }

        // Check if return request already exists
        const existingRequest = await ReturnRequest.findOne({ orderId });
        if (existingRequest) {
            return res.status(400).json({ 
                success: false, 
                message: `A return request has already been ${existingRequest.status.toLowerCase()}.` 
            });
        }

        // Create the Return Request
        const returnRequest = new ReturnRequest({
            orderId: order._id,
            userId: userId,
            reason: reason.trim(),
            status: 'Requested',
            items: order.items.filter(item => item.status !== 'Cancelled').map(item => ({
                productId: item.productId,
                variantId: item.variantId || null,
                quantity: item.quantity,
                price: item.price
            }))
        });

        await returnRequest.save();

        // Update overall order status
        order.status = 'Return Requested';
        order.returnReason = reason.trim();

        // Update each delivered item status to Return Requested
        order.items.forEach(item => {
            if (item.status === 'Delivered' || !item.status || item.status === 'Placed') {
                item.status = 'Return Requested';
            }
        });

        await order.save();

        return res.json({
            success: true,
            message: 'Return request submitted successfully.'
        });

    } catch (error) {
        console.error('Return Order Error:', error.message);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

/**
 * GET Download/View Printable Invoice
 */
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

/**
 * GET Wallet Page
 */
export const loadWallet = async (req, res) => {
    try {
        const userId = req.session.user_id || (req.session.user ? req.session.user._id : null);
        if (!userId) {
            return res.redirect('/login?error=Please login to view wallet');
        }

        const user = await User.findById(userId);
        // Generate a transaction log based on orders and cancellations
        const walletOrders = await Order.find({
            userId,
            $or: [
                { paymentMethod: 'Wallet' },
                { paymentStatus: 'Refunded' },
                { 'items.status': 'Cancelled', paymentMethod: { $in: ['Wallet', 'Razorpay'] } }
            ]
        }).populate('items.productId').sort({ updatedAt: -1 });

        const transactions = [];

        walletOrders.forEach(o => {
            // Debit for placing order with Wallet
            if (o.paymentMethod === 'Wallet') {
                transactions.push({
                    type: 'debit',
                    amount: o.grandTotal,
                    description: `Order payment (#${o.orderNumber})`,
                    date: o.createdAt
                });
            }

            // Credit for whole order cancellation
            if (o.status === 'Cancelled' && o.paymentStatus === 'Refunded' && o.cancellationReason !== 'All items cancelled') {
                transactions.push({
                    type: 'credit',
                    amount: o.grandTotal,
                    description: `Refund for Cancelled Order (#${o.orderNumber})`,
                    date: o.updatedAt
                });
            }

            // Credit for returned order
            if (o.status === 'Returned' && o.paymentStatus === 'Refunded') {
                transactions.push({
                    type: 'credit',
                    amount: o.grandTotal,
                    description: `Refund for Returned Order (#${o.orderNumber})`,
                    date: o.updatedAt
                });
            }

            // Credits for individual item cancellations
            if (o.paymentMethod === 'Wallet' || o.paymentMethod === 'Razorpay') {
                const orderSubtotal = o.subtotal || o.items.reduce((sum, i) => sum + (i.price * i.quantity), 0);
                o.items.forEach(item => {
                    if (item.status === 'Cancelled' && item.cancelledAt) {
                        let refAmt = item.refundAmount;
                        if (refAmt === undefined || refAmt === null) {
                            // Calculate fallback
                            const itemTotal = item.price * item.quantity;
                            const itemContributionRatio = orderSubtotal > 0 ? (itemTotal / orderSubtotal) : 0;
                            const couponDiscountShare = Math.round((o.couponDiscount || 0) * itemContributionRatio);
                            const taxShare = Math.round((o.tax || 0) * itemContributionRatio);
                            refAmt = Math.max(0, itemTotal - couponDiscountShare + taxShare);
                            // If all items are cancelled and this is the last one cancelled, add shipping
                            const allCancelled = o.items.every(i => i.status === 'Cancelled');
                            if (allCancelled) {
                                const latestItem = o.items.reduce((latest, i) => {
                                    if (!latest || (i.cancelledAt && i.cancelledAt > latest.cancelledAt)) {
                                        return i;
                                    }
                                    return latest;
                                }, null);
                                if (latestItem && latestItem._id.toString() === item._id.toString()) {
                                    refAmt += (o.shippingCharge || 0);
                                }
                            }
                        }
                        const prodName = item.productId ? item.productId.productName : 'Item';
                        transactions.push({
                            type: 'credit',
                            amount: refAmt,
                            description: `Refund for Cancelled Item: ${prodName} (#${o.orderNumber})`,
                            date: item.cancelledAt
                        });
                    }
                });
            }
        });

        // Sort by date descending
        transactions.sort((a, b) => b.date - a.date);

        res.render('user/wallet', {
            user,
            transactions,
            page: 'wallet'
        });
    } catch (error) {
        console.error('Load Wallet Page Error:', error.message);
        res.redirect('/profile?error=Could not load wallet');
    }
};

/**
 * POST Add Money to Wallet (AJAX Mock)
 */
export const addMoneyToWallet = async (req, res) => {
    try {
        const userId = req.session.user_id || (req.session.user ? req.session.user._id : null);
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Please login to perform this action' });
        }

        // const { amount } = req.body;
        // const deposit = Number(amount);
        // if (isNaN(deposit) || deposit <= 0 || deposit > 50000) {
        //     return res.status(400).json({ success: false, message: 'Please enter a valid deposit amount between ₹1 and ₹50,000' });
        // }

        const user = await User.findById(userId);
        user.wallet = (user.wallet || 0) + deposit;
        await user.save();

        return res.json({
            success: true,
            message: `Successfully deposited ₹${deposit.toLocaleString('en-IN')} to your wallet.`,
            walletBalance: user.wallet
        });

    } catch (error) {
        console.error('Deposit Wallet Error:', error.message);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

/**
 * GET Active Coupons Page
 */
export const loadCoupons = async (req, res) => {
    try {
        const userId = req.session.user_id || (req.session.user ? req.session.user._id : null);
        const user = userId ? await User.findById(userId) : null;
        const coupons = await Coupon.find({ isActive: true, expiryDate: { $gt: new Date() } });

        res.render('user/coupons', {
            user,
            coupons,
            page: 'coupons'
        });
    } catch (error) {
        console.error('Load Coupons Page Error:', error.message);
        res.redirect('/profile?error=Could not load coupons');
    }
};
export const addAddress = async (req, res) => {
    try {
        const { error } = addressSchema.validate(req.body, { abortEarly: false, allowUnknown: true });

        if (error) {
            const errors = {};
            error.details.forEach(detail => {
                const key = detail.path[0];
                errors[key] = detail.message;
            });
            return res.status(400).json({
                success: false,
                errors,
                message: 'Validation failed'
            });
        }

        const userId = req.session.user_id || (req.session.user ? req.session.user._id : null);
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Please login to add address' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const newAddress = {
            name: req.body.name.trim(),
            phone: req.body.phone.trim(),
            pincode: req.body.pincode.trim(),
            locality: req.body.locality.trim(),
            city: req.body.city,
            state: req.body.state,
            area: req.body.area.trim(),
            house: req.body.house.trim(),
            isDefault: req.body.isDefault === true || req.body.isDefault === 'true'
        };

        if (newAddress.isDefault) {
            user.addresses.forEach(addr => {
                addr.isDefault = false;
            });
        }

        user.addresses.push(newAddress);
        await user.save();

        const savedAddress = user.addresses[user.addresses.length - 1];

        return res.status(200).json({
            success: true,
            message: 'Address added successfully',
            addresses: user.addresses,
            newAddressId: savedAddress._id
        });

    } catch (error) {
        console.error('Add Address Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

export const getAvailableCoupons = async (req, res) => {
    try {
        const coupons = await Coupon.find({ isActive: true });
        return res.status(200).json({
            success: true,
            coupons
        });
    } catch (error) {
        console.error('Fetch Coupons Error:', error.message);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};