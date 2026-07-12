import mongoose from 'mongoose';

const productOfferSchema = new mongoose.Schema({
    offerName: {
        type: String,
        required: [true, 'Offer name is required'],
        unique: true,
        trim: true
    },
    offerType: {
        type: String,
        default: 'product',
        enum: ['product']
    },
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: [true, 'Please select a product.']
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

productOfferSchema.pre('validate', function() {
    if (this.expiryDate && this.startDate && this.expiryDate <= this.startDate) {
        this.invalidate(
            'expiryDate',
            'Expiry date must be after start date'
        );
    }
});

const ProductOffer = mongoose.models.ProductOffer || mongoose.model('ProductOffer', productOfferSchema);
export default ProductOffer;
