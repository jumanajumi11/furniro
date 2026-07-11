import authService from '../../services/user/auth.service.js';
import otpService from '../../services/user/otp.service.js';
import bcrypt from 'bcryptjs';
import User from '../../models/user.js';

export const loadSignup = (req, res) => {
    let referredByCode = '';
    if (req.query.ref) {
        req.session.referredByCode = req.query.ref.trim();
        referredByCode = req.query.ref.trim();
    } else if (req.session.referredByCode) {
        referredByCode = req.session.referredByCode;
    }
    res.render('user/signup', {
        error: null,
        errors: {},
        formData: {
            name: '',
            email: '',
            password: '',
            confirmPassword: '',
            referralCode: referredByCode
        }
    });
};

export const loadLogin = (req, res) => {
    if (req.session.user) {
        return res.redirect('/');
    }
    res.render('user/login', { error: null });
};

export const signup = async (req, res, next) => {
    try {
        console.log("OTP controller called");
        const { name, email, password, confirmPassword, referralCode } = req.body;
        const userEmail = email.toLowerCase().trim();

        // 1. Email uniqueness check
        const existingEmail = await User.findOne({ email: userEmail });
        if (existingEmail) {
            return res.render('user/signup', {
                error: "Email is already registered.",
                errors: { email: "Email is already registered." },
                formData: req.body
            });
        }

        // 2. Referral code validation (optional)
        let referredByUser = null;
        if (referralCode && referralCode.trim() !== '') {
            const cleanRef = referralCode.trim();
            referredByUser = await User.findOne({ referralCode: cleanRef, isAdmin: false });
            if (!referredByUser) {
                return res.render('user/signup', {
                    error: "Invalid referral code.",
                    errors: { referralCode: "Invalid referral code." },
                    formData: req.body
                });
            }
            // A user cannot use their own referral code
            if (referredByUser.email === userEmail) {
                return res.render('user/signup', {
                    error: "Invalid referral code.",
                    errors: { referralCode: "Invalid referral code." },
                    formData: req.body
                });
            }
        }

        console.log("About to generate OTP");
        const otpData = await otpService.sendOtp(userEmail, 'signup');
        console.log("OTP generated:", otpData.otp);

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password.trim(), salt);

        req.session.userTempData = {
            name: name.trim(),
            email: userEmail,
            password: hashedPassword, // hashed password
            otp: otpData.otp,
            otpGeneratedAt: otpData.otpGeneratedAt,
            referredByCode: referralCode ? referralCode.trim() : null
        };
        req.session.otpExpiry = Date.now() + (5 * 60 * 1000);
        req.session.purpose = "signup";
        req.session.resendCount = 0;
        
        req.session.save(err => {
            if (err) {
                return res.render('user/signup', { 
                    error: "Session Error", 
                    errors: {}, 
                    formData: req.body 
                });
            }
            res.redirect('/verify-otp');
        });
    } catch (error) {
        console.error("CRITICAL SIGNUP ERROR:", error);
        res.render('user/signup', { 
            error: error.message || "Something went wrong on the server.",
            errors: {},
            formData: req.body
        });
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
