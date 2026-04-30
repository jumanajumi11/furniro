// // // // const express = require('express');
// // // // const router = express.Router();
// // // // const User = require('../models/User');
// // // // const userController = require('../controllers/user.controller');
// // // // const passport = require('../config/passport');
// // // // const sendOTP = require('../utils/mail'); 
// // // // const generateOTP = require('../utils/otp');

// // // // router.get('/signup', (req, res) => {
// // // //   res.render('user/signup',{ error: null });
// // // // });


// // // // router.get('/login', (req, res) => {
// // // //   res.render('user/login', { error: null });
// // // // });
// // // // router.get('/forgot-password', userController.getForgotPage);
// // // // // router.post('/forgot-password', async (req, res) => {
// // // // //   const { email } = req.body;

// // // // //   const otp = Math.floor(100000 + Math.random() * 900000);

// // // // //   req.session.otp = otp;
// // // // //   req.session.email = email;

// // // // //   await sendOTP(email, otp);

// // // // //   res.redirect('/otp');
// // // // // });
// // // // router.post('/forgot-password', async (req, res) => {
// // // //   const { email } = req.body;

// // // //   const otp = Math.floor(100000 + Math.random() * 900000);

// // // //   req.session.otp = otp;
// // // //   req.session.email = email;

// // // //   await sendOTP(email, otp);

// // // //   res.json({ success: true, message: "OTP sent" });
// // // // });
// // // // router.get('/verify-email', userController.getOtpPage); 

// // // // // OTP സബ്മിറ്റ് ചെയ്യാൻ (POST)
// // // // router.post('/otp', userController.verifyOTP);

// // // // // router.get('/verify-otp', userController.getOtpPage);
// // // // // router.post('/verify-otp', userController.verifyOTP);

// // // // router.get('/reset-password', userController.getResetPage);
// // // // router.post('/reset-password', userController.resetPassword);
// // // // // router.get('/verify-email', userController.verifyEmail);
// // // // // router.post('/verify-email', userController.verifyEmail);


// // // // // router.post('/signup', async (req, res) => {
// // // // //   try {
// // // // //     const { email, password } = req.body;

// // // // //     const existingUser = await User.findOne({ email });
// // // // //     if (existingUser) {
// // // // //       return res.send("Email already exists");
// // // // //     }

// // // // //     const otp = generateOTP(); // use your util
// // // // //     req.session.signupData = { email, password };
// // // // //     req.session.otp = otp;

// // // // //     await sendOTP(email, otp);

// // // // //     return res.redirect('/verify-email');

// // // // //   } catch (err) {
// // // // //     console.log(err);
// // // // //     return res.redirect('/signup');
// // // // //   }
// // // // // });
// // // // // ആ വലിയ router.post('/signup', ...) മുഴുവൻ കളഞ്ഞിട്ട് ഇത് മാത്രം നൽകുക
// // // // router.post('/signup', userController.signup);
// // // // router.post('/login', userController.login);

// // // // router.get('/auth/google',
// // // //   passport.authenticate('google', {
// // // //     scope: ['profile', 'email'],
// // // //     prompt: 'select_account',
// // // //     accessType: 'offline'
// // // //   })
// // // //   );
// // // //   router.get('/auth/google/callback',
// // // //   passport.authenticate('google', {
// // // //     failureRedirect: '/login'
// // // //   }),
// // // //   userController.googleCallback

// // // // );
// // // // router.get('/logout', (req, res) => {
// // // //   req.logout(() => {
// // // //     req.session.destroy(() => {
// // // //       res.redirect('/login');
// // // //     });
// // // //   });
// // // // });
// // // // module.exports = router;
// // // const express = require('express');
// // // const router = express.Router();
// // // const userController = require('../controllers/user.controller');
// // // const passport = require('passport');

// // // // ================= GET ROUTES =================

// // // // Signup & Login
// // // router.get('/signup', (req, res) => res.render('user/signup', { error: null }));
// // // router.get('/login', (req, res) => res.render('user/login', { error: null }));

// // // // Forgot Password Flow (GET)
// // // router.get('/forgot-password', userController.getForgotPage);
// // // router.get('/otp', userController.getOtpPage); // OTP ടൈപ്പ് ചെയ്യാനുള്ള പേജ്
// // // router.get('/reset-password', userController.getResetPage); // പുതിയ പാസ്‌വേഡ് സെറ്റ് ചെയ്യാനുള്ള പേജ്

// // // // Verification (Signup-ന് വേണ്ടി മാത്രം ഉപയോഗിക്കുന്നത്)
// // // router.get('/verify-email', userController.getOtpPage); 

