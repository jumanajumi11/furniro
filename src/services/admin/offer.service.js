import ProductOffer from '../../models/productOffer.js';
import CategoryOffer from '../../models/categoryOffer.js';
import Product from '../../models/product.js';
import Category from '../../models/category.js';

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

    let prodDiscount = 0;
    let catDiscount = 0;

    let prodOfferPercent = 0;
    let catOfferPercent = 0;

    if (preloaded) {
        const { productOfferMap, categoryOfferMap } = preloaded;
        const po = productOfferMap.get(pId);
        if (po) {
            if (po.discountType === 'Percentage') {
                prodDiscount = originalPrice * ((po.discountValue || 0) / 100);
                prodOfferPercent = po.discountValue || 0;
            } else if (po.discountType === 'Fixed Amount') {
                prodDiscount = po.discountValue || 0;
                prodOfferPercent = originalPrice > 0 ? Math.round((prodDiscount / originalPrice) * 100) : 0;
            } else {
                prodOfferPercent = po.offerPercentage || 0;
                prodDiscount = originalPrice * (prodOfferPercent / 100);
            }
        }
        const co = catId ? categoryOfferMap.get(catId) : null;
        if (co) {
            if (co.discountType === 'Percentage') {
                catDiscount = originalPrice * ((co.discountValue || 0) / 100);
                catOfferPercent = co.discountValue || 0;
            } else if (co.discountType === 'Fixed Amount') {
                catDiscount = co.discountValue || 0;
                catOfferPercent = originalPrice > 0 ? Math.round((catDiscount / originalPrice) * 100) : 0;
            } else {
                catOfferPercent = co.offerPercentage || 0;
                catDiscount = originalPrice * (catOfferPercent / 100);
            }
        }
    } else {
        const now = new Date();
        if (pId) {
            const po = await ProductOffer.findOne({
                product: pId,
                isActive: true,
                startDate: { $lte: now },
                expiryDate: { $gte: now }
            }).lean();
            if (po) {
                if (po.discountType === 'Percentage') {
                    prodDiscount = originalPrice * ((po.discountValue || 0) / 100);
                    prodOfferPercent = po.discountValue || 0;
                } else if (po.discountType === 'Fixed Amount') {
                    prodDiscount = po.discountValue || 0;
                    prodOfferPercent = originalPrice > 0 ? Math.round((prodDiscount / originalPrice) * 100) : 0;
                } else {
                    prodOfferPercent = po.offerPercentage || 0;
                    prodDiscount = originalPrice * (prodOfferPercent / 100);
                }
            }
        }
        if (catId) {
            const co = await CategoryOffer.findOne({
                category: catId,
                isActive: true,
                startDate: { $lte: now },
                expiryDate: { $gte: now }
            }).lean();
            if (co) {
                if (co.discountType === 'Percentage') {
                    catDiscount = originalPrice * ((co.discountValue || 0) / 100);
                    catOfferPercent = co.discountValue || 0;
                } else if (co.discountType === 'Fixed Amount') {
                    catDiscount = co.discountValue || 0;
                    catOfferPercent = originalPrice > 0 ? Math.round((catDiscount / originalPrice) * 100) : 0;
                } else {
                    catOfferPercent = co.offerPercentage || 0;
                    catDiscount = originalPrice * (catOfferPercent / 100);
                }
            }
        }
    }

    const highestDiscount = Math.max(prodDiscount, catDiscount);
    const finalPrice = Math.max(0, Math.round(originalPrice - highestDiscount));
    const discountAmount = originalPrice - finalPrice;
    const highestOfferPercent = originalPrice > 0 ? Math.round((discountAmount / originalPrice) * 100) : 0;

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
                productOfferMap.set(po.product.toString(), po);
            }
        }

        const categoryOfferMap = new Map();
        for (const co of categoryOffers) {
            if (co.category) {
                categoryOfferMap.set(co.category.toString(), co);
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

const validateProductOfferData = async (data, isEdit = false, id = null) => {
    if (!data.offerName || !data.offerName.trim()) {
        throw new Error('Offer name is required.');
    }
    if (!data.product) {
        throw new Error('Please select a product.');
    }
    if (!data.discountType || !['Percentage', 'Fixed Amount'].includes(data.discountType)) {
        throw new Error('Discount type is required.');
    }
    const val = Number(data.discountValue);
    if (isNaN(val) || val <= 0) {
        throw new Error('Discount value must be greater than 0.');
    }
    if (data.discountType === 'Percentage' && val > 90) {
        throw new Error('Percentage discount cannot exceed 90%.');
    }
    
    // Check product price for Fixed Amount product offers
    if (data.discountType === 'Fixed Amount') {
        const prod = await Product.findById(data.product);
        if (!prod) {
            throw new Error('Selected product not found.');
        }
        if (val >= prod.regularPrice) {
            throw new Error('Fixed discount cannot exceed the product price.');
        }
    }

    if (!data.startDate) {
        throw new Error('Start date is required.');
    }
    if (!data.expiryDate) {
        throw new Error('End date is required.');
    }

    const start = new Date(data.startDate);
    const end = new Date(data.expiryDate);
    
    if (end <= start) {
        throw new Error('End date must be later than the start date.');
    }

    if (!isEdit) {
        const today = new Date();
        today.setHours(0,0,0,0);
        const startDay = new Date(start);
        startDay.setHours(0,0,0,0);
        if (startDay < today) {
            throw new Error('Start date cannot be in the past.');
        }
    }

    // Do not allow duplicate active offers for the same product
    if (data.isActive !== false) {
        const query = { product: data.product, isActive: true };
        if (isEdit && id) {
            query._id = { $ne: id };
        }
        const dup = await ProductOffer.findOne(query);
        if (dup) {
            throw new Error('An active offer already exists for this product.');
        }
    }
};

const validateCategoryOfferData = async (data, isEdit = false, id = null) => {
    if (!data.offerName || !data.offerName.trim()) {
        throw new Error('Offer name is required.');
    }
    if (!data.category) {
        throw new Error('Please select a category.');
    }
    if (!data.discountType || !['Percentage', 'Fixed Amount'].includes(data.discountType)) {
        throw new Error('Discount type is required.');
    }
    const val = Number(data.discountValue);
    if (isNaN(val) || val <= 0) {
        throw new Error('Discount value must be greater than 0.');
    }
    if (data.discountType === 'Percentage' && val > 90) {
        throw new Error('Percentage discount cannot exceed 90%.');
    }

    if (!data.startDate) {
        throw new Error('Start date is required.');
    }
    if (!data.expiryDate) {
        throw new Error('End date is required.');
    }

    const start = new Date(data.startDate);
    const end = new Date(data.expiryDate);
    
    if (end <= start) {
        throw new Error('End date must be later than the start date.');
    }

    if (!isEdit) {
        const today = new Date();
        today.setHours(0,0,0,0);
        const startDay = new Date(start);
        startDay.setHours(0,0,0,0);
        if (startDay < today) {
            throw new Error('Start date cannot be in the past.');
        }
    }

    // Do not allow duplicate active offers for the same category
    if (data.isActive !== false) {
        const query = { category: data.category, isActive: true };
        if (isEdit && id) {
            query._id = { $ne: id };
        }
        const dup = await CategoryOffer.findOne(query);
        if (dup) {
            throw new Error('An active offer already exists for this category.');
        }
    }
};

export const createProductOffer = async (data) => {
    await validateProductOfferData(data, false);

    const cleanName = (data.offerName || '').trim();
    const existing = await ProductOffer.findOne({ 
        offerName: { $regex: new RegExp(`^${cleanName}$`, 'i') } 
    });
    if (existing) {
        throw new Error('Product Offer name already exists. Please choose a different name.');
    }

    // Set offerPercentage for backward compatibility
    let val = Number(data.discountValue);
    if (data.discountType === 'Percentage') {
        data.offerPercentage = val;
    } else {
        const prod = await Product.findById(data.product);
        data.offerPercentage = prod ? Math.round((val / prod.regularPrice) * 100) : 0;
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

    const combinedData = {
        offerName: data.offerName !== undefined ? data.offerName : offer.offerName,
        product: data.product !== undefined ? data.product : offer.product,
        discountType: data.discountType !== undefined ? data.discountType : offer.discountType,
        discountValue: data.discountValue !== undefined ? data.discountValue : offer.discountValue,
        startDate: data.startDate !== undefined ? data.startDate : offer.startDate,
        expiryDate: data.expiryDate !== undefined ? data.expiryDate : offer.expiryDate,
        isActive: data.isActive !== undefined ? data.isActive : offer.isActive
    };

    await validateProductOfferData(combinedData, true, id);
    
    if (data.offerName && data.offerName.trim() !== offer.offerName) {
        const cleanName = data.offerName.trim();
        const existing = await ProductOffer.findOne({ 
            offerName: { $regex: new RegExp(`^${cleanName}$`, 'i') }, 
            _id: { $ne: id } 
        });
        if (existing) {
            throw new Error('Product Offer name already exists. Please choose a different name.');
        }
    }

    // Update offerPercentage for backward compatibility
    let val = combinedData.discountValue;
    if (combinedData.discountType === 'Percentage') {
        data.offerPercentage = val;
    } else {
        const prod = await Product.findById(combinedData.product);
        data.offerPercentage = prod ? Math.round((val / prod.regularPrice) * 100) : 0;
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
    
    if (!offer.isActive) {
        // We are activating it. Check if another active offer exists.
        const dup = await ProductOffer.findOne({ product: offer.product, isActive: true, _id: { $ne: id } });
        if (dup) {
            throw new Error('An active offer already exists for this product. Deactivate it first.');
        }
    }
    
    offer.isActive = !offer.isActive;
    await offer.save();
    return offer;
};

export const createCategoryOffer = async (data) => {
    await validateCategoryOfferData(data, false);

    const cleanName = (data.offerName || '').trim();
    const existing = await CategoryOffer.findOne({ 
        offerName: { $regex: new RegExp(`^${cleanName}$`, 'i') } 
    });
    if (existing) {
        throw new Error('Category Offer name already exists. Please choose a different name.');
    }

    // Set offerPercentage for backward compatibility
    let val = Number(data.discountValue);
    if (data.discountType === 'Percentage') {
        data.offerPercentage = val;
    } else {
        data.offerPercentage = 0;
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
    
    const combinedData = {
        offerName: data.offerName !== undefined ? data.offerName : offer.offerName,
        category: data.category !== undefined ? data.category : offer.category,
        discountType: data.discountType !== undefined ? data.discountType : offer.discountType,
        discountValue: data.discountValue !== undefined ? data.discountValue : offer.discountValue,
        startDate: data.startDate !== undefined ? data.startDate : offer.startDate,
        expiryDate: data.expiryDate !== undefined ? data.expiryDate : offer.expiryDate,
        isActive: data.isActive !== undefined ? data.isActive : offer.isActive
    };

    await validateCategoryOfferData(combinedData, true, id);

    if (data.offerName && data.offerName.trim() !== offer.offerName) {
        const cleanName = data.offerName.trim();
        const existing = await CategoryOffer.findOne({ 
            offerName: { $regex: new RegExp(`^${cleanName}$`, 'i') }, 
            _id: { $ne: id } 
        });
        if (existing) {
            throw new Error('Category Offer name already exists. Please choose a different name.');
        }
    }

    // Update offerPercentage for backward compatibility
    let val = combinedData.discountValue;
    if (combinedData.discountType === 'Percentage') {
        data.offerPercentage = val;
    } else {
        data.offerPercentage = 0;
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
    
    if (!offer.isActive) {
        // We are activating it. Check if another active offer exists.
        const dup = await CategoryOffer.findOne({ category: offer.category, isActive: true, _id: { $ne: id } });
        if (dup) {
            throw new Error('An active offer already exists for this category. Deactivate it first.');
        }
    }
    
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
