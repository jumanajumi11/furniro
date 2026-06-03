import express from 'express';
import * as otpController from '../../controllers/user/otp.controller.js';
import * as auth from '../../middlewares/auth.js';

const router = express.Router();

router.get('/forgot-password',
    auth.isLogout,
    otpController.getForgotPage
);

router.post('/forgot-password',
    otpController.forgotPassword
);

router.get('/verify-otp',
    auth.isLogout,
    otpController.getOtpPage
);

router.post('/verify-otp',
    otpController.verifyOTP
);

router.post('/resend-otp',
    otpController.resendOTP
);

router.get('/reset-password',
    auth.isLogout,
    otpController.resetPassword
);

router.post('/reset-password', 
    otpController.resetPassword
);

router.post('/send-email-otp',
    auth.isLogin,
    otpController.sendEmailOtp
);

router.post('/verify-email-otp',
    auth.isLogin,
    otpController.verifyAndSaveEmail
);

export default router;