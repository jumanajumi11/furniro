import express from 'express';
import * as couponController from '../../controllers/user/coupon.controller.js';

const router = express.Router();

router.get('/coupons', couponController.loadCoupons);

export default router;
