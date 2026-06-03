import express from 'express';
import * as authController from '../../controllers/user/auth.controller.js';
import * as auth from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validation.js';
import { signupSchema, loginSchema } from '../../validators/auth.validator.js';

const router = express.Router();

router.get('/signup', auth.isLogout, authController.loadSignup);
router.get('/login', auth.isLogout, authController.loadLogin);

router.post('/signup', auth.isLogout, validate(signupSchema), authController.signup);
router.post('/login', auth.isLogout, validate(loginSchema), authController.login);

router.get('/logout', authController.logout);

export default router;
