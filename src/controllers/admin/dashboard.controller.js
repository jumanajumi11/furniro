import * as dashboardService from '../../services/admin/dashboard.service.js';

export const loadDashboard = (req, res) => dashboardService.loadDashboard(req, res);
export const getDashboardChartData = (req, res) => dashboardService.getDashboardChartData(req, res);
