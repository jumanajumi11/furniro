import profileService from '../../services/user/profile.service.js';

export const loadProfile = async (req, res, next) => {
    try {
        const userId = req.session.user ? req.session.user._id : null;
        if (!userId) {
            return res.redirect('/login');
        }

        const userData = await profileService.getUserById(userId);
        if (!userData) {
            return res.redirect('/login');
        }

        res.render('user/profile', {
            user: userData,
            pageTitle: "My Profile"
        });
    } catch (error) {
        console.error("Load Profile Error:", error.message);
        next(error);
    }
};

export const loadEditProfile = async (req, res, next) => {
    try {
        const userData = await profileService.getUserById(req.session.user._id);
        if (!userData) {
            return res.redirect('/profile');
        }
        res.render('user/edit-profile', { user: userData });
    } catch (error) {
        console.error("Load Edit Profile Error:", error.message);
        res.redirect('/profile');
    }
};

export const updateProfile = async (req, res, next) => {
    try {
        const { name, email, phone } = req.body;
        const userId = req.session.user._id;
        const filename = req.file ? req.file.filename : null;

        const updatedUser = await profileService.updateProfile(userId, { name, email, phone, filename });
        req.session.user = updatedUser;

        res.json({ success: true, message: "Profile updated successfully!" });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message || "Server error" });
    }
};

export const removeProfileImage = async (req, res, next) => {
    try {
        const userId = req.session.user._id;
        const updatedUser = await profileService.removeProfileImage(userId);

        req.session.user = updatedUser.toObject ? updatedUser.toObject() : updatedUser;
        req.session.save((err) => {
            if (err) {
                console.log("Session error:", err);
            }
            res.json({ success: true, message: 'Profile image removed' });
        });
    } catch (error) {
        console.error("Remove image error:", error);
        res.status(500).json({ success: false, message: error.message || 'Failed to remove image' });
    }
};

export default {
    loadProfile,
    loadEditProfile,
    updateProfile,
    removeProfileImage
};
