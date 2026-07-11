import { logOtp } from '../src/utils/otpLogger.js';

console.log("=== TESTING SIGNUP OTP ===");
logOtp({
    purpose: 'Signup',
    email: 'user@example.com',
    otp: '482731'
});

console.log("\n=== TESTING RESEND OTP ===");
logOtp({
    type: 'Resent',
    purpose: 'Resend Signup OTP',
    email: 'user@example.com',
    otp: '913624'
});

console.log("\n=== TESTING UPDATE EMAIL OTP ===");
logOtp({
    type: 'Update Email OTP',
    email: 'newuser@example.com',
    otp: '728451'
});