// // // // Home Page
// // // router.get('/home', (req, res) => {
// // //     if (!req.session.user) return res.redirect('/login');
// // //     res.render('user/home', { user: req.session.user });
// // // });

// // // // ================= POST ROUTES =================

// // // // Auth Actions
// // // router.post('/signup', userController.signup);
// // // router.post('/login', userController.login);

// // // // Forgot Password Flow (POST)
// // // router.post('/forgot-password', userController.forgotPassword); // OTP ജനറേറ്റ് ചെയ്ത് അയക്കാൻ
// // // router.post('/otp', userController.verifyOTP); // OTP ശരിയാണോ എന്ന് പരിശോധിക്കാൻ
// // // router.post('/reset-password', userController.resetPassword); // പാസ്‌വേഡ് അപ്ഡേറ്റ് ചെയ്യാൻ

// // // // ================= GOOGLE AUTH =================

// // // router.get('/auth/google',
// // //     passport.authenticate('google', {
// // //         scope: ['profile', 'email'],
// // //         prompt: 'select_account'
// // //     })
// // // );

// // // router.get('/auth/google/callback',
// // //     passport.authenticate('google', { failureRedirect: '/login' }),
// // //     userController.googleCallback
// // // );

// // // // ================= LOGOUT =================

// // // router.get('/logout', (req, res) => {
// // //     req.logout((err) => {
// // //         req.session.destroy(() => {
// // //             res.redirect('/login');
// // //         });
// // //     });
// // // });

// // // module.exports = router;
// // const express = require('express');
// // const router = express.Router();
// // const userController = require('../controllers/user.controller');
// // const passport = require('passport');

// // // ================= GET ROUTES =================

// // // Signup & Login
// // router.get('/signup', (req, res) => res.render('user/signup', { error: null }));
// // router.get('/login', (req, res) => res.render('user/login', { error: null }));

// // // Forgot Password Flow (GET)
// // router.get('/forgot-password', userController.getForgotPage);
// // router.get('/verify-otp', userController.getOtpPage); 
// // router.get('/reset-password', userController.loadResetPassword); 

// // // Verification (Signup-ന് വേണ്ടി മാത്രം ഉപയോഗിക്കുന്നത്)
// // // router.get('/verify-email', userController.getOtpPage); 
// // router.get('/verify-email', (req, res) => {
// //     try {
// //         // സൈൻഅപ്പിൽ നമ്മൾ സെറ്റ് ചെയ്ത otpData സെഷനിൽ ഉണ്ടോ എന്ന് നോക്കുന്നു
// //         if (req.session.otpData) {
            
// //             // സെഷനിൽ നിന്ന് ഇമെയിൽ കൂടി പാസ്സ് ചെയ്താൽ OTP പേജിൽ അത് കാണിക്കാൻ പറ്റും
// //             const email = req.session.userData ? req.session.userData.email : "";
            
// //             // views/user/otp.ejs എന്ന ഫയലിലേക്ക് ഡാറ്റ വിടുന്നു
// //             res.render('user/otp', { 
// //                 email: email, 
// //                 message: null, 
// //                 error: null 
// //             });

// //         } else {
// //             // സെഷൻ ഇല്ലെങ്കിൽ (ഡയറക്ട് ആയി ഈ ലിങ്ക് അടിച്ചാൽ) സൈൻഅപ്പിലേക്ക് വിടുന്നു
// //             console.log("No OTP session found, redirecting to signup");
// //             res.redirect('/signup');
// //         }
// //     } catch (error) {
// //         console.error("Error loading OTP page:", error);
// //         res.redirect('/signup');
// //     }
// // })

// // // Home Page
// // // routes/user.js (Line 212)
// // router.get('/', (req, res) => {
// //     const dummyProducts = [
// //         {
// //             name: "Syltherine",
// //             category: "Stylish cafe chair",
// //             price: "2.500.000",
// //             image: "https://res.cloudinary.com/dp9odkfmd/image/upload/v1776920338/image_113_wlmvvt.png"
// //         },
// //         {
// //             name: "Leviosa",
// //             category: "Stylish cafe chair",
// //             price: "2.500.000",
// //             image: "https://res.cloudinary.com/dp9odkfmd/image/upload/v1776921475/image_114_kmk1ux.png"
// //         },
// //         {
// //             name: "Respira",
// //             category: "Outdoor bar table and stool",
// //             price: "500.000",
// //             image: "https://res.cloudinary.com/dp9odkfmd/image/upload/v1776921535/image_115_uu5fck.png"
// //         }
// //     ];
// //     // സെഷനിൽ യൂസർ ഉണ്ടെങ്കിൽ അത് കൂടി പാസ് ചെയ്യുക (ഹെഡറിലെ പ്രൊഫൈലിന് വേണ്ടി)
// //     res.render('user/home', { products: dummyProducts, user: req.session.user || null });
// // });

