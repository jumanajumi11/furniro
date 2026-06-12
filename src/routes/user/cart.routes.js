import express from 'express';
import * as cartController from '../../controllers/user/cart.controller.js';
import * as auth from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validation.js';
import { addToCartSchema, updateQuantitySchema } from '../../validators/cart.validator.js';

const router = express.Router();


router.get('/cart', auth.isLogin, cartController.loadCart);


router.post('/cart/add', auth.isLogin, validate(addToCartSchema), cartController.addToCart);
router.post('/cart/update', auth.isLogin, validate(updateQuantitySchema), cartController.updateQuantity);
router.post('/cart/remove', auth.isLogin, cartController.removeItem);

export default router;
