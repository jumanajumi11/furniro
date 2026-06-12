// src/services/user/shop.service.js
import mongoose from 'mongoose';
import Product  from '../../models/product.js';
import Category from '../../models/category.js';


export const getHomeProducts = async () => {
    const sofaCategories = [
        { name: 'L Shaped Sofa',   img: 'https://res.cloudinary.com/dp9odkfmd/image/upload/v1776920338/image_113_wlmvvt.png' },
        { name: '3 Seater Sofa',   img: 'https://res.cloudinary.com/dp9odkfmd/image/upload/v1776921475/image_114_kmk1ux.png' },
        { name: 'Recliner Sofa',   img: 'https://res.cloudinary.com/dp9odkfmd/image/upload/v1776921535/image_115_uu5fck.png' }
    ];

    const products = await Product.find({ isListed: true, isDeleted: false })
        .populate('category', 'name')
        .sort({ createdAt: -1 })
        .limit(9)
        .lean();

    return { products, categories: sofaCategories };
};

/**
 * Get filtered, sorted, paginated list of products for the shop page.
 */
export const getShopProducts = async (queryObj) => {
    const baseFilter = { isDeleted: false };

    // ── Search ──────────────────────────────────────────────────────
    let searchQuery = '';
    if (queryObj.search) {
        searchQuery = queryObj.search.trim();
        const re = new RegExp(searchQuery, 'i');
        baseFilter.$or = [
            { productName: re },
            { description: re }
        ];
    }

    // ── Category filter ─────────────────────────────────────────────
    // The user passes the category name string; we look up the ObjectId first
    let selectedCategory = '';
    if (queryObj.category) {
        selectedCategory = queryObj.category.trim();
        const catDoc = await Category.findOne({
            name:      { $regex: `^${selectedCategory}$`, $options: 'i' },
            isDeleted: false,
            isListed:  true
        }).lean();
        if (catDoc) {
            baseFilter.category = catDoc._id;
        } else {
            // Category is inactive, blocked or does not exist: force zero results
            baseFilter.category = new mongoose.Types.ObjectId();
        }
    }

    // ── Price range ─────────────────────────────────────────────────
    let minPrice = '';
    let maxPrice = '';
    if (queryObj.minPrice || queryObj.maxPrice) {
        baseFilter.regularPrice = {};
        if (queryObj.minPrice) {
            minPrice = queryObj.minPrice;
            baseFilter.regularPrice.$gte = Number(minPrice);
        }
        if (queryObj.maxPrice) {
            maxPrice = queryObj.maxPrice;
            baseFilter.regularPrice.$lte = Number(maxPrice);
        }
    }

    // ── Sizes filter ────────────────────────────────────────────────
    let selectedSizes = [];
    if (queryObj.sizes) {
        selectedSizes = Array.isArray(queryObj.sizes)
            ? queryObj.sizes
            : queryObj.sizes.split(',').map(s => s.trim()).filter(Boolean);
        if (selectedSizes.length > 0) {
            baseFilter['variants.size'] = { $in: selectedSizes };
        }
    }



    // ── Sorting ─────────────────────────────────────────────────────
    const sortParam = queryObj.sort || '';
    let sortOptions = {};
    if      (sortParam === 'priceLow')  sortOptions = { regularPrice:  1 };
    else if (sortParam === 'priceHigh') sortOptions = { regularPrice: -1 };
    else if (sortParam === 'aToZ')      sortOptions = { productName:   1 };
    else if (sortParam === 'zToA')      sortOptions = { productName:  -1 };
    else                                sortOptions = { createdAt:    -1 }; // newest first (default)

    // ── Pagination ──────────────────────────────────────────────────
    const limit = 6;
    const page  = Math.max(1, Number(queryObj.page) || 1);
    const skip  = (page - 1) * limit;

    const [totalProducts, products, categoryDocs, allSizes] = await Promise.all([
        Product.countDocuments(baseFilter),
        Product.find(baseFilter)
            .populate('category', 'name')
            .sort(sortOptions)
            .skip(skip)
            .limit(limit)
            .lean(),
        // Distinct category names for sidebar filter
        Category.find({ isDeleted: false, isListed: true })
            .sort({ name: 1 })
            .lean(),
        Product.distinct('variants.size', { isDeleted: false })
    ]);

    const categories  = categoryDocs.map(c => c.name);
    const totalPages  = Math.ceil(totalProducts / limit);
    const sizes       = allSizes.filter(Boolean);

    return {
        products,
        categories,
        sizes,
        currentPage: page,
        totalPages,
        totalProducts,
        searchQuery,
        selectedCategory,
        selectedSizes,
        minPrice,
        maxPrice,
        sortParam,
        limit
    };
};

export default { getHomeProducts, getShopProducts };
