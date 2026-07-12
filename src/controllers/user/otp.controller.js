import otpService from '../../services/user/otp.service.js';
import { sendOTPEmail, sendEmailChangeNotification } from '../../utils/mail.js';
import User from '../../models/user.js';
import { logger } from '../../utils/logger.js';
import { validateEmailFormat } from '../../utils/emailValidator.js';

const handleOtpError = (error, prefix = 'Verification Error:') => {
    const expectedMessages = [
        "Invalid OTP. Please try again.",
        "OTP has expired. Please request a new OTP.",
        "Your session has expired. Please restart the verification process.",
        "OTP not found. Please request a new OTP."
    ];
    if (expectedMessages.includes(error.message)) {
        console.error(error.message);
    } else {
        console.error(prefix, error);
    }
};

export const getForgotPage = (req, res) => {
    res.render('user/forgot-password', { error: null });
};

export const forgotPassword = async (req, res, next) => {
    try {
        console.log("OTP controller called");
        const { email } = req.body;
        const cleanEmail = email.trim().toLowerCase();

        console.log("About to generate OTP");
        const otpData = await otpService.sendOtp(cleanEmail, 'forgot');
        console.log("OTP generated:", otpData.otp);

        req.session.userTempData = {
            email: cleanEmail,
            otp: otpData.otp,
            otpGeneratedAt: otpData.otpGeneratedAt
        };
        req.session.purpose = "forgot";
        req.session.resendCount = 0;

        req.session.save((err) => {
            if (err) {
                return res.status(500).json({ success: false, message: "Session Error" });
            }
            return res.json({ success: true, message: "OTP sent successfully" });
        });
    } catch (error) {
        console.error("Forgot Pass Error:", error);
        res.status(400).json({ success: false, message: error.message || "Server error. Please try again." });
    }
};

export const getOtpPage = (req, res) => {
    if (req.session.purpose === 'signup' && req.session.otpExpiry && Date.now() > req.session.otpExpiry) {
        delete req.session.userTempData;
        delete req.session.purpose;
        delete req.session.otpExpiry;
        return res.redirect('/signup');
    }

    if (!req.session.userTempData) {
        const purpose = req.session.purpose;
        if (purpose === 'signup') {
            return res.redirect('/signup');
        }
        return res.redirect('/forgot-password');
    }
    const email = req.session.userTempData.email;
    const expirationLimit = 120 * 1000; // 
    const generatedAt = req.session.userTempData.otpGeneratedAt || Date.now();
    const remainingTime = Math.max(0, Math.floor((generatedAt + expirationLimit - Date.now()) / 1000));

    res.render('user/otp', { email: email, error: null, remainingTime: remainingTime });
};

export const verifyOTP = async (req, res, next) => {
    try {
        if (req.session.purpose === 'signup' && req.session.otpExpiry && Date.now() > req.session.otpExpiry) {
            delete req.session.userTempData;
            delete req.session.purpose;
            delete req.session.otpExpiry;
            return res.status(400).json({ success: false, message: "OTP has expired. Please request a new OTP.", redirectUrl: '/signup' });
        }

        const { otp } = req.body;
        const tempData = req.session.userTempData;
        const purpose = req.session.purpose;

        const result = await otpService.verifyOtp(otp, tempData, purpose);

        if (purpose === "forgot") {
            req.session.allowReset = true;
            if (req.session.userTempData) {
                delete req.session.userTempData.otp;
                delete req.session.userTempData.otpGeneratedAt;
            }
            return res.json({ success: true, redirectUrl: result.redirectUrl });
        } else {
            req.session.user_id = result.savedUser._id;
            req.session.user = {
                _id: result.savedUser._id,
                name: result.savedUser.name,
                email: result.savedUser.email
            };
            delete req.session.userTempData;
            delete req.session.purpose;
            delete req.session.otpExpiry;

            return res.json({ success: true, redirectUrl: result.redirectUrl });
        }
    } catch (error) {
        handleOtpError(error, "Verification Error:");
        res.status(400).json({ success: false, message: error.message || "server error!" });
    }
};

export const resetPassword = (req, res) => {
    try {
        if (!req.session.allowReset) {
            return res.redirect('/forgot-password');
        }

        res.render('user/reset-password', {
            error: null
        });

    } catch (error) {
        logger.error('resetPassword catch error:', error);
        res.redirect('/forgot-password');
    }
};

export const getVerifyEmailPage = (req, res) => {
    logger.debug('Session Data at getVerifyEmailPage:', req.session.userTempData);

    if (req.session.userTempData) {
        res.render('user/otp', {
            email: req.session.userTempData.email,
            error: null,
            message: null
        });
    } else {
        logger.debug('No userTempData found in session, redirecting to signup');
        res.redirect('/signup');
    }
};

