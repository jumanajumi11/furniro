import mongoose from 'mongoose';
import Product  from '../../models/product.js';
import Category from '../../models/category.js';
import ProductOffer from '../../models/productOffer.js';
import CategoryOffer from '../../models/categoryOffer.js';
import { applyOffers } from './offer.service.js';


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

    await applyOffers(products);

    return { products, categories: sofaCategories };
};


export const getShopProducts = async (queryObj) => {
    const baseFilter = { isDeleted: false };

    // Brand filter
    if (queryObj.brand) {
        baseFilter.brand = new RegExp(`^${queryObj.brand.trim()}$`, 'i');
    }

    // Offers filter
    if (queryObj.offers === 'true') {
        const now = new Date();
        const [activeProductOffers, activeCategoryOffers] = await Promise.all([
            ProductOffer.find({
                isActive: true,
                startDate: { $lte: now },
                expiryDate: { $gte: now }
            }).select('product').lean(),
            CategoryOffer.find({
                isActive: true,
                startDate: { $lte: now },
                expiryDate: { $gte: now }
            }).select('category').lean()
        ]);

        const prodIds = activeProductOffers.map(o => o.product);
        const catIds = activeCategoryOffers.map(o => o.category);

        if (prodIds.length > 0 || catIds.length > 0) {
            baseFilter.$or = baseFilter.$or || [];
            baseFilter.$or.push(
                { _id: { $in: prodIds } },
                { category: { $in: catIds } }
            );
        } else {
            // Force no match if no active offers
            baseFilter._id = new mongoose.Types.ObjectId();
        }
    }

    let searchQuery = '';
    if (queryObj.search) {
        searchQuery = queryObj.search.trim();
        const re = new RegExp(searchQuery, 'i');
        baseFilter.$or = [
            { productName: re },
            { description: re }
        ];
    }

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
            baseFilter.category = new mongoose.Types.ObjectId();
        }
    }

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

    
    let selectedSizes = [];
    if (queryObj.sizes) {
        selectedSizes = Array.isArray(queryObj.sizes)
            ? queryObj.sizes
            : queryObj.sizes.split(',').map(s => s.trim()).filter(Boolean);
        if (selectedSizes.length > 0) {
            baseFilter['variants.size'] = { $in: selectedSizes };
        }
    }



    const sortParam = queryObj.sort || '';
    let sortOptions = {};
    if      (sortParam === 'priceLow')  sortOptions = { regularPrice:  1 };
    else if (sortParam === 'priceHigh') sortOptions = { regularPrice: -1 };
    else if (sortParam === 'aToZ')      sortOptions = { productName:   1 };
    else if (sortParam === 'zToA')      sortOptions = { productName:  -1 };
    else                                sortOptions = { createdAt:    -1 }; 

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
        
        Category.find({ isDeleted: false, isListed: true })
            .sort({ name: 1 })
            .lean(),
        Product.distinct('variants.size', { isDeleted: false })
    ]);

    await applyOffers(products);

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
