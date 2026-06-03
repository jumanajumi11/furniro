import User from '../../models/user.js';

/**
 * Get user by ID.
 * @param {string} userId 
 * @returns {Promise<object>} User document
 */
export const getUserById = async (userId) => {
    return await User.findById(userId);
};

/**
 * Update user profile details.
 * @param {string} userId 
 * @param {object} profileData 
 * @returns {Promise<object>} Updated user document
 */
export const updateProfile = async (userId, profileData) => {
    const { name, email, phone, filename } = profileData;

    const user = await User.findById(userId);
    if (!user) {
        throw new Error("User not found");
    }

    // Handle email changes
    if (email && email.toLowerCase().trim() !== user.email.toLowerCase().trim()) {
        if (user.googleId) {
            throw new Error("Google account email cannot be modified.");
        }

        const existingUser = await User.findOne({ email: email.toLowerCase().trim(), _id: { $ne: userId } });
        if (existingUser) {
            throw new Error("Email already in use!");
        }
        user.email = email.toLowerCase().trim();
    }

    user.name = name ? name.trim() : user.name;
    user.phone = phone ? phone.trim() : user.phone;

    if (filename) {
        user.image = filename;
    }

    const updatedUser = await user.save();
    return updatedUser;
};

/**
 * Remove user profile image.
 * @param {string} userId 
 * @returns {Promise<object>} Updated user document
 */
export const removeProfileImage = async (userId) => {
    const updatedUser = await User.findByIdAndUpdate(
        userId,
        { $set: { image: "" } },
        { new: true }
    );
    if (!updatedUser) {
        throw new Error("User not found");
    }
    return updatedUser;
};

export default {
    getUserById,
    updateProfile,
    removeProfileImage
};
