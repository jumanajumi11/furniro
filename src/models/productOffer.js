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
        required: true
    },
    offerPercentage: {
        type: Number,
        required: true,
        min: 1,
        max: 90
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
