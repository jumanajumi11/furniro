import otpService from '../../services/user/otp.service.js';
import { sendOTPEmail } from '../../utils/mail.js';

export const getForgotPage = (req, res) => {
    res.render('user/forgot-password', { error: null });
};

export const forgotPassword = async (req, res, next) => {
    try {
        const { email } = req.body;
        const cleanEmail = email.trim().toLowerCase();

        const otpData = await otpService.sendOtp(cleanEmail, 'forgot');

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
            // SignUp flow
            req.session.user_id = result.savedUser._id;
            req.session.user = {
                _id: result.savedUser._id,
                name: result.savedUser.name,
                email: result.savedUser.email
            };
            delete req.session.userTempData;
            delete req.session.purpose;

            return res.json({ success: true, redirectUrl: result.redirectUrl });
        }
    } catch (error) {
        console.error("Verification Error:", error);
        if (error.message.includes("expired")) {
            if (req.session.userTempData) {
                delete req.session.userTempData.otp;
            }
            return res.status(400).json({
                success: false,
                message: error.message,
                isExpired: true
            });
        }
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
        console.log(error);
        res.redirect('/forgot-password');
    }
};

export const getVerifyEmailPage = (req, res) => {
    console.log("Session Data at Verify:", req.session.userTempData);

    if (req.session.userTempData) {
        res.render('user/otp', { 
            email: req.session.userTempData.email, 
            error: null,
            message: null 
        });
    } else {
        console.log("❌ No userTempData found in session, redirecting to signup");
        res.redirect('/signup');
    }
};

export const resendOTP = async (req, res, next) => {
    try {
        const tempData = req.session.userTempData;
        if (!tempData || !tempData.email) {
            return res.status(400).json({ success: false, message: "Session expired. Please request a new OTP." });
        }

        if (req.session.resendCount === undefined) {
            req.session.resendCount = 0;
        }

        if (req.session.resendCount >= 3) {
            return res.status(400).json({ success: false, message: "Maximum resend attempts reached. Please restart the process." });
        }

        const email = tempData.email;
        const otpData = await otpService.sendOtp(email, req.session.purpose || 'signup');

        req.session.resendCount += 1;
        req.session.userTempData.otp = otpData.otp;
        req.session.userTempData.otpGeneratedAt = otpData.otpGeneratedAt;

        req.session.save((err) => {
            if (err) {
                console.error("Session save error:", err);
                return res.status(500).json({ success: false, message: "Session error" });
            }
            res.json({ success: true, message: "OTP resent successfully." });
        });
    } catch (error) {
        console.error("Resend OTP Error:", error);
        res.status(400).json({ success: false, message: error.message || "Failed to resend OTP" });
    }
};

export const sendEmailUpdateOTP = async (req, res, next) => {
    try {
        const { newEmail } = req.body;
        if (!newEmail) {
            return res.status(400).json({ success: false, message: "Email is required" });
        }

        const currentUserId = req.session.user._id;
        const otpData = await otpService.sendEmailUpdateOtp(newEmail, currentUserId);

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
        res.status(400).json({ success: false, message: error.message || "Server error" });
    }
};

export const sendEmailOtp = async (req, res, next) => {
    try {
        const { newEmail } = req.body;
        const currentUserId = req.session.user._id;

        const otpData = await otpService.sendEmailUpdateOtp(newEmail, currentUserId);

        req.session.emailOtp = otpData.otp;
        req.session.tempEmail = otpData.newEmail;
        req.session.otpExpiry = Date.now() + 60 * 1000;

        res.json({ success: true, message: "OTP sent to your email." });
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

        await otpService.verifyAndSaveEmail(otp, sessionData, otpExpiry, userId);

        req.session.user.email = req.session.tempEmail;
        delete req.session.emailOtp;
        delete req.session.emailUpdateOTP;
        delete req.session.tempEmail;

        res.json({ success: true, message: "Profile Updated Successfully!" });
    } catch (error) {
        console.error(error);
        res.status(400).json({ success: false, message: error.message || "Server Error" });
    }
};