// // // ================= POST ROUTES =================

// // // Auth Actions
// // router.post('/signup', userController.signup);
// // router.post('/login', userController.login);

// // // Forgot Password Flow (POST)
// // router.post('/forgot-password', userController.forgotPassword); 
// // router.post('/verify-otp', userController.verifyOTP);
// // router.get('/home', userController.loadHome);
// // router.post('/reset-password', userController.resetPassword); 

// // // ================= GOOGLE AUTH =================

// // router.get('/auth/google',
// //     passport.authenticate('google', {
// //         scope: ['profile', 'email'],
// //         prompt: 'select_account'
// //     })
// // );

// // router.get('/auth/google/callback',
// //     passport.authenticate('google', { failureRedirect: '/login' }),
// //     userController.googleCallback
// // );
// // router.get('/home', (req, res) => {
// //     if (req.session.user) {
// //         res.render('user/home', { user: req.session.user });
// //     } else {
// //         res.redirect('/login'); // ലോഗിൻ ചെയ്തിട്ടില്ലെങ്കിൽ തിരിച്ചയക്കുന്നു
// //     }
// // });

// // // ================= LOGOUT =================

// // router.get('/logout', (req, res) => {
// //     req.logout((err) => {
// //         if (err) console.log(err);
// //         req.session.destroy(() => {
// //             res.redirect('/login');
// //         });
// //     });
// // });

// // module.exports = router;
// const express = require('express');
// const router = express.Router();
// const userController = require('../controllers/user.controller');
// const passport = require('passport');
// const multer = require('multer');
// const path = require('path');

// //
// // ഇനി നിങ്ങളുടെ റൂട്ടിൽ ഇത് ഉപയോഗിക്കാം


// // ================= GET ROUTES =================

// // Signup & Login
// router.get('/signup', (req, res) => res.render('user/signup', { error: null }));
// router.get('/login', (req, res) => res.render('user/login', { error: null }));
// // ഇത് നിങ്ങളുടെ routes/user.js-ൽ എവിടെയെങ്കിലും ചേർത്താൽ /home വർക്ക് ആകും
// router.get('/home', (req, res) => {
//     res.redirect('/');
// });
// // Root Route (Home Page with Dummy Data)
// router.get('/', (req, res) => {
//     const dummyProducts = [
//         {
//             name: "Syltherine",
//             category: "Stylish cafe chair",
//             price: "2.500.000",
//             image: "https://res.cloudinary.com/dp9odkfmd/image/upload/v1776920338/image_113_wlmvvt.png"
//         },
//         {
//             name: "Leviosa",
//             category: "Stylish cafe chair",
//             price: "2.500.000",
//             image: "https://res.cloudinary.com/dp9odkfmd/image/upload/v1776921475/image_114_kmk1ux.png"
//         },
//         {
//             name: "Respira",
//             category: "Outdoor bar table and stool",
//             price: "500.000",
//             image: "https://res.cloudinary.com/dp9odkfmd/image/upload/v1776921535/image_115_uu5fck.png"
//         }
//     ];
//     // സെഷനിൽ യൂസർ ഉണ്ടെ// ഉദാഹരണത്തിന് നിങ്ങളുടെ ഹോം റൂട്ട് ഇതുപോലെ ആയിരിക്കും:

//     res.render('user/home', { products: dummyProducts, user: req.session.user || null });
// });
// // റൂട്ട് '/' ആക്കി മാറ്റി

// // Forgot Password Flow
// router.get('/forgot-password', userController.getForgotPage);
// router.get('/verify-otp', userController.getOtpPage); 
// router.get('/reset-password', userController.loadResetPassword); 

// // Signup OTP Verification Page
// router.get('/verify-email', (req, res) => {
//     if (req.session.otpData) {
//         const email = req.session.userData ? req.session.userData.email : "";
//         res.render('user/otp', { email: email, message: null, error: null });
//     } else {
//         res.redirect('/signup');
//     }
// });
// // user.js
// // router.get('/profile', (req, res) => {
// //     // ഇവിടെയാണ് profile.ejs റെൻഡർ ചെയ്യേണ്ടത്
// //     res.render('user/profile'); 
// // });

// // പ്രൊഫൈൽ കാണാൻ
// router.get('/profile', userController.loadProfile);

// // എഡിറ്റ് പേജ് തുറക്കാൻ
// router.get('/edit-profile', userController.loadEditProfile);

