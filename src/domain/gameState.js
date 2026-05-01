import { getDaysUntilDue } from '../utils/gameLogic';

export const QUICK_SLOT_IDS = ['preset100', 'preset250', 'preset400', 'preset550'];

export const createId = (prefix = 'id') => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const createDefaultQuickSlots = () => ({
    preset100: null,
    preset250: null,
    preset400: null,
    preset550: null
});

export const normalizeQuickSlots = (calories = {}, savedFoodIds = new Set()) => {
    const legacySlots = {
        preset100: calories.preset100FoodId,
        preset250: calories.preset250FoodId,
        preset400: calories.preset400FoodId,
        preset550: calories.preset550FoodId
    };
    const rawSlots = {
        ...legacySlots,
        ...(calories.quickSlots && typeof calories.quickSlots === 'object' ? calories.quickSlots : {})
    };

    return Object.fromEntries(
        QUICK_SLOT_IDS.map((slotId) => {
            const foodId = rawSlots[slotId];
            return [slotId, typeof foodId === 'string' && savedFoodIds.has(foodId) ? foodId : null];
        })
    );
};

export const normalizeQuestRecord = (quest = {}) => {
    const { isToday, isFocusedToday, ...rest } = quest;

    return {
        ...rest,
        isFocusedToday: Boolean(isFocusedToday ?? isToday)
    };
};

export const normalizeHabitHistory = (history = {}) => {
    if (!history || typeof history !== 'object' || Array.isArray(history)) return {};

    return Object.fromEntries(
        Object.entries(history)
            .map(([dateKey, count]) => [dateKey, Math.max(0, Number(count) || 0)])
            .filter(([, count]) => count > 0)
    );
};

export const normalizeHabitRecord = (habit = {}, protocolReward = 0, todayKey) => {
    const { isToday: _legacyIsToday, ...rest } = habit;
    const nextHabit = {
        ...rest,
        history: normalizeHabitHistory(habit.history),
        isActive: habit.isActive ?? true,
        completionReward: Number(habit.completionReward ?? protocolReward) || 0,
        passiveReward: Number(habit.passiveReward ?? 0) || 0,
        passivePaidThrough: habit.passivePaidThrough ?? null,
        lastCycleResetDateKey: habit.lastCycleResetDateKey ?? null
    };

    if (nextHabit.passivePaidThrough === null && todayKey && getDaysUntilDue(nextHabit, todayKey) > 0) {
        nextHabit.passivePaidThrough = todayKey;
    }

    return nextHabit;
};

export const isHabitDueForFocus = (habit, referenceDate = new Date()) => {
    if (habit?.isActive === false) return false;
    return getDaysUntilDue(habit, referenceDate) <= 0;
};
