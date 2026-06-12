import User from '../../models/user.js';
import { generateOTP } from '../../utils/generateOTP.js';
import { sendOTPEmail } from '../../utils/mail.js';

const formatTimestamp = (ms) => {
    const d = new Date(ms);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

const logOtpToConsole = (email, otp, durationMs) => {
    if (process.env.NODE_ENV !== "production") {
        const now = Date.now();
        const formattedGen = formatTimestamp(now);
        const formattedExp = formatTimestamp(now + durationMs);
        console.log("\n=================================");
        console.log("OTP GENERATED");
        console.log(`Email: ${email}`);
        console.log(`OTP: ${otp}`);
        console.log(`Generated At: ${formattedGen}`);
        console.log(`Expiry At: ${formattedExp}`);
        console.log("=================================\n");
    }
};

/**
 * Send an OTP to the given email for a specific purpose.
 */
export const sendOtp = async (email, purpose = 'signup') => {
    const cleanEmail = email.toLowerCase().trim();
    
    // For signup, check if user exists
    if (purpose === 'signup') {
        const existingUser = await User.findOne({ email: cleanEmail });
        if (existingUser) {
            throw new Error("User already exists with this email!");
        }
    }

    // For forgot password, check if user exists and is verified
    if (purpose === 'forgot') {
        const user = await User.findOne({ email: cleanEmail });
        if (!user) {
            throw new Error("No account exists with this email address!");
        }
        if (user.googleId) {
            throw new Error("This account is registered via Google. Please sign in with Google.");
        }
        if (!user.isVerified) {
            throw new Error("This email address is not verified. Please verify your email first.");
        }
    }

    const otp = generateOTP();
    // Unconditional logging for debugging (will appear regardless of NODE_ENV)
    console.log('\n=================================');
    console.log('OTP GENERATED');
    console.log('Email:', cleanEmail);
    console.log('OTP:', otp);
    console.log('Generated At:', new Date().toISOString());
    console.log('Expires In: 120 Seconds');
    console.log('=================================\n');
    logOtpToConsole(cleanEmail, otp, 120 * 1000); // 2 minutes expiry
    try {
        await sendOTPEmail(cleanEmail, otp);
    } catch (mailError) {
        console.error("Mail send failed, but continuing OTP flow for local development:", mailError.message);
    }

    return {
        email: cleanEmail,
        otp,
        otpGeneratedAt: Date.now()
    };
};

/**
 * Send OTP for email update flow, ensuring email is not in use by other users.
 */
export const sendEmailUpdateOtp = async (newEmail, currentUserId) => {
    const cleanEmail = newEmail.toLowerCase().trim();

    const existingUser = await User.findOne({ email: cleanEmail, _id: { $ne: currentUserId } });
    if (existingUser) {
        throw new Error("This email address is already saved in the database!");
    }

    const otp = generateOTP();
    // Unconditional logging for debugging (will appear regardless of NODE_ENV)
    console.log('\n=================================');
    console.log('OTP GENERATED');
    console.log('Email:', cleanEmail);
    console.log('OTP:', otp);
    console.log('Generated At:', new Date().toISOString());
    console.log('Expires In: 60 Seconds');
    console.log('=================================\n');
    logOtpToConsole(cleanEmail, otp, 60 * 1000); // 1 minute expiry
    try {
        await sendOTPEmail(cleanEmail, otp);
    } catch (mailError) {
        console.error("Mail send failed, but continuing email update OTP flow for local development:", mailError.message);
    }

    return {
        newEmail: cleanEmail,
        otp,
        otpGeneratedAt: Date.now()
    };
};

/**
 * Verify general OTP (SignUp or Reset Password).
 */


       /**
 * Verify general OTP (SignUp or Reset Password).
 */
export const verifyOtp = async (otp, tempData, purpose) => {
    if (!tempData || !tempData.otp) {
        throw new Error("Session expired.");
    }

    // Check expiration (2 minutes limit)
    const currentTime = Date.now();
    const otpTime = tempData.otpGeneratedAt;
    const expirationLimit = 2 * 60 * 1000; 

    if (currentTime > (otpTime + expirationLimit)) {
        throw new Error("OTP has expired. Please click Resend.");
    }

    if (otp.toString() !== tempData.otp.toString()) {
        throw new Error("invalid OTP!");
    }

    if (purpose === 'forgot') {
        return { allowReset: true, redirectUrl: '/reset-password' };
    } else {
        // --- DUPLICATE KEY ERROR ഒഴിവാക്കാൻ ഇവിടെ മാറ്റം വരുത്തി ---
        
        // ആദ്യം ഡാറ്റാബേസിൽ ഈ ഇമെയിൽ ഉണ്ടോ എന്ന് നോക്കുന്നു
        const existingUser = await User.findOne({ email: tempData.email.toLowerCase().trim() });
        
        if (existingUser) {
            // യൂസർ ഓൾറെഡി ഉണ്ടെങ്കിൽ വീണ്ടും സേവ് ചെയ്യാതെ ഹോമിലേക്ക് വിടുന്നു
            return {
                savedUser: existingUser,
                redirectUrl: '/'
            };
        }

        // ഇല്ലെങ്കിൽ മാത്രം പുതിയ യൂസറെ ഉണ്ടാക്കി സേവ് ചെയ്യുന്നു
        const newUser = new User({
            name: tempData.name,
            email: tempData.email,
            password: tempData.password,
            isVerified: true
        });

        const savedUser = await newUser.save();
        return {
            savedUser,
            redirectUrl: '/'
        };
    }
};

/**
 * Verify OTP for general email update step.
 */
export const verifyEmailOtp = async (otp, sessionData) => {
    if (!sessionData) {
        throw new Error("Session expired");
    }

    if (otp.toString() !== sessionData.otp.toString()) {
        throw new Error("Invalid OTP");
    }

    return true;
};

/**
 * Verify and save new email address to database.
 */
export const verifyAndSaveEmail = async (otp, sessionData, sessionOtpExpiry, userId) => {
    const currentTime = Date.now();
    
    if (currentTime > sessionOtpExpiry) {
        throw new Error("OTP expired! Please resend.");
    }

    if (!sessionData || otp.toString() !== sessionData.otp.toString()) {
        throw new Error("Incorrect OTP! Please try again.");
    }

    const updatedUser = await User.findByIdAndUpdate(
        userId,
        { email: sessionData.newEmail },
        { returnDocument:'after'}
    );

    return updatedUser;
};
/**
 * Reset user password
 */
export const resetPassword = async (email, password) => {

    const user = await User.findOne({
        email: email.toLowerCase().trim()
    });

    if (!user) {
        throw new Error("User not found");
    }

    user.password = password;

    await user.save();

    return true;
};
export default {
    sendOtp,
    sendEmailUpdateOtp,
    verifyOtp,
    verifyEmailOtp,
    verifyAndSaveEmail,
    resetPassword
};
