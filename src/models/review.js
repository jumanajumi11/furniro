import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema({
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    userName:  { type: String, required: true },
    rating:    { type: Number, required: true, min: 1, max: 5 },
    title:     { type: String, required: true, trim: true },
    comment:   { type: String, required: true, trim: true },
    images:    { type: [String], default: [] }
}, { timestamps: true });

const Review = mongoose.models.Review || mongoose.model('Review', reviewSchema);
export default Review;
