import Joi from 'joi';


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

export const signupSchema = Joi.object({
    name: Joi.string().trim().min(2).required().messages({
        'string.empty': 'Name is required.',
        'string.min': 'Name must be at least 2 characters long.'
    }),
    email: Joi.string().trim().email().lowercase().required().messages({
        'string.email': 'Invalid email format.',
        'string.empty': 'Email is required.'
    }),
    password: passwordComplexity,
    confirmPassword: Joi.any().equal(Joi.ref('password')).required().messages({
        'any.only': 'Passwords do not match.'
    })
});

export const loginSchema = Joi.object({
    email: Joi.string().trim().email().lowercase().required().messages({
        'string.email': 'Invalid email format.',
        'string.empty': 'Email is required.'
    }),
    password: Joi.string().required().messages({
        'string.empty': 'Password is required.'
    })
});

export const forgotPasswordSchema = Joi.object({
    email: Joi.string().trim().email().lowercase().required().messages({
        'string.email': 'Invalid email format.',
        'string.empty': 'Email is required.'
    })
});

export const verifyOtpSchema = Joi.object({
    otp: Joi.string().trim().length(6).pattern(/^\d+$/).required().messages({
        'string.length': 'OTP must be 6 digits.',
        'string.pattern.base': 'OTP must contain only numbers.',
        'string.empty': 'OTP is required.'
    })
});

export const resetPasswordSchema = Joi.object({
    password: passwordComplexity,
    confirmPassword: Joi.any().equal(Joi.ref('password')).required().messages({
        'any.only': 'Passwords do not match.'
    })
});
