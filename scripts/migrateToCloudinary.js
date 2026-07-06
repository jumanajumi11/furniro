import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Load .env first from absolute path of project root
dotenv.config({ path: path.join(__dirname, '../.env') });

// Log env loading status for debugging (mask secrets)
console.log('\n[DEBUG] Loading environment variables...');
const cloudName = process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY || process.env.CLOUDINARY_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET || process.env.CLOUDINARY_SECRET;
const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || process.env.MONGODB;

console.log(`[DEBUG] CLOUDINARY_CLOUD_NAME: ${cloudName ? 'LOADED' : 'NOT FOUND'}`);
console.log(`[DEBUG] CLOUDINARY_API_KEY: ${apiKey ? 'LOADED' : 'NOT FOUND'}`);
console.log(`[DEBUG] CLOUDINARY_API_SECRET: ${apiSecret ? 'LOADED' : 'NOT FOUND'}`);
console.log(`[DEBUG] MONGO_URI: ${mongoUri ? 'LOADED' : 'NOT FOUND'}`);

// 2. Validate environment variables before importing modules that depend on them
if (!cloudName || !apiKey || !apiSecret || !mongoUri) {
    const missing = [];
    if (!cloudName) missing.push('CLOUDINARY_CLOUD_NAME (or CLOUDINARY_NAME)');
    if (!apiKey) missing.push('CLOUDINARY_API_KEY (or CLOUDINARY_KEY)');
    if (!apiSecret) missing.push('CLOUDINARY_API_SECRET (or CLOUDINARY_SECRET)');
    if (!mongoUri) missing.push('MONGO_URI (or MONGODB_URI / MONGODB)');
    
    console.error(`\n================================================================`);
    console.error(`[MIGRATION ERROR] Missing required environment variables:`);
    console.error(`----------------------------------------------------------------`);
    missing.forEach(m => console.error(` - Missing: ${m}`));
    console.error(`================================================================`);
    console.error(`Please update your .env file in the root folder with these keys.`);
    console.error(`Example:`);
    console.error(`CLOUDINARY_CLOUD_NAME=your_cloud_name`);
    console.error(`CLOUDINARY_API_KEY=your_api_key`);
    console.error(`CLOUDINARY_API_SECRET=your_api_secret`);
    console.error(`MONGO_URI=mongodb+srv://user:pass@cluster0.../furnitureDB`);
    console.error(`================================================================\n`);
    process.exit(1);
}

// 3. Dynamically import modules to ensure dotenv.config() runs first
const mongoose = (await import('mongoose')).default;
const fs = (await import('fs')).default;
const connectDB = (await import('../src/config/db.js')).default;
const Product = (await import('../src/models/product.js')).default;
const Banner = (await import('../src/models/banner.js')).default;
const User = (await import('../src/models/user.js')).default;
const { uploadToCloudinary } = await import('../src/utils/cloudinary.js');

/**
 * Resolves database image paths or filenames to actual local files inside the project.
 */
const findLocalFile = (imagePath, type) => {
    if (!imagePath || typeof imagePath !== 'string') return null;
    
    // If it starts with http, it's not a local file
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) return null;

    // Clean up potential prefixes
    const cleanPath = imagePath.replace(/^\/+/, ''); // remove leading slashes

    // Possible search paths relative to process.cwd()
    const searchPaths = [];

    // 1. Try resolving it directly
    searchPaths.push(path.join(process.cwd(), cleanPath));
    searchPaths.push(path.join(process.cwd(), 'public', cleanPath));
    
    // 2. If it contains 'uploads/' or 'upload/', try changing one to the other
    if (cleanPath.startsWith('uploads/')) {
        const withoutUploads = cleanPath.substring('uploads/'.length);
        searchPaths.push(path.join(process.cwd(), 'public/upload', withoutUploads));
        searchPaths.push(path.join(process.cwd(), 'public/uploads', withoutUploads));
    } else if (cleanPath.startsWith('upload/')) {
        const withoutUpload = cleanPath.substring('upload/'.length);
        searchPaths.push(path.join(process.cwd(), 'public/upload', withoutUpload));
        searchPaths.push(path.join(process.cwd(), 'public/uploads', withoutUpload));
    }

    // 3. Try fallback paths based on type and filename
    const filename = path.basename(cleanPath);
    if (type === 'product') {
        searchPaths.push(path.join(process.cwd(), 'public/upload/products', filename));
        searchPaths.push(path.join(process.cwd(), 'public/uploads/products', filename));
    } else if (type === 'banner') {
        searchPaths.push(path.join(process.cwd(), 'public/upload/banners', filename));
        searchPaths.push(path.join(process.cwd(), 'public/uploads/banners', filename));
    } else if (type === 'user') {
        searchPaths.push(path.join(process.cwd(), 'public/upload', filename));
        searchPaths.push(path.join(process.cwd(), 'public/uploads', filename));
        searchPaths.push(path.join(process.cwd(), 'public/upload/profile', filename));
        searchPaths.push(path.join(process.cwd(), 'public/uploads/profile', filename));
    }

    // Return the first path that exists
    for (const p of searchPaths) {
        if (fs.existsSync(p) && !fs.statSync(p).isDirectory()) {
            return p;
        }
    }

    return null;
};

