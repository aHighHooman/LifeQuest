const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const getDateKey = (value = new Date(), timeZone = 'UTC') => {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(value);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
};

const dateKeyToUtc = (dateKey) => {
    if (!DATE_KEY_PATTERN.test(`${dateKey || ''}`)) return null;
    const [year, month, day] = dateKey.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day));
};

export const addDays = (dateKey, amount) => {
    const date = dateKeyToUtc(dateKey);
    if (!date) return null;
    date.setUTCDate(date.getUTCDate() + Number(amount || 0));
    return date.toISOString().slice(0, 10);
};

export const diffDays = (leftDateKey, rightDateKey) => {
    const left = dateKeyToUtc(leftDateKey);
    const right = dateKeyToUtc(rightDateKey);
    if (!left || !right) return 0;
    return Math.floor((left.getTime() - right.getTime()) / MS_PER_DAY);
};

export const getProtocolIntervalDays = (protocol) => {
    if (protocol.frequency === 'weekly') return 7;
    if (protocol.frequency === 'monthly') return 30;
    if (protocol.frequency === 'interval') return Math.max(1, Number(protocol.frequencyParam) || 1);
    return 1;
};

export const getLatestProtocolCompletionDateKey = (protocol) => (
    Object.keys(protocol?.history || {})
        .filter((dateKey) => Number(protocol.history[dateKey] || 0) > 0)
        .sort()
        .pop() || null
);

export const getProtocolCycleAnchorDateKey = (protocol) => {
    const completion = getLatestProtocolCompletionDateKey(protocol);
    const reset = protocol?.lastCycleResetDateKey || null;
    if (!completion) return reset;
    if (!reset) return completion;
    return completion > reset ? completion : reset;
};

export const getProtocolDueDateKey = (protocol) => {
    const anchor = getProtocolCycleAnchorDateKey(protocol);
    return anchor ? addDays(anchor, getProtocolIntervalDays(protocol)) : null;
};

export const getProtocolCycleState = (protocol, todayKey) => {
    const dueDateKey = getProtocolDueDateKey(protocol);
    const daysUntilDue = dueDateKey ? diffDays(dueDateKey, todayKey) : 0;
    return {
        dueDateKey,
        daysUntilDue,
        isDueToday: dueDateKey ? daysUntilDue === 0 : true,
        isOverdue: dueDateKey ? daysUntilDue < 0 : false
    };
};

export const getPausedPassivePaidThrough = (protocol, todayKey) => {
    const dueDateKey = getProtocolDueDateKey(protocol);
    if (!dueDateKey) return protocol.passivePaidThrough ?? null;
    const boundary = todayKey < dueDateKey ? todayKey : dueDateKey;
    return !protocol.passivePaidThrough || boundary > protocol.passivePaidThrough
        ? boundary
        : protocol.passivePaidThrough;
};
