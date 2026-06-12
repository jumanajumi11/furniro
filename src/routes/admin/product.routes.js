import express  from 'express';
import multer   from 'multer';
import path     from 'path';
import { fileURLToPath } from 'url';
import * as productController from '../../controllers/admin/productController.js';
import * as auth from '../../middlewares/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ── Multer storage for product images ──────────────────────────────
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'public/upload/products/'),
    filename:    (req, file, cb) => {
        const unique = `prod-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
        cb(null, unique + path.extname(file.originalname).toLowerCase());
    }
});

const fileFilter = (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    allowed.includes(file.mimetype)
        ? cb(null, true)
        : cb(new Error('Only JPEG, PNG, WEBP files are allowed'), false);
};

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 2 * 1024 * 1024 } // 2 MB
});

const uploadImages = (req, res, next) => {
    upload.any()(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ success: false, message: 'Image size cannot exceed 2MB.', errors: { images: 'Image size cannot exceed 2MB.' } });
            }
            return res.status(400).json({ success: false, message: err.message, errors: { images: err.message } });
        } else if (err) {
            return res.status(400).json({ success: false, message: err.message, errors: { images: err.message } });
        }
        next();
    });
};

// ── Router ─────────────────────────────────────────────────────────
const router = express.Router();

// List / dashboard
router.get('/products',auth.isAdmin, productController.listProducts);

// Name duplicate check (must come BEFORE /:id routes)
router.get('/products/check-name',auth.isAdmin, productController.checkProductName);
router.get('/products/check-product-name',auth.isAdmin, productController.checkProductName);

// Add product page
router.get('/products/add',auth.isAdmin, productController.showAddProduct);

// Create product
router.post('/products',auth.isAdmin, uploadImages, productController.createProduct);

// Edit product page
router.get('/products/:id/edit',auth.isAdmin, productController.showEditProduct);

// Update product
router.put('/products/:id',auth.isAdmin, uploadImages, productController.updateProduct);

// Toggle  isListed  (Hide ↔ Show)
router.patch('/products/:id/toggle', auth.isAdmin, productController.toggleProductListing);

// Soft delete
router.delete('/products/:id',auth.isAdmin, productController.deleteProduct);

export default router;
