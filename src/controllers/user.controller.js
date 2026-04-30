const User = require('../models/user');
const bcrypt = require('bcryptjs'); 
const userService = require('../services/user.service');
const sendOTP = require('../utils/otp');
const generateOTP = require('../utils/generateOTP');
const { sendOTPEmail } = require('../utils/mail');
const nodemailer = require('nodemailer');
// ================= SIGNUP =================

const signup = async (req, res) => {
    try {
        const { name, email, password, confirmPassword } = req.body;

        
        if (!name || !email || !password || !confirmPassword) {
            return res.render('user/signup', { error: "All fields are required!" });
        }

        
     if (password !== confirmPassword) {
            return res.render('user/signup', { error: "Passwords do not match!" });
        }

        const userEmail = email.toLowerCase().trim();

        
        const existingUser = await User.findOne({ email: userEmail });
        if (existingUser) {
            return res.render('user/signup', { error: "User already exists with this email!" });
        }

        
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password.trim(), salt);

        
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        console.log("Generated OTP:", otp);

        
        
req.session.userTempData = { 
    name, 
    email: userEmail, 
    password: hashedPassword, 
    otp: otp 
};

        
        try {
            await sendOTPEmail(userEmail, otp); 
            console.log("Email sent to:", userEmail);
        } catch (mailError) {
            console.error("Mail Sending Error:", mailError);
            return res.render('user/signup', { error: "Failed to send OTP. Please try again." });
        }
        req.session.userEmail = email; 

        
req.session.userTempData = { name, email: userEmail, password: hashedPassword, otp };
req.session.purpose = "signup";

req.session.save((err) => {
    if (err) {
        console.error("Session Save Error:", err);
        return res.render('user/signup', { error: "Session Error" });
    }
    console.log("Signup Session ID:", req.sessionID);
    console.log("✅ Session saved and redirecting...");
    res.redirect('/verify-email'); 
});

    } catch (error) {
        console.error("CRITICAL SIGNUP ERROR:", error);
        res.render('user/signup', { error: "Something went wrong on the server." });
    }
};
    
// ================= LOGIN =================
const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        
       
        const user = await userService.loginUser(email, password);

        if (!user) {
            return res.render("user/login", { error: "Invalid email or password" });
        }

       
        if (!user.isVerified && !user.googleId) {
            return res.render("user/login", { error: "Please verify your email first" });
        }

        
        req.session.user = user; 
        req.session.save((err) => {
            if (err) {
                console.log("Session Save Error:", err);
                return res.render("user/login", { error: "Session error, try again." });
            }
            console.log("Login successful, session saved for:", user.email);
            return res.redirect('/');
        });

    } catch (error) {
        console.error("Login Error:", error.message);
        return res.render("user/login", { error: error.message });
    }
};

// ================= GOOGLE CALLBACK =================
const googleCallback = (req, res) => {
    try {
        if (!req.user) return res.redirect('/login');
        req.session.user = req.user;
        return res.redirect('/');
    } catch (error) {
        return res.redirect('/login');
    }
    const newUser = new User({
    name: profile.displayName,
    email: profile.emails[0].value,
    googleId: profile.id,
    isVerified: true, // 
    // ...
});
};

// ================= FORGOT PASSWORD =================
const getForgotPage = (req, res) => {
    res.render('user/forgot-password', { error: null });
};

const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email: email });

        if (!user) {
            
            return res.status(404).json({ success: false, message: "ഈ ഇമെയിലിൽ യൂസർ ഇല്ല!" });
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        
        
        req.session.userTempData = { email: email, otp: otp }; 
        req.session.purpose = "forgot"; 

        
        await sendOTPEmail(email, otp);

        req.session.save((err) => {
            if (err) {
                return res.status(500).json({ success: false, message: "Session Error" });
            }
            
            return res.json({ success: true, message: "OTP sent successfully" });
        });

    } catch (error) {
        console.error("Forgot Pass Error:", error);
        res.status(500).json({ success: false, message: "Server error. Please try again." });
    }
};
const verifyForgotOTP = async (req, res) => {
    try {
        const { otp } = req.body;
        const tempData = req.session.forgotPasswordTemp;

        if (!tempData) {
            return res.status(400).json({ success: false, message: "Session expired." });
        }

        if (otp == tempData.otp) {
            
            req.session.allowReset = true;

            
            return res.json({ success: true, redirectUrl: '/reset-password' });
        } else {
            return res.status(400).json({ success: false, message: "Invalid OTP" });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: "Server error" });
    }
};
// ================= OTP VERIFICATION =================
const getOtpPage = (req, res) => {
    
    res.render('user/otp', { error: null }); 
};


