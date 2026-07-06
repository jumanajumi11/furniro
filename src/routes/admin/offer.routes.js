import express from 'express';
import * as offerController from '../../controllers/admin/offer.controller.js';
import * as auth from '../../middlewares/auth.js';

const router = express.Router();

// Product Offers
router.get('/offers/products', auth.isAdmin, offerController.getProductOffers);
router.post('/offers/products/create', auth.isAdmin, offerController.createProductOffer);
router.post('/offers/products/:id/edit', auth.isAdmin, offerController.updateProductOffer);
router.post('/offers/products/:id/delete', auth.isAdmin, offerController.deleteProductOffer);
router.patch('/offers/products/:id/toggle', auth.isAdmin, offerController.toggleProductOfferStatus);

// Category Offers
router.get('/offers/categories', auth.isAdmin, offerController.getCategoryOffers);
router.post('/offers/categories/create', auth.isAdmin, offerController.createCategoryOffer);
router.post('/offers/categories/:id/edit', auth.isAdmin, offerController.updateCategoryOffer);
router.post('/offers/categories/:id/delete', auth.isAdmin, offerController.deleteCategoryOffer);
router.patch('/offers/categories/:id/toggle', auth.isAdmin, offerController.toggleCategoryOfferStatus);

export default router;
