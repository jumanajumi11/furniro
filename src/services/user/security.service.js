import User from '../../models/user.js';
import bcrypt from 'bcryptjs';


export const changePassword = async (userId, { oldPassword, newPassword, confirmPassword }) => {
    const user = await User.findById(userId);
    if (!user) {
        throw new Error("User not found");
    }

    if (!oldPassword || !newPassword || !confirmPassword) {
        throw new Error("All fields are mandatory!");
    }

    if (newPassword === oldPassword) {
        throw new Error("New password must be different from your current password.");
    }

    if (newPassword !== confirmPassword) {
        throw new Error("Confirm password does not match the new password.");
    }

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
        throw new Error("Current password is incorrect");
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    return user;
};


export const createPassword = async (userId, { newPassword }) => {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const updatedUser = await User.findByIdAndUpdate(
        userId,
        { password: hashedPassword },
        { returnDocument:'after' }
    );

    if (!updatedUser) {
        throw new Error("User not found");
    }

    return updatedUser;
};

export const resetPasswordByEmail = async (email, password) => {
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
        throw new Error("User not found.");
    }
    if (user.googleId) {
        throw new Error("This account is registered via Google. Password reset is not allowed.");
    }
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password.trim(), salt);
    
    user.password = hashedPassword;
    await user.save();
    return user;
};

export default {
    changePassword,
    createPassword,
    resetPasswordByEmail
};
