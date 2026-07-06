import * as couponService from '../../services/admin/coupon.service.js';
import Coupon from '../../models/coupon.js';
import { logger } from '../../utils/logger.js';

export const getCoupons = async (req, res) => {
    try {
        await couponService.autoDeactivateExpiredCoupons();

        const ITEMS_PER_PAGE = 10;
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const skip = (page - 1) * ITEMS_PER_PAGE;

        const search = (req.query.search || '').trim().toUpperCase();
        const status = req.query.status || 'All';

        const filter = {};

        if (search) {
            filter.code = { $regex: search, $options: 'i' };
        }

        const now = new Date();
        if (status === 'Active') {
            filter.isActive = true;
            filter.expiryDate = { $gt: now };
        } else if (status === 'Inactive') {
            filter.isActive = false;
            filter.expiryDate = { $gt: now };
        } else if (status === 'Expired') {
            filter.expiryDate = { $lte: now };
        }

        const coupons = await Coupon.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(ITEMS_PER_PAGE)
            .lean();

        const totalCoupons = await Coupon.countDocuments(filter);
        const totalPages = Math.ceil(totalCoupons / ITEMS_PER_PAGE);

        res.render('admin/coupons', {
            coupons,
            search,
            status,
            currentPage: page,
            totalPages,
            totalCoupons,
            activePage: 'coupons'
        });
    } catch (error) {
        console.error('[Admin Coupon] getCoupons Error:', error);
        res.status(500).send('Internal Server Error');
    }
};

export const createCoupon = async (req, res) => {
    try {
        const coupon = await couponService.create(req.body);
        logger.debug(`[Admin Coupon] Coupon Created: ${coupon.code}`);
        return res.status(200).json({ success: true, message: 'Coupon created successfully!' });
    } catch (error) {
        console.warn(`[Admin Coupon] Create Validation Failure: ${error.message}`);
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const updateCoupon = async (req, res) => {
    try {
        const couponId = req.params.id;
        const coupon = await couponService.update(couponId, req.body);
        logger.debug(`[Admin Coupon] Coupon Updated: ${coupon.code}`);
        return res.status(200).json({ success: true, message: 'Coupon updated successfully!' });
    } catch (error) {
        console.warn(`[Admin Coupon] Update Failure on ID ${req.params.id}: ${error.message}`);
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const deleteCoupon = async (req, res) => {
    try {
        const couponId = req.params.id;
        await couponService.remove(couponId);
        logger.debug(`[Admin Coupon] Coupon Deleted ID: ${couponId}`);
        return res.status(200).json({ success: true, message: 'Coupon deleted successfully!' });
    } catch (error) {
        console.error(`[Admin Coupon] Delete Failure on ID ${req.params.id}: ${error.message}`);
        return res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

export const toggleCouponStatus = async (req, res) => {
    try {
        const couponId = req.params.id;
        const coupon = await couponService.toggleStatus(couponId);
        logger.debug(`[Admin Coupon] Coupon Status Toggled: ${coupon.code} -> Active: ${coupon.isActive}`);
        return res.status(200).json({ success: true, message: `Coupon ${coupon.isActive ? 'activated' : 'deactivated'} successfully!`, isActive: coupon.isActive });
    } catch (error) {
        console.warn(`[Admin Coupon] Toggle Status Failure on ID ${req.params.id}: ${error.message}`);
        return res.status(400).json({ success: false, message: error.message });
    }
};
