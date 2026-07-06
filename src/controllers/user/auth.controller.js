import authService from '../../services/user/auth.service.js';
import otpService from '../../services/user/otp.service.js';
import bcrypt from 'bcryptjs';

export const loadSignup = (req, res) => {
    if (req.query.ref) {
        req.session.referredByCode = req.query.ref.trim();
    }
    res.render('user/signup', { error: null });
};

export const loadLogin = (req, res) => {
    if (req.session.user) {
        return res.redirect('/');
    }
    res.render('user/login', { error: null });
};

export const signup = async (req, res, next) => {
    try {
        const { name, email, password } = req.body;
        const userEmail = email.toLowerCase().trim();

        
        const otpData = await otpService.sendOtp(userEmail, 'signup');


        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password.trim(), salt);

        req.session.userTempData = {
            name,
            email: userEmail,
            password: hashedPassword, // hashed password
            otp: otpData.otp,
            otpGeneratedAt: otpData.otpGeneratedAt,
            referredByCode: req.session.referredByCode || null
        };
        req.session.otpExpiry = Date.now() + (5 * 60 * 1000);
        req.session.purpose = "signup";
        req.session.resendCount = 0;
        
        req.session.save(err => {
            if (err) {
                return res.render('user/signup', { error: "Session Error" });
            }
            res.redirect('/verify-otp');
        });
    } catch (error) {
        console.error("CRITICAL SIGNUP ERROR:", error);
        res.render('user/signup', { error: error.message || "Something went wrong on the server." });
    }
};

export const login = async (req, res, next) => {
    try {
        const { email, password } = req.body;
        const cleanEmail = email.trim().toLowerCase();

        let user;
        try {
            user = await authService.loginUser(cleanEmail, password);
        } catch (e) {
            if (e.message === 'User not found') {
                return res.render('user/login', { error: "No account found with this email address." });
            }
            if (e.message === 'Wrong password') {
                return res.render('user/login', { error: "The password is incorrect." });
            }
            console.error('Login Service Error:', e);
            return res.render('user/login', { error: "A technical error occurred. Please try again later." });
        }

        if (user.isBlocked) {
            return res.render('user/login', { error: "Your account has been blocked by the administrator." });
        }
        if (!user.isVerified && !user.googleId) {
            return res.render('user/login', { error: "Please verify your email address before logging in." });
        }

        req.session.user_id = user._id;
        req.session.user = { _id: user._id, name: user.name, email: user.email };
        req.session.save(err => {
            if (err) {
                console.error('Session Save Error:', err);
                return res.render('user/login', { error: "Failed to save session. Please try again." });
            }
            return res.redirect('/');
        });
    } catch (error) {
        console.error('Login Error:', error.message);
        return res.render('user/login', { error: "A technical error occurred. Please try again later." });
    }
};

export const logout = (req, res, next) => {
    req.logout((err) => {
        if (err) {
            console.error("Logout Error:", err);
        }
        req.session.destroy((destroyErr) => {
            if (destroyErr) {
                console.error("Session Destroy Error:", destroyErr);
            }
            res.clearCookie('user.sid');
            res.redirect('/login');
        });
    });
};

export default {
    loadSignup,
    loadLogin,
    signup,
    login,
    logout
};
