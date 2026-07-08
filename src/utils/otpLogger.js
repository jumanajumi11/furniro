/**
 * Centralized utility to log generated or resent OTPs to the terminal.
 * Used exclusively for development purposes (suppressed in production environments).
 */
export const logOtp = ({ type = 'Generated', purpose, email, otp, expires = '5 minutes' }) => {
    // Only log to terminal if the environment is not production
    if (process.env.NODE_ENV === 'production') {
        return;
    }

    console.log("========================================");
    if (type === 'Update Email OTP') {
        console.log("Update Email OTP");
        console.log(`New Email : ${email}`);
        console.log(`OTP       : ${otp}`);
        console.log(`Expires   : ${expires}`);
    } else if (type === 'Resent') {
        console.log("OTP Resent");
        console.log(`Purpose : ${purpose}`);
        console.log(`Email   : ${email}`);
        console.log(`OTP     : ${otp}`);
        console.log(`Expires : ${expires}`);
    } else {
        console.log("OTP Generated");
        console.log(`Purpose : ${purpose}`);
        console.log(`Email   : ${email}`);
        console.log(`OTP     : ${otp}`);
        console.log(`Expires : ${expires}`);
    }
    console.log("========================================");
};

export default logOtp;
