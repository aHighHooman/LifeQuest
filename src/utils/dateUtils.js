/**
 * Date utility functions for consistent date handling.
 */

/**
 * Get today's date in ISO format (YYYY-MM-DD).
 * Used for history keys and date comparisons throughout the app.
 */
export const getTodayISO = () => new Date().toISOString().split('T')[0];

/**
 * Check if a date string is within the last N days.
 * @param {string} dateStr - ISO date string
 * @param {number} days - Number of days to check
 */
export const isWithinDays = (dateStr, days) => {
    if (!dateStr) return false;
    const diffTime = Math.abs(new Date() - new Date(dateStr));
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= days;
};
