/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import { useBudget } from './BudgetContext';
import { usePersistentState } from '../utils/persistence';
import {
    addDaysToDateKey,
    getDaysUntilDue,
    getHabitCycleState,
    getLatestHabitCycleAnchorDateKey,
    getHabitDueDateKey,
    getHabitPassivePayoutDateKeys,
} from '../utils/gameLogic';
import { getTodayISO, isWithinDays, toLocalDateKey } from '../utils/dateUtils';
import {
    createPortableSnapshot,
    readProtocolLookaheadDays,
    storePortableImportBackup,
    writeProtocolLookaheadDays
} from '../utils/portableState.js';

const GameContext = createContext();
const CalorieContext = createContext();

export const useGame = () => useContext(GameContext);
export const useGameCalories = () => useContext(CalorieContext);

const INITIAL_STATS = {
    level: 1,
    xp: 0,
    maxXp: 100,
    hp: 0,
    maxHp: 100,
    gold: 0,
};

const INITIAL_TASKS = [];
const INITIAL_HABITS = [];

const INITIAL_SETTINGS = {
    protocolReward: 1,
    questRewards: {
        easy: 5,
        medium: 15,
        hard: 40,
        legendary: 100
    }
};

const INITIAL_CALORIES = {
    current: 0,
    target: 2000,
    history: [],
    savedFoods: [],
    recentFoodIds: [],
    passiveCheckpointDate: null,
    passiveCheckpoints: [],
    preset100FoodId: null,
    preset250FoodId: null,
    preset400FoodId: null,
    preset550FoodId: null
};
const INITIAL_COIN_HISTORY = [];
const INITIAL_BUDGET_TRANSFER = {
    totalMonthlyBudget: 0,
    groceryAllocation: 0,
    earnedRewards: 0,
    groceryList: [],
    priceDatabase: {},
    groceryPeriod: 'weekly',
    stipendAmount: 0,
    stipendPeriod: 'weekly',
    stipendPaidThrough: null,
    goldToUsdRatio: 10
};
const STIPEND_PERIOD_DAYS = {
    weekly: 7,
    'bi-weekly': 14,
    monthly: 30
};
const PASSIVE_CALORIE_SOURCE = 'passive';
const PASSIVE_CALORIE_CHECKPOINTS = [
    { id: '18:00', hour: 18, minute: 0, label: 'Passive Fill 6PM' },
    { id: '21:00', hour: 21, minute: 0, label: 'Passive Fill 9PM' },
    { id: '23:59', hour: 23, minute: 59, label: 'Passive Fill 11:59PM' }
];

const normalizeStatsForImport = (stats = {}) => ({
    ...INITIAL_STATS,
    ...stats
});

const normalizeSettingsForImport = (settings = {}) => ({
    ...INITIAL_SETTINGS,
    ...settings,
    questRewards: {
        ...INITIAL_SETTINGS.questRewards,
        ...(settings.questRewards || {})
    }
});

const createId = (prefix = 'id') => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const normalizeCalorieNumber = (value) => {
    const parsed = Math.round(Number(value) || 0);
    return Math.max(0, parsed);
};

const normalizeSignedCalorieNumber = (value) => Math.round(Number(value) || 0);

const normalizeCalorieLabel = (label, fallback = 'Manual Entry') => {
    const trimmed = `${label ?? ''}`.trim();
    return trimmed || fallback;
};

const getPassiveCheckpointDate = (dateKey, checkpoint) => {
    const [year, month, day] = `${dateKey}`.split('-').map(Number);
    return new Date(year, month - 1, day, checkpoint.hour, checkpoint.minute, 0, 0);
};

const getPassiveCalorieChunks = (target) => {
    const safeTarget = Math.max(1, normalizeCalorieNumber(target));
    const baseChunk = Math.floor(safeTarget / PASSIVE_CALORIE_CHECKPOINTS.length);
    const chunks = PASSIVE_CALORIE_CHECKPOINTS.map(() => baseChunk);
    chunks[chunks.length - 1] += safeTarget - chunks.reduce((sum, chunk) => sum + chunk, 0);
    return chunks;
};

const normalizePassiveCheckpoints = (checkpoints) => {
    if (!Array.isArray(checkpoints)) return [];
    const validCheckpointIds = new Set(PASSIVE_CALORIE_CHECKPOINTS.map((checkpoint) => checkpoint.id));
    return [...new Set(checkpoints.filter((checkpointId) => validCheckpointIds.has(checkpointId)))];
};

const createCalorieHistoryEntry = ({
    id = createId('cal'),
    timestamp = new Date().toISOString(),
    dateKey,
    calories,
    label,
    source = 'manual',
    foodId = null
}) => {
    const safeTimestamp = timestamp || new Date().toISOString();
    const safeCalories = normalizeSignedCalorieNumber(calories);
    const safeSource = source || 'manual';
    return {
        id,
        timestamp: safeTimestamp,
        dateKey: dateKey || toLocalDateKey(safeTimestamp),
        calories: safeCalories,
        label: normalizeCalorieLabel(
            label,
            safeSource === 'preset'
                ? `Quick Add ${Math.abs(safeCalories)}`
                : safeCalories < 0
                    ? 'Exercise Burn'
                    : 'Manual Entry'
        ),
        source: safeSource,
        foodId: foodId || null
    };
};

const createSavedFoodRecord = ({
    id = createId('food'),
    name,
    calories,
    coinCost = 0,
    createdAt = new Date().toISOString(),
    updatedAt = createdAt
}) => ({
    id,
    name: normalizeCalorieLabel(name, 'Untitled Food'),
    calories: Math.max(1, normalizeCalorieNumber(calories)),
    coinCost: Math.max(0, normalizeCalorieNumber(coinCost)),
    createdAt,
    updatedAt
});

