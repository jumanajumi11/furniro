import express from 'express';
import * as couponController from '../../controllers/admin/coupon.controller.js';
import * as auth from '../../middlewares/auth.js';

const router = express.Router();

router.get('/coupons', auth.isAdmin, couponController.getCoupons);
router.post('/coupons/create', auth.isAdmin, couponController.createCoupon);
router.post('/coupons/:id/delete', auth.isAdmin, couponController.deleteCoupon);
router.post('/coupons/:id/edit', auth.isAdmin, couponController.updateCoupon);
router.patch('/coupons/:id/toggle', auth.isAdmin, couponController.toggleCouponStatus);

export default router;
