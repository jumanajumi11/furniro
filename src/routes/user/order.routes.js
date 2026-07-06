import express from 'express';
import * as orderController from '../../controllers/user/order.controller.js';
import * as auth from '../../middlewares/auth.js';

const router = express.Router();

router.post('/checkout/place-order', auth.isLogin, orderController.placeOrder);
router.get('/orders', auth.isLogin, orderController.loadOrders);
router.get('/orders/:id', auth.isLogin, orderController.loadOrderDetails);
router.post('/orders/:id/cancel', auth.isLogin, orderController.cancelOrder);
router.post('/orders/:id/return', auth.isLogin, orderController.returnOrder);
router.post('/orders/:orderId/items/:itemId/cancel', auth.isLogin, orderController.cancelOrderItem);
router.post('/orders/:orderId/items/:itemId/return', auth.isLogin, orderController.returnOrderItem);
router.get('/orders/:id/invoice', auth.isLogin, orderController.loadInvoice);

export default router;
