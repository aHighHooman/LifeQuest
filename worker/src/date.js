import { isDateKey } from '../../src/domain/calendar.js';

// Convert an instant only at the request boundary, using the authenticated
// request's timezone. Bare day keys have no timezone and remain unchanged.
export const getDateKey = (value = new Date(), timeZone = 'UTC') => {
    if (isDateKey(value)) return value;
    const date = value instanceof Date ? value : new Date(value);
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
};
