import securityService from '../../services/user/security.service.js';
import profileService from '../../services/user/profile.service.js';

export const loadSecurity = async (req, res, next) => {
    try {
        const userId = req.session.user ? req.session.user._id : null;
        if (!userId) {
            return res.redirect('/login');
        }

        const userData = await profileService.getUserById(userId);
        const error = req.query.error;
        const success = req.query.success;

        res.render('user/security', {
            user: userData,
            error: error,
            success: success
        });
    } catch (error) {
        console.log(error.message);
        res.status(500).send("Server Error");
    }
};

export const changePassword = async (req, res, next) => {
    try {
        const userId = req.session.user._id;
        const user = await profileService.getUserById(userId);
        if (user && user.googleId) {
            throw new Error("Password changes are not allowed for Google accounts.");
        }
        await securityService.changePassword(userId, req.body);
        res.redirect('/security?success=Password updated successfully');
    } catch (error) {
        res.redirect(`/security?error=${encodeURIComponent(error.message || 'Something went wrong')}`);
    }
};

export const createPassword = async (req, res, next) => {
    try {
        const userId = req.session.user._id;
        const user = await profileService.getUserById(userId);
        if (user && user.googleId) {
            throw new Error("Password changes are not allowed for Google accounts.");
        }
        const updatedUser = await securityService.createPassword(userId, req.body);

        req.session.user.password = updatedUser.password;
        res.redirect('/security?success=Password created successfully! You can now login using email.');
    } catch (error) {
        console.error(error);
        res.redirect(`/security?error=${encodeURIComponent(error.message || 'Something went wrong')}`);
    }
};

export const loadResetPassword = async (req, res, next) => {
    try {
        if (!req.session.allowReset) {
            console.log("Access denied to Reset Page, redirecting to forgot-password");
            return res.redirect('/forgot-password');
        }
        res.render('user/reset-password', { error: null });
    } catch (error) {
        console.log(error);
        res.redirect('/forgot-password');
    }
};

export const resetPassword = async (req, res, next) => {
    try {
        const { password } = req.body;
        const email = req.session.userTempData ? req.session.userTempData.email : null;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Session expired. Please try forgot password again."
            });
        }

        await securityService.resetPasswordByEmail(email, password);

        delete req.session.userTempData;
        delete req.session.purpose;
        delete req.session.otp;
        delete req.session.otpExpiry;
        delete req.session.allowReset;

        return res.json({ success: true, message: "Password updated successfully!" });
    } catch (error) {
        console.error("Reset Password Error:", error);
        return res.status(400).json({ success: false, message: error.message || "Internal Server Error" });
    }
};

export default {
    loadSecurity,
    changePassword,
    createPassword,
    loadResetPassword,
    resetPassword
};
