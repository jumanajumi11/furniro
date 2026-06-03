import express from 'express';
import * as shopController from '../../controllers/user/shop.controller.js';
import * as auth from '../../middlewares/auth.js';
import upload from '../../config/multer.js';

const router = express.Router();

// Shop listing
router.get('/shop', auth.isLogin, shopController.loadShop);

// Product details (with logged-in user check)
router.get('/shop/product/:id', auth.isLogin, shopController.loadProductDetails);

// Reviews (verified purchaser check inside controller)
router.post('/shop/product/:id/review', auth.isLogin, upload.array('reviewImages', 5), shopController.addReview);

// Cart actions (now handled by cart.routes.js)
// router.post('/cart/add', auth.isLogin, shopController.addToCart);
router.post('/cart/buy-now', auth.isLogin, shopController.buyNow);

export default router;