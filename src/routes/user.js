import express from 'express';

import authRoutes from './user/auth.routes.js';
import profileRoutes from './user/profile.routes.js';
import addressRoutes from './user/address.routes.js';
import homeRoutes from './user/home.routes.js';
import shopRoutes from './user/shop.routes.js';
import cartRoutes from './user/cart.routes.js';
import wishlistRoutes from './user/wishlist.routes.js';
import otpRoutes from './user/otp.routes.js';
import securityRoutes from './user/security.routes.js';
import googleRoutes from './user/google.routes.js';
import checkoutRoutes from './user/checkout.routes.js';

const router = express.Router();

router.use('/', authRoutes);
router.use('/', homeRoutes);
router.use('/', profileRoutes);
router.use('/', addressRoutes);
router.use('/', shopRoutes);
router.use('/', cartRoutes);
router.use('/', wishlistRoutes);
router.use('/', otpRoutes);
router.use('/', securityRoutes);
router.use('/', googleRoutes);
router.use('/', checkoutRoutes);

export default router;