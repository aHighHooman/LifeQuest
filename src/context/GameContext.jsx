/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import { useBudget } from './BudgetContext';
import { usePersistentState } from '../utils/persistence';
import {
    addDaysToDateKey,
    getHabitCycleState,
    getLatestHabitCycleAnchorDateKey,
    getHabitDueDateKey,
    getHabitPassivePayoutDateKeys,
} from '../utils/gameLogic';
import { getTodayISO, isWithinDays, toLocalDateKey } from '../utils/dateUtils';
import {
    createPortableSnapshot,
    normalizePortableSnapshot,
    readProtocolLookaheadDays,
    storePortableImportBackup,
    writeProtocolLookaheadDays
} from '../utils/portableState.js';
import {
    QUICK_SLOT_IDS,
    createDefaultQuickSlots,
    createId,
    normalizeHabitHistory,
    normalizeHabitRecord as normalizeDomainHabitRecord,
    normalizeQuestRecord,
    normalizeQuickSlots
} from '../domain/gameState.js';

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
    passiveCheckpointLedger: {},
    quickSlots: createDefaultQuickSlots()
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
const PASSIVE_CALORIE_LOOKBACK_DAYS = 7;
const PASSIVE_CALORIE_CHECKPOINTS = [
    { id: '18:00', hour: 18, minute: 0, label: 'Passive Fill 6PM' },
    { id: '23:59', hour: 23, minute: 59, label: 'Passive Fill 11:59PM' }
];

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

const getPassiveSettlementDateKeys = (now = new Date()) => {
    const dateKeys = [];
    const cursor = new Date(now);
    cursor.setHours(12, 0, 0, 0);
    cursor.setDate(cursor.getDate() - (PASSIVE_CALORIE_LOOKBACK_DAYS - 1));

    for (let index = 0; index < PASSIVE_CALORIE_LOOKBACK_DAYS; index += 1) {
        dateKeys.push(toLocalDateKey(cursor));
        cursor.setDate(cursor.getDate() + 1);
    }

    return dateKeys;
};

const normalizePassiveCheckpointLedger = (ledger) => {
    if (!ledger || typeof ledger !== 'object' || Array.isArray(ledger)) return {};

    return Object.fromEntries(
        Object.entries(ledger)
            .filter(([dateKey]) => /^\d{4}-\d{2}-\d{2}$/.test(dateKey))
            .map(([dateKey, checkpoints]) => [dateKey, normalizePassiveCheckpoints(checkpoints)])
    );
};

