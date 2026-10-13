import { normalizeCurrencyAmount } from '../constants/currency.js';
import { getProtocolCycleState, getProtocolSchedule, getProtocolStreak } from './protocols.js';
import { resolveQuestReward } from './rewards.js';
import { isProtocolInTimeWindow, normalizeProtocolTimeWindow } from './protocolTimeWindow.js';

export const questView = (quest, settings = {}) => {
    const reward = resolveQuestReward(settings, quest);
    return {
        id: quest.id,
        title: quest.title,
        status: quest.discarded ? 'discarded' : quest.completed ? 'completed' : 'active',
        selectedForToday: Boolean(quest.isFocusedToday),
        difficulty: quest.difficulty || 'easy',
        dueDate: quest.dueDate || null,
        missionBrief: quest.missionBrief || '',
        reward: {
            xp: reward.xp,
            gold: reward.gold
        },
        createdAt: quest.createdAt || null,
        completedAt: quest.completedAt || null,
        discardedAt: quest.discardedAt || null
    };
};

// Health is calorie capacity: how much of today's calorie target is left.
export const healthView = (calories = {}, todayKey) => {
    const calorieTarget = Math.max(1, Math.round(Number(calories?.target) || 1));
    const caloriesConsumed = Math.max(0, (calories?.history || []).reduce((sum, entry) => (
        entry?.dateKey === todayKey ? sum + Math.round(Number(entry.calories) || 0) : sum
    ), 0));
    return {
        capacityPercent: Math.round(Math.max(0, Math.min(100, ((calorieTarget - caloriesConsumed) / calorieTarget) * 100))),
        caloriesRemaining: Math.max(0, calorieTarget - caloriesConsumed),
        caloriesConsumed,
        calorieTarget
    };
};

export const protocolView = (protocol, todayKey, now = new Date()) => {
    const cycle = getProtocolCycleState(protocol, todayKey);
    const completionsToday = Number(protocol.history?.[todayKey] || 0);
    return {
        id: protocol.id,
        title: protocol.title,
        status: protocol.isActive === false ? 'inactive' : 'active',
        selectedForToday: protocol.isActive !== false && cycle.daysUntilDue <= 0 && isProtocolInTimeWindow(protocol, now),
        ...(protocol.todayWindow ? { todayWindow: normalizeProtocolTimeWindow(protocol.todayWindow) } : {}),
        completedToday: completionsToday > 0,
        completionsToday,
        ...getProtocolSchedule(protocol, todayKey),
        ...(protocol.pendingSchedule?.effectiveDateKey > todayKey ? { pendingSchedule: { ...protocol.pendingSchedule } } : {}),
        streak: getProtocolStreak(protocol, todayKey),
        completionReward: normalizeCurrencyAmount(protocol.completionReward),
        passiveReward: normalizeCurrencyAmount(protocol.passiveReward),
        dueDate: cycle.dueDateKey,
        daysUntilDue: cycle.daysUntilDue,
        isOverdue: cycle.isOverdue,
        createdAt: protocol.createdAt || null
    };
};
