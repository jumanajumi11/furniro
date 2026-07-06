import express from 'express';

import authRoutes from './admin/auth.routes.js';
import dashboardRoutes from './admin/dashboard.routes.js';
import userRoutes from './admin/user.routes.js';
import categoryRoutes from './admin/category.routes.js';
import productRoutes from './admin/product.routes.js';
import orderRoutes from './admin/order.routes.js';
import couponRoutes from './admin/coupon.routes.js';
import offerRoutes from './admin/offer.routes.js';
import referralRoutes from './admin/referral.routes.js';
import salesRoutes from './admin/sales.routes.js';
import bannerRoutes from './admin/banner.routes.js';

const router = express.Router();

router.use('/', authRoutes);
router.use('/', dashboardRoutes);
router.use('/', userRoutes);
router.use('/', categoryRoutes);
router.use('/', productRoutes);
router.use('/', orderRoutes);
router.use('/', couponRoutes);
router.use('/', offerRoutes);
router.use('/', referralRoutes);
router.use('/', salesRoutes);
router.use('/', bannerRoutes);

export default router;