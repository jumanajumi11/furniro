import express from 'express';
import * as categoryController from '../../controllers/admin/categoryController.js';
import * as auth from '../../middlewares/auth.js';
import upload from '../../config/multer.js';

const router = express.Router();


router.get('/categories', auth.isAdmin, categoryController.listCategories);


router.post('/categories', auth.isAdmin, upload.single('image'), categoryController.createCategory);


router.put('/categories/:id', auth.isAdmin, upload.single('image'), categoryController.updateCategory);


router.patch('/categories/toggle/:id', auth.isAdmin, categoryController.toggleStatus);
router.get('/categories/check-name', categoryController.checkCategoryName);

router.delete('/categories/:id', auth.isAdmin, categoryController.deleteCategory);

export default router;
