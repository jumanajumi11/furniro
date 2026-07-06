import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer';

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_NAME,
    api_key:    process.env.CLOUDINARY_API_KEY   || process.env.CLOUDINARY_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET|| process.env.CLOUDINARY_SECRET
});

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'Furniro_Products',
        allowedFormats: ['jpg', 'png', 'jpeg'],
    },
});

const upload = multer({ storage: storage });

export { cloudinary, upload };