const normalizeCalorieHistoryEntry = (entry, index) => {
    const timestamp = entry?.timestamp || entry?.date || new Date().toISOString();
    const calories = entry?.calories ?? entry?.amount ?? 0;
    const source = entry?.source || 'manual';
    const fallbackLabel = source === 'preset'
        ? `Quick Add ${Math.abs(normalizeSignedCalorieNumber(calories))}`
        : source === PASSIVE_CALORIE_SOURCE
            ? 'Passive Fill'
            : normalizeSignedCalorieNumber(calories) < 0
                ? 'Exercise Burn'
                : 'Manual Entry';

    return createCalorieHistoryEntry({
        id: entry?.id || createId(`cal-${index}`),
        timestamp,
        dateKey: entry?.dateKey || toLocalDateKey(timestamp),
        calories,
        label: entry?.label || fallbackLabel,
        source,
        foodId: entry?.foodId || null
    });
};

const normalizeSavedFood = (food, index) => createSavedFoodRecord({
    id: food?.id || createId(`food-${index}`),
    name: food?.name,
    calories: food?.calories,
    coinCost: food?.coinCost,
    createdAt: food?.createdAt || new Date().toISOString(),
    updatedAt: food?.updatedAt || food?.createdAt || new Date().toISOString()
});

const normalizeQuickSlotFoodId = (foodId, savedFoodIds) => {
    if (typeof foodId !== 'string' || !foodId) return null;
    return savedFoodIds.has(foodId) ? foodId : null;
};

const recomputeCalorieCurrent = (history, todayKey = getTodayISO()) => {
    return (history || []).reduce((sum, entry) => {
        if (entry.dateKey !== todayKey) return sum;
        return sum + normalizeSignedCalorieNumber(entry.calories);
    }, 0);
};

const normalizeCaloriesForImport = (calories = {}) => {
    const history = Array.isArray(calories.history)
        ? calories.history.map(normalizeCalorieHistoryEntry)
        : INITIAL_CALORIES.history;
    const savedFoods = Array.isArray(calories.savedFoods)
        ? calories.savedFoods.map(normalizeSavedFood)
        : INITIAL_CALORIES.savedFoods;
    const savedFoodIds = new Set(savedFoods.map((food) => food.id));
    const recentFoodIds = Array.isArray(calories.recentFoodIds)
        ? calories.recentFoodIds.filter((id) => savedFoodIds.has(id)).slice(0, 10)
        : INITIAL_CALORIES.recentFoodIds;
    const target = Math.max(1, normalizeCalorieNumber(calories.target || INITIAL_CALORIES.target));
    const passiveCheckpointDate = calories.passiveCheckpointDate === getTodayISO()
        ? calories.passiveCheckpointDate
        : getTodayISO();
    const passiveCheckpoints = calories.passiveCheckpointDate === passiveCheckpointDate
        ? normalizePassiveCheckpoints(calories.passiveCheckpoints)
        : [];

    return {
        ...INITIAL_CALORIES,
        ...calories,
        current: recomputeCalorieCurrent(history),
        target,
        history,
        savedFoods,
        recentFoodIds,
        passiveCheckpointDate,
        passiveCheckpoints,
        preset100FoodId: normalizeQuickSlotFoodId(calories.preset100FoodId, savedFoodIds),
        preset250FoodId: normalizeQuickSlotFoodId(calories.preset250FoodId, savedFoodIds),
        preset400FoodId: normalizeQuickSlotFoodId(calories.preset400FoodId, savedFoodIds),
        preset550FoodId: normalizeQuickSlotFoodId(calories.preset550FoodId, savedFoodIds)
    };
};

const isNormalizedCalorieHistoryEntry = (entry) => {
    if (!entry || typeof entry !== 'object') return false;
    if (typeof entry.id !== 'string' || !entry.id) return false;
    if (typeof entry.timestamp !== 'string' || !entry.timestamp) return false;
    if (typeof entry.dateKey !== 'string' || !entry.dateKey) return false;
    if (typeof entry.label !== 'string' || !entry.label.trim()) return false;
    if (typeof entry.source !== 'string' || !entry.source) return false;
    if (!Number.isInteger(Number(entry.calories))) return false;

    return Object.prototype.hasOwnProperty.call(entry, 'foodId');
};

const isNormalizedSavedFood = (food) => {
    if (!food || typeof food !== 'object') return false;
    if (typeof food.id !== 'string' || !food.id) return false;
    if (typeof food.name !== 'string' || !food.name.trim()) return false;
    if (!Number.isInteger(Number(food.calories)) || Number(food.calories) <= 0) return false;
    if (!Number.isInteger(Number(food.coinCost)) || Number(food.coinCost) < 0) return false;
    if (typeof food.createdAt !== 'string' || !food.createdAt) return false;
    if (typeof food.updatedAt !== 'string' || !food.updatedAt) return false;

    return true;
};

const isCaloriesStateNormalized = (calories = {}) => {
    if (!calories || typeof calories !== 'object') return false;
    if (
        !Array.isArray(calories.history)
        || !Array.isArray(calories.savedFoods)
        || !Array.isArray(calories.recentFoodIds)
    ) {
        return false;
    }

    if (calories.passiveCheckpointDate !== null && typeof calories.passiveCheckpointDate !== 'string') {
        return false;
    }

    if (!Array.isArray(calories.passiveCheckpoints)) {
        return false;
    }

    if (normalizePassiveCheckpoints(calories.passiveCheckpoints).length !== calories.passiveCheckpoints.length) {
        return false;
    }

    if (Math.max(1, normalizeCalorieNumber(calories.target || INITIAL_CALORIES.target)) !== Number(calories.target)) {
        return false;
    }

    if (recomputeCalorieCurrent(calories.history) !== Number(calories.current || 0)) {
        return false;
    }

    if (!calories.history.every(isNormalizedCalorieHistoryEntry)) {
        return false;
    }

    if (!calories.savedFoods.every(isNormalizedSavedFood)) {
        return false;
    }

    const savedFoodIds = new Set(calories.savedFoods.map((food) => food.id));
    if (calories.recentFoodIds.length > 10 || !calories.recentFoodIds.every((id) => savedFoodIds.has(id))) {
        return false;
    }

    if (calories.preset100FoodId !== null && !savedFoodIds.has(calories.preset100FoodId)) {
        return false;
    }

    if (calories.preset250FoodId !== null && !savedFoodIds.has(calories.preset250FoodId)) {
        return false;
    }

    if (calories.preset400FoodId !== null && !savedFoodIds.has(calories.preset400FoodId)) {
        return false;
    }

    if (calories.preset550FoodId !== null && !savedFoodIds.has(calories.preset550FoodId)) {
        return false;
    }

    return true;
};

