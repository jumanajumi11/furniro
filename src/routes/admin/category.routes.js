import express from 'express';
import * as categoryController from '../../controllers/admin/categoryController.js';
import * as auth from '../../middlewares/auth.js';
import upload from '../../config/multer.js';

const router = express.Router();

// ── List categories (search, filter, sort, paginate)
router.get('/categories', auth.isAdmin, categoryController.listCategories);

// ── Create a new category (image upload via multer)
router.post('/categories', auth.isAdmin, upload.single('image'), categoryController.createCategory);

// ── Update a category (optional new image)
router.put('/categories/:id', auth.isAdmin, upload.single('image'), categoryController.updateCategory);

// ── Toggle isListed (Hide ↔ Show) – AJAX PATCH, returns JSON
router.patch('/categories/toggle/:id', auth.isAdmin, categoryController.toggleStatus);
// ഉദാഹരണത്തിന്:
router.get('/categories/check-name', categoryController.checkCategoryName);
// ── Soft-delete a category
router.delete('/categories/:id', auth.isAdmin, categoryController.deleteCategory);

export default router;
