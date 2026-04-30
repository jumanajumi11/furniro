const User = require('../models/user');
const bcrypt = require('bcryptjs');

const createUser = async (email, password, name) => {
    try {
        
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password.trim(), salt);

        
        const user = new User({
            name: name,
            email: email.toLowerCase().trim(),
            password: hashedPassword, 
            isVerified: true
        });

        const savedUser = await user.save();
        console.log("✅ Hash saved in DB:", savedUser.password); 
        return savedUser;
    } catch (error) {
        console.error("Signup Error:", error);
        throw error;
    }
};

const loginUser = async (email, password) => {
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) throw new Error("User not found");

    console.log("--- LOGIN DEBUG ---");
    console.log("DB Password Hash:", user.password);

    
    const isMatch = await bcrypt.compare(password.trim(), user.password);
    console.log("Password Match Result:", isMatch);

    if (!isMatch) throw new Error("Wrong password");
    return user;
};

module.exports = { createUser, loginUser };