export const resendOTP = async (req, res, next) => {
    try {
        if (req.session.purpose === 'signup' && req.session.otpExpiry && Date.now() > req.session.otpExpiry) {
            delete req.session.userTempData;
            delete req.session.purpose;
            delete req.session.otpExpiry;
            return res.status(400).json({ success: false, message: "Session expired. Please request a new OTP.", redirectUrl: '/signup' });
        }

        const tempData = req.session.userTempData;
        if (!tempData || !tempData.email) {
            return res.status(400).json({ success: false, message: "Session expired. Please request a new OTP.", redirectUrl: '/signup' });
        }

        if (req.session.resendCount === undefined) {
            req.session.resendCount = 0;
        }

        if (req.session.resendCount >= 3) {
            return res.status(400).json({ success: false, message: "Maximum resend attempts reached. Please restart the process." });
        }

        console.log("OTP controller called");
        const email = tempData.email;
        // Pass isResend=true to ensure it's logged as a resent OTP in the console
        console.log("About to generate OTP");
        const otpData = await otpService.sendOtp(email, req.session.purpose || 'signup', true);
        console.log("OTP generated:", otpData.otp);

        req.session.resendCount += 1;
        req.session.userTempData.otp = otpData.otp;
        req.session.userTempData.otpGeneratedAt = otpData.otpGeneratedAt;

        // Extend signup session expiry timer upon sending new OTP
        if (req.session.purpose === 'signup') {
            req.session.otpExpiry = Date.now() + (5 * 60 * 1000);
        }

        req.session.save((err) => {
            if (err) {
                logger.error('resendOTP — Session save error:', err);
                return res.status(500).json({ success: false, message: 'Session error' });
            }
            res.json({ success: true, message: "A new OTP has been sent successfully." });
        });
    } catch (error) {
        console.error("Resend OTP Error:", error);
        res.status(400).json({ success: false, message: error.message || "Failed to resend OTP" });
    }
};

export const sendEmailUpdateOTP = async (req, res, next) => {
    try {
        console.log("OTP controller called");
        const { newEmail } = req.body;
        if (!newEmail) {
            return res.status(400).json({ success: false, message: "Email is required" });
        }

        const currentUserId = req.session.user._id;
        const isResend = !!req.session.emailUpdateData;
        console.log("About to generate OTP");
        const otpData = await otpService.sendEmailUpdateOtp(newEmail, currentUserId, isResend);
        console.log("OTP generated:", otpData.otp);

        req.session.emailUpdateData = {
            newEmail: otpData.newEmail,
            otp: otpData.otp
        };

        res.json({ success: true, message: "OTP sent to your new email." });
    } catch (error) {
        console.error("Send Email OTP Error:", error);
        res.status(400).json({ success: false, message: error.message || "Error sending OTP" });
    }
};

export const verifyEmailOtp = async (req, res, next) => {
    try {
        const { otp } = req.body;
        const sessionData = req.session.emailUpdateData;

        await otpService.verifyEmailOtp(otp, sessionData);

        req.session.emailUpdateData.isVerified = true;
        return res.json({ success: true });
    } catch (error) {
        handleOtpError(error, "Verify Email OTP Error:");
        res.status(400).json({ success: false, message: error.message || "Server error" });
    }
};

export const sendEmailOtp = async (req, res, next) => {
    try {
        console.log("OTP controller called");
        const { newEmail } = req.body;
        const currentUserId = req.session.user._id;

        const emailError = validateEmailFormat(newEmail);
        if (emailError) {
            return res.status(400).json({ success: false, message: emailError });
        }

        const currentUser = await User.findById(currentUserId);
        if (newEmail.toLowerCase().trim() === currentUser.email.toLowerCase().trim()) {
            return res.status(400).json({ success: false, message: "New email must be different from current email." });
        }

        const isResend = !!req.session.emailOtp;
        console.log("About to generate OTP");
        const otpData = await otpService.sendEmailUpdateOtp(newEmail, currentUserId, isResend);
        console.log("OTP generated:", otpData.otp);

        req.session.emailOtp = otpData.otp;
        req.session.tempEmail = otpData.newEmail;
        req.session.otpExpiry = Date.now() + 60 * 1000;
        delete req.session.emailUpdateOTP;

        const message = isResend ? "OTP has been resent successfully." : "OTP sent successfully.";
        res.json({ success: true, message });
    } catch (error) {
        console.error("Send Email OTP Error:", error);
        res.status(400).json({ success: false, message: error.message || "Failed to send OTP to email." });
    }
};

export const verifyAndSaveEmail = async (req, res, next) => {
    try {
        const { otp } = req.body;
        const sessionData = {
            newEmail: req.session.tempEmail,
            otp: req.session.emailOtp || req.session.emailUpdateOTP
        };
        const otpExpiry = req.session.otpExpiry;
        const userId = req.session.user._id;

        const currentUser = await User.findById(userId);
        const oldEmail = currentUser.email;

        await otpService.verifyAndSaveEmail(otp, sessionData, otpExpiry, userId);

        // Send email change notification to the old email
        try {
            await sendEmailChangeNotification(oldEmail, sessionData.newEmail);
        } catch (mailErr) {
            console.error("Failed to send email change notification:", mailErr);
        }

        req.session.user.email = req.session.tempEmail;
        delete req.session.emailOtp;
        delete req.session.emailUpdateOTP;
        delete req.session.tempEmail;
        delete req.session.otpExpiry;

        res.json({ success: true, message: "Email updated successfully." });
    } catch (error) {
        handleOtpError(error, "Verify and Save Email Error:");
        res.status(400).json({ success: false, message: error.message || "Server Error" });
    }
};
