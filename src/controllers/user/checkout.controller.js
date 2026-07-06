import Product from '../../models/product.js';
import User from '../../models/user.js';
import Coupon from '../../models/coupon.js';
import Order from '../../models/order.js';
import cartService from '../../services/user/cart.service.js';
import { applyOffers } from '../../services/user/offer.service.js';

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
            await applyOffers(product);
            
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
            const warnings = await cartService.cleanUnavailableItems(userId);
            if (warnings.length > 0) {
                return res.redirect('/cart?error=Some items in your cart were updated or are unavailable');
            }

            const cart = await cartService.getCart(userId);
            if (!cart || !cart.items.length) {
                return res.redirect('/cart?error=Your cart is empty');
            }

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

        const coupons = await Coupon.find({ isActive: true, expiryDate: { $gt: new Date() } });
        const couponCode = req.session.appliedCouponCode || '';

        if (couponCode) {
            const coupon = await Coupon.findOne({ code: couponCode, isActive: true });
            if (coupon && coupon.expiryDate > new Date()) {
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
                    delete req.session.appliedCouponCode;
                }
            } else {
                delete req.session.appliedCouponCode;
            }
        }

        res.render('user/checkout', {
            user,
            items,
            totals,
            addresses: user.addresses || [],
            coupons,
            appliedCouponCode: req.session.appliedCouponCode || '',
            couponError: null,
            walletBalance: user.wallet !== undefined ? user.wallet : 0
        });

    } catch (error) {
        console.error('Load Checkout Page Error:', error.message);
        res.redirect('/cart?error=Could not load checkout');
    }
};

export const applyCoupon = async (req, res) => {
    try {
        const userId = req.session.user_id || (req.session.user ? req.session.user._id : null);
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Please login to apply coupon' });
        }

        const couponCode = req.body.couponCode || req.body.code;
        if (!couponCode) {
            return res.status(400).json({ success: false, message: 'Coupon code is required' });
        }

        const coupon = await Coupon.findOne({ code: couponCode.trim().toUpperCase(), isActive: true });
        if (!coupon || coupon.expiryDate <= new Date()) {
            return res.status(400).json({ success: false, message: 'Invalid or expired coupon' });
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

        let items = [];
        const isBuyNow = req.query.buyNow === 'true' && !!req.session.buyNowItem;
        if (isBuyNow) {
            const buyNow = req.session.buyNowItem;
            const product = await Product.findById(buyNow.productId).populate('category');
            await applyOffers(product);
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
        const subtotal = totals.subtotal;

        console.log("Coupon:", couponCode);
        console.log("User:", req.session.user || req.user);
        console.log("Subtotal:", subtotal);

        const netCost = Math.max(0, totals.subtotal - totals.discount);

        if (netCost < coupon.minPurchase) {
            return res.status(400).json({
                success: false,
                message: `Minimum purchase of ₹${coupon.minPurchase.toLocaleString('en-IN')} is required to apply this coupon`
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
            await applyOffers(product);
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
