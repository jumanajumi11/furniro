import express from 'express';

import * as ordersController from '../../controllers/admin/orders.controller.js';
import * as auth             from '../../middlewares/auth.js';

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// IMPORTANT: Static routes MUST be declared BEFORE dynamic :id routes so
// Express does not treat literal path segments as :id values.
// ─────────────────────────────────────────────────────────────────────────────

// ── LIST: GET /admin/orders
//    Query params: status | sort | search | page
router.get(
    '/orders',
    auth.isAdmin,
    ordersController.loadOrders,
);

// ── AJAX STATUS UPDATE: PATCH /admin/orders/update-status   ← static, must be first
//    Body: { orderId: string, status: string }
//    Returns JSON { success, message }
router.patch(
    '/orders/update-status',
    auth.isAdmin,
    ordersController.updateOrderStatusPost,
);

// ── FULL-PAGE DETAIL VIEW: GET /admin/orders/:id
//    Renders the standalone admin/order-details.ejs page.
//    Deep-populates items.productId + userId (password excluded).
router.get(
    '/orders/:id',
    auth.isAdmin,
    ordersController.getAdminOrderDetail,
);

// ── STATUS UPDATE (by URL param): PATCH /admin/orders/:id/status
//    Body: { status: string }
//    Returns JSON { success, message, updatedStatus, orderId }
router.patch(
    '/orders/:id/status',
    auth.isAdmin,
    ordersController.updateOrderStatus,
);

// ── RETURN REQUEST DETAILS: GET /admin/orders/:id/return-request
router.get(
    '/orders/:id/return-request',
    auth.isAdmin,
    ordersController.getReturnRequestDetails,
);

// ── APPROVE RETURN REQUEST: POST /admin/orders/:id/return-request/approve
router.post(
    '/orders/:id/return-request/approve',
    auth.isAdmin,
    ordersController.approveReturnRequest,
);

// ── REJECT RETURN REQUEST: POST /admin/orders/:id/return-request/reject
router.post(
    '/orders/:id/return-request/reject',
    auth.isAdmin,
    ordersController.rejectReturnRequest,
);

export default router;
