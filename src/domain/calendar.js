// Calendar arithmetic operates on day keys only. Instant/timezone conversion
// belongs to the browser and worker adapters, never to these domain rules.
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const dateKeyToUtc = (dateKey) => {
    if (typeof dateKey !== 'string' || !DATE_KEY_PATTERN.test(dateKey)) return null;
    const [year, month, day] = dateKey.split('-').map(Number);
    const date = new Date(0);
    date.setUTCFullYear(year, month - 1, day);
    date.setUTCHours(0, 0, 0, 0);
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
        return null;
    }
    return date;
};

export const isDateKey = (value) => dateKeyToUtc(value) !== null;

export const addDays = (dateKey, amount) => {
    const date = dateKeyToUtc(dateKey);
    const days = Number(amount || 0);
    if (!date || !Number.isFinite(days)) return null;
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
};

export const diffDays = (leftDateKey, rightDateKey) => {
    const left = dateKeyToUtc(leftDateKey);
    const right = dateKeyToUtc(rightDateKey);
    if (!left || !right) return 0;
    return Math.round((left.getTime() - right.getTime()) / MS_PER_DAY);
};
