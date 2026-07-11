
import User from '../../models/user.js';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import { logger } from '../../utils/logger.js';
import { logOtp } from '../../utils/otpLogger.js';

const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
        user: 'adminfurniro@gmail.com',
        pass: 'qmqpvkkoycscunvi'
    }
});

const generateOTP = () =>
    Math.floor(100000 + Math.random() * 900000).toString();


export const loadLogin = async (req, res) => {
    try {
        if (req.session.admin) {
            return res.redirect('/admin/dashboard');
        }

        res.render('admin/login', { error: null });

    } catch (error) {
        logger.error('[Admin] loadLogin error:', error);
    }
};

export const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        const cleanEmail = email.trim().toLowerCase();

        const admin = await User.findOne({
            email: cleanEmail,
            isAdmin: true
        });

        if (!admin) {
            return res.render('admin/login', {
                error: 'Admin access denied or email not found!'
            });
        }

        const isMatch = await bcrypt.compare(password, admin.password);

        if (isMatch) {

            req.session.admin = {
                _id: admin._id.toString(),
                name: admin.name,
                email: admin.email,
                role: 'admin'
            };

            return req.session.save(err => {

                if (err) {
                    return res.render('admin/login', {
                        error: 'Session failed!'
                    });
                }

                res.redirect('/admin/dashboard');
            });

        } else {

            return res.render('admin/login', {
                error: 'Incorrect password!'
            });
        }

    } catch (error) {

        res.render('admin/login', {
            error: 'Internal server error!'
        });
    }
};


export const loadForgotPassword = async (req, res) => {
    try {

        res.render('admin/forgot-password', {
            error: null,
            message: null
        });

    } catch (error) {
        logger.error('[Admin] loadForgotPassword error:', error);
    }
};
export const loadVerifyOTP = async (req, res) => {
    try {

        res.render('admin/verify-otp', {
            error: null,
            email: req.session.resetEmail || null,
            otpExpiry: req.session.otpExpiry || null
        });

    } catch (error) {
        logger.error('[Admin] loadVerifyOTP error:', error);
        res.redirect('/admin/forgot-password');
    }
};
export const sendResetOTP = async (req, res) => {
    try {
        console.log("OTP controller called");
        const { email } = req.body;

        const admin = await User.findOne({
            email,
            isAdmin: true
        });

        if (!admin) {
            return res.render('admin/forgot-password', {
                error: 'Admin email not found!',
                message: null
            });
        }

        console.log("About to generate OTP");
        const otp = generateOTP();
        console.log("OTP created:", otp);

        console.log("========== OTP DEBUG ==========");
        console.log("Purpose:", "Admin Forgot Password");
        console.log("Email:", email);
        console.log("OTP:", otp);
        console.log("===============================");
        
        // Log generated OTP to terminal
        logOtp({
            type: "Generated",
            purpose: "Admin Password Reset OTP",
            email: email,
            otp: otp,
            expires: "1 minute"
        });

        req.session.resetOTP = otp;
        req.session.resetEmail = email;
        req.session.adminEmail = email;
        req.session.otpExpiry = Date.now() + 60 * 1000;

        const mailOptions = {
            from: 'adminfurniro@gmail.com',
            to: email,
            subject: 'Admin Password Reset OTP',
            text: `Your OTP is ${otp}`
        };

        console.log("Sending OTP email");
        transporter.sendMail(mailOptions, (err) => {

            if (err) {
                logger.error('[Admin] sendMail error:', err);

                return res.render('admin/forgot-password', {
                    error: 'Failed to send OTP',
                    message: null
                });
            }

            res.redirect('/admin/verify-otp');
        });

    } catch (error) {

        console.error(error);

        res.render('admin/forgot-password', {
            error: 'Something went wrong!',
            message: null
        });
    }
};

export const verifyOTP = async (req, res) => {

    const { otp } = req.body;

    const sessionOTP = req.session.resetOTP;
    const expiry = req.session.otpExpiry;

    if (!expiry || Date.now() > expiry) {

        delete req.session.resetOTP;

        return res.render('admin/verify-otp', {
            error: 'OTP Expired! Please resend.',
            email: req.session.resetEmail
        });
    }

    if (otp === sessionOTP) {

        res.render('admin/reset-password', {
            error: null
        });

    } else {

        res.render('admin/verify-otp', {
            error: 'Invalid OTP!',
            email: req.session.resetEmail || null,
            otpExpiry: req.session.otpExpiry || null
        });
    }
};

