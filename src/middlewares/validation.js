import Joi from 'joi';

/**
 
 * @param {Joi.ObjectSchema} 
 * @param {string} source 'body' | 'query' | 'params'
 */
export const validate = (schema, source = 'body') => {
    return (req, res, next) => {
        const data = req[source];
        const { error, value } = schema.validate(data, { abortEarly: true, allowUnknown: true });

        if (error) {
            const errorMessage = error.details[0].message;

            
            const path = req.path;

            if (path === '/signup') {
                return res.render('user/signup', { error: errorMessage });
            }

            if (path === '/login') {
                return res.render('user/login', { error: errorMessage });
            }

            if (path === '/change-password') {
                return res.redirect(`/security?error=${encodeURIComponent(errorMessage)}`);
            }

            if (path === '/create-password') {
                return res.redirect(`/security?error=${encodeURIComponent(errorMessage)}`);
            }

            
            return res.status(400).json({
                success: false,
                message: errorMessage
            });
        }

        
        req[source] = value;
        next();
    };
};

export default validate;
