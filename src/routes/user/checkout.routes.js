import express from 'express';
import * as checkoutController from '../../controllers/user/checkout.controller.js';
import { addCheckoutAddress } from '../../controllers/user/address.controller.js';
import * as auth from '../../middlewares/auth.js';

const router = express.Router();

router.get('/checkout', auth.isLogin, checkoutController.loadCheckout);
router.post('/checkout/coupon/apply', auth.isLogin, checkoutController.applyCoupon);
router.post('/checkout/coupon/remove', auth.isLogin, checkoutController.removeCoupon);
router.post('/checkout/address/add', auth.isLogin, addCheckoutAddress);
router.get('/checkout/coupons', auth.isLogin, checkoutController.getAvailableCoupons);

export default router;
