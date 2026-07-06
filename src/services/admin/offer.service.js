import ProductOffer from '../../models/productOffer.js';
import CategoryOffer from '../../models/categoryOffer.js';

/**
 * Calculates the best offer percentage for a product (max of product vs category offer).
 *
 * @param {Object} product - The product document or object.
 * @param {Object} [preloaded] - Optional preloaded maps to avoid DB queries (performance).
 * @param {Map} preloaded.productOfferMap - Map of product ID -> discount percentage.
 * @param {Map} preloaded.categoryOfferMap - Map of category ID -> discount percentage.
 * @returns {Promise<Object>} An object with pricing and discount details.
 */
export const calculateBestOffer = async (product, preloaded = null) => {
    if (!product) {
        return {
            originalPrice: 0,
            offerPercentage: 0,
            discountAmount: 0,
            finalPrice: 0,
            productOffer: 0,
            categoryOffer: 0,
            effectiveOffer: 0
        };
    }

    const originalPrice = product.regularPrice || 0;
    const pId = product._id ? product._id.toString() : '';
    const catId = product.category && product.category._id 
        ? product.category._id.toString() 
        : (product.category ? product.category.toString() : '');

    let prodOfferPercent = 0;
    let catOfferPercent = 0;

    if (preloaded) {
        const { productOfferMap, categoryOfferMap } = preloaded;
        prodOfferPercent = productOfferMap.get(pId) || 0;
        catOfferPercent = catId ? (categoryOfferMap.get(catId) || 0) : 0;
    } else {
        const now = new Date();
        if (pId) {
            const po = await ProductOffer.findOne({
                product: pId,
                isActive: true,
                startDate: { $lte: now },
                expiryDate: { $gte: now }
            }).lean();
            if (po) prodOfferPercent = po.offerPercentage || 0;
        }
        if (catId) {
            const co = await CategoryOffer.findOne({
                category: catId,
                isActive: true,
                startDate: { $lte: now },
                expiryDate: { $gte: now }
            }).lean();
            if (co) catOfferPercent = co.offerPercentage || 0;
        }
    }

    const highestOfferPercent = Math.max(prodOfferPercent, catOfferPercent);
    const finalPrice = Math.round(originalPrice * (1 - highestOfferPercent / 100));
    const discountAmount = originalPrice - finalPrice;

    return {
        originalPrice,
        offerPercentage: highestOfferPercent,
        discountAmount,
        finalPrice,
        productOffer: prodOfferPercent,
        categoryOffer: catOfferPercent,
        effectiveOffer: highestOfferPercent
    };
};

/**
 * Applies active offers to a single product or array of products, updating sale prices,
 * discount details, and variant sale prices.
 *
 * @param {Object|Array} products - A single product or array of products.
 * @returns {Promise<Object|Array>} The updated products.
 */
export const applyOffers = async (products) => {
    if (!products) return products;
    const isArray = Array.isArray(products);
    const productList = isArray ? products : [products];

    try {
        const now = new Date();
        const productOffers = await ProductOffer.find({
            isActive: true,
            startDate: { $lte: now },
            expiryDate: { $gte: now }
        }).lean();

        const categoryOffers = await CategoryOffer.find({
            isActive: true,
            startDate: { $lte: now },
            expiryDate: { $gte: now }
        }).lean();

        const productOfferMap = new Map();
        for (const po of productOffers) {
            if (po.product) {
                productOfferMap.set(po.product.toString(), po.offerPercentage);
            }
        }

        const categoryOfferMap = new Map();
        for (const co of categoryOffers) {
            if (co.category) {
                categoryOfferMap.set(co.category.toString(), co.offerPercentage);
            }
        }

        const preloaded = { productOfferMap, categoryOfferMap };

        for (const p of productList) {
            if (!p) continue;
            const offerDetail = await calculateBestOffer(p, preloaded);

            const target = p._doc || p;
            target.salePrice = offerDetail.offerPercentage > 0 ? offerDetail.finalPrice : null;
            target.offerApplied = offerDetail.offerPercentage > 0;
            target.offerPercentage = offerDetail.offerPercentage;
            target.discountAmount = offerDetail.discountAmount;
            target.originalPrice = offerDetail.originalPrice;
            target.productOffer = offerDetail.productOffer;
            target.categoryOffer = offerDetail.categoryOffer;
            target.effectiveOffer = offerDetail.effectiveOffer;
            target.finalPrice = offerDetail.finalPrice;

            if (p._doc) {
                p.salePrice = target.salePrice;
                p.offerApplied = target.offerApplied;
                p.offerPercentage = target.offerPercentage;
                p.discountAmount = target.discountAmount;
                p.originalPrice = target.originalPrice;
                p.productOffer = target.productOffer;
                p.categoryOffer = target.categoryOffer;
                p.effectiveOffer = target.effectiveOffer;
                p.finalPrice = target.finalPrice;
            }

            // Dynamically calculate variant prices with discount
            if (p.variants && p.variants.length > 0) {
                for (const v of p.variants) {
                    const originalVariantPrice = v.price || 0;
                    const vTarget = v._doc || v;
                    if (offerDetail.offerPercentage > 0) {
                        vTarget.salePrice = Math.round(originalVariantPrice * (1 - offerDetail.offerPercentage / 100));
                    } else {
                        vTarget.salePrice = null;
                    }
                    if (v._doc) {
                        v.salePrice = vTarget.salePrice;
                    }
                }
            }
        }
    } catch (err) {
        console.error('Error applying offers:', err);
    }

    return isArray ? productList : productList[0];
};

