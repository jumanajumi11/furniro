import mongoose from 'mongoose';

const couponSchema = new mongoose.Schema({
    code:         { type: String, required: true, unique: true, uppercase: true, trim: true },
    discountType: { type: String, enum: ['flat', 'percentage'], default: 'flat' },
    discountValue:{ type: Number, required: true },
    minPurchase:  { type: Number, default: 0 },
    maxDiscount:  { type: Number, default: null },
    expiryDate:   { type: Date, required: true },
    isActive:     { type: Boolean, default: true }
}, { timestamps: true });

const Coupon = mongoose.models.Coupon || mongoose.model('Coupon', couponSchema);
export default Coupon;
