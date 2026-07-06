import fs from 'fs';
import path from 'path';
import https from 'https';
import Banner from '../../models/banner.js';
import { uploadToCloudinary, deleteFromCloudinary, getPublicIdFromUrl } from '../../utils/cloudinary.js';

// Delete file helper
const deleteFile = (filename) => {
    if (filename) {
        const filePath = path.join(process.cwd(), 'public/upload/banners', filename);
        if (fs.existsSync(filePath)) {
            try {
                fs.unlinkSync(filePath);
            } catch (err) {
                console.error(`Error deleting banner file: ${filePath}`, err);
            }
        }
    }
};

// Download helper for auto-seeding
const downloadImage = (url, filepath) => {
    return new Promise((resolve, reject) => {
        const dir = path.dirname(filepath);
        if (!fs.existsSync(dir)){
            fs.mkdirSync(dir, { recursive: true });
        }
        const file = fs.createWriteStream(filepath);
        https.get(url, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to get image: ${response.statusCode}`));
                return;
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close(resolve);
            });
        }).on('error', (err) => {
            fs.unlink(filepath, () => reject(err));
        });
    });
};

export const loadBanners = async (req, res) => {
    try {
        // Auto-seed Shop page banner if none exists and hasn't been seeded before
        const seedFlagFile = path.join(process.cwd(), 'public/upload/banners/.seeded-shop-banner');
        let shopBanner = await Banner.findOne({ page: 'shop' });
        if (!shopBanner && !fs.existsSync(seedFlagFile)) {
            const url = 'https://images.unsplash.com/photo-1540518614846-7eded433c457?auto=format&fit=crop&w=1920&q=80';
            const filename = 'shop-banner-default.jpg';
            const filepath = path.join(process.cwd(), 'public/upload/banners', filename);
            try {
                await downloadImage(url, filepath);
                const result = await uploadToCloudinary(filepath, 'banners');
                await Banner.create({
                    title: 'Shop',
                    page: 'shop',
                    imageUrl: result.secure_url,
                    status: 'Active'
                });
                if (fs.existsSync(filepath)) {
                    fs.unlinkSync(filepath);
                }
                
                // Write flag file
                fs.writeFileSync(seedFlagFile, 'seeded');
            } catch (seedError) {
                console.error('[Admin] Failed to auto-seed shop banner image:', seedError.message);
            }
        }

        const banners = await Banner.find({}).sort({ createdAt: -1 }).lean();
        res.render('admin/banner-list', {
            banners,
            adminUser: req.session.admin || { name: 'Jumana' }
        });
    } catch (error) {
        console.error('[Admin] loadBanners error:', error);
        res.status(500).send('Internal Server Error');
    }
};

export const createBanner = async (req, res) => {
    try {
        const { title, page, status } = req.body;

        const cleanupUploadedFile = () => {
            if (req.file) {
                try { fs.unlinkSync(req.file.path); } catch (e) {}
            }
        };

        if (!title || !title.trim()) {
            cleanupUploadedFile();
            return res.status(400).json({ success: false, message: 'Banner title is required.' });
        }

        if (!page || !page.trim() || !['home', 'shop'].includes(page)) {
            cleanupUploadedFile();
            return res.status(400).json({ success: false, message: 'Banner page is required.' });
        }

        if (!status || !['Active', 'Inactive'].includes(status)) {
            cleanupUploadedFile();
            return res.status(400).json({ success: false, message: 'Status is required.' });
        }

        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Banner image is required.' });
        }

        let uploadResult = null;
        try {
            uploadResult = await uploadToCloudinary(req.file.path, 'banners');
            await fs.promises.unlink(req.file.path).catch(() => {});
        } catch (uploadErr) {
            cleanupUploadedFile();
            return res.status(500).json({ success: false, message: 'Cloudinary upload failed.' });
        }

        const banner = await Banner.create({
            title: title.trim(),
            page,
            imageUrl: uploadResult.secure_url,
            status
        });

        return res.status(201).json({
            success: true,
            message: 'Banner created successfully.',
            banner
        });

    } catch (error) {
        console.error('[Admin] createBanner error:', error);
        if (req.file) {
            try { fs.unlinkSync(req.file.path); } catch (e) {}
        }
        return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

export const updateBanner = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, page, status, imageRemoved } = req.body;

        const cleanupUploadedFile = () => {
            if (req.file) {
                try { fs.unlinkSync(req.file.path); } catch (e) {}
            }
        };

        if (!title || !title.trim()) {
            cleanupUploadedFile();
            return res.status(400).json({ success: false, message: 'Banner title is required.' });
        }

        if (!page || !page.trim() || !['home', 'shop'].includes(page)) {
            cleanupUploadedFile();
            return res.status(400).json({ success: false, message: 'Banner page is required.' });
        }

        if (!status || !['Active', 'Inactive'].includes(status)) {
            cleanupUploadedFile();
            return res.status(400).json({ success: false, message: 'Status is required.' });
        }

        const banner = await Banner.findById(id);
        if (!banner) {
            cleanupUploadedFile();
            return res.status(404).json({ success: false, message: 'Banner not found.' });
        }

        if (imageRemoved === 'true' && !req.file) {
            cleanupUploadedFile();
            return res.status(400).json({ success: false, message: 'Please upload a banner image.' });
        }

        let oldImage = null;
        let newImageUrl = banner.imageUrl;

        if (imageRemoved === 'true') {
            oldImage = banner.imageUrl;
            if (req.file) {
                try {
                    const result = await uploadToCloudinary(req.file.path, 'banners');
                    newImageUrl = result.secure_url;
                    await fs.promises.unlink(req.file.path).catch(() => {});
                } catch (uploadErr) {
                    cleanupUploadedFile();
                    return res.status(500).json({ success: false, message: 'Cloudinary upload failed.' });
                }
            } else {
                newImageUrl = '';
            }
        } else if (req.file) {
            oldImage = banner.imageUrl;
            try {
                const result = await uploadToCloudinary(req.file.path, 'banners');
                newImageUrl = result.secure_url;
                await fs.promises.unlink(req.file.path).catch(() => {});
            } catch (uploadErr) {
                cleanupUploadedFile();
                return res.status(500).json({ success: false, message: 'Cloudinary upload failed.' });
            }
        }

        banner.imageUrl = newImageUrl;
        banner.title = title.trim();
        banner.page = page;
        banner.status = status;

        await banner.save();

        if (oldImage) {
            const publicId = getPublicIdFromUrl(oldImage);
            if (publicId) {
                await deleteFromCloudinary(publicId).catch(() => {});
            }
        }

        return res.status(200).json({
            success: true,
            message: 'Banner updated successfully.',
            banner
        });

    } catch (error) {
        console.error('[Admin] updateBanner error:', error);
        if (req.file) {
            try { fs.unlinkSync(req.file.path); } catch (e) {}
        }
        return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

export const deleteBanner = async (req, res) => {
    try {
        const { id } = req.params;
        const banner = await Banner.findById(id);
        if (!banner) {
            return res.status(404).json({ success: false, message: 'Banner not found.' });
        }

        const image = banner.imageUrl;
        await Banner.findByIdAndDelete(id);

        if (image) {
            const publicId = getPublicIdFromUrl(image);
            if (publicId) {
                await deleteFromCloudinary(publicId).catch(() => {});
            }
        }

        return res.status(200).json({
            success: true,
            message: 'Banner deleted successfully.'
        });

    } catch (error) {
        console.error('[Admin] deleteBanner error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

// User-side banners API endpoint
export const getUserBanners = async (req, res) => {
    try {
        const { page } = req.query;
        const query = { status: 'Active' };
        if (page) {
            query.page = page;
        }
        const banners = await Banner.find(query).sort({ createdAt: -1 }).lean();
        return res.json(banners);
    } catch (error) {
        console.error('[User API] getUserBanners error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};
