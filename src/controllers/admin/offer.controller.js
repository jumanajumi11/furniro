import * as offerService from '../../services/admin/offer.service.js';
import ProductOffer from '../../models/productOffer.js';
import CategoryOffer from '../../models/categoryOffer.js';
import Product from '../../models/product.js';
import Category from '../../models/category.js';
import { logger } from '../../utils/logger.js';

// ================= PRODUCT OFFERS =================

export const getProductOffers = async (req, res) => {
    try {
        await offerService.autoDeactivateExpiredOffers();

        const ITEMS_PER_PAGE = 10;
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const skip = (page - 1) * ITEMS_PER_PAGE;

        const search = (req.query.search || '').trim();
        const status = req.query.status || 'All';

        const filter = {};
        const now = new Date();

        if (status === 'Active') {
            filter.isActive = true;
            filter.expiryDate = { $gt: now };
            filter.startDate = { $lte: now };
        } else if (status === 'Inactive') {
            filter.isActive = false;
            filter.expiryDate = { $gt: now };
        } else if (status === 'Expired') {
            filter.expiryDate = { $lte: now };
        }

        if (search) {
            let productIds = [];
            const priceNum = Number(search);
            const productQuery = {
                $or: [
                    { productName: { $regex: search, $options: 'i' } }
                ]
            };
            if (!isNaN(priceNum)) {
                productQuery.$or.push({ regularPrice: priceNum });
            }
            const matchingProducts = await Product.find(productQuery).select('_id').lean();
            productIds = matchingProducts.map(p => p._id);

            const $or = [
                { offerName: { $regex: search, $options: 'i' } },
                { discountType: { $regex: search, $options: 'i' } }
            ];

            const searchNum = Number(search);
            if (!isNaN(searchNum)) {
                $or.push({ discountValue: searchNum });
                $or.push({ offerPercentage: searchNum });
            }

            if (productIds.length > 0) {
                $or.push({ product: { $in: productIds } });
            }

            const searchLower = search.toLowerCase();
            if (searchLower === 'active') {
                $or.push({
                    isActive: true,
                    startDate: { $lte: now },
                    expiryDate: { $gte: now }
                });
            } else if (searchLower === 'expired') {
                $or.push({
                    expiryDate: { $lte: now }
                });
            } else if (searchLower === 'inactive') {
                $or.push({
                    isActive: false,
                    expiryDate: { $gt: now }
                });
            }

            if (/^\d{4}$/.test(search)) {
                const year = parseInt(search);
                $or.push({
                    startDate: { $gte: new Date(`${year}-01-01`), $lte: new Date(`${year}-12-31T23:59:59.999`) }
                });
                $or.push({
                    expiryDate: { $gte: new Date(`${year}-01-01`), $lte: new Date(`${year}-12-31T23:59:59.999`) }
                });
            } else {
                const searchDate = new Date(search);
                if (!isNaN(searchDate.getTime())) {
                    const startOfDay = new Date(searchDate);
                    startOfDay.setHours(0, 0, 0, 0);
                    const endOfDay = new Date(searchDate);
                    endOfDay.setHours(23, 59, 59, 999);
                    $or.push({
                        startDate: { $gte: startOfDay, $lte: endOfDay }
                    });
                    $or.push({
                        expiryDate: { $gte: startOfDay, $lte: endOfDay }
                    });
                }
            }

            filter.$and = [ { $or } ];
        }

        const productOffers = await ProductOffer.find(filter)
            .populate('product', 'productName regularPrice images')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(ITEMS_PER_PAGE)
            .lean();

        const totalOffers = await ProductOffer.countDocuments(filter);
        const totalPages = Math.ceil(totalOffers / ITEMS_PER_PAGE);

        const products = await Product.find({ isDeleted: false, isListed: true })
            .select('productName regularPrice')
            .sort({ productName: 1 })
            .lean();

        res.render('admin/offers-products', {
            productOffers,
            products,
            search,
            status,
            currentPage: page,
            totalPages,
            totalOffers,
            activePage: 'offers-products'
        });
    } catch (error) {
        console.error('[Admin Offer] getProductOffers Error:', error);
        res.status(500).send('Internal Server Error');
    }
};

