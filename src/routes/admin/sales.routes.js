import express from 'express';
import * as salesController from '../../controllers/admin/sales.controller.js';
import * as auth from '../../middlewares/auth.js';

const router = express.Router();

// Ledger routes
router.get('/ledger', auth.isAdmin, salesController.getLedgerBook);
router.get('/ledger/generate-pdf', auth.isAdmin, salesController.generateLedgerBookPDF);

// Sales Report routes
router.get('/reports/sales', auth.isAdmin, salesController.getSalesReport);
router.get('/reports/sales/csv', auth.isAdmin, salesController.exportSalesReportCSV);
router.get('/reports/sales/print', auth.isAdmin, salesController.printSalesReport);

export default router;
