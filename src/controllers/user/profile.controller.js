import profileService from '../../services/user/profile.service.js';
import { logger } from '../../utils/logger.js';
import fs from 'fs';
import { uploadToCloudinary, deleteFromCloudinary, getPublicIdFromUrl } from '../../utils/cloudinary.js';

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
        
        let newImageUrl = null;
        let oldImage = null;

        if (req.file) {
            try {
                const user = await profileService.getUserById(userId);
                if (user && user.image) {
                    oldImage = user.image;
                }
                const result = await uploadToCloudinary(req.file.path, 'profiles');
                newImageUrl = result.secure_url;
                await fs.promises.unlink(req.file.path).catch(() => {});
            } catch (uploadErr) {
                if (req.file) {
                    await fs.promises.unlink(req.file.path).catch(() => {});
                }
                return res.status(500).json({ success: false, message: 'Cloudinary upload failed.' });
            }
        }

        const updatedUser = await profileService.updateProfile(userId, { 
            name, 
            email, 
            phone, 
            filename: newImageUrl 
        });
        
        req.session.user = updatedUser;

        // If update succeeded, delete the old image from Cloudinary
        if (oldImage) {
            const publicId = getPublicIdFromUrl(oldImage);
            if (publicId) {
                await deleteFromCloudinary(publicId).catch(() => {});
            }
        }

        res.json({ success: true, message: "Profile updated successfully!" });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message || "Server error" });
    }
};

export const removeProfileImage = async (req, res, next) => {
    try {
        const userId = req.session.user._id;
        
        // Find current user profile image to delete from Cloudinary
        const user = await profileService.getUserById(userId);
        let oldImage = null;
        if (user && user.image) {
            oldImage = user.image;
        }

        const updatedUser = await profileService.removeProfileImage(userId);

        req.session.user = updatedUser.toObject ? updatedUser.toObject() : updatedUser;
        
        if (oldImage) {
            const publicId = getPublicIdFromUrl(oldImage);
            if (publicId) {
                await deleteFromCloudinary(publicId).catch(() => {});
            }
        }

        req.session.save((err) => {
            if (err) {
                logger.error('Profile session save error:', err);
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
