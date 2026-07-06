

/**
 * Format string to lowercase and trim it.
 * @param {string} str 
 * @returns {string}
 */
export const cleanString = (str) => {
    return str ? str.trim().toLowerCase() : '';
};

/**
 * Format numeric price to Indian Rupee (INR) currency style.
 * E.g. 1000 -> "₹1,000"
 * @param {number} amount 
 * @returns {string}
 */
export const formatCurrency = (amount) => {
    const value = parseFloat(amount);
    if (isNaN(value)) return '₹0';
    return `₹${value.toLocaleString('en-IN')}`;
};

