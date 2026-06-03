import Joi from 'joi';

export const addToCartSchema = Joi.object({
    productId: Joi.string().hex().length(24).required().messages({
        'string.empty': 'Product ID is required.',
        'string.hex': 'Invalid Product ID format.',
        'string.length': 'Product ID must be 24 characters.'
    }),
    variantId: Joi.string().hex().length(24).allow(null, '').optional().messages({
        'string.hex': 'Invalid Variant ID format.',
        'string.length': 'Variant ID must be 24 characters.'
    }),
    quantity: Joi.number().integer().min(1).required().messages({
        'number.base': 'Quantity must be a number.',
        'number.integer': 'Quantity must be an integer.',
        'number.min': 'Quantity must be at least 1.'
    })
});

export const updateQuantitySchema = Joi.object({
    productId: Joi.string().hex().length(24).required().messages({
        'string.empty': 'Product ID is required.',
        'string.hex': 'Invalid Product ID format.',
        'string.length': 'Product ID must be 24 characters.'
    }),
    variantId: Joi.string().hex().length(24).allow(null, '').optional().messages({
        'string.hex': 'Invalid Variant ID format.',
        'string.length': 'Variant ID must be 24 characters.'
    }),
    quantity: Joi.number().integer().min(1).max(10).required().messages({
        'number.base': 'Quantity must be a number.',
        'number.integer': 'Quantity must be an integer.',
        'number.min': 'Quantity must be at least 1.',
        'number.max': 'Quantity cannot exceed 10 units per product.'
    })
});
