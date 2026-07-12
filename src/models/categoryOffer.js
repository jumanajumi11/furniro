import mongoose from 'mongoose';

const categoryOfferSchema = new mongoose.Schema({
    offerName: {
        type: String,
        required: [true, 'Offer name is required'],
        unique: true,
        trim: true
    },
    offerType: {
        type: String,
        default: 'category',
        enum: ['category']
    },
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        required: [true, 'Please select a category.']
    },
    discountType: {
        type: String,
        enum: ['Percentage', 'Fixed Amount'],
        required: [true, 'Discount type is required']
    },
    discountValue: {
        type: Number,
        required: [true, 'Discount value is required']
    },
    offerPercentage: {
        type: Number,
        default: 0
    },
    startDate: {
        type: Date,
        required: true
    },
    expiryDate: {
        type: Date,
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

// Expiry date must be after start date validation
categoryOfferSchema.pre('validate', function() {
    if (
        this.startDate &&
        this.expiryDate &&
        this.expiryDate <= this.startDate
    ) {
        this.invalidate(
            'expiryDate',
            'Expiry date must be after start date'
        );
    }
});

const CategoryOffer = mongoose.models.CategoryOffer || mongoose.model('CategoryOffer', categoryOfferSchema);
export default CategoryOffer;