export const autoDeactivateExpiredOffers = async () => {
    const now = new Date();
    await ProductOffer.updateMany(
        { expiryDate: { $lte: now }, isActive: true },
        { isActive: false }
    );
    await CategoryOffer.updateMany(
        { expiryDate: { $lte: now }, isActive: true },
        { isActive: false }
    );
};

export const createProductOffer = async (data) => {
    const existing = await ProductOffer.findOne({ offerName: data.offerName });
    if (existing) {
        throw new Error('Product Offer name already exists. Please choose a different name.');
    }
    try {
        const offer = new ProductOffer(data);
        await offer.save();
        return offer;
    } catch (error) {
        if (error.code === 11000 || error.message.includes('E11000')) {
            throw new Error('Product Offer name already exists. Please choose a different name.');
        }
        throw error;
    }
};

export const updateProductOffer = async (id, data) => {
    const offer = await ProductOffer.findById(id);
    if (!offer) throw new Error('Offer not found');
    
    if (data.offerName && data.offerName !== offer.offerName) {
        const existing = await ProductOffer.findOne({ offerName: data.offerName, _id: { $ne: id } });
        if (existing) {
            throw new Error('Product Offer name already exists. Please choose a different name.');
        }
    }
    
    try {
        Object.assign(offer, data);
        await offer.save();
        return offer;
    } catch (error) {
        if (error.code === 11000 || error.message.includes('E11000')) {
            throw new Error('Product Offer name already exists. Please choose a different name.');
        }
        throw error;
    }
};

export const deleteProductOffer = async (id) => {
    const offer = await ProductOffer.findByIdAndDelete(id);
    if (!offer) throw new Error('Offer not found');
    return offer;
};

export const toggleProductOfferStatus = async (id) => {
    const offer = await ProductOffer.findById(id);
    if (!offer) throw new Error('Offer not found');
    offer.isActive = !offer.isActive;
    await offer.save();
    return offer;
};

export const createCategoryOffer = async (data) => {
    const existing = await CategoryOffer.findOne({ offerName: data.offerName });
    if (existing) {
        throw new Error('Category Offer name already exists. Please choose a different name.');
    }
    try {
        const offer = new CategoryOffer(data);
        await offer.save();
        return offer;
    } catch (error) {
        if (error.code === 11000 || error.message.includes('E11000')) {
            throw new Error('Category Offer name already exists. Please choose a different name.');
        }
        throw error;
    }
};

export const updateCategoryOffer = async (id, data) => {
    const offer = await CategoryOffer.findById(id);
    if (!offer) throw new Error('Offer not found');
    
    if (data.offerName && data.offerName !== offer.offerName) {
        const existing = await CategoryOffer.findOne({ offerName: data.offerName, _id: { $ne: id } });
        if (existing) {
            throw new Error('Category Offer name already exists. Please choose a different name.');
        }
    }
    
    try {
        Object.assign(offer, data);
        await offer.save();
        return offer;
    } catch (error) {
        if (error.code === 11000 || error.message.includes('E11000')) {
            throw new Error('Category Offer name already exists. Please choose a different name.');
        }
        throw error;
    }
};

export const deleteCategoryOffer = async (id) => {
    const offer = await CategoryOffer.findByIdAndDelete(id);
    if (!offer) throw new Error('Offer not found');
    return offer;
};

export const toggleCategoryOfferStatus = async (id) => {
    const offer = await CategoryOffer.findById(id);
    if (!offer) throw new Error('Offer not found');
    offer.isActive = !offer.isActive;
    await offer.save();
    return offer;
};

export default {
    calculateBestOffer,
    applyOffers,
    autoDeactivateExpiredOffers,
    createProductOffer,
    updateProductOffer,
    deleteProductOffer,
    toggleProductOfferStatus,
    createCategoryOffer,
    updateCategoryOffer,
    deleteCategoryOffer,
    toggleCategoryOfferStatus
};
