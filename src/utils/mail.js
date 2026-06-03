import dotenv from 'dotenv';
dotenv.config();

import nodemailer from 'nodemailer';

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

/**
 * Send OTP code via email.
 * @param {string} email 
 * @param {string} otp 
 */
export const sendOTPEmail = async (email, otp) => {
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

export default { sendOTPEmail };