const sendEmailUpdateOTP = async (req, res) => {
    const { newEmail } = req.body;
    
    
    const existingUser = await User.findOne({ email: newEmail });
    if (existingUser) return res.json({ success: false, message: "Email already taken!" });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    req.session.emailUpdateOTP = otp; 
    req.session.tempEmail = newEmail;

    
    await sendMail(newEmail, "Verify Email Change", `Your OTP is ${otp}`);
    
    res.json({ success: true });
};
const loadVerifyPage = (req, res) => {
    console.log("Verify Page Session Check:", req.session.userTempData); 
    if (!req.session.userTempData) {
        return res.redirect('/signup');
    }
    res.render('user/otp', { email: req.session.userTempData.email });
};

const verifyOTP = async (req, res) => {
    try {
        const { otp } = req.body;
        const tempData = req.session.userTempData;
        const purpose = req.session.purpose;

        console.log("Current Purpose in Session:", purpose); 

        if (!tempData) {
            return res.status(400).json({ success: false, message: "Session expired" });
        }

        if (otp == tempData.otp) {
            
            if (purpose === "forgot") {
                req.session.allowReset = true; 
                console.log("Redirecting to Reset Password...");
                return res.json({ success: true, redirectUrl: '/reset-password' });
            } 
            
            
            else {
                const newUser = new User({
                    name: tempData.name,
                    email: tempData.email,
                    password: tempData.password,
                    isVerified: true
                });
                await newUser.save();
                req.session.user = newUser._id; 
                console.log("Redirecting to Home...");
                return res.json({ success: true, redirectUrl: '/' }); 
            }
        } else {
            return res.status(400).json({ success: false, message: "Invalid OTP" });
        }
    } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};


// Function to send OTP to the new email
const sendEmailOtp = async (req, res) => {
    try {
        const { newEmail } = req.body;
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        
        req.session.emailOtp = otp;
        req.session.tempEmail = newEmail;

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: "furniro75@gmail.com", 
                pass: "kcokeejbghngqnre" 
            }
        });

        const mailOptions = {
            from: "furniro75@gmail.com", // Changed this to match your auth user
            to: newEmail,
            subject: 'Email Verification OTP',
            text: `Your OTP for updating email is: ${otp}. This code will expire soon.`
        };

        await transporter.sendMail(mailOptions);
        
        console.log(`OTP sent to ${newEmail}: ${otp}`);
        res.json({ success: true, message: "OTP sent to your email." });

    } catch (error) {
        // This will show you exactly why it failed in your VS Code terminal
        console.error("Nodemailer Error Details:", error); 
        res.status(500).json({ success: false, message: "Failed to send OTP to email." });
    }
};
  

