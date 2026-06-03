import Joi from 'joi';

// Custom password complexity check
const passwordComplexity = Joi.string()
    .min(8)
    .pattern(/[a-zA-Z]/)
    .pattern(/[0-9]/)
    .required()
    .messages({
        'string.min': 'Password must be at least 8 characters long.',
        'string.pattern.base': 'Password must contain both letters and numbers.',
        'any.required': 'Password is required.'
    });

export const changePasswordSchema = Joi.object({
    oldPassword: Joi.string().required().messages({
        'string.empty': 'Current password is required.'
    }),
    newPassword: passwordComplexity,
    confirmPassword: Joi.any().equal(Joi.ref('newPassword')).required().messages({
        'any.only': 'Passwords do not match.'
    })
});

export const createPasswordSchema = Joi.object({
    newPassword: passwordComplexity,
    confirmPassword: Joi.any().equal(Joi.ref('newPassword')).required().messages({
        'any.only': 'Passwords do not match.'
    })
});
