import { isDateKey } from '../domain/calendar.js';
import { getProtocolCycleState } from '../domain/protocols.js';
import { toLocalDateKey } from './dateUtils.js';

// These are the browser date adapters used by quest and protocol screens.
export const parseDateKey = (dateKey) => {
    if (!dateKey) return null;
    const key = toLocalDateKey(dateKey);
    if (!isDateKey(key)) return null;
    const [year, month, day] = key.split('-').map(Number);
    const date = new Date(0);
    date.setFullYear(year, month - 1, day);
    date.setHours(0, 0, 0, 0);
    return date;
};

export const getHabitCycleState = (habit, referenceDate = new Date()) => (
    getProtocolCycleState(habit, toLocalDateKey(referenceDate))
);

export const getDaysUntilDue = (habit, referenceDate = new Date()) => (
    getHabitCycleState(habit, referenceDate).daysUntilDue
);
