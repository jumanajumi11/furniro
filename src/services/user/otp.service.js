import User from '../../models/user.js';
import { generateOTP } from '../../utils/generateOTP.js';
import { sendOTPEmail } from '../../utils/mail.js';
import { logger } from '../../utils/logger.js';

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


export const sendOtp = async (email, purpose = 'signup') => {
    const cleanEmail = email.toLowerCase().trim();
    
    
    if (purpose === 'signup') {
        const existingUser = await User.findOne({ email: cleanEmail });
        if (existingUser) {
            throw new Error("User already exists with this email!");
        }
    }

    
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
    logOtpToConsole(cleanEmail, otp, 120 * 1000);
    try {
        await sendOTPEmail(cleanEmail, otp);
    } catch (mailError) {
        logger.error("Mail send failed, but continuing OTP flow:", mailError.message);
    }

    return {
        email: cleanEmail,
        otp,
        otpGeneratedAt: Date.now()
    };
};


export const sendEmailUpdateOtp = async (newEmail, currentUserId) => {
    const cleanEmail = newEmail.toLowerCase().trim();

    const existingUser = await User.findOne({ email: cleanEmail, _id: { $ne: currentUserId } });
    if (existingUser) {
        throw new Error("This email address is already saved in the database!");
    }

    const otp = generateOTP();
    logOtpToConsole(cleanEmail, otp, 60 * 1000);
    try {
        await sendOTPEmail(cleanEmail, otp);
    } catch (mailError) {
        logger.error("Mail send failed, but continuing email update OTP flow:", mailError.message);
    }

    return {
        newEmail: cleanEmail,
        otp,
        otpGeneratedAt: Date.now()
    };
};





export const verifyOtp = async (otp, tempData, purpose) => {
    if (!tempData || !tempData.otp) {
        throw new Error("Session expired.");
    }

    
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
        
        
        
        const existingUser = await User.findOne({ email: tempData.email.toLowerCase().trim() });
        
        if (existingUser) {
            
            return {
                savedUser: existingUser,
                redirectUrl: '/'
            };
        }

        
        let referredByUser = null;
        let settings = { referralEnabled: false, referrerReward: 0, referredReward: 0 };
        if (tempData.referredByCode) {
            const { getSettings } = await import('../../utils/settings.js');
            settings = await getSettings();
            if (settings.referralEnabled) {
                referredByUser = await User.findOne({ referralCode: tempData.referredByCode, isAdmin: false });
            }
        }

        const newUser = new User({
            name: tempData.name,
            email: tempData.email,
            password: tempData.password,
            isVerified: true,
            referredBy: referredByUser ? referredByUser._id : null
        });

        const savedUser = await newUser.save();

        if (referredByUser && settings.referralEnabled) {
            const referrerReward = settings.referrerReward || 200;
            const referredReward = settings.referredReward || 100;

         
            referredByUser.wallet = (referredByUser.wallet || 0) + referrerReward;
            await referredByUser.save();

           
            savedUser.wallet = (savedUser.wallet || 0) + referredReward;
            await savedUser.save();

            const WalletTransaction = (await import('../../models/walletTransaction.js')).default;
            
          
            await WalletTransaction.create({
                userId: referredByUser._id,
                amount: referrerReward,
                type: 'credit',
                description: `Referral Reward for inviting ${savedUser.email}`,
                status: 'completed',
                transactionDate: new Date()
            });

           
            await WalletTransaction.create({
                userId: savedUser._id,
                amount: referredReward,
                type: 'credit',
                description: `Referral Sign-up Bonus (Referred by ${referredByUser.email})`,
                status: 'completed',
                transactionDate: new Date()
            });

            const ReferralHistory = (await import('../../models/referralHistory.js')).default;
            await ReferralHistory.create({
                referrer: referredByUser._id,
                referred: savedUser._id,
                referrerReward,
                referredReward,
                status: 'Completed'
            });
        }

        return {
            savedUser,
            redirectUrl: '/'
        };
    }
};


export const verifyEmailOtp = async (otp, sessionData) => {
    if (!sessionData) {
        throw new Error("Session expired");
    }

    if (otp.toString() !== sessionData.otp.toString()) {
        throw new Error("Invalid OTP");
    }

    return true;
};


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
