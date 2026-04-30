
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') }); 
// നിങ്ങളുടെ ഫോൾഡർ സ്ട്രക്ചർ അനുസരിച്ച് ../../ എന്നത് മാറ്റം വരാം.
const nodemailer = require('nodemailer');


const transporter = nodemailer.createTransport({
    service: 'gmail',
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    
auth: {
    user: "furniro75@gmail.com",
    pass: "kcokeejbghngqnre" 
},
    tls: {
        rejectUnauthorized: false 
    }
});

const sendOTPEmail = async (email, otp) => {
    try {
        const mailOptions = {
            from: "furniro75@gmail.com", 
            to: email,
            subject: 'Verification Code',
            text: `Your OTP is: ${otp}`
        };
        await transporter.sendMail(mailOptions);
        console.log("Email sent successfully");
    } catch (error) {
        console.error("Mail Error:", error);
        throw error;
    }
};

module.exports = { sendOTPEmail }