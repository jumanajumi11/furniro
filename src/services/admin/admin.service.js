

import User from '../../models/user.js';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';

// Setup transporter
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

// ---------- Admin Auth ----------

export const loadLogin = async (req, res) => {
    try {
        if (req.session.admin) {
            return res.redirect('/admin/dashboard');
        }

        res.render('admin/login', { error: null });

    } catch (error) {
        console.log(error);
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

// ---------- Password Reset ----------

export const loadForgotPassword = async (req, res) => {
    try {

        res.render('admin/forgot-password', {
            error: null,
            message: null
        });

    } catch (error) {
        console.log(error);
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

        console.log(error);

        res.redirect('/admin/forgot-password');
    }
};
export const sendResetOTP = async (req, res) => {
    try {

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

        const otp = generateOTP();
        // Unconditional logging for debugging (will appear regardless of NODE_ENV)
        console.log('\n=================================');
        console.log('OTP GENERATED');
        console.log('Email:', email);
        console.log('OTP:', otp);
        console.log('Generated At:', new Date().toISOString());
        console.log('Expires In: 60 Seconds');
        console.log('=================================\n');

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

        transporter.sendMail(mailOptions, (err) => {

            if (err) {
                console.log(err);

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

        const email =
            req.session.adminEmail || req.session.resetEmail;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email missing in session'
            });
        }

        const otp = generateOTP();

        req.session.resetOTP = otp;
        req.session.otpExpiry = Date.now() + 60 * 1000;

        const mailOptions = {
            from: 'adminfurniro@gmail.com',
            to: email,
            subject: 'Admin Password Reset OTP',
            text: `Your new OTP is ${otp}`
        };

        transporter.sendMail(mailOptions, error => {

            if (error) {
                console.log(error);

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

// ---------- Session ----------

export const logout = async (req, res) => {
    try {

        req.session.destroy(() => {

            res.clearCookie('admin.sid');

            res.redirect('/admin/login');
        });

    } catch (error) {

        console.log(error);

        res.redirect('/admin/dashboard');
    }
};

// ---------- User Management ----------

export const getUsers = async (req, res) => {
    try {

        const search = req.query.search || '';
        const status = req.query.status || '';
        const sort = req.query.sort || 'desc';

        const page = parseInt(req.query.page) || 1;

        const limit = 10;

        let query = {
            isAdmin: false,
            isBlocked:true,
            name: { $regex: '^f', $options: 'i' },

            $or: [
                {
                    name: {
                        $regex: search,
                        $options: 'i'
                    }
                },
                {
                    email: {
                        $regex: search,
                        $options: 'i'
                    }
                }
            ]
        };

        if (status === 'active') {
            query.isBlocked = false;
        } else if (status === 'blocked') {
            query.isBlocked = true;
        }

        const users = await User.find(query)
            .sort({
                createdAt: sort === 'desc' ? -1 : 1
            })
            .skip((page - 1) * limit)
            .limit(limit);

        const totalUsers = await User.countDocuments(query);

        const totalPages = Math.ceil(totalUsers / limit);

        res.render('admin/customers-managment', {
            users,
            search,
            status,
            sort,
            currentPage: page,
            totalPages
        });

    } catch (error) {

        console.error(error);

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

        user.isBlocked = !user.isBlocked;

        await user.save();

        res.json({
            success: true,
            isBlocked: user.isBlocked
        });

    } catch (error) {

        console.error(error);

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

        user.isBlocked = !user.isBlocked;

        await user.save();

        res.json({
            success: true,
            isBlocked: user.isBlocked
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            message: 'Error updating user status'
        });
    }
};


// ---------- Dashboard ----------
export const loadDashboard = async (req, res) => {
    try {
        res.render('admin/dashboard');
    } catch (error) {
        console.error("Load Dashboard Error:", error);
        res.status(500).send("Server Error");
    }
};