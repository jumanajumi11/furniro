import express from 'express';
import upload from '../../config/multer.js';
import * as profileController from '../../controllers/user/profile.controller.js';
import * as auth from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validation.js';
import { profileUpdateSchema } from '../../validators/profile.validator.js';

const router = express.Router();

router.get('/profile', auth.isLogin, profileController.loadProfile);
router.get('/profile/edit', auth.isLogin, profileController.loadEditProfile);
router.patch('/profile', auth.isLogin, upload.single('image'), validate(profileUpdateSchema), profileController.updateProfile);
router.delete('/profile/image', auth.isLogin, profileController.removeProfileImage);

export default router;
