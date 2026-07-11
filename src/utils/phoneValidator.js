export const validatePhoneFormat = (value) => {
    if (!value) return null;
    if (value.includes(' ')) {
        return 'Phone number cannot contain spaces.';
    }
    if (/[^0-9]/.test(value)) {
        return 'Phone number can contain only numbers.';
    }
    if (value.length !== 10) {
        return 'Phone number must contain exactly 10 digits.';
    }
    if (!/^[6-9]/.test(value)) {
        return 'Please enter a valid Indian mobile number.';
    }
    return null;
};

export const phoneCustomValidator = (value, helpers) => {
    if (!value || value.trim() === '') {
        return '';
    }
    const errorMsg = validatePhoneFormat(value);
    if (errorMsg) {
        return helpers.message(errorMsg);
    }
    return value.trim();
};
