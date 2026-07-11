/**
 * Centralized utility to log generated or resent OTPs to the terminal.
 * Outputs to console.log unconditionally so it appears in terminal and PM2 logs.
 */
export const logOtp = ({
    type,
    purpose,
    email,
    otp,
    expires
}) => {
    console.log(`
====================================
OTP ${type}
Purpose : ${purpose}
Email   : ${email}
OTP     : ${otp}
Expires : ${expires}
====================================
`);
};

export default logOtp;