// const storage = multer.diskStorage({
//     destination: function (req, file, cb) {
//         // public/uploads എന്ന് തന്നെ നൽകുക, ഫോൾഡർ ഉണ്ടെന്ന് ഉറപ്പാക്കുക
//         cb(null, 'public/upload/'); 
//     },
//     filename: function (req, file, cb) {
//         const name = Date.now() + '-' + file.originalname.replace(/\s+/g, '-');
//         cb(null, name);
//     }
// });

// const upload = multer({ storage: storage }); // ഇതാണ് ആ 'upload' വേരിയബിൾ


// // മാറ്റങ്ങൾ സേവ് ചെയ്യാൻ (POST method)
// // upload എന്നത് നിങ്ങളുടെ multer കോൺഫിഗറേഷൻ ആണ്


// // ================= POST ROUTES =================

// router.post('/signup', userController.signup);
// router.post('/login', userController.login);
// router.post('/forgot-password', userController.forgotPassword); 
// // ഇപ്പൊഴത്തെ എറർ വരാൻ സാധ്യതയുള്ള സ്ഥലം ഇതാണ്
// router.post('/verify-otp', userController.verifyOTP); // ഈ വരിയാണോ 375-ൽ ഉള്ളത്?
// router.post('/reset-password', userController.resetPassword); 
// // ഇമേജ് അപ്‌ലോഡ് ചെയ്യാൻ
// router.post('/update-profile', upload.single('image'), userController.updateProfile);

// // ഇമേജ് റിമൂവ് ചെയ്യാൻ
// router.post('/remove-profile-image', userController.removeProfileImage);
// // ================= GOOGLE AUTH =================

// router.get('/auth/google',
//     passport.authenticate('google', {
//         scope: ['profile', 'email'],
//         prompt: 'select_account'
//     })
// );

// router.get('/auth/google/callback',
//     passport.authenticate('google', { failureRedirect: '/login' }),
//     userController.googleCallback
// );

// // ================= LOGOUT =================

// router.get('/logout', (req, res) => {
//     req.logout((err) => {
//         if (err) console.log(err);
//         req.session.destroy(() => {
//             res.clearCookie('connect.sid'); // സെഷൻ കുക്കി കൂടി ക്ലിയർ ചെയ്യുന്നു
//             res.redirect('/login');
//         });
//     });
// });

// module.exports = router;
const User = require('../models/user');
const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const passport = require('passport');
const multer = require('multer');
const path = require('path');
const { sendOTPEmail } = require('../utils/mail');


// Multer Storage Configuration
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/upload/'); 
    },
    filename: function (req, file, cb) {
        const name = Date.now() + '-' + file.originalname.replace(/\s+/g, '-');
        cb(null, name);
    }
});
const upload = multer({ storage: storage });

// ================= GET ROUTES =================

// Root Route (Home Page)
router.get('/', async (req, res) => {
    try {
       const category = [
            { name: 'L shaped sofa', img: "https://res.cloudinary.com/dp9odkfmd/image/upload/v1776920338/image_113_wlmvvt.png" }, 
            { name: '3 seater sofa', img: 'https://res.cloudinary.com/dp9odkfmd/image/upload/v1776921475/image_114_kmk1ux.png' },
            { name: 'Recliner sofa', img: 'https://res.cloudinary.com/dp9odkfmd/image/upload/v1776921535/image_115_uu5fck.png' }
        ];

        const dummyProducts = [
            {
                name: "Syltherine",
                category: "Stylish sofa",
                price: "2.500.000",
                image: "https://res.cloudinary.com/dp9odkfmd/image/upload/v1776920338/image_113_wlmvvt.png"
            },
            {
                name: "Leviosa",
                category: "Stylish cafe chair",
                price: "2.500.000",
                image: "https://res.cloudinary.com/dp9odkfmd/image/upload/v1776921475/image_114_kmk1ux.png"
            },
            {
                name: "recliner ",
                category: "Stylish sofa",
                price: "2.500.000",
                image: "https://res.cloudinary.com/dp9odkfmd/image/upload/v1776921535/image_115_uu5fck.png"
            },


        ];

        res.render('user/home', { 
            user: req.session.user || null, 
            category: category,
            products: dummyProducts 
        });
    } catch (error) {
        console.log("Home Page Error:", error.message);
        res.redirect('/login');
    }
});

router.get('/home', (req, res) => res.redirect('/'));

// Auth Pages
router.get('/signup', (req, res) => res.render('user/signup', { error: null }));
router.get('/login', (req, res) => res.render('user/login', { error: null }));

