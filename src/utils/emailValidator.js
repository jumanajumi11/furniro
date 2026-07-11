/**
 * Validates email format according to custom requirements.
 * @param {string} email 
 * @returns {string|null} Error message if invalid, null if valid.
 */
export const validateEmailFormat = (email) => {
    if (email === undefined || email === null || typeof email !== 'string' || email.trim() === '') {
        return "Email address is required";
    }
    if (email.includes(' ')) {
        return "Email address should not contain spaces";
    }
    if (!email.includes('@')) {
        return "Please enter a valid email address with @";
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return "Please enter a valid email address";
    }
    return null;
};

export default validateEmailFormat;
