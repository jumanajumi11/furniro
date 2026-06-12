import express from 'express';
import * as checkoutController from '../../controllers/user/checkout.controller.js';
import * as auth from '../../middlewares/auth.js';

const router = express.Router();

// Checkout Flow
router.get('/checkout', auth.isLogin, checkoutController.loadCheckout);
router.post('/checkout/coupon/apply', auth.isLogin, checkoutController.applyCoupon);
router.post('/checkout/coupon/remove', auth.isLogin, checkoutController.removeCoupon);
router.post('/checkout/place-order', auth.isLogin, checkoutController.placeOrder);
router.get('/checkout/success/:id', auth.isLogin, checkoutController.loadSuccess);
router.post('/checkout/address/add', auth.isLogin, checkoutController.addAddress);
router.get('/checkout/coupons', auth.isLogin, checkoutController.getAvailableCoupons);

// Orders List & Details
router.get('/orders', auth.isLogin, checkoutController.loadOrders);
router.get('/orders/:id', auth.isLogin, checkoutController.loadOrderDetails);
router.post('/orders/:id/cancel', auth.isLogin, checkoutController.cancelOrder);
router.post('/orders/:id/return', auth.isLogin, checkoutController.returnOrder);
router.post('/orders/:orderId/items/:itemId/cancel', auth.isLogin, checkoutController.cancelOrderItem);
router.get('/orders/:id/invoice', auth.isLogin, checkoutController.loadInvoice);

// Wallet & Coupons
router.get('/wallet', auth.isLogin, checkoutController.loadWallet);
router.post('/wallet/add-money', auth.isLogin, checkoutController.addMoneyToWallet);
router.get('/coupons', checkoutController.loadCoupons);
export default router;
