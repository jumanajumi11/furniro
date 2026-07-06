import Coupon from '../../models/coupon.js';

export const autoDeactivateExpiredCoupons = async () => {
    const now = new Date();
    await Coupon.updateMany(
        { expiryDate: { $lte: now }, isActive: true },
        { isActive: false }
    );
};

export const validateCoupon = async (data, isEdit = false, couponId = null) => {
    const { code, discountType, discountValue, minPurchase, maxDiscount, usageLimit, expiryDate } = data;

    if (!code || !code.trim()) {
        throw new Error('Coupon code is required.');
    }
    
    const formattedCode = code.trim().toUpperCase();
    if (formattedCode.length < 3 || formattedCode.length > 20) {
        throw new Error('Coupon code length must be between 3 and 20 characters.');
    }

    const codeRegex = /^[A-Z0-9_-]+$/;
    if (!codeRegex.test(formattedCode)) {
        throw new Error('Coupon code must contain only letters, numbers, underscores, and hyphens.');
    }

    
    const query = { code: formattedCode };
    if (isEdit && couponId) {
        query._id = { $ne: couponId };
    }
    const existing = await Coupon.findOne(query);
    if (existing) {
        throw new Error('Coupon code already exists.');
    }

    const val = parseFloat(discountValue);
    if (isNaN(val) || val <= 0) {
        throw new Error('Discount value must be greater than 0.');
    }

    if (discountType === 'percentage' && val > 90) {
        throw new Error('Percentage discount cannot exceed 90%.');
    }

    const minP = parseFloat(minPurchase) || 0;
    if (minP < 0) {
        throw new Error('Minimum purchase amount cannot be negative.');
    }

    let maxD = null;
    if (maxDiscount !== undefined && maxDiscount !== null && maxDiscount !== '') {
        maxD = parseFloat(maxDiscount);
        if (isNaN(maxD) || maxD < 0) {
            throw new Error('Maximum discount cannot be negative.');
        }
    }

    let usageL = null;
    if (usageLimit !== undefined && usageLimit !== null && usageLimit !== '') {
        usageL = parseInt(usageLimit);
        if (isNaN(usageL) || usageL <= 0) {
            throw new Error('Usage limit must be a positive integer.');
        }
    }

    if (!expiryDate) {
        throw new Error('Expiry date is required.');
    }

    const expDate = new Date(expiryDate);
    if (isNaN(expDate.getTime())) {
        throw new Error('Invalid expiry date.');
    }

    if (!isEdit && expDate <= new Date()) {
        throw new Error('Expiry date must be a future date during creation.');
    }

    return {
        code: formattedCode,
        couponCode: formattedCode,
        discountType,
        discountValue: val,
        minPurchase: minP,
        minimumPurchase: minP,
        maxDiscount: maxD,
        usageLimit: usageL,
        expiryDate: expDate
    };
};

export const create = async (data) => {
    const validatedData = await validateCoupon(data, false);
    const newCoupon = new Coupon({
        ...validatedData,
        isActive: true
    });
    return await newCoupon.save();
};

export const update = async (id, data) => {
    const coupon = await Coupon.findById(id);
    if (!coupon) {
        throw new Error('Coupon not found.');
    }

    const now = new Date();
    if (new Date(coupon.expiryDate) <= now) {
        throw new Error('Expired coupon cannot be edited.');
    }

    const validatedData = await validateCoupon(data, true, id);
    Object.assign(coupon, validatedData);
    return await coupon.save();
};

export const remove = async (id) => {
    const deleted = await Coupon.findByIdAndDelete(id);
    if (!deleted) {
        throw new Error('Coupon not found.');
    }
    return deleted;
};

export const toggleStatus = async (id) => {
    const coupon = await Coupon.findById(id);
    if (!coupon) {
        throw new Error('Coupon not found.');
    }

    const now = new Date();
    if (new Date(coupon.expiryDate) <= now) {
        throw new Error('Expired coupon cannot be activated again.');
    }

    coupon.isActive = !coupon.isActive;
    return await coupon.save();
};