// Forgot Password Flow
router.get('/forgot-password', userController.getForgotPage);
router.get('/verify-otp', userController.getOtpPage); 
router.get('/reset-password', userController.loadResetPassword); 

// OTP Verification Page (Signup)

// GET: /verify-email
router.get('/verify-email', (req, res) => {
    // ലോഗ് ചെയ്ത് നോക്കുക ഡാറ്റ ഉണ്ടോ എന്ന്
    console.log("Session Data at Verify:", req.session.userTempData);

    if (req.session.userTempData) {
        // ഇമെയിൽ ഒടിപി പേജിലേക്ക് പാസ് ചെയ്യുന്നു
        res.render('user/otp', { 
            email: req.session.userTempData.email, 
            error: null,
            message: null // ഇത് കൂടി ചേർക്കുക
        });
    } else {
        console.log("❌ No userTempData found in session, redirecting to signup");
        res.redirect('/signup');
    }
});

// Profile Routes
router.get('/profile', userController.loadProfile);
router.get('/edit-profile', userController.loadEditProfile);

// ================= POST ROUTES =================

router.post('/signup', userController.signup);
router.post('/login', userController.login);
router.post('/forgot-password', userController.forgotPassword); 
router.post('/verify-otp', userController.verifyOTP);
router.post('/reset-password', userController.resetPassword); 

// Profile Update Actions
router.post('/update-profile', upload.single('image'), userController.updateProfile);
router.post('/remove-profile-image', userController.removeProfileImage);

router.get('/addresses',userController.loadAddresses);
router.post('/add-address', userController.addAddress);
router.post('/edit-address/:id', userController.editAddress);
router.post('/delete-address/:id', userController.deleteAddress);
// Add this line to your routes file

// RESEND OTP ROUTE
router.post('/resend-otp', async (req, res) => {
    try {
        const email = req.session.userEmail;
        if (!email) {
            return res.status(400).json({ success: false, message: "Session expired." });
        }

        const newOTP = Math.floor(100000 + Math.random() * 900000).toString();
        
        // ഡാറ്റാബേസിൽ ഒറ്റത്തവണ അപ്‌ഡേറ്റ് ചെയ്താൽ മതി
       await User.findOneAndUpdate(
    { email: email }, 
    { $set: { otp: newOTP } }, 
    { 
        upsert: true, 
        returnDocument: 'after' // 'new: true' എന്നതിന് പകരം ഇത് നൽകുക
    }
);

        // സെഷനിലും ബാക്കപ്പിനായി സൂക്ഷിക്കാം
        req.session.emailOtp = newOTP;

        await sendOTPEmail(email, newOTP);
        console.log("Resent OTP saved to DB:", newOTP);
        
        res.json({ success: true });
    } catch (error) {
        console.error("Resend OTP Error:", error);
        res.status(500).json({ success: false });
    }
});

// VERIFY OTP ROUTE
// verify-otp റൂട്ട്
router.post('/verify-otp', async (req, res) => {
    try {
        const { otp } = req.body;
        const email = req.session.userEmail; // സെഷനിൽ ഇമെയിൽ ഉണ്ടെന്ന് ഉറപ്പാക്കുക

        if (!email) {
            return res.status(400).json({ success: false, message: "സെഷൻ കാലാവധി കഴിഞ്ഞു." });
        }

        const user = await User.findOne({ email: email });

        // ഡാറ്റാബേസിലെ OTP-യും യൂസർ നൽകിയതും താരതമ്യം ചെയ്യുന്നു
        if (user && user.otp && String(user.otp).trim() === String(otp).trim()) {
            await User.findOneAndUpdate({ email: email }, { $set: { otp: null, isVerified: true } });
            return res.json({ success: true, redirectUrl: "/home" });
        } else {
            return res.status(400).json({ success: false, message: "തെറ്റായ OTP ആണ് നൽകിയത്." });
        }
    } catch (error) {
        res.status(500).json({ success: false });
    }
});
// Also make sure you have the verification route defined
router.post('/verify-email-otp', userController.verifyEmailOtp);

router.get('/security', userController.loadSecurity);
router.post('/change-password', userController.changePassword);
router.post('/create-password', userController.createPassword);
// ================= GOOGLE AUTH =================

router.get('/auth/google',
    passport.authenticate('google', {
        scope: ['profile', 'email'],
        prompt: 'select_account'
    })
);

router.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/login' }),
    userController.googleCallback
);

// ================= LOGOUT =================

router.get('/logout', (req, res) => {
    req.logout((err) => {
        if (err) console.log(err);
        req.session.destroy(() => {
            res.clearCookie('connect.sid');
            res.redirect('/login');
        });
    });
});

module.exports = router;