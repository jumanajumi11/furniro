import fs from 'fs';
import path from 'path';
import Banner from '../../models/banner.js';
import Category from '../../models/category.js';
import Product from '../../models/product.js';
import ProductOffer from '../../models/productOffer.js';
import CategoryOffer from '../../models/categoryOffer.js';

// Delete file helper
const deleteFile = (filePath) => {
    if (filePath) {
        // filePath is like 'public/upload/banners/filename.png'
        const fullPath = path.join(process.cwd(), filePath);
        if (fs.existsSync(fullPath)) {
            try {
                fs.unlinkSync(fullPath);
            } catch (err) {
                console.error(`Error deleting banner file: ${fullPath}`, err);
            }
        }
    }
};

export const getBannersList = async (queryObj) => {
    const page = Math.max(1, parseInt(queryObj.page) || 1);
    const limit = 5; // paginated: 5 banners per page
    const skip = (page - 1) * limit;

    const filter = {};

    // Search by title
    if (queryObj.search) {
        filter.title = new RegExp(queryObj.search.trim(), 'i');
    }

    // Filter by status
    const now = new Date();
    if (queryObj.status) {
        if (queryObj.status === 'Active') {
            filter.status = 'Active';
            filter.startDate = { $lte: now };
            filter.endDate = { $gte: now };
        } else if (queryObj.status === 'Inactive') {
            filter.status = 'Inactive';
        } else if (queryObj.status === 'Expired') {
            filter.endDate = { $lt: now };
        }
    }

    const totalBanners = await Banner.countDocuments(filter);
    const banners = await Banner.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

    // Map a virtual status to display (Active, Inactive, Expired)
    const processedBanners = banners.map(banner => {
        let displayStatus = banner.status;
        if (banner.status === 'Active' && banner.endDate < now) {
            displayStatus = 'Expired';
        } else if (banner.status === 'Active' && banner.startDate > now) {
            displayStatus = 'Scheduled';
        }
        return {
            ...banner,
            displayStatus
        };
    });

    const totalPages = Math.ceil(totalBanners / limit);

    return {
        banners: processedBanners,
        currentPage: page,
        totalPages,
        totalBanners,
        searchQuery: queryObj.search || '',
        selectedStatus: queryObj.status || 'All'
    };
};

export const getRedirectSelectorData = async () => {
    const [categories, products, productOffers, categoryOffers, brands] = await Promise.all([
        Category.find({ isDeleted: false, isListed: true }).select('name').lean(),
        Product.find({ isDeleted: false, isListed: true }).select('productName').lean(),
        ProductOffer.find({ isActive: true }).select('offerName').lean(),
        CategoryOffer.find({ isActive: true }).select('offerName').lean(),
        Product.distinct('brand', { isDeleted: false })
    ]);

    const activeBrands = brands.filter(Boolean);

    return {
        categories,
        products,
        offers: [...productOffers, ...categoryOffers],
        brands: activeBrands
    };
};

export const createBanner = async (bannerData) => {
    const banner = new Banner(bannerData);
    await banner.save();
    return banner;
};

export const updateBanner = async (id, bannerData, newImageFilename = null) => {
    const banner = await Banner.findById(id);
    if (!banner) {
        throw new Error('Banner not found');
    }

    // If new image uploaded, update image filename and delete old file
    if (newImageFilename) {
        const oldImage = banner.image;
        bannerData.image = newImageFilename;
        
        // Delete old image
        if (oldImage) {
            deleteFile(`public/upload/banners/${oldImage}`);
        }
    }

    // Assign data
    Object.assign(banner, bannerData);
    await banner.save();
    return banner;
};

export const deleteBanner = async (id) => {
    const banner = await Banner.findById(id);
    if (!banner) {
        throw new Error('Banner not found');
    }

    // Delete local image file
    if (banner.image) {
        deleteFile(`public/upload/banners/${banner.image}`);
    }

    await Banner.findByIdAndDelete(id);
};

export const toggleStatus = async (id) => {
    const banner = await Banner.findById(id);
    if (!banner) {
        throw new Error('Banner not found');
    }

    banner.status = banner.status === 'Active' ? 'Inactive' : 'Active';
    await banner.save();
    return banner;
};

export default {
    getBannersList,
    getRedirectSelectorData,
    createBanner,
    updateBanner,
    deleteBanner,
    toggleStatus
};
