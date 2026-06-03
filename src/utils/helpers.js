/**
 * General helper functions for the ecommerce app.
 */

/**
 * Format string to lowercase and trim it.
 * @param {string} str 
 * @returns {string}
 */
export const cleanString = (str) => {
    return str ? str.trim().toLowerCase() : '';
};
