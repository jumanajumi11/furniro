const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');

// ലോഗിൻ റൂട്ടുകൾ
router.get('/login', adminController.loadLogin);
router.post('/login', adminController.login);
router.get('/logout', adminController.logout);

// പ്രൊട്ടക്റ്റഡ് റൂട്ട് (ഉദാഹരണത്തിന് ഡാഷ്‌ബോർഡ്)
router.get('/dashboard', (req, res) => {
    if (req.session.admin) {
        res.render('admin/dashboard');
    } else {
        res.redirect('/admin/login');
    }
});
router.get('/forgot-password', adminController.loadForgotPassword);
router.post('/forgot-password', adminController.sendResetOTP);

router.get('/verify-otp', (req, res) => {
    res.render('admin/verify-otp', { error: null });
});

router.post('/verify-otp', adminController.verifyOTP);

router.post('/reset-password', adminController.resetPassword);

// User Management Routes
router.get('/customers', (req, res) => {
    if (req.session.admin) {
        adminController.getUsers(req, res);
    } else {
        res.redirect('/admin/login');
    }
});

router.post('/customers/toggle-block/:id', (req, res) => {
    if (req.session.admin) {
        adminController.toggleBlock(req, res);
    } else {
        res.status(401).json({ success: false, message: 'Unauthorized' });
    }
});

module.exports = router;