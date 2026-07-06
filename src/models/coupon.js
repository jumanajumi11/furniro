import mongoose from 'mongoose';

const couponSchema = new mongoose.Schema({
    code:            { type: String, unique: true, uppercase: true, trim: true },
    couponCode:      { type: String, unique: true, uppercase: true, trim: true },
    discountType:    { type: String, enum: ['flat', 'percentage'], default: 'flat' },
    discountValue:   { type: Number, required: true },
    minPurchase:     { type: Number, default: 0 },
    minimumPurchase: { type: Number, default: 0 },
    maxDiscount:     { type: Number, default: null },
    expiryDate:      { type: Date, required: true },
    usageLimit:      { type: Number, default: null },
    isActive:        { type: Boolean, default: true }
}, { timestamps: true });

couponSchema.pre('validate', function() {
    if (this.couponCode && !this.code) {
        this.code = this.couponCode;
    } else if (this.code && !this.couponCode) {
        this.couponCode = this.code;
    }

    if (this.minimumPurchase !== undefined && this.minPurchase === 0) {
        this.minPurchase = this.minimumPurchase;
    } else if (this.minPurchase !== undefined && this.minimumPurchase === 0) {
        this.minimumPurchase = this.minPurchase;
    }
});

const Coupon = mongoose.models.Coupon || mongoose.model('Coupon', couponSchema);
export default Coupon;