const normalizeBudgetForImport = (budget = {}) => ({
    ...INITIAL_BUDGET_TRANSFER,
    ...budget,
    groceryList: Array.isArray(budget.groceryList) ? budget.groceryList : INITIAL_BUDGET_TRANSFER.groceryList,
    priceDatabase: budget.priceDatabase && !Array.isArray(budget.priceDatabase)
        ? budget.priceDatabase
        : INITIAL_BUDGET_TRANSFER.priceDatabase
});

const normalizeImportedSnapshot = (snapshot) => ({
    stats: normalizeStatsForImport(snapshot.stats),
    settings: normalizeSettingsForImport(snapshot.settings),
    quests: Array.isArray(snapshot.quests) ? snapshot.quests : INITIAL_TASKS,
    habits: Array.isArray(snapshot.habits) ? snapshot.habits : INITIAL_HABITS,
    calories: normalizeCaloriesForImport(snapshot.calories),
    coinHistory: Array.isArray(snapshot.coinHistory) ? snapshot.coinHistory : INITIAL_COIN_HISTORY,
    budget: normalizeBudgetForImport(snapshot.budget),
    ui: {
        protocolLookaheadDays: Math.max(1, Number(snapshot.ui?.protocolLookaheadDays) || 1)
    }
});

const createLedgerTimestamp = (dateKey) => {
    if (!dateKey) return new Date().toISOString();

    const [year, month, day] = dateKey.split('-').map(Number);
    return new Date(year, month - 1, day, 12, 0, 0, 0).toISOString();
};

const createCoinHistoryEntry = ({ amount, description, type = 'earned', date = new Date().toISOString() }) => ({
    id: createId('coin'),
    date,
    amount,
    description,
    type
});

const getDefaultPassivePaidThrough = (habit, todayKey) => {
    const latestCycleAnchorDateKey = getLatestHabitCycleAnchorDateKey(habit);
    if (!latestCycleAnchorDateKey) return null;

    const dueDateKey = getHabitDueDateKey(habit);
    if (!dueDateKey) return latestCycleAnchorDateKey;

    return todayKey < dueDateKey ? todayKey : dueDateKey;
};

const normalizeHabitRecord = (habit, protocolReward, todayKey) => {
    let nextHabit = habit;
    let didChange = false;

    if (nextHabit.isActive === undefined) {
        nextHabit = { ...nextHabit, isActive: true };
        didChange = true;
    }

    if (nextHabit.completionReward === undefined) {
        nextHabit = {
            ...nextHabit,
            completionReward: Number(protocolReward || 0)
        };
        didChange = true;
    }

    if (nextHabit.passiveReward === undefined) {
        nextHabit = {
            ...nextHabit,
            passiveReward: 0
        };
        didChange = true;
    }

    if (nextHabit.passivePaidThrough === undefined) {
        nextHabit = {
            ...nextHabit,
            passivePaidThrough: getDefaultPassivePaidThrough(nextHabit, todayKey)
        };
        didChange = true;
    }

    if (nextHabit.lastCycleResetDateKey === undefined) {
        nextHabit = {
            ...nextHabit,
            lastCycleResetDateKey: null
        };
        didChange = true;
    }

    return didChange ? nextHabit : habit;
};

const refreshHabitDailyState = (habit) => {
    const isToday = habit.isActive === false ? false : getDaysUntilDue(habit) <= 0;

    if (habit.isToday === isToday) {
        return habit;
    }

    return { ...habit, isToday };
};

const getPausedPassivePaidThrough = (habit, todayKey) => {
    const dueDateKey = getHabitDueDateKey(habit);
    if (!dueDateKey) return habit.passivePaidThrough ?? null;

    const pauseBoundary = todayKey < dueDateKey ? todayKey : dueDateKey;
    if (!habit.passivePaidThrough || pauseBoundary > habit.passivePaidThrough) {
        return pauseBoundary;
    }

    return habit.passivePaidThrough;
};

const settlePassiveIncome = (habits, todayKey) => {
    let totalGold = 0;
    const ledgerEntries = [];
    let didChange = false;

    const updatedHabits = habits.map((habit) => {
        const payoutDateKeys = getHabitPassivePayoutDateKeys(habit, habit.passivePaidThrough, todayKey);
        if (!payoutDateKeys.length) {
            return habit;
        }

        const passiveReward = Number(habit.passiveReward || 0);
        totalGold += passiveReward * payoutDateKeys.length;
        payoutDateKeys.forEach((dateKey) => {
            ledgerEntries.push(createCoinHistoryEntry({
                amount: passiveReward,
                description: `Protocol passive income: ${habit.title}`,
                type: 'earned',
                date: createLedgerTimestamp(dateKey)
            }));
        });

        didChange = true;
        return {
            ...habit,
            passivePaidThrough: payoutDateKeys[payoutDateKeys.length - 1]
        };
    });

    return { updatedHabits, totalGold, ledgerEntries, didChange };
};

const getStipendPayoutDateKeys = (paidThroughDateKey, period, todayKey) => {
    if (!paidThroughDateKey) return [];

    const intervalDays = STIPEND_PERIOD_DAYS[period] || STIPEND_PERIOD_DAYS.weekly;
    const payoutDateKeys = [];
    let cursor = addDaysToDateKey(paidThroughDateKey, intervalDays);

    while (cursor && cursor <= todayKey) {
        payoutDateKeys.push(cursor);
        cursor = addDaysToDateKey(cursor, intervalDays);
    }

    return payoutDateKeys;
};

