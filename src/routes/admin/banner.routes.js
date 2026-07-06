import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import * as bannerController from '../../controllers/admin/banner.controller.js';
import * as auth from '../../middlewares/auth.js';

const router = express.Router();

// Ensure the directory exists
const uploadDir = 'public/upload/banners/';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const unique = `banner-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
        cb(null, unique + path.extname(file.originalname).toLowerCase());
    }
});

// File filter
const fileFilter = (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Only JPG, JPEG, PNG, WEBP files are allowed'), false);
    }
};

// Multer upload config (5MB limit)
const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 }
});

// Custom upload middleware to handle Multer validation errors in JSON format
const handleUpload = (req, res, next) => {
    upload.single('bannerImage')(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ success: false, message: 'Image size cannot exceed 5MB.' });
            }
            return res.status(400).json({ success: false, message: err.message });
        } else if (err) {
            return res.status(400).json({ success: false, message: err.message });
        }
        next();
    });
};

// Admin Auth and Routes mounting
router.get('/banners', auth.isAdmin, bannerController.loadBanners);
router.post('/banners', auth.isAdmin, handleUpload, bannerController.createBanner);
router.put('/banners/:id', auth.isAdmin, handleUpload, bannerController.updateBanner);
router.delete('/banners/:id', auth.isAdmin, bannerController.deleteBanner);

export default router;
