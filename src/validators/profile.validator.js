import Joi from 'joi';
import { validateEmailFormat } from '../utils/emailValidator.js';
import { phoneCustomValidator } from '../utils/phoneValidator.js';

const emailCustomValidator = (value, helpers) => {
    const errorMsg = validateEmailFormat(value);
    if (errorMsg) {
        return helpers.message(errorMsg);
    }
    return value.toLowerCase().trim();
};

export const profileUpdateSchema = Joi.object({
    name: Joi.string().trim().min(2).required().messages({
        'string.empty': 'Name is required.',
        'string.min': 'Name must be at least 2 characters long.'
    }),
    email: Joi.string().required().custom(emailCustomValidator).messages({
        'string.empty': 'Email is required.'
    }),
    phone: Joi.string().allow('').custom(phoneCustomValidator)
});
