import express from 'express';
import * as cartController from '../../controllers/user/cart.controller.js';
import * as auth from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validation.js';
import { addToCartSchema, updateQuantitySchema } from '../../validators/cart.validator.js';

const router = express.Router();

// Cart Page
router.get('/cart', auth.isLogin, cartController.loadCart);

// Cart operations
router.post('/cart/add', auth.isLogin, validate(addToCartSchema), cartController.addToCart);
router.post('/cart/update', auth.isLogin, validate(updateQuantitySchema), cartController.updateQuantity);
router.post('/cart/remove', auth.isLogin, cartController.removeItem);

// Checkout pre-validation
router.get('/checkout', auth.isLogin, cartController.checkoutValidate);

export default router;