export const createProductOffer = async (req, res) => {
    try {
        const offer = await offerService.createProductOffer(req.body);
        logger.debug(`[Admin Offer] Product Offer Created: ${offer.offerName}`);
        return res.status(200).json({ success: true, message: 'Product offer created successfully!' });
    } catch (error) {
        console.warn(`[Admin Offer] Product Offer Create Validation Failure: ${error.message}`);
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const updateProductOffer = async (req, res) => {
    try {
        const offerId = req.params.id;
        const offer = await offerService.updateProductOffer(offerId, req.body);
        logger.debug(`[Admin Offer] Product Offer Updated: ${offer.offerName}`);
        return res.status(200).json({ success: true, message: 'Product offer updated successfully!' });
    } catch (error) {
        console.warn(`[Admin Offer] Product Offer Update Failure on ID ${req.params.id}: ${error.message}`);
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const deleteProductOffer = async (req, res) => {
    try {
        const offerId = req.params.id;
        await offerService.deleteProductOffer(offerId);
        logger.debug(`[Admin Offer] Product Offer Deleted ID: ${offerId}`);
        return res.status(200).json({ success: true, message: 'Product offer deleted successfully!' });
    } catch (error) {
        console.error(`[Admin Offer] Product Offer Delete Failure on ID ${req.params.id}: ${error.message}`);
        return res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

export const toggleProductOfferStatus = async (req, res) => {
    try {
        const offerId = req.params.id;
        const offer = await offerService.toggleProductOfferStatus(offerId);
        logger.debug(`[Admin Offer] Product Offer Status Toggled: ${offer.offerName} -> Active: ${offer.isActive}`);
        return res.status(200).json({ success: true, message: `Product offer ${offer.isActive ? 'enabled' : 'disabled'} successfully!`, isActive: offer.isActive });
    } catch (error) {
        console.warn(`[Admin Offer] Product Offer Toggle Failure on ID ${req.params.id}: ${error.message}`);
        return res.status(400).json({ success: false, message: error.message });
    }
};

// ================= CATEGORY OFFERS =================

export const getCategoryOffers = async (req, res) => {
    try {
        await offerService.autoDeactivateExpiredOffers();

        const ITEMS_PER_PAGE = 10;
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const skip = (page - 1) * ITEMS_PER_PAGE;

        const search = (req.query.search || '').trim();
        const status = req.query.status || 'All';

        const filter = {};
        const now = new Date();

        if (status === 'Active') {
            filter.isActive = true;
            filter.expiryDate = { $gt: now };
            filter.startDate = { $lte: now };
        } else if (status === 'Inactive') {
            filter.isActive = false;
            filter.expiryDate = { $gt: now };
        } else if (status === 'Expired') {
            filter.expiryDate = { $lte: now };
        }

        if (search) {
            let categoryIds = [];
            const matchingCategories = await Category.find({
                name: { $regex: search, $options: 'i' }
            }).select('_id').lean();
            categoryIds = matchingCategories.map(c => c._id);

            const $or = [
                { offerName: { $regex: search, $options: 'i' } },
                { discountType: { $regex: search, $options: 'i' } }
            ];

            const searchNum = Number(search);
            if (!isNaN(searchNum)) {
                $or.push({ discountValue: searchNum });
                $or.push({ offerPercentage: searchNum });
            }

            if (categoryIds.length > 0) {
                $or.push({ category: { $in: categoryIds } });
            }

            const searchLower = search.toLowerCase();
            if (searchLower === 'active') {
                $or.push({
                    isActive: true,
                    startDate: { $lte: now },
                    expiryDate: { $gte: now }
                });
            } else if (searchLower === 'expired') {
                $or.push({
                    expiryDate: { $lte: now }
                });
            } else if (searchLower === 'inactive') {
                $or.push({
                    isActive: false,
                    expiryDate: { $gt: now }
                });
            }

            if (/^\d{4}$/.test(search)) {
                const year = parseInt(search);
                $or.push({
                    startDate: { $gte: new Date(`${year}-01-01`), $lte: new Date(`${year}-12-31T23:59:59.999`) }
                });
                $or.push({
                    expiryDate: { $gte: new Date(`${year}-01-01`), $lte: new Date(`${year}-12-31T23:59:59.999`) }
                });
            } else {
                const searchDate = new Date(search);
                if (!isNaN(searchDate.getTime())) {
                    const startOfDay = new Date(searchDate);
                    startOfDay.setHours(0, 0, 0, 0);
                    const endOfDay = new Date(searchDate);
                    endOfDay.setHours(23, 59, 59, 999);
                    $or.push({
                        startDate: { $gte: startOfDay, $lte: endOfDay }
                    });
                    $or.push({
                        expiryDate: { $gte: startOfDay, $lte: endOfDay }
                    });
                }
            }

            filter.$and = [ { $or } ];
        }

        const categoryOffers = await CategoryOffer.find(filter)
            .populate('category', 'name')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(ITEMS_PER_PAGE)
            .lean();

        const totalOffers = await CategoryOffer.countDocuments(filter);
        const totalPages = Math.ceil(totalOffers / ITEMS_PER_PAGE);

        const categories = await Category.find({ isDeleted: false, isListed: true })
            .select('name')
            .sort({ name: 1 })
            .lean();

        res.render('admin/offers-categories', {
            categoryOffers,
            categories,
            search,
            status,
            currentPage: page,
            totalPages,
            totalOffers,
            activePage: 'offers-categories'
        });
    } catch (error) {
        console.error('[Admin Offer] getCategoryOffers Error:', error);
        res.status(500).send('Internal Server Error');
    }
};

export const createCategoryOffer = async (req, res) => {
    try {
        const offer = await offerService.createCategoryOffer(req.body);
        logger.debug(`[Admin Offer] Category Offer Created: ${offer.offerName}`);
        return res.status(200).json({ success: true, message: 'Category offer created successfully!' });
    } catch (error) {
        console.warn(`[Admin Offer] Category Offer Create Validation Failure: ${error.message}`);
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const updateCategoryOffer = async (req, res) => {
    try {
        const offerId = req.params.id;
        const offer = await offerService.updateCategoryOffer(offerId, req.body);
        logger.debug(`[Admin Offer] Category Offer Updated: ${offer.offerName}`);
        return res.status(200).json({ success: true, message: 'Category offer updated successfully!' });
    } catch (error) {
        console.warn(`[Admin Offer] Category Offer Update Failure on ID ${req.params.id}: ${error.message}`);
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const deleteCategoryOffer = async (req, res) => {
    try {
        const offerId = req.params.id;
        await offerService.deleteCategoryOffer(offerId);
        logger.debug(`[Admin Offer] Category Offer Deleted ID: ${offerId}`);
        return res.status(200).json({ success: true, message: 'Category offer deleted successfully!' });
    } catch (error) {
        console.error(`[Admin Offer] Category Offer Delete Failure on ID ${req.params.id}: ${error.message}`);
        return res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

export const toggleCategoryOfferStatus = async (req, res) => {
    try {
        const offerId = req.params.id;
        const offer = await offerService.toggleCategoryOfferStatus(offerId);
        logger.debug(`[Admin Offer] Category Offer Status Toggled: ${offer.offerName} -> Active: ${offer.isActive}`);
        return res.status(200).json({ success: true, message: `Category offer ${offer.isActive ? 'enabled' : 'disabled'} successfully!`, isActive: offer.isActive });
    } catch (error) {
        console.warn(`[Admin Offer] Category Offer Toggle Failure on ID ${req.params.id}: ${error.message}`);
        return res.status(400).json({ success: false, message: error.message });
    }
};
