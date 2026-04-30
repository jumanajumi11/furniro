const sendEmail = require('./mail'); 

const sendOTP = async (email, otp) => { 
    try {
        if (!email || !otp) {
            console.error("❌ Email or OTP is missing in otp.js");
            return;
        }

        console.log(`Passing to mail.js -> Email: ${email}, OTP: ${otp}`);

        await sendEmail(email, otp); 
        console.log("✅ OTP Sent Successfully");
    } catch (error) {
        console.error("❌ Error in otp.js:", error.message);
    }
};

module.exports = sendOTP;


