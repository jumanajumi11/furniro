import Joi from 'joi';
import { phoneCustomValidator } from '../utils/phoneValidator.js';

export const addressSchema = Joi.object({
    name: Joi.string().trim().min(2).required().messages({
        'string.empty': 'Name is required.',
        'string.min': 'Name must be at least 2 characters.'
    }),
    phone: Joi.string().required().custom(phoneCustomValidator).messages({
        'string.empty': 'Phone number is required.'
    }),
    pincode: Joi.string().trim().pattern(/^\d{6}$/).required().messages({
        'string.pattern.base': 'Pincode must be a 6-digit number.',
        'string.empty': 'Pincode is required.'
    }),
    state: Joi.string().trim().required().messages({
        'string.empty': 'State is required.'
    }),
    city: Joi.string().trim().required().messages({
        'string.empty': 'City is required.'
    }),
    locality: Joi.string().trim().required().messages({
        'string.empty': 'Locality is required.'
    }),
    house: Joi.string().trim().required().messages({
        'string.empty': 'House/Flat number is required.'
    }),
    area: Joi.string().trim().required().messages({
        'string.empty': 'Area/Street is required.'
    }),
    isDefault: Joi.any().optional()
});
