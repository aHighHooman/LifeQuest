const MS_PER_DAY = 1000 * 60 * 60 * 24;

const normalizeDate = (value = new Date()) => {
    const date = value instanceof Date ? new Date(value) : new Date(value);
    date.setHours(0, 0, 0, 0);
    return date;
};

export const parseDateKey = (dateKey) => {
    if (!dateKey) return null;

    if (/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
        const [year, month, day] = dateKey.split('-').map(Number);
        return new Date(year, month - 1, day);
    }

    return normalizeDate(dateKey);
};

export const toDateKey = (value = new Date()) => {
    const date = normalizeDate(value);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export const addDaysToDateKey = (dateKey, days) => {
    const date = parseDateKey(dateKey);
    if (!date) return null;

    date.setDate(date.getDate() + Number(days || 0));
    return toDateKey(date);
};

export const diffDateKeys = (leftDateKey, rightDateKey) => {
    const left = parseDateKey(leftDateKey);
    const right = parseDateKey(rightDateKey);

    if (!left || !right) return 0;

    return Math.floor((left - right) / MS_PER_DAY);
};

export const getHabitIntervalDays = (habit) => {
    if (habit.frequency === 'weekly') return 7;
    if (habit.frequency === 'monthly') return 30;
    if (habit.frequency === 'interval') return Number(habit.frequencyParam) || 1;
    return 1;
};

export const getLatestHabitCompletionDateKey = (habit) => {
    const history = habit?.history || {};

    return Object.keys(history)
        .filter((dateKey) => Number(history[dateKey] || 0) > 0)
        .sort()
        .pop() || null;
};

export const getLatestHabitCycleAnchorDateKey = (habit) => {
    const lastCompletedDateKey = getLatestHabitCompletionDateKey(habit);
    const lastCycleResetDateKey = habit?.lastCycleResetDateKey || null;

    if (!lastCompletedDateKey) return lastCycleResetDateKey;
    if (!lastCycleResetDateKey) return lastCompletedDateKey;

    return lastCompletedDateKey > lastCycleResetDateKey
        ? lastCompletedDateKey
        : lastCycleResetDateKey;
};

export const getHabitDueDateKey = (habit) => {
    const anchorDateKey = getLatestHabitCycleAnchorDateKey(habit);
    if (!anchorDateKey) return null;

    return addDaysToDateKey(anchorDateKey, getHabitIntervalDays(habit));
};

export const getHabitPassiveWindow = (habit) => {
    const anchorDateKey = getLatestHabitCycleAnchorDateKey(habit);
    if (!anchorDateKey) {
        return {
            anchorDateKey: null,
            startDateKey: null,
            endDateKey: null
        };
    }

    const dueDateKey = getHabitDueDateKey(habit);

    return {
        anchorDateKey,
        startDateKey: addDaysToDateKey(anchorDateKey, 1),
        endDateKey: dueDateKey
    };
};

export const getHabitPassivePayoutDateKeys = (habit, startAfterDateKey = null, throughDateKey = toDateKey()) => {
    if (habit?.isActive === false || Number(habit?.passiveReward || 0) <= 0) {
        return [];
    }

    const { anchorDateKey, startDateKey, endDateKey } = getHabitPassiveWindow(habit);
    if (!anchorDateKey || !startDateKey || !endDateKey) return [];

    const effectiveStartKey = addDaysToDateKey(startAfterDateKey || anchorDateKey, 1);
    const firstDateKey = effectiveStartKey > startDateKey ? effectiveStartKey : startDateKey;
    const lastDateKey = throughDateKey < endDateKey ? throughDateKey : endDateKey;

    if (firstDateKey > lastDateKey) return [];

    const payoutDateKeys = [];
    let cursor = firstDateKey;

    while (cursor <= lastDateKey) {
        payoutDateKeys.push(cursor);
        cursor = addDaysToDateKey(cursor, 1);
    }

    return payoutDateKeys;
};

export const getDaysUntilDue = (habit, referenceDate = new Date()) => {
    const dueDateKey = getHabitDueDateKey(habit);
    if (!dueDateKey) return 0;

    return diffDateKeys(dueDateKey, toDateKey(referenceDate));
};

export const getHabitCycleState = (habit, referenceDate = new Date()) => {
    const todayKey = toDateKey(referenceDate);
    const lastCompletedDateKey = getLatestHabitCompletionDateKey(habit);
    const cycleAnchorDateKey = getLatestHabitCycleAnchorDateKey(habit);
    const dueDateKey = getHabitDueDateKey(habit);
    const daysUntilDue = dueDateKey ? diffDateKeys(dueDateKey, todayKey) : 0;

    return {
        todayKey,
        lastCompletedDateKey,
        cycleAnchorDateKey,
        dueDateKey,
        daysUntilDue,
        isDueToday: dueDateKey ? daysUntilDue === 0 : true,
        isOverdue: dueDateKey ? daysUntilDue < 0 : false
    };
};
