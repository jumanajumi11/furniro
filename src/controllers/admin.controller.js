
import * as adminService from '../services/admin/admin.service.js';


export const loadLogin = (req, res) => adminService.loadLogin(req, res);
export const loadDashboard = (req, res) => adminService.loadDashboard(req, res);
export const login = (req, res) => adminService.login(req, res);
export const loadForgotPassword = (req, res) => adminService.loadForgotPassword(req, res);
export const loadVerifyOTP = (req, res) =>
    adminService.loadVerifyOTP(req, res);
export const  sendResetOTP = (req, res) => adminService.sendResetOTP(req, res);
export const  resetPassword = (req, res) => adminService.resetPassword(req, res);
export const verifyOTP = (req, res) => adminService.verifyOTP(req, res);
export const resendAdminOTP = (req, res) => adminService.resendAdminOTP(req, res);
export const  verifyAdminOTP = (req, res) => adminService.verifyAdminOTP(req, res);
export const  logout = (req, res) => adminService.logout(req, res);
export const  getUsers = (req, res) => adminService.getUsers(req, res);
export const blockUser = (req, res) => adminService.blockUser(req, res);
export const  toggleBlock = (req, res) => adminService.toggleBlock(req, res);


