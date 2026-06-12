import Cart from '../../models/cart.js';
import Product from '../../models/product.js';
import Wishlist from '../../models/wishlist.js';
import mongoose from 'mongoose';

/**
 * Get user's cart populated with product and category info.
 */
export const getCart = async (userId) => {
    return await Cart.findOne({ userId }).populate({
        path: 'items.productId',
        populate: { path: 'category' }
    });
};

/**
 * Scan and clean unavailable items in user's cart (deleted, unlisted, inactive, or stock changes).
 * Returns array of warning messages describing actions taken.
 */
export const cleanUnavailableItems = async (userId) => {
    const cart = await Cart.findOne({ userId });
    if (!cart || !cart.items.length) return [];

    const warnings = [];
    const updatedItems = [];
    let isModified = false;

    for (const item of cart.items) {
        const product = await Product.findById(item.productId).populate('category');

        // Check if product exists, is active (listed), and is not deleted
        if (!product || product.isDeleted || !product.isListed || (product.category && product.category.isDeleted)) {
            warnings.push(`"${product?.productName || 'A product'} in your cart is no longer available and was removed.`);
            isModified = true;
            continue; // Skip, removing it from the updated items array
        }

        let maxAvailableStock = 0;
        let selectedVariant = null;

        // If product has variants, check the variant
        if (product.variants && product.variants.length > 0) {
            if (item.variantId) {
                selectedVariant = product.variants.id(item.variantId);
                if (!selectedVariant) {
                    warnings.push(`The selected variant of "${product.productName}" is no longer available and was removed.`);
                    isModified = true;
                    continue;
                }
                maxAvailableStock = selectedVariant.stock;
            } else {
                // If variantId is missing but product has variants, resolve to first available variant
                selectedVariant = product.variants.find(v => v.stock > 0) || product.variants[0];
                item.variantId = selectedVariant._id;
                maxAvailableStock = selectedVariant.stock;
                isModified = true;
            }
        } else {
            maxAvailableStock = product.stock;
        }

        // Validate stock levels
        if (maxAvailableStock <= 0) {
            // Product is out of stock - keep in cart but mark it for UI reference
            // Quantity stays, but we will clamp or show as out of stock
            if (item.quantity > 0) {
                // We keep it in cart but UI will disable checkout and show out of stock ribbon.
            }
        } else if (item.quantity > maxAvailableStock) {
            // Quantity exceeds stock - reduce to maximum available stock
            warnings.push(`The quantity for "${product.productName}" was reduced to ${maxAvailableStock} due to limited stock.`);
            item.quantity = maxAvailableStock;
            isModified = true;
        }

        // Clamp quantity to maximum purchase limit of 10
        if (item.quantity > 10) {
            warnings.push(`The quantity for "${product.productName}" was reduced to the maximum purchase limit of 10 units.`);
            item.quantity = 10;
            isModified = true;
        }

        updatedItems.push(item);
    }

    if (isModified) {
        cart.items = updatedItems;
        await cart.save();
    }

    return warnings;
};

/**
 * Add or update item in cart, and remove from wishlist.
 */
export const addItemToCart = async (userId, productId, variantId, quantity) => {
    const qty = Math.max(1, parseInt(quantity) || 1);

    if (!mongoose.Types.ObjectId.isValid(productId)) {
        throw new Error('Invalid Product ID');
    }

    const product = await Product.findById(productId).populate('category');
    if (!product || product.isDeleted || !product.isListed || (product.category && product.category.isDeleted)) {
        throw new Error('This product is currently unavailable');
    }

    let selectedVariant = null;
    let availableStock = product.stock;
    let unitPrice = product.salePrice || product.regularPrice;

    if (product.variants && product.variants.length > 0) {
        if (variantId) {
            selectedVariant = product.variants.id(variantId);
            if (!selectedVariant) {
                throw new Error('Selected product variant is invalid');
            }
        } else {
            // For quick add from shop card, select the first available variant with stock
            selectedVariant = product.variants.find(v => v.stock > 0);
            if (!selectedVariant) {
                throw new Error('This item is currently out of stock');
            }
        }
        availableStock = selectedVariant.stock;
        unitPrice = selectedVariant.price || unitPrice;
    }

    if (availableStock <= 0) {
        throw new Error('This item is currently out of stock');
    }

    let cart = await Cart.findOne({ userId });
    if (!cart) {
        cart = new Cart({ userId, items: [] });
    }

    const finalVariantId = selectedVariant ? selectedVariant._id : null;

    const existingIndex = cart.items.findIndex(item =>
        item.productId.toString() === productId.toString() &&
        (finalVariantId
            ? item.variantId && item.variantId.toString() === finalVariantId.toString()
            : !item.variantId)
    );

    let finalQty = qty;
    let message = 'Product added to cart successfully!';

    if (existingIndex > -1) {
        finalQty = cart.items[existingIndex].quantity + qty;
        if (finalQty > 10) {
            finalQty = 10;
            message = 'Cart updated! Quantity capped at the maximum limit of 10 units.';
        } else if (finalQty > availableStock) {
            finalQty = availableStock;
            message = `Cart updated! Quantity capped at maximum available stock of ${availableStock} units.`;
        } else {
            message = 'Product quantity in cart updated successfully!';
        }
        cart.items[existingIndex].quantity = finalQty;
    } else {
        if (finalQty > 10) {
            finalQty = 10;
            message = 'Product added! Quantity capped at the maximum limit of 10 units.';
        } else if (finalQty > availableStock) {
            finalQty = availableStock;
            message = `Product added! Quantity capped at maximum available stock of ${availableStock} units.`;
        }
        cart.items.push({
            productId,
            variantId: finalVariantId,
            quantity: finalQty
        });
    }

    await cart.save();

    // Wishlist Integration: auto-remove from wishlist if present
    let wishlistRemoved = false;
    const wishlist = await Wishlist.findOne({ userId });
    if (wishlist) {
        const pIndex = wishlist.products.indexOf(productId);
        if (pIndex > -1) {
            wishlist.products.splice(pIndex, 1);
            await wishlist.save();
            wishlistRemoved = true;
        }
    }

    // Retrieve updated counts
    const cartCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);
    const wishlistCount = wishlist ? wishlist.products.length : 0;

    return {
        success: true,
        message,
        cartCount,
        wishlistCount,
        wishlistRemoved
    };
};

