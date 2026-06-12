import Wishlist from '../../models/wishlist.js';
import Product from '../../models/product.js';
import mongoose from 'mongoose';

/**
 * Get user's wishlist populated with product details.
 */
export const getWishlist = async (userId) => {
    return await Wishlist.findOne({ userId }).populate({
        path: 'products',
        populate: { path: 'category' }
    });
};

/**
 * Scan and clean unavailable items in user's wishlist (deleted, unlisted, or inactive categories).
 * Returns the cleaned wishlist document.
 */
export const cleanUnavailableWishlistItems = async (userId) => {
    let wishlist = await Wishlist.findOne({ userId });
    if (!wishlist) {
        wishlist = new Wishlist({ userId, products: [] });
        await wishlist.save();
        return wishlist;
    }

    if (!wishlist.products || wishlist.products.length === 0) {
        return wishlist;
    }

    const activeProductIds = [];
    let isModified = false;

    for (const prodId of wishlist.products) {
        if (!prodId) continue;
        
        const product = await Product.findById(prodId).populate('category');
        
        // Product must exist, not be deleted, must be listed, and its category must be active & listed
        const isProductValid = product && 
                               !product.isDeleted && 
                               product.isListed && 
                               (!product.category || (!product.category.isDeleted && product.category.isListed));
        
        if (isProductValid) {
            activeProductIds.push(prodId);
        } else {
            isModified = true;
        }
    }

    if (isModified) {
        wishlist.products = activeProductIds;
        await wishlist.save();
    }

    // Populate and return
    return await Wishlist.findOne({ userId }).populate({
        path: 'products',
        populate: { path: 'category' }
    });
};

/**
 * Toggle product in user's wishlist.
 * Blocks adding deleted or unlisted products/categories.
 */
export const toggleWishlist = async (userId, productId) => {
    if (!mongoose.Types.ObjectId.isValid(productId)) {
        throw new Error('Invalid Product ID');
    }

    const product = await Product.findById(productId).populate('category');
    
    // Validate product status
    if (!product || product.isDeleted) {
        throw new Error('This product is no longer available');
    }

    let wishlist = await Wishlist.findOne({ userId });
    if (!wishlist) {
        wishlist = new Wishlist({ userId, products: [] });
    }

    const prodIndex = wishlist.products.findIndex(p => p.toString() === productId.toString());
    let added = false;

    if (prodIndex > -1) {
        // Toggle behavior: remove if exists
        wishlist.products.splice(prodIndex, 1);
    } else {
        // Toggle behavior: add if not exists, but block unlisted/blocked products
        if (!product.isListed || (product.category && (!product.category.isListed || product.category.isDeleted))) {
            throw new Error('This product is currently unavailable and cannot be added to wishlist');
        }
        wishlist.products.push(productId);
        added = true;
    }

    await wishlist.save();
    const wishlistCount = wishlist.products.length;

    return {
        success: true,
        added,
        wishlistCount
    };
};

/**
 * Remove an item from the wishlist directly.
 */
export const removeItemFromWishlist = async (userId, productId) => {
    if (!mongoose.Types.ObjectId.isValid(productId)) {
        throw new Error('Invalid Product ID');
    }
    let wishlist = await Wishlist.findOne({ userId });
    if (!wishlist) {
        return { success: true, wishlistCount: 0 };
    }

    const pIndex = wishlist.products.findIndex(p => p.toString() === productId.toString());
    if (pIndex > -1) {
        wishlist.products.splice(pIndex, 1);
        await wishlist.save();
    }

    return {
        success: true,
        wishlistCount: wishlist.products.length
    };
};

export default {
    getWishlist,
    cleanUnavailableWishlistItems,
    toggleWishlist,
    removeItemFromWishlist
};
