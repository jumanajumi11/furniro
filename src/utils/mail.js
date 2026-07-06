import nodemailer from 'nodemailer';
import { logger } from './logger.js';

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
        logger.debug("Email sent successfully to:", email);
    } catch (error) {
        logger.error("Mail Error:", error);
        throw error;
    }
};

export default { sendOTPEmail };