import Wishlist from '../../models/wishlist.js';
import Product from '../../models/product.js';
import mongoose from 'mongoose';
import { applyOffers } from './offer.service.js';


export const getWishlist = async (userId) => {
    const wl = await Wishlist.findOne({ userId }).populate({
        path: 'products',
        populate: { path: 'category' }
    });
    if (wl && wl.products && wl.products.length > 0) {
        await applyOffers(wl.products);
    }
    return wl;
};


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

    const wl = await Wishlist.findOne({ userId }).populate({
        path: 'products',
        populate: { path: 'category' }
    });
    if (wl && wl.products && wl.products.length > 0) {
        await applyOffers(wl.products);
    }
    return wl;
};


export const toggleWishlist = async (userId, productId) => {
    if (!mongoose.Types.ObjectId.isValid(productId)) {
        throw new Error('Invalid Product ID');
    }

    const product = await Product.findById(productId).populate('category');
    
    
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
        
        wishlist.products.splice(prodIndex, 1);
    } else {
        
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
