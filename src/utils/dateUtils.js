/**
 * Format a date object as YYYY-MM-DD using local time.
 * @param {Date} date - Date object (default: now)
 */
export const toLocalISOString = (date = new Date()) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

/**
 * Get today's date in ISO format (YYYY-MM-DD) based on LOCAL time.
 * Used for history keys and date comparisons throughout the app.
 */
export const getTodayISO = () => toLocalISOString(new Date());

/**
 * Check if a date string is within the last N days.
 * @param {string} dateStr - ISO date string (YYYY-MM-DD or full ISO)
 * @param {number} days - Number of days to check
 */
export const isWithinDays = (dateStr, days) => {
    if (!dateStr) return false;

    let target;
    // Handle YYYY-MM-DD strings explicitly as local time components
    // (new Date('YYYY-MM-DD') defaults to UTC, which offsets the day in local time)
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        const [y, m, d] = dateStr.split('-').map(Number);
        target = new Date(y, m - 1, d);
    } else {
        target = new Date(dateStr);
    }

    const now = new Date();

    // Reset times to ignore hours/minutes (comparison is purely day-based)
    target.setHours(0, 0, 0, 0);
    now.setHours(0, 0, 0, 0);

    const diffTime = Math.abs(now - target);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays <= days;
};
