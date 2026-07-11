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

export const sendEmailChangeNotification = async (oldEmail, newEmail) => {
    try {
        const mailOptions = {
            from: "furniro75@gmail.com",
            to: oldEmail,
            subject: 'Security Alert: Your Email Has Been Changed',
            text: `Hello, \n\nThe email address for your account has been successfully changed to ${newEmail}.\n\nIf you did not make this change, please contact support immediately.`
        };
        await transporter.sendMail(mailOptions);
        logger.debug("Email change notification sent successfully to old email:", oldEmail);
    } catch (error) {
        logger.error("Email change notification mail error:", error);
    }
};

export default { sendOTPEmail, sendEmailChangeNotification };