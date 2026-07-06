import { cloudinary } from '../config/cloudinary.js';
import { logger } from './logger.js';

/**
 * Uploads a local file to Cloudinary.
 * @param {string} filePath - Absolute or relative path to the local file
 * @param {string} folder - Folder name in Cloudinary (e.g. 'products', 'banners', 'profiles')
 * @returns {Promise<{ secure_url: string, public_id: string }>} Upload result containing URL and public ID
 */
export const uploadToCloudinary = async (filePath, folder) => {
    try {
        const result = await cloudinary.uploader.upload(filePath, {
            folder: `furniro/${folder}`
        });
        return {
            secure_url: result.secure_url,
            public_id: result.public_id
        };
    } catch (error) {
        logger.error(`Cloudinary upload failed for file ${filePath}:`, error);
        throw error;
    }
};

/**
 * Deletes an image from Cloudinary using its public ID.
 * @param {string} publicId - Cloudinary public ID of the resource
 * @returns {Promise<any>} Deletion result
 */
export const deleteFromCloudinary = async (publicId) => {
    try {
        if (!publicId) return null;
        const result = await cloudinary.uploader.destroy(publicId);
        return result;
    } catch (error) {
        logger.error(`Cloudinary delete failed for publicId ${publicId}:`, error);
        throw error;
    }
};

/**
 * Parses/extracts the public ID from a Cloudinary secure_url.
 * @param {string} url - Cloudinary secure_url
 * @returns {string|null} The public ID or null if not found
 */
export const getPublicIdFromUrl = (url) => {
    if (!url || typeof url !== 'string') return null;
    if (!url.includes('cloudinary.com')) return null;
    try {
        const parts = url.split('/upload/');
        if (parts.length < 2) return null;
        
        const pathAfterUpload = parts[1];
        const pathSegments = pathAfterUpload.split('/');
        
        // Remove version (e.g. 'v1620938837') if present
        if (pathSegments[0].match(/^v\d+$/)) {
            pathSegments.shift();
        }
        
        const remainingPath = pathSegments.join('/');
        // Remove file extension
        const dotIndex = remainingPath.lastIndexOf('.');
        if (dotIndex !== -1) {
            return remainingPath.substring(0, dotIndex);
        }
        return remainingPath;
    } catch (e) {
        logger.error('Failed to parse Cloudinary URL:', e);
        return null;
    }
};
