import express from 'express';
import * as paymentController from '../../controllers/user/payment.controller.js';
import * as auth from '../../middlewares/auth.js';

const router = express.Router();

router.get('/checkout/success/:id', auth.isLogin, paymentController.loadSuccess);
router.get('/checkout/failure/:id', auth.isLogin, paymentController.loadFailure);
router.post('/checkout/verify-payment', auth.isLogin, paymentController.verifyPayment);
router.post('/checkout/retry-payment', auth.isLogin, paymentController.retryPayment);

export default router;
