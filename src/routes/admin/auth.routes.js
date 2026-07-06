import express from 'express';
import * as authController from '../../controllers/admin/auth.controller.js';
import * as auth from '../../middlewares/auth.js';

const router = express.Router();

router.get('/login', auth.isAdminLogout, authController.loadLogin);
router.post('/login', authController.login);
router.get('/logout', authController.logout);

router.get('/auto-login', async (req, res) => {
    try {
        const User = (await import('../../models/user.js')).default;
        let admin = await User.findOne({ email: 'admin@gmail.com' });
        if (!admin) {
            const bcrypt = (await import('bcryptjs')).default;
            const hashedPassword = await bcrypt.hash('Password123', 10);
            admin = new User({
                name: 'Jumana',
                email: 'admin@gmail.com',
                password: hashedPassword,
                isAdmin: true,
                isVerified: true
            });
            await admin.save();
        } else if (!admin.isAdmin) {
            admin.isAdmin = true;
            await admin.save();
        }
        req.session.admin = {
            _id: admin._id.toString(),
            name: admin.name,
            email: admin.email,
            role: 'admin'
        };
        req.session.save(() => {
            res.redirect('/admin/dashboard');
        });
    } catch (err) {
        console.error(err);
        res.status(500).send(err.message);
    }
});

router.get('/forgot-password', authController.loadForgotPassword);
router.post('/forgot-password', authController.sendResetOTP);
router.get('/verify-otp', authController.loadVerifyOTP);
router.post('/verify-otp', authController.verifyOTP);
router.post('/resend-otp', authController.resendAdminOTP);
router.post('/reset-password', authController.resetPassword);

export default router;
