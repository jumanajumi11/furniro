import express from 'express';
import * as wishlistController from '../../controllers/user/wishlist.controller.js';
import * as auth from '../../middlewares/auth.js';

const router = express.Router();

// Wishlist Page
router.get('/wishlist', auth.isLogin, wishlistController.loadWishlist);

// Wishlist Operations
router.post('/wishlist/toggle', auth.isLogin, wishlistController.toggleWishlist);
router.post('/wishlist/remove', auth.isLogin, wishlistController.removeItem);
router.post('/wishlist/move-to-cart', auth.isLogin, wishlistController.moveToCart);

export default router;