const settleBudgetStipend = (amount, period, paidThroughDateKey, todayKey) => {
    const stipendAmount = Number(amount || 0);
    if (stipendAmount <= 0 || !paidThroughDateKey) {
        return { totalGold: 0, ledgerEntries: [], paidThrough: paidThroughDateKey };
    }

    const payoutDateKeys = getStipendPayoutDateKeys(paidThroughDateKey, period, todayKey);
    if (!payoutDateKeys.length) {
        return { totalGold: 0, ledgerEntries: [], paidThrough: paidThroughDateKey };
    }

    return {
        totalGold: stipendAmount * payoutDateKeys.length,
        ledgerEntries: payoutDateKeys.map((dateKey) => createCoinHistoryEntry({
            amount: stipendAmount,
            description: 'Budget stipend',
            type: 'earned',
            date: createLedgerTimestamp(dateKey)
        })),
        paidThrough: payoutDateKeys[payoutDateKeys.length - 1]
    };
};

export const GameProvider = ({ children }) => {
    const {
        totalMonthlyBudget,
        setTotalMonthlyBudget,
        groceryAllocation,
        setGroceryAllocation,
        earnedRewards,
        setEarnedRewards,
        groceryList,
        setGroceryList,
        priceDatabase,
        setPriceDatabase,
        groceryPeriod,
        setGroceryPeriod,
        goldToUsdRatio,
        setGoldToUsdRatio,
        addRewardFromGold,
        removeRewardFromGold,
        stipendAmount,
        setStipendAmount,
        stipendPeriod,
        setStipendPeriod,
        stipendPaidThrough,
        setStipendPaidThrough,
        removeCompletedGroceriesBefore
    } = useBudget();
    const dailyRolloverRef = useRef('');

    const [stats, setStats] = usePersistentState('lq_stats', INITIAL_STATS);
    const [quests, setQuests] = usePersistentState('lq_quests', INITIAL_TASKS);
    const [habits, setHabits] = usePersistentState('lq_habits', INITIAL_HABITS);
    const [settings, setSettings] = usePersistentState('lq_settings', INITIAL_SETTINGS);
    const [calories, setCalories] = usePersistentState('lq_calories', INITIAL_CALORIES);
    const [coinHistory, setCoinHistory] = usePersistentState('lq_coin_history', INITIAL_COIN_HISTORY);

    useEffect(() => {
        setCalories((prev) => (isCaloriesStateNormalized(prev) ? prev : normalizeCaloriesForImport(prev)));
    }, [setCalories]);

    const settlePassiveCalorieCheckpoints = useCallback((now = new Date()) => {
        const todayKey = toLocalDateKey(now);

        setCalories((prev) => {
            const history = Array.isArray(prev.history) ? prev.history : [];
            const storedSettledCheckpointIds = prev.passiveCheckpointDate === todayKey
                ? normalizePassiveCheckpoints(prev.passiveCheckpoints)
                : [];
            const existingPassiveCheckpointIds = PASSIVE_CALORIE_CHECKPOINTS
                .filter((checkpoint) => history.some((entry) => (
                    entry.dateKey === todayKey
                    && entry.source === PASSIVE_CALORIE_SOURCE
                    && entry.id === `cal-passive-${todayKey}-${checkpoint.id}`
                )))
                .map((checkpoint) => checkpoint.id);
            const settledCheckpointIds = normalizePassiveCheckpoints([
                ...storedSettledCheckpointIds,
                ...existingPassiveCheckpointIds
            ]);
            const settledCheckpointSet = new Set(settledCheckpointIds);
            const passiveChunks = getPassiveCalorieChunks(prev.target);
            const nextHistory = [...history];
            const nextSettledCheckpointIds = [...settledCheckpointIds];

            PASSIVE_CALORIE_CHECKPOINTS.forEach((checkpoint, index) => {
                const checkpointDate = getPassiveCheckpointDate(todayKey, checkpoint);

                if (now < checkpointDate || settledCheckpointSet.has(checkpoint.id)) return;

                const hasUserEntryBeforeCheckpoint = history.some((entry) => {
                    if (entry.dateKey !== todayKey || entry.source === PASSIVE_CALORIE_SOURCE) return false;
                    const entryDate = new Date(entry.timestamp);
                    return Number.isFinite(entryDate.getTime()) && entryDate <= checkpointDate;
                });

                settledCheckpointSet.add(checkpoint.id);
                nextSettledCheckpointIds.push(checkpoint.id);

                if (hasUserEntryBeforeCheckpoint) return;

                nextHistory.push(createCalorieHistoryEntry({
                    id: `cal-passive-${todayKey}-${checkpoint.id}`,
                    timestamp: checkpointDate.toISOString(),
                    dateKey: todayKey,
                    calories: passiveChunks[index],
                    label: checkpoint.label,
                    source: PASSIVE_CALORIE_SOURCE
                }));
            });

            const checkpointDateChanged = prev.passiveCheckpointDate !== todayKey;
            const checkpointsChanged = nextSettledCheckpointIds.length !== settledCheckpointIds.length;
            const historyChanged = nextHistory.length !== history.length;

            if (!checkpointDateChanged && !checkpointsChanged && !historyChanged) {
                return prev;
            }

            return {
                ...prev,
                history: nextHistory,
                passiveCheckpointDate: todayKey,
                passiveCheckpoints: nextSettledCheckpointIds,
                current: recomputeCalorieCurrent(nextHistory, todayKey)
            };
        });
    }, [setCalories]);

    useEffect(() => {
        settlePassiveCalorieCheckpoints();

        const intervalId = window.setInterval(() => {
            settlePassiveCalorieCheckpoints();
        }, 30000);

        return () => window.clearInterval(intervalId);
    }, [settlePassiveCalorieCheckpoints]);

    const updateStats = useCallback((newStats) => {
        setStats(prev => ({ ...prev, ...newStats }));
    }, [setStats]);

    const updateSettings = useCallback((newSettings) => {
        setSettings(prev => ({ ...prev, ...newSettings }));
    }, [setSettings]);

    const exportAppState = useCallback(() => createPortableSnapshot({
        stats,
        settings,
        quests,
        habits,
        calories,
        coinHistory,
        budget: {
            totalMonthlyBudget,
            groceryAllocation,
            earnedRewards,
            groceryList,
            priceDatabase,
            groceryPeriod,
            stipendAmount,
            stipendPeriod,
            stipendPaidThrough,
            goldToUsdRatio
        },
        ui: {
            protocolLookaheadDays: readProtocolLookaheadDays()
        }
    }), [
        calories,
        coinHistory,
        earnedRewards,
        goldToUsdRatio,
        groceryAllocation,
        groceryList,
        groceryPeriod,
        habits,
        priceDatabase,
        quests,
        settings,
        stats,
        stipendAmount,
        stipendPaidThrough,
        stipendPeriod,
        totalMonthlyBudget
    ]);

    const importAppState = useCallback((snapshot) => {
        const backupKey = storePortableImportBackup(exportAppState());
        const nextState = normalizeImportedSnapshot(snapshot);

        setStats(nextState.stats);
        setSettings(nextState.settings);
        setQuests(nextState.quests);
        setHabits(nextState.habits);
        setCalories(nextState.calories);
        setCoinHistory(nextState.coinHistory);

        setTotalMonthlyBudget(nextState.budget.totalMonthlyBudget);
        setGroceryAllocation(nextState.budget.groceryAllocation);
        setEarnedRewards(nextState.budget.earnedRewards);
        setGroceryList(nextState.budget.groceryList);
        setPriceDatabase(nextState.budget.priceDatabase);
        setGroceryPeriod(nextState.budget.groceryPeriod);
        setStipendAmount(nextState.budget.stipendAmount);
        setStipendPeriod(nextState.budget.stipendPeriod);
        setStipendPaidThrough(nextState.budget.stipendPaidThrough);
        setGoldToUsdRatio(nextState.budget.goldToUsdRatio);

        writeProtocolLookaheadDays(nextState.ui.protocolLookaheadDays);

        return { backupKey };
    }, [
        exportAppState,
        setCalories,
        setCoinHistory,
        setEarnedRewards,
        setGoldToUsdRatio,
        setGroceryAllocation,
        setGroceryList,
        setGroceryPeriod,
        setHabits,
        setPriceDatabase,
        setQuests,
        setSettings,
        setStats,
        setStipendAmount,
        setStipendPaidThrough,
        setStipendPeriod,
        setTotalMonthlyBudget
    ]);

    const logCalories = useCallback(({
        calories: amount,
        label,
        source = 'manual',
        foodId = null
    }) => {
        const safeCalories = normalizeSignedCalorieNumber(amount);
        if (safeCalories === 0) return false;

        const now = new Date().toISOString();
        const nextEntry = createCalorieHistoryEntry({
            timestamp: now,
            calories: safeCalories,
            label,
            source,
            foodId
        });

        setCalories(prev => {
            const nextRecentFoodIds = foodId
                ? [foodId, ...(prev.recentFoodIds || []).filter((id) => id !== foodId)].slice(0, 10)
                : prev.recentFoodIds || [];
            const nextHistory = [...(prev.history || []), nextEntry];
            return {
                ...prev,
                history: nextHistory,
                recentFoodIds: nextRecentFoodIds,
                current: recomputeCalorieCurrent(nextHistory)
            };
        });

        return true;
    }, [setCalories]);

    const addCalories = useCallback((amount) => {
        return logCalories({
            calories: amount,
            label: `Quick Add ${normalizeCalorieNumber(amount)}`,
            source: 'preset'
        });
    }, [logCalories]);

    const updateCalorieEntry = useCallback((entryId, updates = {}) => {
        const todayKey = getTodayISO();

        setCalories(prev => {
            const nextHistory = (prev.history || []).map((entry) => {
                if (entry.id !== entryId || entry.dateKey !== todayKey) return entry;

                const nextCalories = updates.calories === undefined
                    ? entry.calories
                    : (() => {
                        const parsedCalories = normalizeSignedCalorieNumber(updates.calories);
                        return parsedCalories === 0 ? entry.calories : parsedCalories;
                    })();
                const nextLabel = updates.label === undefined
                    ? entry.label
                    : normalizeCalorieLabel(updates.label, entry.label);
                const nextFoodId = updates.foodId === undefined ? entry.foodId : (updates.foodId || null);
                const nextSource = updates.source || entry.source;

                return {
                    ...entry,
                    calories: nextCalories,
                    label: nextLabel,
                    foodId: nextFoodId,
                    source: nextSource
                };
            });

            return {
                ...prev,
                history: nextHistory,
                current: recomputeCalorieCurrent(nextHistory)
            };
        });
    }, [setCalories]);

    const deleteCalorieEntry = useCallback((entryId) => {
        const todayKey = getTodayISO();

        setCalories(prev => {
            const nextHistory = (prev.history || []).filter(
                (entry) => !(entry.id === entryId && entry.dateKey === todayKey)
            );

            return {
                ...prev,
                history: nextHistory,
                current: recomputeCalorieCurrent(nextHistory)
            };
        });
    }, [setCalories]);

    const createSavedFood = useCallback(({ name, calories, coinCost = 0 }) => {
        const nextFood = createSavedFoodRecord({ name, calories, coinCost });

        setCalories(prev => ({
            ...prev,
            savedFoods: [...(prev.savedFoods || []), nextFood]
        }));

        return nextFood;
    }, [setCalories]);

    const updateSavedFood = useCallback((foodId, updates = {}) => {
        setCalories(prev => ({
            ...prev,
            savedFoods: (prev.savedFoods || []).map((food) => {
                if (food.id !== foodId) return food;

                return createSavedFoodRecord({
                    ...food,
                    ...updates,
                    id: food.id,
                    createdAt: food.createdAt,
                    updatedAt: new Date().toISOString()
                });
            })
        }));
    }, [setCalories]);

    const deleteSavedFood = useCallback((foodId) => {
        setCalories(prev => ({
            ...prev,
            savedFoods: (prev.savedFoods || []).filter((food) => food.id !== foodId),
            recentFoodIds: (prev.recentFoodIds || []).filter((id) => id !== foodId),
            preset100FoodId: prev.preset100FoodId === foodId ? null : prev.preset100FoodId,
            preset250FoodId: prev.preset250FoodId === foodId ? null : prev.preset250FoodId,
            preset400FoodId: prev.preset400FoodId === foodId ? null : prev.preset400FoodId,
            preset550FoodId: prev.preset550FoodId === foodId ? null : prev.preset550FoodId
        }));
    }, [setCalories]);

    const setCalorieGoal = useCallback((amount) => {
        const safeGoal = Math.max(1, normalizeCalorieNumber(amount));
        setCalories(prev => ({ ...prev, target: safeGoal }));
    }, [setCalories]);

    const assignQuickSlotFood = useCallback((slotId, foodId = null) => {
        if (!['preset100', 'preset250', 'preset400', 'preset550'].includes(slotId)) return;

        setCalories(prev => {
            const savedFoodIds = new Set((prev.savedFoods || []).map((food) => food.id));
            const safeFoodId = foodId && savedFoodIds.has(foodId) ? foodId : null;

            if (slotId === 'preset100') {
                return { ...prev, preset100FoodId: safeFoodId };
            }

            if (slotId === 'preset250') {
                return { ...prev, preset250FoodId: safeFoodId };
            }

            if (slotId === 'preset400') {
                return { ...prev, preset400FoodId: safeFoodId };
            }

            return { ...prev, preset550FoodId: safeFoodId };
        });
    }, [setCalories]);

    const appendCoinHistoryEntries = useCallback((entries) => {
        if (!entries.length) return;
        setCoinHistory(prev => [...prev, ...entries]);
    }, [setCoinHistory]);

    const spendCoins = useCallback((amount, description) => {
        setStats(prev => ({ ...prev, gold: prev.gold - amount }));
        appendCoinHistoryEntries([
            createCoinHistoryEntry({
                amount,
                description,
                type: 'spent'
            })
        ]);
        return true;
    }, [appendCoinHistoryEntries, setStats]);

    const addXp = useCallback((amount) => {
        const numAmount = Number(amount);
        setStats(prev => {
            let newXp = Number(prev.xp || 0) + numAmount;
            let newLevel = prev.level;
            let newMaxXp = prev.maxXp;
            let newHp = prev.hp;
            let newMaxHp = prev.maxHp;

            while (newXp >= newMaxXp) {
                newLevel += 1;
                newXp -= newMaxXp;
                newMaxXp = Math.floor(newMaxXp * 1.2);
                newHp = newMaxHp;
            }

            while (newXp < 0 && newLevel > 1) {
                newLevel -= 1;
                newMaxXp = Math.ceil(newMaxXp / 1.2);
                newXp += newMaxXp;
            }

            return { ...prev, xp: newXp, level: newLevel, maxXp: newMaxXp, hp: newHp };
        });
    }, [setStats]);

    const addGold = useCallback((amount, source = 'reward', options = {}) => {
        const numAmount = Number(amount);
        setStats(prev => ({ ...prev, gold: Number(prev.gold || 0) + numAmount }));

        if (numAmount !== 0) {
            appendCoinHistoryEntries([
                createCoinHistoryEntry({
                    amount: numAmount,
                    description: options.description || (numAmount > 0 ? `Earned from ${source}` : `Reverted ${source}`),
                    type: numAmount > 0 ? 'earned' : 'spent',
                    date: options.date || new Date().toISOString()
                })
            ]);
        }
    }, [appendCoinHistoryEntries, setStats]);

    const takeDamage = useCallback((amount) => {
        setStats(prev => ({
            ...prev,
            hp: Math.max(0, prev.hp - amount)
        }));
    }, [setStats]);

    const addQuest = useCallback((title, difficulty = 'easy', dueDate = null, customReward = null, missionBrief = '') => {
        const defaultRewards = {
            easy: { xp: 10, gold: settings.questRewards.easy },
            medium: { xp: 25, gold: settings.questRewards.medium },
            hard: { xp: 60, gold: settings.questRewards.hard },
            legendary: { xp: 150, gold: settings.questRewards.legendary },
        };

        const newQuest = {
            id: Date.now().toString(),
            title,
            difficulty,
            dueDate,
            missionBrief,
            completed: false,
            discarded: false,
            reward: customReward || defaultRewards[difficulty] || defaultRewards.easy,
            isCustomReward: !!customReward,
            createdAt: new Date().toISOString(),
        };

        setQuests(prev => [newQuest, ...prev]);
    }, [setQuests, settings.questRewards]);

    const updateQuest = useCallback((id, updates) => {
        setQuests(prev => prev.map(q => q.id === id ? { ...q, ...updates } : q));
    }, [setQuests]);

    const completeQuest = useCallback((id) => {
        const quest = quests.find(q => q.id === id);
        if (!quest || quest.completed) return;

        const diff = quest.difficulty || 'easy';
        const xpAmount = Number(quest.reward.xp || 0);
        let goldAmount = Number(quest.reward.gold || 0);

        if (!quest.isCustomReward) {
            const settingVal = settings.questRewards[diff];
            if (settingVal !== undefined) {
                goldAmount = Number(settingVal);
            }
        }

        addXp(xpAmount);
        addGold(goldAmount, 'Quest');
        addRewardFromGold(goldAmount);

        setQuests(prev => prev.map(q => {
            if (q.id === id) {
                return {
                    ...q,
                    completed: true,
                    completedAt: new Date().toISOString(),
                    completedReward: { xp: xpAmount, gold: goldAmount }
                };
            }
            return q;
        }));
    }, [addGold, addRewardFromGold, addXp, quests, setQuests, settings.questRewards]);

    const undoCompleteQuest = useCallback((id) => {
        const quest = quests.find(q => q.id === id);
        if (!quest || !quest.completed) return;

        let xpAmount = 0;
        let goldAmount = 0;

        if (quest.completedReward) {
            xpAmount = Number(quest.completedReward.xp || 0);
            goldAmount = Number(quest.completedReward.gold || 0);
        } else {
            const diff = quest.difficulty || 'easy';
            xpAmount = Number(quest.reward.xp || 0);
            goldAmount = Number(quest.reward.gold || 0);

            if (!quest.isCustomReward) {
                const settingVal = settings.questRewards[diff];
                if (settingVal !== undefined) {
                    goldAmount = Number(settingVal);
                }
            }
        }

        addXp(-xpAmount);
        addGold(-goldAmount, 'Quest Undo');
        removeRewardFromGold(goldAmount);

        setQuests(prev => prev.map(q => (
            q.id === id ? { ...q, completed: false, completedAt: null, completedReward: null } : q
        )));
    }, [addGold, addXp, quests, removeRewardFromGold, setQuests, settings.questRewards]);

    const deleteQuest = useCallback((id) => {
        setQuests(prev => prev.map(q => (
            q.id === id ? { ...q, discarded: true, discardedAt: new Date().toISOString() } : q
        )));
    }, [setQuests]);

    const restoreQuest = useCallback((id) => {
        setQuests(prev => prev.map(q => (
            q.id === id ? { ...q, discarded: false, discardedAt: null } : q
        )));
    }, [setQuests]);

    const permanentDeleteQuest = useCallback((id) => {
        setQuests(prev => prev.filter(q => q.id !== id));
    }, [setQuests]);

    const addHabit = useCallback((title, frequency = 'daily', frequencyParam = 1, rewardConfig = {}) => {
        const newHabit = {
            id: Date.now().toString(),
            title,
            frequency,
            frequencyParam,
            streak: 0,
            history: {},
            isActive: false,
            isToday: false,
            completionReward: Number(rewardConfig.completionReward ?? settings.protocolReward) || 0,
            passiveReward: Number(rewardConfig.passiveReward ?? 0) || 0,
            passivePaidThrough: null,
            lastCycleResetDateKey: null,
            createdAt: new Date().toISOString(),
        };

        setHabits(prev => [newHabit, ...prev]);
    }, [setHabits, settings.protocolReward]);

    const toggleHabitActivation = useCallback((id, isActive) => {
        const todayKey = getTodayISO();

        setHabits(prev => prev.map(h => {
            if (h.id !== id) return h;

            if (isActive) {
                return {
                    ...h,
                    isActive: true,
                    isToday: getDaysUntilDue(h) <= 0
                };
            }

            return {
                ...h,
                isActive: false,
                isToday: false,
                passivePaidThrough: getPausedPassivePaidThrough(h, todayKey)
            };
        }));
    }, [setHabits]);

    const checkHabit = useCallback((id, direction = 'positive') => {
        const today = getTodayISO();
        const currentHabit = habits.find(h => h.id === id);

        if (!currentHabit) return;

        if (direction === 'positive') {
            const { isDueToday } = getHabitCycleState(currentHabit, today);
            const completionReward = Number(currentHabit.completionReward ?? settings.protocolReward) || 0;

            addXp(5);

            if (isDueToday && completionReward > 0) {
                addGold(completionReward, 'Protocol', {
                    description: `Protocol due bonus: ${currentHabit.title}`
                });
                addRewardFromGold(completionReward);
            }

            setHabits(prev => prev.map(h => {
                if (h.id !== id) return h;

                const newHistory = { ...(h.history || {}) };
                const count = Number(newHistory[today] || 0);

                return {
                    ...h,
                    streak: Number(h.streak || 0) + 1,
                    history: { ...newHistory, [today]: count + 1 },
                    isActive: true,
                    isToday: false,
                    passivePaidThrough: today,
                    lastCycleResetDateKey: today,
                    completionReward: Number(h.completionReward ?? settings.protocolReward) || 0,
                    passiveReward: Number(h.passiveReward || 0) || 0
                };
            }));
            return;
        }

        if (direction === 'skip') {
            setHabits(prev => prev.map(h => {
                if (h.id !== id) return h;

                return {
                    ...h,
                    isActive: true,
                    isToday: false,
                    passivePaidThrough: today,
                    lastCycleResetDateKey: today,
                    completionReward: Number(h.completionReward ?? settings.protocolReward) || 0,
                    passiveReward: Number(h.passiveReward || 0) || 0
                };
            }));
            return;
        }

        takeDamage(5);
        setHabits(prev => prev.map(h => {
            if (h.id !== id) return h;

            const newHistory = { ...(h.history || {}) };
            const count = Number(newHistory[today] || 0);

            return {
                ...h,
                streak: 0,
                history: { ...newHistory, [today]: count - 1 }
            };
        }));
    }, [addGold, addRewardFromGold, addXp, habits, setHabits, settings.protocolReward, takeDamage]);

    const updateHabitRewards = useCallback((id, rewardConfig = {}) => {
        const hasCompletionReward = Object.prototype.hasOwnProperty.call(rewardConfig, 'completionReward');
        const hasPassiveReward = Object.prototype.hasOwnProperty.call(rewardConfig, 'passiveReward');

        if (!hasCompletionReward && !hasPassiveReward) return;

        setHabits(prev => prev.map(h => {
            if (h.id !== id) return h;

            return {
                ...h,
                completionReward: hasCompletionReward
                    ? Math.max(0, Number(rewardConfig.completionReward) || 0)
                    : Number(h.completionReward ?? settings.protocolReward) || 0,
                passiveReward: hasPassiveReward
                    ? Math.max(0, Number(rewardConfig.passiveReward) || 0)
                    : Number(h.passiveReward || 0) || 0
            };
        }));
    }, [setHabits, settings.protocolReward]);

    const deleteHabit = useCallback((id) => {
        setHabits(prev => prev.filter(h => h.id !== id));
    }, [setHabits]);

    const toggleToday = useCallback((id, type) => {
        if (type === 'quest') {
            setQuests(prev => prev.map(q => q.id === id ? { ...q, isToday: !q.isToday } : q));
            return;
        }

        if (type === 'habit') {
            setHabits(prev => prev.map(h => h.id === id ? { ...h, isToday: !h.isToday } : h));
        }
    }, [setHabits, setQuests]);

    useEffect(() => {
        const todayKey = getTodayISO();
        const normalizedHabits = habits.map(habit => normalizeHabitRecord(habit, settings.protocolReward, todayKey));
        const hasChanges = normalizedHabits.some((habit, index) => habit !== habits[index]);

        if (!hasChanges) return;

        setHabits(normalizedHabits);
    }, [habits, setHabits, settings.protocolReward]);

    useEffect(() => {
        const today = getTodayISO();
        const lastLoginDate = stats.lastLoginDate;
        const rolloverKey = `${lastLoginDate || 'none'}=>${today}`;

        if (lastLoginDate === today) {
            dailyRolloverRef.current = '';
            return;
        }

        if (dailyRolloverRef.current === rolloverKey) {
            return;
        }

        dailyRolloverRef.current = rolloverKey;

        const normalizedHabits = habits.map(habit => normalizeHabitRecord(habit, settings.protocolReward, today));
        const passiveSettlement = settlePassiveIncome(normalizedHabits, today);
        const stipendSettlement = settleBudgetStipend(stipendAmount, stipendPeriod, stipendPaidThrough, today);
        const nextHabits = passiveSettlement.updatedHabits.map(refreshHabitDailyState);
        const habitsChanged = nextHabits.some((habit, index) => habit !== habits[index]);

        setQuests(prev => prev.map(q => ({
            ...q,
            isToday: q.dueDate === today && !q.completed
        })));

        if (habitsChanged) {
            setHabits(nextHabits);
        }

        removeCompletedGroceriesBefore(today);

        if (Number(stipendAmount) > 0 && !stipendPaidThrough) {
            setStipendPaidThrough(today);
        } else if (stipendSettlement.paidThrough !== stipendPaidThrough) {
            setStipendPaidThrough(stipendSettlement.paidThrough);
        }

        const totalRolloverGold = passiveSettlement.totalGold + stipendSettlement.totalGold;
        const rolloverLedgerEntries = [
            ...passiveSettlement.ledgerEntries,
            ...stipendSettlement.ledgerEntries
        ];

        if (totalRolloverGold > 0) {
            setStats(prev => ({
                ...prev,
                gold: Number(prev.gold || 0) + totalRolloverGold,
                lastLoginDate: today
            }));
            appendCoinHistoryEntries(rolloverLedgerEntries);
            addRewardFromGold(passiveSettlement.totalGold);
        } else {
            setStats(prev => ({ ...prev, lastLoginDate: today }));
        }

        setCalories(prev => ({
            ...prev,
            current: recomputeCalorieCurrent(prev.history || [], today)
        }));
    }, [
        addRewardFromGold,
        appendCoinHistoryEntries,
        habits,
        removeCompletedGroceriesBefore,
        setCalories,
        setHabits,
        setQuests,
        setStipendPaidThrough,
        setStats,
        settings.protocolReward,
        stats.lastLoginDate,
        stipendAmount,
        stipendPaidThrough,
        stipendPeriod
    ]);

    useEffect(() => {
        const hasExpiredDiscardedQuests = quests.some(
            quest => quest.discarded && quest.discardedAt && !isWithinDays(quest.discardedAt, 7)
        );

        if (!hasExpiredDiscardedQuests) return;

        setQuests(prev => prev.filter(
            quest => !(quest.discarded && quest.discardedAt && !isWithinDays(quest.discardedAt, 7))
        ));
    }, [quests, setQuests]);

    const calorieContextValue = useMemo(() => ({
        calories,
        addCalories,
        logCalories,
        updateCalorieEntry,
        deleteCalorieEntry,
        createSavedFood,
        updateSavedFood,
        deleteSavedFood,
        setCalorieGoal,
        assignQuickSlotFood,
        spendCoins
    }), [
        calories,
        addCalories,
        logCalories,
        updateCalorieEntry,
        deleteCalorieEntry,
        createSavedFood,
        updateSavedFood,
        deleteSavedFood,
        setCalorieGoal,
        assignQuickSlotFood,
        spendCoins
    ]);

    const contextValue = useMemo(() => ({
        stats, quests, habits, settings, coinHistory,
        addQuest, completeQuest, deleteQuest, restoreQuest, updateQuest, permanentDeleteQuest, undoCompleteQuest,
        addHabit, checkHabit, deleteHabit, toggleHabitActivation, updateHabitRewards,
        updateStats, updateSettings, spendCoins, addGold,
        toggleToday, exportAppState, importAppState
    }), [
        stats, quests, habits, settings, coinHistory,
        addQuest, completeQuest, deleteQuest, restoreQuest, updateQuest, permanentDeleteQuest, undoCompleteQuest,
        addHabit, checkHabit, deleteHabit, toggleHabitActivation, updateHabitRewards,
        updateStats, updateSettings, spendCoins, addGold,
        toggleToday, exportAppState, importAppState
    ]);

    return (
        <GameContext.Provider value={contextValue}>
            <CalorieContext.Provider value={calorieContextValue}>
                {children}
            </CalorieContext.Provider>
        </GameContext.Provider>
    );
};
