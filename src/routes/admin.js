import express from 'express';

import * as adminController from '../controllers/admin.controller.js';
import categoryRoutes from './admin/category.routes.js';
import productRoutes  from './admin/product.routes.js';
import ordersRoutes   from './admin/orders.routes.js';
import * as auth from '../middlewares/auth.js';

const router = express.Router();

// ================= AUTH =================

router.get('/login',auth.isAdminLogout,adminController.loadLogin);

router.post('/login',adminController.login);

router.get('/logout',adminController.logout);

// ================= DASHBOARD =================

router.get('/dashboard',auth.isAdmin,adminController.loadDashboard);

// ================= FORGOT PASSWORD =================

router.get('/forgot-password',adminController.loadForgotPassword);

router.post('/forgot-password',adminController.sendResetOTP);

router.get('/verify-otp',adminController.loadVerifyOTP);

router.post('/verify-otp',adminController.verifyOTP);

router.post('/resend-otp',adminController.resendAdminOTP);

router.post('/reset-password',adminController.resetPassword);

// ================= CUSTOMERS =================

router.get('/customers',auth.isAdmin,adminController.getUsers);

router.patch('/block-user/:id',auth.isAdmin,adminController.blockUser);

router.patch( '/customers/toggle-block/:id',auth.isAdmin,adminController.toggleBlock);

// ================= CATEGORIES =================

router.use('/', categoryRoutes);

// ================= PRODUCTS =================

router.use('/', productRoutes);

// ================= ORDERS =================

router.use('/', ordersRoutes);

export default router;