const migrateBanners = async () => {
    const banners = await Banner.find({});
    let count = 0;
    let failed = 0;
    let skipped = 0;

    console.log(`\n--- Migrating Banners (Total: ${banners.length}) ---`);

    for (const banner of banners) {
        const bannerPath = banner.imageUrl || banner.image;
        if (!bannerPath) {
            skipped++;
            continue;
        }

        if (bannerPath.startsWith('http://') || bannerPath.startsWith('https://')) {
            skipped++;
            continue;
        }

        const localPath = findLocalFile(bannerPath, 'banner');
        if (!localPath) {
            console.error(`[Banner] Local file not found for path: "${bannerPath}"`);
            failed++;
            continue;
        }

        try {
            console.log(`[Banner] Uploading ${bannerPath} to Cloudinary...`);
            const uploadResult = await uploadToCloudinary(localPath, 'banners');
            
            if (banner.imageUrl !== undefined) banner.imageUrl = uploadResult.secure_url;
            if (banner.image !== undefined) banner.image = uploadResult.secure_url;
            await banner.save();

            console.log(`[Banner] Successfully migrated: ${bannerPath} -> ${uploadResult.secure_url}`);
            count++;
        } catch (err) {
            console.error(`[Banner] Failed to migrate ${bannerPath}:`, err.message);
            failed++;
        }
    }

    return { total: banners.length, migrated: count, failed, skipped };
};

const migrateUsers = async () => {
    const users = await User.find({});
    let count = 0;
    let failed = 0;
    let skipped = 0;

    console.log(`\n--- Migrating Users (Total: ${users.length}) ---`);

    for (const user of users) {
        const userPath = user.image || user.profileImage;
        if (!userPath) {
            skipped++;
            continue;
        }

        if (userPath.startsWith('http://') || userPath.startsWith('https://')) {
            skipped++;
            continue;
        }

        const localPath = findLocalFile(userPath, 'user');
        if (!localPath) {
            console.error(`[User] Local file not found for path: "${userPath}"`);
            failed++;
            continue;
        }

        try {
            console.log(`[User] Uploading ${userPath} to Cloudinary...`);
            const uploadResult = await uploadToCloudinary(localPath, 'profiles');
            
            if (user.image !== undefined) user.image = uploadResult.secure_url;
            if (user.profileImage !== undefined) user.profileImage = uploadResult.secure_url;
            await user.save();

            console.log(`[User] Successfully migrated: ${userPath} -> ${uploadResult.secure_url}`);
            count++;
        } catch (err) {
            console.error(`[User] Failed to migrate ${userPath}:`, err.message);
            failed++;
        }
    }

    return { total: users.length, migrated: count, failed, skipped };
};

const migrateProducts = async () => {
    const products = await Product.find({});
    let count = 0;
    let failed = 0;
    let skipped = 0;

    console.log(`\n--- Migrating Products (Total: ${products.length}) ---`);

    for (const product of products) {
        let isModified = false;

        // 1. Migrate main images array
        if (product.images && product.images.length > 0) {
            const newImages = [];
            for (const img of product.images) {
                if (img.startsWith('http://') || img.startsWith('https://')) {
                    newImages.push(img);
                    continue;
                }

                const localPath = findLocalFile(img, 'product');
                if (!localPath) {
                    console.error(`[Product Main Image] Local file not found for: "${img}"`);
                    newImages.push(img);
                    failed++;
                    continue;
                }

                try {
                    console.log(`[Product] Uploading main image ${img} to Cloudinary...`);
                    const result = await uploadToCloudinary(localPath, 'products');
                    newImages.push(result.secure_url);
                    isModified = true;
                } catch (err) {
                    console.error(`[Product Main Image] Failed to upload ${img}:`, err.message);
                    newImages.push(img);
                    failed++;
                }
            }
            product.images = newImages;
        }

        // 2. Migrate color-specific images
        if (product.colors && product.colors.length > 0) {
            for (const color of product.colors) {
                if (color.images && color.images.length > 0) {
                    const newColorImages = [];
                    for (const img of color.images) {
                        if (img.startsWith('http://') || img.startsWith('https://')) {
                            newColorImages.push(img);
                            continue;
                        }

                        const localPath = findLocalFile(img, 'product');
                        if (!localPath) {
                            console.error(`[Product Color Image] Local file not found for: "${img}"`);
                            newColorImages.push(img);
                            failed++;
                            continue;
                        }

                        try {
                            console.log(`[Product Color] Uploading color image ${img} to Cloudinary...`);
                            const result = await uploadToCloudinary(localPath, 'products');
                            newColorImages.push(result.secure_url);
                            isModified = true;
                        } catch (err) {
                            console.error(`[Product Color Image] Failed to upload ${img}:`, err.message);
                            newColorImages.push(img);
                            failed++;
                        }
                    }
                    color.images = newColorImages;
                }
            }
        }

        if (isModified) {
            try {
                await product.save();
                console.log(`[Product] Successfully migrated product ID: ${product._id}`);
                count++;
            } catch (err) {
                console.error(`[Product] Failed to save product ID: ${product._id}:`, err.message);
                failed++;
            }
        } else {
            skipped++;
        }
    }

    return { total: products.length, migrated: count, failed, skipped };
};

const runMigration = async () => {
    try {
        console.log('Connecting to database...');
        await connectDB();

        console.log('Starting Cloudinary migration...');

        const bannerResult = await migrateBanners();
        const userResult = await migrateUsers();
        const productResult = await migrateProducts();

        console.log('\n=================================');
        console.log('MIGRATION SUMMARY');
        console.log('=================================');
        console.log(`Banners:  Total: ${bannerResult.total}, Migrated: ${bannerResult.migrated}, Failed: ${bannerResult.failed}, Skipped: ${bannerResult.skipped}`);
        console.log(`Users:    Total: ${userResult.total}, Migrated: ${userResult.migrated}, Failed: ${userResult.failed}, Skipped: ${userResult.skipped}`);
        console.log(`Products: Total: ${productResult.total}, Migrated: ${productResult.migrated}, Failed: ${productResult.failed}, Skipped: ${productResult.skipped}`);
        console.log('=================================\n');

        console.log('Migration finished. Closing connection...');
        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error('Fatal migration error:', error);
        process.exit(1);
    }
};

runMigration();
