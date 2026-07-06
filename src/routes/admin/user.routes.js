import express from 'express';
import * as userController from '../../controllers/admin/user.controller.js';
import * as auth from '../../middlewares/auth.js';

const router = express.Router();

router.get('/customers', auth.isAdmin, userController.getUsers);
router.patch('/block-user/:id', auth.isAdmin, userController.blockUser);
router.patch('/customers/toggle-block/:id', auth.isAdmin, userController.toggleBlock);

export default router;