export const resetPassword = async (req, res) => {
    try {

        const { password, confirmPassword } = req.body;

        const email = req.session.resetEmail;

        if (!email) {
            return res.redirect('/admin/forgot-password');
        }

        if (password !== confirmPassword) {

            return res.render('admin/reset-password', {
                error: 'Passwords do not match!',
                email
            });
        }

        const securePassword = await bcrypt.hash(password, 10);

        await User.updateOne(
            { email },
            { $set: { password: securePassword } }
        );

        delete req.session.resetOTP;
        delete req.session.resetEmail;

        res.redirect('/admin/login');

    } catch (error) {

        console.error(error);

        res.render('admin/reset-password', {
            error: 'Something went wrong!'
        });
    }
};

export const resendAdminOTP = async (req, res) => {
    try {
        console.log("OTP controller called");
        const email =
            req.session.adminEmail || req.session.resetEmail;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email missing in session'
            });
        }

        console.log("About to generate OTP");
        const otp = generateOTP();
        console.log("OTP created:", otp);

        console.log("========== OTP DEBUG ==========");
        console.log("Purpose:", "Resend Admin Forgot Password");
        console.log("Email:", email);
        console.log("OTP:", otp);
        console.log("===============================");

        // Log resent OTP to terminal
        logOtp({
            type: "Resent",
            purpose: "Resend Admin Password Reset OTP",
            email: email,
            otp: otp,
            expires: "1 minute"
        });

        req.session.resetOTP = otp;
        req.session.otpExpiry = Date.now() + 60 * 1000;

        const mailOptions = {
            from: 'adminfurniro@gmail.com',
            to: email,
            subject: 'Admin Password Reset OTP',
            text: `Your new OTP is ${otp}`
        };

        console.log("Sending OTP email");
        transporter.sendMail(mailOptions, error => {

            if (error) {
                logger.error('[Admin] resendAdminOTP sendMail error:', error);

                return res.status(500).json({
                    success: false
                });
            }

            res.json({
                success: true
            });
        });

    } catch (error) {

        res.status(500).json({
            success: false
        });
    }
};


export const logout = async (req, res) => {
    try {

        req.session.destroy(() => {

            res.clearCookie('admin.sid');

            res.redirect('/admin/login');
        });

    } catch (error) {
        logger.error('[Admin] logout error:', error);
        res.redirect('/admin/dashboard');
    }
};


export const getUsers = async (req, res) => {
    try {
        const search = req.query.search || '';
        const status = req.query.status || '';
        const sort = req.query.sort || 'desc';
        const page = parseInt(req.query.page) || 1;
        const limit = 10;

        let query = {
            isAdmin: false
        };

        if (status === 'active') {
            query.isBlocked = false;
        } else if (status === 'blocked') {
            query.isBlocked = true;
        }

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { phone: { $regex: search, $options: 'i' } }
            ];
        }

       
        let sortOption = { createdAt: -1 };
        if (sort === 'asc' || sort === 'oldest') {
            sortOption = { createdAt: 1 };
        } else if (sort === 'name_az' || sort === 'az') {
            sortOption = { name: 1 };
        } else if (sort === 'name_za' || sort === 'za') {
            sortOption = { name: -1 };
        }

       
        logger.debug('--- ADMIN CUSTOMER MANAGEMENT QUERY AUDIT ---');
        logger.debug('Final MongoDB Query:', JSON.stringify(query));
        const totalNonAdmins = await User.countDocuments({ isAdmin: false });
        logger.debug('Total non-admin users in Database:', totalNonAdmins);

        const totalUsers = await User.countDocuments(query);
        logger.debug('Total users matching filters (Displayed Count):', totalUsers);
        logger.debug('---------------------------------------------');

        const users = await User.find(query)
            .sort(sortOption)
            .skip((page - 1) * limit)
            .limit(limit);

        const totalPages = Math.ceil(totalUsers / limit);

        res.render('admin/customers-managment', {
            users,
            search,
            status,
            sort,
            currentPage: page,
            totalPages,
            totalUsers,
            totalNonAdmins,
            limit
        });

    } catch (error) {
        console.error("getUsers Error:", error);
        res.status(500).send('Server Error');
    }
};

export const toggleBlock = async (req, res) => {
    try {
        const userId = req.params.id;
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        if (user.isAdmin) {
            return res.status(403).json({
                success: false,
                message: 'Admin accounts cannot be blocked.'
            });
        }

        user.isBlocked = !user.isBlocked;
        await user.save();

        res.json({
            success: true,
            isBlocked: user.isBlocked
        });

    } catch (error) {
        console.error("toggleBlock Error:", error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

export const blockUser = async (req, res) => {
    try {
        const userId = req.params.id;
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        if (user.isAdmin) {
            return res.status(403).json({
                success: false,
                message: 'Admin accounts cannot be blocked.'
            });
        }

        user.isBlocked = !user.isBlocked;
        await user.save();

        res.json({
            success: true,
            isBlocked: user.isBlocked
        });

    } catch (error) {
        console.error("blockUser Error:", error);
        res.status(500).json({
            success: false,
            message: 'Error updating user status'
        });
    }
};
