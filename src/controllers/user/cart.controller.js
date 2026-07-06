import cartService from '../../services/user/cart.service.js';
import Cart from '../../models/cart.js';
import Product from '../../models/product.js';
import mongoose from 'mongoose';


export const loadCart = async (req, res) => {
    try {
        const userId = req.session.user_id || (req.session.user ? req.session.user._id : null);
        if (!userId) {
            return res.redirect('/login?error=Please login to view your cart');
        }

        const warnings = await cartService.cleanUnavailableItems(userId);

        const cart = await cartService.getCart(userId);
        const items = cart ? cart.items : [];

        const totals = cartService.calculateCartTotals(items);

        res.render('user/cart', {
            user: req.session.user || null,
            items,
            totals,
            warnings,
            success: req.query.success || null,
            error: req.query.error || null
        });

    } catch (error) {
        console.error('Load Cart Page Error:', error.message);
        res.redirect('/shop?error=Could not load cart');
    }
};


export const addToCart = async (req, res) => {
    try {
        const userId = req.session.user_id || (req.session.user ? req.session.user._id : null);
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Please login to add items to cart' });
        }

        const { productId, variantId, quantity } = req.body;

        const result = await cartService.addItemToCart(userId, productId, variantId, quantity);
        return res.json(result);

    } catch (error) {
        console.error('AJAX Add to Cart Error:', error.message);
        return res.status(500).json({ success: false, message: error.message || 'Internal server error' });
    }
};


export const updateQuantity = async (req, res) => {
    try {
        const userId = req.session.user_id || (req.session.user ? req.session.user._id : null);
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Please login to update quantity' });
        }

        const { productId, variantId, quantity } = req.body;

        await cartService.updateItemQuantity(userId, productId, variantId, quantity);

        const cart = await cartService.getCart(userId);
        const totals = cartService.calculateCartTotals(cart.items);

        const updatedItem = cart.items.find(item =>
            item.productId._id.toString() === productId.toString() &&
            (variantId ? item.variantId && item.variantId.toString() === variantId.toString() : !item.variantId)
        );

        let itemSubtotal = 0;
        if (updatedItem) {
            const prod = updatedItem.productId;
            let price = prod.salePrice || prod.regularPrice || 0;
            if (prod.variants && prod.variants.length > 0 && updatedItem.variantId) {
                const variant = prod.variants.id(updatedItem.variantId);
                if (variant) {
                    price = variant.salePrice || variant.price || price;
                }
            }
            itemSubtotal = price * updatedItem.quantity;
        }

        const cartCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);
        return res.json({
            success: true,
            message: 'Quantity updated successfully',
            totals,
            itemSubtotal,
            cartCount
        });

    } catch (error) {
        console.error('AJAX Update Quantity Error:', error.message);
        return res.status(400).json({ success: false, message: error.message || 'Could not update quantity' });
    }
};


export const removeItem = async (req, res) => {
    try {
        const userId = req.session.user_id || (req.session.user ? req.session.user._id : null);
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Please login to perform this action' });
        }

        const { productId, variantId } = req.body;

        await cartService.removeItemFromCart(userId, productId, variantId);

        const cart = await cartService.getCart(userId);
        const items = cart ? cart.items : [];
        const totals = cartService.calculateCartTotals(items);
        const cartCount = items.reduce((sum, item) => sum + item.quantity, 0);

        return res.json({
            success: true,
            message: 'Product removed from cart successfully',
            totals,
            cartCount
        });

    } catch (error) {
        console.error('AJAX Remove Item Error:', error.message);
        return res.status(400).json({ success: false, message: error.message || 'Could not remove item' });
    }
};

export const checkoutValidate = async (req, res) => {
    try {
        const userId = req.session.user_id || (req.session.user ? req.session.user._id : null);
        if (!userId) {
            return res.redirect('/login?error=Please login to proceed');
        }

        
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

        
        res.render('user/checkout-placeholder', {
            user: req.session.user || null,
            totals: cartService.calculateCartTotals(cart.items),
            items: cart.items
        });

    } catch (error) {
        console.error('Checkout Validation Error:', error.message);
        res.redirect('/cart?error=Checkout validation failed');
    }
};


export default {
    loadCart,
    addToCart,
    updateQuantity,
    removeItem,
    checkoutValidate
   
};
