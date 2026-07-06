import User from '../../models/user.js';
import bcrypt from 'bcryptjs';

/**
 * 
 * @param {string} email 
 * @param {string} password 
 * @param {string} name 
 * @returns {Promise<object>} Saved user document
 */
export const createUser = async (email, password, name) => {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password.trim(), salt);
    const user = new User({
        name: name,
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        isVerified: true
    });
    const savedUser = await user.save();
    return savedUser;
};

/**
 * 
 * @param {string} email 
 * @param {string} password 
 * @returns {Promise<object>} User document
 */
export const loginUser = async (email, password) => {
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) throw new Error('User not found');
    
    const isMatch = await bcrypt.compare(password.trim(), user.password);
    if (!isMatch) throw new Error('Wrong password');
    
    return user;
};

export default {
    createUser,
    loginUser
};
