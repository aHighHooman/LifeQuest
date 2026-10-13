const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export const getDeviceTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

export const normalizeProtocolTimeWindow = (window) => {
    if (!window || typeof window !== 'object') return null;
    const start = TIME_PATTERN.test(window.start) ? window.start : null;
    const end = TIME_PATTERN.test(window.end) ? window.end : null;
    if (!start && !end) return null;
    let timeZone;
    if (typeof window.timeZone === 'string') {
        try {
            new Intl.DateTimeFormat('en', { timeZone: window.timeZone });
            timeZone = window.timeZone;
        } catch { /* Legacy or invalid zones use the caller's local clock. */ }
    }
    return { start, end, ...(timeZone ? { timeZone } : {}) };
};

const toMinutes = (time) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));

// This is a Today visibility rule, independent of recurrence and rewards.
// Store the device's zone so MCP can evaluate the same window on each request.
export const isProtocolInTimeWindow = (protocol, now = new Date()) => {
    const window = normalizeProtocolTimeWindow(protocol.todayWindow);
    if (!window) return true;
    let minute = now.getHours() * 60 + now.getMinutes();
    if (window.timeZone) {
        const parts = new Intl.DateTimeFormat('en', {
            timeZone: window.timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
        }).formatToParts(now);
        const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
        minute = Number(values.hour) * 60 + Number(values.minute);
    }
    const start = window.start ? toMinutes(window.start) : 0;
    const end = window.end ? toMinutes(window.end) : 1440;
    return start > end ? minute >= start || minute < end : minute >= start && minute < end;
};
