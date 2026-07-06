import express from 'express';
import * as orderController from '../../controllers/admin/order.controller.js';
import * as auth             from '../../middlewares/auth.js';

const router = express.Router();

router.get('/orders', auth.isAdmin, orderController.loadOrders);
router.get('/returns', auth.isAdmin, orderController.getReturnRequests);
router.patch('/orders/update-status', auth.isAdmin, orderController.updateOrderStatusPost);
router.get('/orders/:id', auth.isAdmin, orderController.getAdminOrderDetail);
router.patch('/orders/:orderId/items/:itemId/status', auth.isAdmin, orderController.updateOrderItemStatus);
router.patch('/orders/:orderId/item/:itemId/cancel', auth.isAdmin, orderController.cancelOrderItem);
router.patch('/orders/:id/status', auth.isAdmin, orderController.updateOrderStatus);
router.get('/return-requests/:requestId', auth.isAdmin, orderController.getReturnRequestDetails);
router.post('/return-requests/:requestId/approve', auth.isAdmin, orderController.approveReturnRequest);
router.post('/return-requests/:requestId/reject', auth.isAdmin, orderController.rejectReturnRequest);

export default router;
