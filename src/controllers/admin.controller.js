const User = require('../models/user');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true, 
    auth: {
               user: 'adminfurniro@gmail.com', 
                pass: 'qmqpvkkoycscunvi'
    }
});



const loadLogin = async (req, res) => {
    try {
        
        if (req.session.admin) {
            return res.redirect('/admin/dashboard');
        }
        res.render('admin/login', { error: null });
    } catch (error) {
        console.log(error);
    }
};


const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        
       
        const cleanEmail = email.trim().toLowerCase();

       
        const admin = await User.findOne({ email: cleanEmail });

        if (!admin) {
            return res.render('admin/login', { error: "Email not found!" });
        }

       
        if (admin.isAdmin == true || admin.isAdmin == "true") {
            
            
            const isMatch = await bcrypt.compare(password, admin.password);
            
            if (isMatch) {
               
                req.session.admin = {
                    _id: admin._id.toString(),
                    name: admin.name,
                    email: admin.email,
                    isAdmin: true
                };

              
                return req.session.save((err) => {
                    if (err) {
                        console.error("Session Save Error:", err);
                        return res.render('admin/login', { error: "Session creation failed!" });
                    }
                    res.redirect('/admin/dashboard');
                });

            } else {
                return res.render('admin/login', { error: "Incorrect password!" });
            }
        } else {
            return res.render('admin/login', { error: "Access denied! You do not have admin privileges." });
        }
    } catch (error) {
        console.error("Login Error:", error);
        res.render('admin/login', { error: "Internal server error! Please try again later." });
    }
};



const loadForgotPassword = async (req, res) => {
    try {
        res.render('admin/forgot-password', { error: null, message: null });
    } catch (error) {
        console.log(error);
    }
};


const sendResetOTP = async (req, res) => {
    try {
        const { email } = req.body;
        
        const admin = await User.findOne({ email: email, isAdmin: true });

        if (!admin) {
            return res.render('admin/forgot-password', { error: "Admin email not found!", message: null });
        }

        const otp = generateOTP();
           req.session.resetOTP = otp;
           req.session.resetEmail = email;

          req.session.otpExpiry = Date.now() + 60 * 1000;
        // Nodemailer Configuration
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: 'adminfurniro@gmail.com', 
                pass: 'qmqpvkkoycscunvi'    
            }
        });

        const mailOptions = {
            from: 'adminfurniro@gmail.com',
            to: email,
            subject: 'Admin Password Reset OTP',
            text: `Your OTP for password reset is: ${otp}. This OTP is valid for a limited time.`
        };

        transporter.sendMail(mailOptions, (err) => {
            if (err) {
                console.log("Mail Sending Error:", err);
                return res.render('admin/forgot-password', { error: "Failed to send OTP. Please try again.", message: null });
            }
            console.log("OTP sent successfully to:", email);
            res.redirect('/admin/verify-otp');
        });

    } catch (error) {
        console.error("Internal Error:", error);
        res.render('admin/forgot-password', { error: "Something went wrong!", message: null });
    }
}


const resetPassword = async (req, res) => {
    try {
        const { password, confirmPassword } = req.body;
        const email = req.session.resetEmail; 

        if (!email) {
            return res.redirect('/admin/forgot-password');
        }

        
        if (password !== confirmPassword) {
            return res.render('admin/reset-password', { 
                error: "Passwords do not match!", 
                email: email 
            });
        }

    
        const securePassword = await bcrypt.hash(password, 10);

        
        await User.updateOne(
            { email: email }, 
            { $set: { password: securePassword } }
        );

        
        delete req.session.resetOTP;
        delete req.session.resetEmail;

        
        res.redirect('/admin/login?success=Password reset successfully');

    } catch (error) {
        console.error(error);
        res.render('admin/reset-password', { error: "Something went wrong!" });
    }
};

const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString(); 
};

// verifyOTP ഫംഗ്ഷൻ
const verifyOTP = async (req, res) => {
    const { otp } = req.body;
    const sessionOTP = req.session.resetOTP;
    const expiry = req.session.otpExpiry;

   
    if (Date.now() > expiry) {
        delete req.session.resetOTP; // 
        return res.render('admin/verify-otp', { 
            error: "OTP Expired! Please resend a new one.", 
            email: req.session.resetEmail 
        });
    }

    if (otp === sessionOTP) {
        res.render('admin/reset-password', { error: null });
    } else {
        res.render('admin/verify-otp', { error: "Invalid OTP!", email: req.session.resetEmail });
    }
};

const logout = async (req, res) => {
    try {
        delete req.session.admin;
        res.redirect('/admin/login');
    } catch (error) {
        console.log(error);
    }
};
const getUsers = async (req, res) => {
    try {
        const search = req.query.search || "";
        const status = req.query.status || "";
        const sort = req.query.sort || "desc";
        const page = parseInt(req.query.page) || 1;
        const limit = 10;

        
        let query = {
            isAdmin: false, 
            $or: [
                { name: { $regex: search, $options: "i" } },
                { email: { $regex: search, $options: "i" } }
            ]
        };

        
        if (status === "active") {
            query.isBlocked = false;
        } else if (status === "blocked") {
            query.isBlocked = true;
        }

        
        const users = await User.find(query)
            .sort({ createdAt: sort === "desc" ? -1 : 1 }) //
            .skip((page - 1) * limit)
            .limit(limit);

        const totalUsers = await User.countDocuments(query);
        const totalPages = Math.ceil(totalUsers / limit);

        
        res.render("admin/customers-managment", {
            users,
            search,
            status, 
            sort,   
            currentPage: page,
            totalPages
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Server Error");
    }
};


const toggleBlock = async (req, res) => {
    try {
        const userId = req.params.id;
        
        const user = await User.findById(userId); 

        if (user) {
            user.isBlocked = !user.isBlocked; 
            await user.save();
            return res.json({ success: true }); 
        }
        res.json({ success: false, message: "User not found" });
    } catch (error) {
        res.status(500).json({ success: false });
    }
};

module.exports = {
    loadLogin,
    login,
    generateOTP,
    loadForgotPassword,
    sendResetOTP ,
    resetPassword,
    verifyOTP,
    logout,
    getUsers,
    toggleBlock
};