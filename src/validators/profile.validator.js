import Joi from 'joi';

export const profileUpdateSchema = Joi.object({
    name: Joi.string().trim().min(2).required().messages({
        'string.empty': 'Name is required.',
        'string.min': 'Name must be at least 2 characters long.'
    }),
    email: Joi.string().trim().email().lowercase().required().messages({
        'string.email': 'Invalid email format.',
        'string.empty': 'Email is required.'
    }),
    phone: Joi.string().trim().pattern(/^\d{10}$/).allow('').messages({
        'string.pattern.base': 'Phone number must be a 10-digit number.'
    })
});
