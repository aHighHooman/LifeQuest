import { diffDays, isDateKey } from '../domain/calendar.js';

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
 * Normalize a Date or timestamp-like value to a local YYYY-MM-DD key.
 * Useful when persisted values are stored as full UTC ISO strings.
 * @param {Date|string|number} value
 */
export const toLocalDateKey = (value = new Date()) => {
    // A persisted calendar day is already a day, not a midnight UTC instant.
    if (isDateKey(value)) return value;
    const date = value instanceof Date ? value : new Date(value);
    return toLocalISOString(date);
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
    const targetKey = toLocalDateKey(dateStr);
    if (!isDateKey(targetKey)) return false;
    return Math.abs(diffDays(getTodayISO(), targetKey)) <= days;
};
