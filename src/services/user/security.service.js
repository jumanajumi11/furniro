import User from '../../models/user.js';
import bcrypt from 'bcryptjs';

/**
 * Change user password from settings page.
 */
export const changePassword = async (userId, { oldPassword, newPassword }) => {
    const user = await User.findById(userId);
    if (!user) {
        throw new Error("User not found");
    }

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
        throw new Error("Current password is incorrect");
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    return user;
};

/**
 * Create a password for social auth users.
 */
export const createPassword = async (userId, { newPassword }) => {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const updatedUser = await User.findByIdAndUpdate(
        userId,
        { password: hashedPassword },
        { new: true }
    );

    if (!updatedUser) {
        throw new Error("User not found");
    }

    return updatedUser;
};

/**
 * Reset user password by email (forgot password reset phase).
 */
export const resetPasswordByEmail = async (email, password) => {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password.trim(), salt);
    const updatedUser = await User.findOneAndUpdate(
        { email: email.toLowerCase().trim() },
        { password: hashedPassword },
        { new: true }
    );
    if (!updatedUser) {
        throw new Error("User not found.");
    }
    return updatedUser;
};

export default {
    changePassword,
    createPassword,
    resetPasswordByEmail
};