const createCalorieHistoryEntry = ({
    id = createId('cal'),
    timestamp = new Date().toISOString(),
    dateKey,
    calories,
    label,
    source = 'manual',
    foodId = null,
    coinCost = 0
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
        foodId: foodId || null,
        coinCost: Math.max(0, normalizeCalorieNumber(coinCost))
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
        foodId: entry?.foodId || null,
        coinCost: entry?.coinCost
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

const recomputeCalorieCurrent = (history, todayKey = getTodayISO()) => {
    return (history || []).reduce((sum, entry) => {
        if (entry.dateKey !== todayKey) return sum;
        return sum + normalizeSignedCalorieNumber(entry.calories);
    }, 0);
};

const getEditableCalorieDateKeys = () => {
    const today = getTodayISO();
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);

    return new Set([today, toLocalDateKey(yesterdayDate)]);
};

const normalizeCaloriesForImport = (calories = {}) => {
    const savedFoods = Array.isArray(calories.savedFoods)
        ? calories.savedFoods.map(normalizeSavedFood)
        : INITIAL_CALORIES.savedFoods;
    const savedFoodsById = new Map(savedFoods.map((food) => [food.id, food]));
    const history = Array.isArray(calories.history)
        ? calories.history.map((entry, index) => {
            const normalizedEntry = normalizeCalorieHistoryEntry(entry, index);
            if (Object.prototype.hasOwnProperty.call(entry || {}, 'coinCost')) {
                return normalizedEntry;
            }

            const savedFood = normalizedEntry.foodId ? savedFoodsById.get(normalizedEntry.foodId) : null;
            return {
                ...normalizedEntry,
                coinCost: normalizeCalorieNumber(savedFood?.coinCost || 0)
            };
        })
        : INITIAL_CALORIES.history;
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
    const passiveCheckpointLedger = normalizePassiveCheckpointLedger({
        ...calories.passiveCheckpointLedger,
        ...(calories.passiveCheckpointDate ? { [calories.passiveCheckpointDate]: calories.passiveCheckpoints } : {})
    });

    const quickSlots = normalizeQuickSlots(calories, savedFoodIds);

    const normalized = {
        ...INITIAL_CALORIES,
        ...calories,
        current: recomputeCalorieCurrent(history),
        target,
        history,
        savedFoods,
        recentFoodIds,
        passiveCheckpointDate,
        passiveCheckpoints,
        passiveCheckpointLedger,
        quickSlots
    };

    delete normalized.preset100FoodId;
    delete normalized.preset250FoodId;
    delete normalized.preset400FoodId;
    delete normalized.preset550FoodId;

    return normalized;
};

const isNormalizedCalorieHistoryEntry = (entry) => {
    if (!entry || typeof entry !== 'object') return false;
    if (typeof entry.id !== 'string' || !entry.id) return false;
    if (typeof entry.timestamp !== 'string' || !entry.timestamp) return false;
    if (typeof entry.dateKey !== 'string' || !entry.dateKey) return false;
    if (typeof entry.label !== 'string' || !entry.label.trim()) return false;
    if (typeof entry.source !== 'string' || !entry.source) return false;
    if (!Number.isInteger(Number(entry.calories))) return false;
    if (!Number.isInteger(Number(entry.coinCost)) || Number(entry.coinCost) < 0) return false;

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

    if (
        !calories.passiveCheckpointLedger
        || typeof calories.passiveCheckpointLedger !== 'object'
        || Array.isArray(calories.passiveCheckpointLedger)
    ) {
        return false;
    }

    if (
        JSON.stringify(normalizePassiveCheckpointLedger(calories.passiveCheckpointLedger))
        !== JSON.stringify(calories.passiveCheckpointLedger)
    ) {
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

    if (!calories.quickSlots || typeof calories.quickSlots !== 'object' || Array.isArray(calories.quickSlots)) {
        return false;
    }

    return QUICK_SLOT_IDS.every((slotId) => (
        Object.prototype.hasOwnProperty.call(calories.quickSlots, slotId)
        && (calories.quickSlots[slotId] === null || savedFoodIds.has(calories.quickSlots[slotId]))
    ));
};

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
    const normalized = normalizeDomainHabitRecord(habit, protocolReward, todayKey);
    const passivePaidThrough = habit.passivePaidThrough === undefined
        ? getDefaultPassivePaidThrough(normalized, todayKey)
        : normalized.passivePaidThrough;

    return {
        ...normalized,
        passivePaidThrough
    };
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
            const passiveChunks = getPassiveCalorieChunks(prev.target);
            const nextHistory = [...history];
            const nextLedger = normalizePassiveCheckpointLedger({
                ...prev.passiveCheckpointLedger,
                ...(prev.passiveCheckpointDate ? { [prev.passiveCheckpointDate]: prev.passiveCheckpoints } : {})
            });

            getPassiveSettlementDateKeys(now).forEach((dateKey) => {
                const storedSettledCheckpointIds = normalizePassiveCheckpoints(nextLedger[dateKey]);
                const existingPassiveCheckpointIds = PASSIVE_CALORIE_CHECKPOINTS
                    .filter((checkpoint) => history.some((entry) => (
                        entry.dateKey === dateKey
                        && entry.source === PASSIVE_CALORIE_SOURCE
                        && entry.id === `cal-passive-${dateKey}-${checkpoint.id}`
                    )))
                    .map((checkpoint) => checkpoint.id);
                const settledCheckpointIds = normalizePassiveCheckpoints([
                    ...storedSettledCheckpointIds,
                    ...existingPassiveCheckpointIds
                ]);
                const settledCheckpointSet = new Set(settledCheckpointIds);
                const nextSettledCheckpointIds = [...settledCheckpointIds];

                PASSIVE_CALORIE_CHECKPOINTS.forEach((checkpoint, index) => {
                    const checkpointDate = getPassiveCheckpointDate(dateKey, checkpoint);

                    if (now < checkpointDate || settledCheckpointSet.has(checkpoint.id)) return;

                    const hasUserEntryBeforeCheckpoint = history.some((entry) => {
                        if (entry.dateKey !== dateKey || entry.source === PASSIVE_CALORIE_SOURCE) return false;
                        const entryDate = new Date(entry.timestamp);
                        return Number.isFinite(entryDate.getTime()) && entryDate <= checkpointDate;
                    });

                    settledCheckpointSet.add(checkpoint.id);
                    nextSettledCheckpointIds.push(checkpoint.id);

                    if (hasUserEntryBeforeCheckpoint) return;

                    nextHistory.push(createCalorieHistoryEntry({
                        id: `cal-passive-${dateKey}-${checkpoint.id}`,
                        timestamp: checkpointDate.toISOString(),
                        dateKey,
                        calories: passiveChunks[index],
                        label: checkpoint.label,
                        source: PASSIVE_CALORIE_SOURCE
                    }));
                });

                if (nextSettledCheckpointIds.length > 0) {
                    nextLedger[dateKey] = normalizePassiveCheckpoints(nextSettledCheckpointIds);
                }
            });

            const todayPassiveCheckpoints = normalizePassiveCheckpoints(nextLedger[todayKey]);
            const checkpointDateChanged = prev.passiveCheckpointDate !== todayKey;
            const checkpointsChanged = (
                JSON.stringify(todayPassiveCheckpoints) !== JSON.stringify(normalizePassiveCheckpoints(prev.passiveCheckpoints))
                || JSON.stringify(nextLedger) !== JSON.stringify(normalizePassiveCheckpointLedger(prev.passiveCheckpointLedger))
            );
            const historyChanged = nextHistory.length !== history.length;

            if (!checkpointDateChanged && !checkpointsChanged && !historyChanged) {
                return prev;
            }

            return {
                ...prev,
                history: nextHistory,
                passiveCheckpointDate: todayKey,
                passiveCheckpoints: todayPassiveCheckpoints,
                passiveCheckpointLedger: nextLedger,
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
        const nextState = normalizePortableSnapshot(snapshot);

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
        foodId = null,
        coinCost = 0
    }) => {
        const safeCalories = normalizeSignedCalorieNumber(amount);
        if (safeCalories === 0) return false;

        const now = new Date().toISOString();
        const nextEntry = createCalorieHistoryEntry({
            timestamp: now,
            calories: safeCalories,
            label,
            source,
            foodId,
            coinCost
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
        const editableDateKeys = getEditableCalorieDateKeys();

        setCalories(prev => {
            const nextHistory = (prev.history || []).map((entry) => {
                if (entry.id !== entryId || !editableDateKeys.has(entry.dateKey)) return entry;

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

    const appendCoinHistoryEntries = useCallback((entries) => {
        if (!entries.length) return;
        setCoinHistory(prev => [...prev, ...entries]);
    }, [setCoinHistory]);

    const deleteCalorieEntry = useCallback((entryId) => {
        const editableDateKeys = getEditableCalorieDateKeys();
        const history = calories.history || [];
        const deletedEntry = history.find((entry) => entry.id === entryId && editableDateKeys.has(entry.dateKey));
        const savedFood = deletedEntry?.foodId
            ? (calories.savedFoods || []).find((food) => food.id === deletedEntry.foodId)
            : null;
        const refundAmount = deletedEntry
            ? normalizeCalorieNumber(deletedEntry.coinCost ?? savedFood?.coinCost ?? 0)
            : 0;

        setCalories(prev => {
            const nextHistory = (prev.history || []).filter(
                (entry) => !(entry.id === entryId && editableDateKeys.has(entry.dateKey))
            );

            return {
                ...prev,
                history: nextHistory,
                current: recomputeCalorieCurrent(nextHistory)
            };
        });

        if (deletedEntry && refundAmount > 0) {
            setStats(prev => ({ ...prev, gold: Number(prev.gold || 0) + refundAmount }));
            appendCoinHistoryEntries([
                createCoinHistoryEntry({
                    amount: refundAmount,
                    description: `Refunded food removal: ${deletedEntry.label || 'Calorie entry'}`,
                    type: 'earned'
                })
            ]);
        }
    }, [appendCoinHistoryEntries, calories.history, calories.savedFoods, setCalories, setStats]);

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
            quickSlots: Object.fromEntries(
                QUICK_SLOT_IDS.map((slotId) => [
                    slotId,
                    prev.quickSlots?.[slotId] === foodId ? null : prev.quickSlots?.[slotId] ?? null
                ])
            )
        }));
    }, [setCalories]);

    const setCalorieGoal = useCallback((amount) => {
        const safeGoal = Math.max(1, normalizeCalorieNumber(amount));
        setCalories(prev => ({ ...prev, target: safeGoal }));
    }, [setCalories]);

    const assignQuickSlotFood = useCallback((slotId, foodId = null) => {
        if (!QUICK_SLOT_IDS.includes(slotId)) return;

        setCalories(prev => {
            const savedFoodIds = new Set((prev.savedFoods || []).map((food) => food.id));
            const safeFoodId = foodId && savedFoodIds.has(foodId) ? foodId : null;
            return {
                ...prev,
                quickSlots: {
                    ...createDefaultQuickSlots(),
                    ...(prev.quickSlots || {}),
                    [slotId]: safeFoodId
                }
            };
        });
    }, [setCalories]);

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
            id: createId('quest'),
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
            id: createId('habit'),
            title,
            frequency,
            frequencyParam,
            streak: 0,
            history: {},
            isActive: false,
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
                    isActive: true
                };
            }

            return {
                ...h,
                isActive: false,
                passivePaidThrough: getPausedPassivePaidThrough(h, todayKey)
            };
        }));
    }, [setHabits]);

    const completeHabit = useCallback((id) => {
        const today = getTodayISO();
        const currentHabit = habits.find(h => h.id === id);

        if (!currentHabit) return;

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

            const newHistory = normalizeHabitHistory(h.history);
            const count = Number(newHistory[today] || 0);

            return {
                ...h,
                streak: Number(h.streak || 0) + 1,
                history: { ...newHistory, [today]: count + 1 },
                isActive: true,
                passivePaidThrough: today,
                lastCycleResetDateKey: today,
                completionReward: Number(h.completionReward ?? settings.protocolReward) || 0,
                passiveReward: Number(h.passiveReward || 0) || 0
            };
        }));
    }, [addGold, addRewardFromGold, addXp, habits, setHabits, settings.protocolReward]);

    const skipHabitCycle = useCallback((id) => {
        const today = getTodayISO();

        setHabits(prev => prev.map(h => {
            if (h.id !== id) return h;

            return {
                ...h,
                isActive: true,
                passivePaidThrough: today,
                lastCycleResetDateKey: today,
                completionReward: Number(h.completionReward ?? settings.protocolReward) || 0,
                passiveReward: Number(h.passiveReward || 0) || 0
            };
        }));
    }, [setHabits, settings.protocolReward]);

    const recordHabitFailure = useCallback((id) => {
        const today = getTodayISO();
        takeDamage(5);
        setHabits(prev => prev.map(h => {
            if (h.id !== id) return h;

            const newHistory = normalizeHabitHistory(h.history);
            const count = Number(newHistory[today] || 0);
            const nextCount = Math.max(0, count - 1);
            const nextHistory = { ...newHistory };

            if (nextCount > 0) {
                nextHistory[today] = nextCount;
            } else {
                delete nextHistory[today];
            }

            return {
                ...h,
                streak: 0,
                history: nextHistory
            };
        }));
    }, [setHabits, takeDamage]);

    const undoHabitCompletion = useCallback((id) => {
        const today = getTodayISO();

        setHabits(prev => prev.map(h => {
            if (h.id !== id) return h;

            const newHistory = normalizeHabitHistory(h.history);
            const count = Number(newHistory[today] || 0);
            const nextCount = Math.max(0, count - 1);
            const nextHistory = { ...newHistory };

            if (nextCount > 0) {
                nextHistory[today] = nextCount;
            } else {
                delete nextHistory[today];
            }

            return {
                ...h,
                streak: Math.max(0, Number(h.streak || 0) - 1),
                history: nextHistory
            };
        }));
    }, [setHabits]);

    const checkHabit = useCallback((id, direction = 'positive') => {
        if (direction === 'skip') {
            skipHabitCycle(id);
            return;
        }

        if (direction === 'negative' || direction === 'failure') {
            recordHabitFailure(id);
            return;
        }

        completeHabit(id);
    }, [completeHabit, recordHabitFailure, skipHabitCycle]);

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
            setQuests(prev => prev.map(q => q.id === id ? { ...q, isFocusedToday: !q.isFocusedToday } : q));
            return;
        }

        if (type === 'habit') {
            return;
        }
    }, [setQuests]);

    useEffect(() => {
        const todayKey = getTodayISO();
        const normalizedHabits = habits.map(habit => normalizeHabitRecord(habit, settings.protocolReward, todayKey));
        const hasChanges = JSON.stringify(normalizedHabits) !== JSON.stringify(habits);

        if (!hasChanges) return;

        setHabits(normalizedHabits);
    }, [habits, setHabits, settings.protocolReward]);

    useEffect(() => {
        const normalizedQuests = quests.map(normalizeQuestRecord);
        const hasChanges = JSON.stringify(normalizedQuests) !== JSON.stringify(quests);

        if (!hasChanges) return;

        setQuests(normalizedQuests);
    }, [quests, setQuests]);

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
        const nextHabits = passiveSettlement.updatedHabits;
        const habitsChanged = nextHabits.some((habit, index) => habit !== habits[index]);

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
        addHabit, completeHabit, skipHabitCycle, recordHabitFailure, undoHabitCompletion, checkHabit,
        deleteHabit, toggleHabitActivation, updateHabitRewards,
        updateStats, updateSettings, spendCoins, addGold,
        toggleToday, exportAppState, importAppState
    }), [
        stats, quests, habits, settings, coinHistory,
        addQuest, completeQuest, deleteQuest, restoreQuest, updateQuest, permanentDeleteQuest, undoCompleteQuest,
        addHabit, completeHabit, skipHabitCycle, recordHabitFailure, undoHabitCompletion, checkHabit,
        deleteHabit, toggleHabitActivation, updateHabitRewards,
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