/**
 * Update item quantity in the cart.
 */
export const updateItemQuantity = async (userId, productId, variantId, quantity) => {
    const qty = parseInt(quantity);
    if (isNaN(qty) || qty < 1) {
        throw new Error('Quantity must be at least 1');
    }
    if (qty > 10) {
        throw new Error('Quantity cannot exceed the maximum purchase limit of 10 units');
    }

    const product = await Product.findById(productId);
    if (!product || product.isDeleted || !product.isListed) {
        throw new Error('Product is no longer available');
    }

    let availableStock = product.stock;
    if (product.variants && product.variants.length > 0) {
        const varId = variantId || null;
        const variant = product.variants.id(varId);
        if (!variant) {
            throw new Error('Selected product variant is invalid');
        }
        availableStock = variant.stock;
    }

    if (qty > availableStock) {
        throw new Error(`Only ${availableStock} unit(s) are available in stock`);
    }

    const cart = await Cart.findOne({ userId });
    if (!cart) {
        throw new Error('Cart not found');
    }

    const itemIndex = cart.items.findIndex(item =>
        item.productId.toString() === productId.toString() &&
        (variantId
            ? item.variantId && item.variantId.toString() === variantId.toString()
            : !item.variantId)
    );

    if (itemIndex === -1) {
        throw new Error('Item not found in cart');
    }

    cart.items[itemIndex].quantity = qty;
    await cart.save();

    return cart;
};

/**
 * Remove an item from the cart.
 */
export const removeItemFromCart = async (userId, productId, variantId) => {
    const cart = await Cart.findOne({ userId });
    if (!cart) {
        throw new Error('Cart not found');
    }

    const initialLength = cart.items.length;
    cart.items = cart.items.filter(item => {
        const matchProduct = item.productId.toString() === productId.toString();
        const matchVariant = variantId
            ? item.variantId && item.variantId.toString() === variantId.toString()
            : !item.variantId;
        return !(matchProduct && matchVariant);
    });

    if (cart.items.length === initialLength) {
        throw new Error('Item not found in cart');
    }

    await cart.save();
    return cart;
};

/**
 * Calculate totals for populated cart items.
 */
export const calculateCartTotals = (populatedItems) => {
    let subtotal = 0; // original price sum
    let discount = 0; // product discount amount

    populatedItems.forEach(item => {
        const prod = item.productId;
        if (!prod || prod.isDeleted || !prod.isListed) return;

        let originalPrice = prod.regularPrice || 0;
        let actualPrice = prod.salePrice || prod.regularPrice || 0;

        if (prod.variants && prod.variants.length > 0 && item.variantId) {
            const variant = prod.variants.id(item.variantId);
            if (variant) {
                originalPrice = variant.price || originalPrice;
                actualPrice = variant.price || actualPrice;
            }
        }

        const qty = item.quantity;
        subtotal += originalPrice * qty;

        if (originalPrice > actualPrice) {
            discount += (originalPrice - actualPrice) * qty;
        }
    });

    const netCost = Math.max(0, subtotal - discount);

    // Configured shipping charge from process.env (defaults to 300, clamped between 0 and 5000 to prevent unrealistic charges)
    let baseShippingCharge = 300;
    const envShipping = process.env.SHIPPING_CHARGE || process.env.SHIPPING || process.env.SHIPPING_FEE;
    if (envShipping !== undefined && envShipping !== null) {
        const parsed = Number(envShipping);
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 5000) {
            baseShippingCharge = parsed;
        }
    }

    // Shipping charge is free for purchases above ₹500,000 threshold
    const shippingThreshold = 500000;
    const shippingCharge = (netCost === 0 || netCost >= shippingThreshold) ? 0 : baseShippingCharge;

    // Tax calculation: 10% VAT/tax on net cost
    const taxRate = 0.10;
    const tax = Math.round(netCost * taxRate);

    // Grand Total = Subtotal + Shipping Charge - Discounts + Tax
    const grandTotal = Math.max(0, subtotal + shippingCharge - discount + tax);

    return {
        subtotal,
        discount,
        couponDiscount: 0,
        tax,
        shippingCharge,
        grandTotal
    };
};

export default {
    getCart,
    cleanUnavailableItems,
    addItemToCart,
    updateItemQuantity,
    removeItemFromCart,
    calculateCartTotals
};