const verifyEmailOtp = async (req, res) => {
    try {
        const { otp } = req.body;
        
        
        if (otp === req.session.emailOtp) {
            
            req.session.emailOtp = null; 
            return res.json({ success: true, message: "Email verified!", redirectUrl: "/home" });
        } else {
            return res.status(400).json({ success: false, message: "Invalid OTP. Please try again." });
        }
    } catch (error) {
        console.error("Verify OTP Error:", error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};
// Example logic for Resend OTP
const resendOTP = async (req, res) => {
    try {
        const email = req.session.userEmail; 
        if (!email) {
            return res.json({ success: false, message: "Session expired. Please try again." });
        }

        
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        
        
        req.session.user = otp;

        
        await sendOTPEmail(email, otp); 

        console.log("Resent OTP:", otp);
        res.json({ success: true, message: "OTP has been resent to your email." });

    } catch (error) {
        console.error(error);
        res.json({ success: false, message: "Internal server error" });
    }
};
// ================= RESET PASSWORD =================
const getResetPage = (req, res) => {
    
   
    res.render('user/reset-password', { error: null });
};


//     try {
//         const { password } = req.body;
//         const email = req.session.email;

//         if (!email) return res.redirect('/forgot-password');

//         await userService.updatePassword(email, password);
//         req.session.otp = null;
//         req.session.email = null;

//         return res.redirect('/login');
//     } catch (error) {
//         return res.render('reset-password', { error: "Reset failed" });
//     }
// };
// const resetPassword = async (req, res) => {
//     try {
//         const { otp, password, confirmPassword } = req.body;
//         const sessionOtp = req.session.otp;
//         const email = req.session.email;

//         // 1. പാസ്‌വേഡുകൾ മാച്ച് ആകുന്നുണ്ടോ എന്ന് നോക്കുക
//         if (password !== confirmPassword) {
//             return res.json({ success: false, message: "Passwords do not match!" });
//         }

//         // 2. ഒടിപി ശരിയാണോ എന്ന് നോക്കുക
//         if (!otp || otp != sessionOtp) {
//             return res.json({ success: false, message: "Invalid or expired OTP!" });
//         }

//         // 3. പാസ്‌വേഡ് ഹാഷ് ചെയ്ത് ഡാറ്റാബേസിൽ അപ്‌ഡേറ്റ് ചെയ്യുക
//         const hashedPassword = await bcrypt.hash(password, 10);
//         await User.findOneAndUpdate({ email: email }, { password: hashedPassword });

//         // സെഷൻ ക്ലിയർ ചെയ്യുക
//         req.session.otp = null;

//         return res.json({ success: true, message: "Password reset successful!" });

//     } catch (error) {
//         console.error(error);
//         return res.json({ success: false, message: "Server error during reset." });
//     }
// };
// user.controller.js

// const resetPassword = async (req, res) => {
//     try {
//         // ഇ.ജെ.എസ് ഫോമിൽ നിന്നുള്ള ഡാറ്റ എടുക്കുന്നു
//         const { otp, password, confirmPassword } = req.body;
        
//         // സെഷനിൽ നമ്മൾ നേരത്തെ സേവ് ചെയ്ത OTP-യും ഇമെയിലും എടുക്കുന്നു
//         const sessionOtp = req.session.otp;
//         const email = req.session.email;

//         console.log("Reset Attempt for:", email);

//         // വാലിഡേഷൻ
//         if (password !== confirmPassword) {
//             return res.status(400).json({ success: false, message: "Passwords do not match!" });
//         }

//         if (!sessionOtp || otp != sessionOtp) {
//             return res.status(400).json({ success: false, message: "Invalid or expired OTP!" });
//         }

//         // പാസ്‌വേഡ് ഹാഷ് ചെയ്യുക (bcrypt ഇൻസ്റ്റാൾ ചെയ്തിട്ടുണ്ടെന്ന് ഉറപ്പുവരുത്തുക)
//         const hashedPassword = await bcrypt.hash(password, 10);

//         // ഡാറ്റാബേസിൽ പാസ്‌വേഡ് അപ്‌ഡേറ്റ് ചെയ്യുന്നു
//         const user = await User.findOneAndUpdate(
//             { email: email }, 
//             { password: hashedPassword }
//         );

//         if (!user) {
//             return res.status(404).json({ success: false, message: "User not found!" });
//         }

//         // സെഷൻ ക്ലിയർ ചെയ്യുന്നു
//         req.session.otp = null;

//         return res.status(200).json({ success: true, message: "Password updated successfully!" });

//     } catch (error) {
//         console.error("Reset Password Error:", error);
//         return res.status(500).json({ success: false, message: "Server error" });
//     }
// };

// // ഇത് മറക്കരുത്
// module.exports = {
//     // ... മറ്റ് ഫംഗ്ഷനുകൾ
//     resetPassword,
//     // ...
// };
// console.log("Session Data:", req.session);
// console.log("Email from Session:", req.session.email);
// താഴെ പറയുന്ന വരികൾ Line 988-ന് ശേഷം പകരം ചേർക്കുക
const loadResetPasswordPage = (req, res) => {
    if (!req.session.allowReset) {
        return res.redirect('/forgot-password');
    }
    res.render('user/reset-password');
};
const loadResetPassword = async (req, res) => {
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

const resetPassword = async (req, res) => {
    try {
        const { password, confirmPassword } = req.body;
        
        
        const email = req.session.userTempData ? req.session.userTempData.email : null;

        if (!email) {
            return res.status(400).json({ success: false, message: "Session expired. Please try forgot password again." });
        }

        if (password !== confirmPassword) {
            return res.status(400).json({ success: false, message: "Passwords do not match!" });
        }

        
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        
        const updatedUser = await User.findOneAndUpdate(
            { email: email }, 
            { password: hashedPassword },
            { new: true }
        );

        if (!updatedUser) {
            return res.status(404).json({ success: false, message: "User not found." });
        }

        
        delete req.session.userTempData;
        delete req.session.purpose;
        delete req.session.allowReset;

        
        return res.json({ success: true, message: "Password updated successfully!" });

    } catch (error) {
        console.error("Reset Password Error:", error);
        return res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};
const loadHome = async (req, res) => {
    try {
        
        res.render('home'); 
    } catch (error) {
        console.log(error);
    }
};


const verifyAndSaveEmail = async (req, res) => {
    try {
        const { otp } = req.body;
        
        if (otp === req.session.emailUpdateOTP) {
            
            const userId = req.session.user._id;
            const newEmail = req.session.tempEmail;

            
            await User.findByIdAndUpdate(userId, { email: newEmail });

            
            req.session.user.email = newEmail;

            
            delete req.session.emailUpdateOTP;
            delete req.session.tempEmail;

            res.json({ success: true, message: "Profile Updated Successfully!" });
        } else {
            res.json({ success: false, message: "Incorrect OTP! Please try again." });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};



const loadProfile = async (req, res) => {
    try {
        
        const userId = req.session.user ? req.session.user._id : null;

        if (!userId) {
            
            return res.redirect('/login');
        }

        
        const userData = await User.findById(userId);

        if (!userData) {
            return res.redirect('/login');
        }

        
        res.render('user/profile', { 
            user: userData,
            pageTitle: "My Profile" 
        });

    } catch (error) {
        console.error("Load Profile Error:", error.message);
        
        res.redirect('/home');
    }
};

//
const loadEditProfile = async (req, res) => {
    try {
        const userData = await User.findById(req.session.user._id);
        res.render('user/edit-profile', { user: userData });
    } catch (error) {
        res.redirect('/profile');
    }
};

const updateProfile = async (req, res) => {
    try {
        const { name, email, phone } = req.body;
        const userId = req.session.user._id;

        // Duplicate Email Check
        const existingUser = await User.findOne({ email, _id: { $ne: userId } });
        if (existingUser) {
            return res.status(400).json({ success: false, message: "Email already in use!" });
        }

        const updateData = { name, email, phone };
        
        
        if (req.file) {
            updateData.image = req.file.filename;
        }

        const updatedUser = await User.findByIdAndUpdate(userId, updateData, { new: true });
        req.session.user = updatedUser;

        res.json({ success: true, message: "Profile updated successfully!" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server error" });
    }
};

const removeProfileImage = async (req, res) => {
    try {
        const userId = req.session.user._id;

        // Database-il image field empty aakkunnu
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { $set: { image: "" } },
            {returnDocument: 'after' }
        );

        // Session update cheyyunnu
        req.session.user = updatedUser.toObject();

        // Session save aayathinusesham 'Profile' page-ilekku vidunnu
        req.session.save((err) => {
            if (err) console.log("Session error:", err);
            res.redirect('/profile'); // Edit-profile-ilekalla, profile-ilekku thanne pokunnu
        });

    } catch (error) {
        console.error("Remove image error:", error);
        res.redirect('/profile');
    }
};

const loadAddresses = async (req, res) => {
    try {
        const userId = req.session.user ? req.session.user._id : null;

        
        if (userId) {
            const userData = await User.findById(userId);
            return res.render('user/addresses', { user: userData });
        }

        
        res.render('user/addresses', { user: null });

    } catch (error) {
        console.log("Error in loadAddresses:", error.message);
        res.status(500).send("Server Error");
    }
};


const addAddress = async (req, res) => {
    try {
        const { name, phone, pincode, state, city, locality, house, area, isDefault } = req.body;
        const userId = req.session.user ? req.session.user._id : null;
        
        if (!userId) return res.redirect('/login');

        const newAddress = {
            name, phone, pincode, state, city, locality,
            house,
            area,
            isDefault: isDefault === 'on' ? true : false
        };

        // If this is set to default, we might want to unset others (optional based on logic, but for now just push)
        if (newAddress.isDefault) {
            await User.updateMany(
                { _id: userId, "addresses.isDefault": true },
                { $set: { "addresses.$[].isDefault": false } }
            );
        }

        
        await User.findByIdAndUpdate(userId, {
            $push: { addresses: newAddress }
        });

        res.redirect('/addresses');
    } catch (error) {
        console.log(error.message);
        res.redirect('/addresses');
    }
};

// Edit Address (POST Request)
const editAddress = async (req, res) => {
    try {
        const addressId = req.params.id;
        const userId = req.session.user ? req.session.user._id : null;
        
        if (!userId) return res.redirect('/login');

        const { name, phone, pincode, state, city, locality, house, area, isDefault } = req.body;
        const isDefaultBool = isDefault === 'on' ? true : false;

        if (isDefaultBool) {
            // Remove default from all others
            await User.updateMany(
                { _id: userId, "addresses.isDefault": true },
                { $set: { "addresses.$[].isDefault": false } }
            );
        }

        await User.findOneAndUpdate(
            { _id: userId, "addresses._id": addressId },
            {
                $set: {
                    "addresses.$.name": name,
                    "addresses.$.phone": phone,
                    "addresses.$.pincode": pincode,
                    "addresses.$.state": state,
                    "addresses.$.city": city,
                    "addresses.$.locality": locality,
                    "addresses.$.house": house,
                    "addresses.$.area": area,
                    "addresses.$.isDefault": isDefaultBool
                }
            }
        );

        res.redirect('/addresses');
    } catch (error) {
        console.log(error.message);
        res.redirect('/addresses');
    }
};

const loadEditAddress = async (req, res) => {
    try {
        const addressId = req.params.id;
        const userId = req.session.user ? req.session.user._id : null;
        if (!userId) return res.redirect('/login');
        
        const user = await User.findOne({ _id: userId });
        const address = user.addresses.id(addressId); // 

        res.render('user/edit-address', { address: address });
    } catch (error) {
        console.log(error.message);
        res.redirect('/addresses');
    }
};

const deleteAddress = async (req, res) => {
    try {
        const addressId = req.params.id;
        const userId = req.session.user ? req.session.user._id : null;
        if (!userId) return res.redirect('/login');

        await User.findByIdAndUpdate(userId, {
            $pull: { addresses: { _id: addressId } }
        });

        res.redirect('/addresses');
    } catch (error) {
        console.log(error.message);
        res.redirect('/addresses');
    }
};
const loadSecurity = async (req, res) => {
    try {
        
        const userId = req.session.user ? req.session.user._id : null;
        
        if (!userId) {
            return res.redirect('/login');
        }

        const userData = await User.findById(userId);
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


const changePassword = async (req, res) => {
    try {
        const { newPassword } = req.body;
        const userId = req.session.user ? req.session.user._id : null;

        if (!userId) {
            return res.redirect('/login?error=Please login again');
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword.trim(), salt);

        const updatedUser = await User.findByIdAndUpdate(
            userId, 
            { $set: { password: hashedPassword } },
            { returnDocument: 'after' }
        );

        if (updatedUser) {
            // --- UPDATE DEBUG ---
            console.log("--- UPDATE DEBUG ---");
            console.log("Updating User ID:", userId);
            console.log("New Hash Saved:", updatedUser.password);
            console.log("---------------------");

            req.session.user = updatedUser;
            req.session.save((err) => {
                if (err) throw err;
                res.redirect('/security?success=Password updated successfully!');
            });
        } else {
            res.redirect('/security?error=User not found');
        }

    } catch (error) {
        console.error("Change Password Error:", error.message);
        res.redirect('/security?error=Server error');
    }
};
const createPassword = async (req, res) => {
    try {
        const { newPassword, confirmPassword } = req.body;
        const userId = req.session.user._id;

        if (newPassword !== confirmPassword) {
            return res.redirect('/security?error=Passwords do not match');
        }

        
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        
        await User.findByIdAndUpdate(userId, {
            password: hashedPassword
        });

        
        req.session.user.password = hashedPassword;

        res.redirect('/security?success=Password created successfully! You can now login using email.');
    } catch (error) {
        console.error(error);
        res.redirect('/security?error=Something went wrong');
    }
};


// ================= LOGOUT =================
const logout = (req, res) => {
    req.session.destroy((err) => {
        if (err) console.log("Logout Error:", err);
        res.redirect('/login');
    });
};

// ================= EXPORT =================
module.exports = {
    signup,
    login,
    googleCallback,
    getForgotPage,
    forgotPassword,
    getOtpPage,
    verifyOTP,
    getResetPage,
    loadResetPassword,
    resetPassword,
    loadHome,
    loadProfile,
    loadEditProfile,
    updateProfile,
    removeProfileImage,
    loadAddresses,
    addAddress,
    editAddress,
    loadEditAddress,
    deleteAddress,
    loadSecurity,
    changePassword,
    createPassword,
    verifyAndSaveEmail,
    verifyEmailOtp,
    sendEmailOtp,
   sendEmailUpdateOTP,
   resendOTP,
   logout

    
};
