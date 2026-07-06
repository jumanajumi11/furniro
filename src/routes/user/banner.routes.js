import express from 'express';
import * as bannerController from '../../controllers/admin/banner.controller.js';

const router = express.Router();

router.get('/banners', bannerController.getUserBanners);

export default router;
