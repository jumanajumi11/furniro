import express from 'express';
import * as dashboardController from '../../controllers/admin/dashboard.controller.js';
import * as auth from '../../middlewares/auth.js';

const router = express.Router();

router.get('/dashboard', auth.isAdmin, dashboardController.loadDashboard);
router.get('/api/dashboard-stats', auth.isAdmin, dashboardController.getDashboardChartData);

export default router;
