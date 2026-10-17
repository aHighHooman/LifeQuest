import { addDays, diffDays } from './calendar.js';

export const getProtocolSchedule = (protocol, todayKey) => {
    const pending = protocol.pendingSchedule;
    const schedule = pending?.effectiveDateKey && todayKey >= pending.effectiveDateKey ? pending : protocol;
    return { frequency: schedule.frequency || 'daily', frequencyParam: Number(schedule.frequencyParam || 1) };
};

// Saved changes survive reloads and become active on the same calendar day in
// the browser and worker. Until then, today's cycle and bonus stay intact.
export const applyPendingProtocolSchedule = (protocol, todayKey) => {
    if (!protocol?.pendingSchedule?.effectiveDateKey || !todayKey || todayKey < protocol.pendingSchedule.effectiveDateKey) return protocol;
    const { pendingSchedule: _pending, ...rest } = protocol;
    return { ...rest, ...getProtocolSchedule(protocol, todayKey) };
};

export const getProtocolIntervalDays = (protocol, todayKey) => {
    const schedule = getProtocolSchedule(protocol, todayKey);
    if (schedule.frequency === 'weekly') return 7;
    if (schedule.frequency === 'monthly') return 30;
    if (schedule.frequency === 'interval') {
        const interval = Number(schedule.frequencyParam);
        return Number.isFinite(interval) ? Math.max(1, interval) : 1;
    }
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

export const getProtocolDueDateKey = (protocol, todayKey) => {
    const anchor = getProtocolCycleAnchorDateKey(protocol);
    return anchor ? addDays(anchor, getProtocolIntervalDays(protocol, todayKey)) : null;
};

export const getProtocolCycleState = (protocol, todayKey) => {
    const dueDateKey = getProtocolDueDateKey(protocol, todayKey);
    const daysUntilDue = dueDateKey ? diffDays(dueDateKey, todayKey) : 0;
    return {
        todayKey,
        lastCompletedDateKey: getLatestProtocolCompletionDateKey(protocol),
        cycleAnchorDateKey: getProtocolCycleAnchorDateKey(protocol),
        dueDateKey,
        daysUntilDue,
        isDueToday: dueDateKey ? daysUntilDue === 0 : true,
        isOverdue: dueDateKey ? daysUntilDue < 0 : false
    };
};

// Consecutive completions counted back from the latest, where each followed
// the previous one within the protocol's interval. An active protocol whose
// current cycle is overdue has broken its streak.
export const getProtocolStreak = (protocol, todayKey) => {
    const completionDays = Object.keys(protocol?.history || {})
        .filter((dateKey) => Number(protocol.history[dateKey] || 0) > 0)
        .sort();
    if (!completionDays.length) return 0;
    if (protocol.isActive !== false && getProtocolCycleState(protocol, todayKey).isOverdue) return 0;
    const intervalDays = Math.floor(getProtocolIntervalDays(protocol, todayKey));
    let streak = 1;
    for (let index = completionDays.length - 1; index > 0; index -= 1) {
        if (diffDays(completionDays[index], completionDays[index - 1]) > intervalDays) break;
        streak += 1;
    }
    return streak;
};

export const getProtocolPassiveWindow = (protocol, todayKey) => {
    const anchorDateKey = getProtocolCycleAnchorDateKey(protocol);
    return {
        anchorDateKey,
        startDateKey: anchorDateKey ? addDays(anchorDateKey, 1) : null,
        endDateKey: getProtocolDueDateKey(protocol, todayKey)
    };
};

export const getProtocolPassivePayoutDateKeys = (protocol, startAfterDateKey, throughDateKey) => {
    if (protocol?.isActive === false || Number(protocol?.passiveReward || 0) <= 0) return [];
    const { anchorDateKey, startDateKey, endDateKey } = getProtocolPassiveWindow(protocol, throughDateKey);
    if (!startDateKey || !endDateKey || !throughDateKey) return [];

    const effectiveStartKey = addDays(startAfterDateKey || anchorDateKey, 1);
    if (!effectiveStartKey) return [];
    const firstDateKey = effectiveStartKey > startDateKey ? effectiveStartKey : startDateKey;
    const lastDateKey = throughDateKey < endDateKey ? throughDateKey : endDateKey;
    const payoutDateKeys = [];
    for (let cursor = firstDateKey; cursor && cursor <= lastDateKey; cursor = addDays(cursor, 1)) {
        payoutDateKeys.push(cursor);
    }
    return payoutDateKeys;
};

export const getPausedPassivePaidThrough = (protocol, todayKey) => {
    const dueDateKey = getProtocolDueDateKey(protocol, todayKey);
    if (!dueDateKey) return protocol.passivePaidThrough ?? null;
    const boundary = todayKey < dueDateKey ? todayKey : dueDateKey;
    return !protocol.passivePaidThrough || boundary > protocol.passivePaidThrough
        ? boundary
        : protocol.passivePaidThrough;
};
