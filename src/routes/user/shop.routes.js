import express from 'express';
import * as shopController from '../../controllers/user/shop.controller.js';
import * as auth from '../../middlewares/auth.js';
import upload from '../../config/multer.js';

const router = express.Router();


router.get('/shop', auth.isLogin, shopController.loadShop);

router.get('/shop/product/:id', auth.isLogin, shopController.loadProductDetails);


router.post('/shop/product/:id/review', auth.isLogin, upload.array('reviewImages', 5), shopController.addReview);


router.post('/cart/buy-now', auth.isLogin, shopController.buyNow);

export default router;