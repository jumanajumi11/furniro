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

    // Coupon Code
    if (!code || !code.trim()) {
        throw new Error('Coupon code is required.');
    }
    
    const formattedCode = code.trim().toUpperCase();
    const codeRegex = /^[A-Z0-9_-]+$/;
    if (!codeRegex.test(formattedCode)) {
        throw new Error('Please enter a valid coupon code.');
    }

    // Uniqueness
    const query = { code: formattedCode };
    if (isEdit && couponId) {
        query._id = { $ne: couponId };
    }
    const existing = await Coupon.findOne(query);
    if (existing) {
        throw new Error('Coupon code already exists.');
    }

    // Discount Type
    if (!discountType || (discountType !== 'percentage' && discountType !== 'flat')) {
        throw new Error('Discount type is required.');
    }

    // Discount Value
    const val = parseFloat(discountValue);
    if (isNaN(val) || val <= 0) {
        throw new Error('Discount value must be greater than 0.');
    }

    if (discountType === 'percentage' && val > 90) {
        throw new Error('Percentage discount cannot exceed 90%.');
    }

    // Minimum Purchase Amount
    if (minPurchase === undefined || minPurchase === null || minPurchase === '') {
        throw new Error('Minimum purchase amount is required.');
    }
    const minP = parseFloat(minPurchase);
    if (isNaN(minP) || minP < 0) {
        throw new Error('Minimum purchase amount cannot be negative.');
    }

    // Maximum Discount
    let maxD = null;
    if (discountType === 'percentage') {
        if (maxDiscount === undefined || maxDiscount === null || maxDiscount === '') {
            throw new Error('Maximum discount is required.');
        }
        maxD = parseFloat(maxDiscount);
        if (isNaN(maxD) || maxD <= 0) {
            throw new Error('Maximum discount must be greater than 0.');
        }
    } else {
        if (maxDiscount !== undefined && maxDiscount !== null && maxDiscount !== '') {
            maxD = parseFloat(maxDiscount);
            if (isNaN(maxD) || maxD <= 0) {
                throw new Error('Maximum discount must be greater than 0.');
            }
        }
    }

    // Expiry Date
    if (!expiryDate) {
        throw new Error('Expiry date is required.');
    }

    const expDate = new Date(expiryDate);
    if (isNaN(expDate.getTime())) {
        throw new Error('Invalid expiry date.');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkExp = new Date(expDate);
    checkExp.setHours(0, 0, 0, 0);
    if (checkExp < today) {
        throw new Error('Expiry date cannot be in the past.');
    }

    // Usage Limit
    if (usageLimit === undefined || usageLimit === null || usageLimit === '') {
        throw new Error('Usage limit is required.');
    }
    const usageL = parseInt(usageLimit);
    if (isNaN(usageL) || usageL <= 0) {
        throw new Error('Usage limit must be a positive integer greater than 0.');
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
