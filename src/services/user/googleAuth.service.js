import User from '../../models/user.js';

/**
 * Handle custom operations post Google OAuth authentication.
 * @param {object} googleUser Passport profile / authenticated 
 * @returns {Promise<object>} User database record
 */
export const handleGoogleLogin = async (googleUser) => {
    if (!googleUser) {
        throw new Error("Google authentication failed");
    }

    const user = await User.findById(googleUser._id);
    if (!user) {
        throw new Error("User record not found");
    }

    if (user.isBlocked) {
        throw new Error("Your account has been blocked by the administrator.");
    }

    return user;
};

export default {
    handleGoogleLogin
};
