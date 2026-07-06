import mongoose from 'mongoose';

const bannerSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Banner title is required'],
        trim: true
    },
    page: {
        type: String,
        required: [true, 'Page location is required'],
        enum: ['home', 'shop']
    },
    imageUrl: {
        type: String,
        required: [true, 'Banner image URL is required']
    },
    status: {
        type: String,
        required: [true, 'Status is required'],
        enum: ['Active', 'Inactive'],
        default: 'Active'
    }
}, { timestamps: true });

const Banner = mongoose.models.Banner || mongoose.model('Banner', bannerSchema);
export default Banner;
