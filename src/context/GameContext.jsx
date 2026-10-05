/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo } from 'react';
import { useAppState, useAppStateField } from './AppStateContext.jsx';
import { createInitialAppState } from '../domain/initialState.js';
import {
    changeCoins,
    setCoinBalance,
    completeQuest as completeQuestTransaction,
    undoQuest as undoQuestTransaction,
    completeProtocol as completeProtocolTransaction,
    createQuest as createQuestTransaction,
    discardQuest as discardQuestTransaction,
    restoreQuest as restoreQuestTransaction,
    setQuestFocus,
    createProtocol as createProtocolTransaction,
    setProtocolActive,
    skipProtocol as skipProtocolTransaction,
    purchaseGrocery, refundGrocery, purchaseCalories, refundCalories
} from '../domain/transactions.js';
import { addDays } from '../domain/calendar.js';
import {
    PASSIVE_CALORIE_SOURCE,
    createCalorieEntry,
    createSavedFood,
    getEditableCalorieDateKeys,
    normalizeCalorieLabel,
    normalizeCalorieNumber,
    normalizeSignedCalorieNumber
} from '../domain/calories.js';
import { getTodayISO, isWithinDays, toLocalDateKey } from '../utils/dateUtils';
import {
    createPortableSnapshot,
    migrateLegacyPortableSnapshot,
    readProtocolLookaheadDays,
    storePortableImportBackup,
    writeProtocolLookaheadDays
} from '../utils/portableState.js';
import {
    QUICK_SLOT_IDS,
    createDefaultQuickSlots,
    createId,
    normalizeHabitRecord,
    normalizeQuestRecord,
    normalizeQuickSlots
} from '../domain/gameState.js';
import {
    applyHomeScreenIconMetadata,
    normalizeHomeScreenIconId
} from '../utils/homeScreenIcons.js';
import {
    normalizeCurrencyAmount,
    normalizeNonNegativeCurrencyAmount
} from '../constants/currency.js';

const GameContext = createContext();
const CalorieContext = createContext();

export const useGame = () => useContext(GameContext);
export const useGameCalories = () => useContext(CalorieContext);

const INITIAL_CALORIES = createInitialAppState().calories;
const PASSIVE_CALORIE_LOOKBACK_DAYS = 7;
const PASSIVE_CALORIE_CHECKPOINTS = [
    { id: '18:00', hour: 18, minute: 0, label: 'Passive Fill 6PM' },
    { id: '23:59', hour: 23, minute: 59, label: 'Passive Fill 11:59PM' }
];

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
    const todayKey = toLocalDateKey(now);
    return Array.from({ length: PASSIVE_CALORIE_LOOKBACK_DAYS }, (_, index) => (
        addDays(todayKey, index - (PASSIVE_CALORIE_LOOKBACK_DAYS - 1))
    ));
};

const normalizePassiveCheckpointLedger = (ledger) => {
    if (!ledger || typeof ledger !== 'object' || Array.isArray(ledger)) return {};

    return Object.fromEntries(
        Object.entries(ledger)
            .filter(([dateKey]) => /^\d{4}-\d{2}-\d{2}$/.test(dateKey))
            .map(([dateKey, checkpoints]) => [dateKey, normalizePassiveCheckpoints(checkpoints)])
    );
};

const createCalorieHistoryEntry = ({ id = createId('cal'), timestamp, dateKey, ...entry }) => {
    const safeTimestamp = timestamp || new Date().toISOString();
    return createCalorieEntry({
        ...entry, id, timestamp: safeTimestamp, dateKey: dateKey || toLocalDateKey(safeTimestamp)
    });
};

const createSavedFoodRecord = ({ id = createId('food'), createdAt = new Date().toISOString(), ...food }) => (
    createSavedFood({ updatedAt: createdAt, ...food, id, createdAt })
);

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
                coinCost: normalizeNonNegativeCurrencyAmount(savedFood?.coinCost || 0)
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
    if (!Number.isFinite(Number(entry.coinCost)) || Number(entry.coinCost) < 0) return false;

    return Object.prototype.hasOwnProperty.call(entry, 'foodId');
};

const isNormalizedSavedFood = (food) => {
    if (!food || typeof food !== 'object') return false;
    if (typeof food.id !== 'string' || !food.id) return false;
    if (typeof food.name !== 'string' || !food.name.trim()) return false;
    if (!Number.isInteger(Number(food.calories)) || Number(food.calories) <= 0) return false;
    if (!Number.isFinite(Number(food.coinCost)) || Number(food.coinCost) < 0) return false;
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

export const createTransactionEvent = (prefix = 'coin', now = new Date()) => ({
    id: createId(prefix), date: now.toISOString(), todayKey: toLocalDateKey(now),
    dateForDay: createLedgerTimestamp
});

export const GameProvider = ({ children }) => {
    const { state, updateState } = useAppState();
    const stats = state.stats;
    const [quests, setQuests] = useAppStateField('quests');
    const [habits, setHabits] = useAppStateField('habits');
    const [settings, setSettings] = useAppStateField('settings');
    const [calories, setCalories] = useAppStateField('calories');
    const coinHistory = state.coinHistory;

    useEffect(() => {
        setCalories((prev) => (isCaloriesStateNormalized(prev) ? prev : normalizeCaloriesForImport(prev)));
    }, [setCalories]);

    useEffect(() => {
        const normalizedIconId = normalizeHomeScreenIconId(settings.homeScreenIconId);
        applyHomeScreenIconMetadata(normalizedIconId);

        if (settings.homeScreenIconId !== normalizedIconId) {
            setSettings((prev) => ({ ...prev, homeScreenIconId: normalizedIconId }));
        }
    }, [settings.homeScreenIconId, setSettings]);

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

    const updateStats = useCallback((newStats = {}) => {
        const { gold, ...otherStats } = newStats;
        const event = createTransactionEvent();
        updateState((previous) => {
            const next = { ...previous, stats: { ...previous.stats, ...otherStats } };
            return gold === undefined ? next : setCoinBalance(next, gold, event);
        });
    }, [updateState]);

    const updateSettings = useCallback((newSettings) => {
        setSettings(prev => ({
            ...prev,
            ...newSettings,
            ...(Object.prototype.hasOwnProperty.call(newSettings || {}, 'protocolReward')
                ? { protocolReward: normalizeNonNegativeCurrencyAmount(newSettings.protocolReward) }
                : {}),
            ...(newSettings?.questRewards
                ? {
                    questRewards: {
                        ...prev.questRewards,
                        ...newSettings.questRewards,
                        ...Object.fromEntries(
                            Object.entries(newSettings.questRewards).map(([key, value]) => [
                                key,
                                normalizeNonNegativeCurrencyAmount(value)
                            ])
                        )
                    }
                }
                : {})
        }));
    }, [setSettings]);

    const exportAppState = useCallback(() => createPortableSnapshot({
        ...state,
        ui: { protocolLookaheadDays: readProtocolLookaheadDays() }
    }), [state]);

    const importAppState = useCallback((snapshot, { backup = true } = {}) => {
        const next = migrateLegacyPortableSnapshot(snapshot);
        const backupKey = backup ? storePortableImportBackup(exportAppState()) : null;
        updateState({
            stats: next.stats, settings: next.settings, quests: next.quests,
            habits: next.habits, calories: next.calories, coinHistory: next.coinHistory,
            budget: next.budget
        });
        writeProtocolLookaheadDays(next.ui.protocolLookaheadDays);
        return { backupKey };
    }, [exportAppState, updateState]);

    const logCalories = useCallback(({
        calories: amount, label, source = 'manual', foodId = null, coinCost = 0, saveAsFood = false
    }) => {
        const safeCalories = normalizeSignedCalorieNumber(amount);
        if (safeCalories === 0) return false;
        const event = createTransactionEvent();
        const savedFood = saveAsFood && safeCalories > 0
            ? createSavedFoodRecord({ name: label, calories: safeCalories, coinCost, createdAt: event.date })
            : null;
        const entry = createCalorieHistoryEntry({
            timestamp: event.date,
            dateKey: event.todayKey,
            calories: safeCalories,
            label,
            source: savedFood ? 'saved-food' : source,
            foodId: savedFood?.id || foodId,
            coinCost: safeCalories > 0 ? coinCost : 0
        });
        updateState((previous) => purchaseCalories(previous, entry, event, savedFood));
        return true;
    }, [updateState]);

    const updateCalorieEntry = useCallback((entryId, updates = {}) => {
        const editableDateKeys = getEditableCalorieDateKeys(getTodayISO());

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

    const deleteCalorieEntry = useCallback((entryId) => {
        const event = createTransactionEvent();
        const editableDateKeys = getEditableCalorieDateKeys(event.todayKey);
        updateState((previous) => refundCalories(previous, entryId, editableDateKeys, event));
    }, [updateState]);

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
        const event = createTransactionEvent();
        updateState((previous) => changeCoins(previous, -normalizeCurrencyAmount(amount), event, description));
        return true;
    }, [updateState]);

    const purchaseGroceryItem = useCallback((id) => {
        const event = createTransactionEvent();
        updateState((previous) => purchaseGrocery(previous, id, event));
    }, [updateState]);

    const refundGroceryItem = useCallback((id) => {
        const event = createTransactionEvent();
        updateState((previous) => refundGrocery(previous, id, event));
    }, [updateState]);

    const addQuest = useCallback((title, difficulty = 'easy', dueDate = null, customReward = null, missionBrief = '') => {
        const event = createTransactionEvent('quest');
        updateState((previous) => createQuestTransaction(previous, {
            title, difficulty, dueDate, reward: customReward, missionBrief
        }, event));
    }, [updateState]);

    const updateQuest = useCallback((id, updates) => {
        setQuests(prev => prev.map(q => q.id === id ? { ...q, ...updates } : q));
    }, [setQuests]);

    const completeQuest = useCallback((id) => {
        const event = createTransactionEvent();
        updateState((previous) => completeQuestTransaction(previous, id, event));
    }, [updateState]);

    const undoCompleteQuest = useCallback((id) => {
        const event = createTransactionEvent();
        updateState((previous) => undoQuestTransaction(previous, id, event));
    }, [updateState]);

    const deleteQuest = useCallback((id) => {
        const event = createTransactionEvent();
        updateState((previous) => discardQuestTransaction(previous, id, event));
    }, [updateState]);

    const restoreQuest = useCallback((id) => {
        updateState((previous) => restoreQuestTransaction(previous, id));
    }, [updateState]);

    const addHabit = useCallback((title, frequency = 'daily', frequencyParam = 1, rewardConfig = {}) => {
        const event = createTransactionEvent('habit');
        updateState((previous) => createProtocolTransaction(previous, {
            title, frequency, frequencyParam, ...rewardConfig, active: false
        }, event));
    }, [updateState]);

    const toggleHabitActivation = useCallback((id, isActive) => {
        const event = createTransactionEvent();
        updateState((previous) => setProtocolActive(previous, id, Boolean(isActive), event));
    }, [updateState]);

    const completeHabit = useCallback((id) => {
        const event = createTransactionEvent();
        updateState((previous) => completeProtocolTransaction(previous, id, event));
    }, [updateState]);

    const skipHabitCycle = useCallback((id) => {
        const event = createTransactionEvent();
        updateState((previous) => skipProtocolTransaction(previous, id, event));
    }, [updateState]);

    const updateHabitRewards = useCallback((id, rewardConfig = {}) => {
        const hasCompletionReward = Object.prototype.hasOwnProperty.call(rewardConfig, 'completionReward');
        const hasPassiveReward = Object.prototype.hasOwnProperty.call(rewardConfig, 'passiveReward');

        if (!hasCompletionReward && !hasPassiveReward) return;

        setHabits(prev => prev.map(h => {
            if (h.id !== id) return h;

            return {
                ...h,
                completionReward: hasCompletionReward
                    ? normalizeNonNegativeCurrencyAmount(rewardConfig.completionReward)
                    : normalizeNonNegativeCurrencyAmount(h.completionReward ?? settings.protocolReward),
                passiveReward: hasPassiveReward
                    ? normalizeNonNegativeCurrencyAmount(rewardConfig.passiveReward)
                    : normalizeNonNegativeCurrencyAmount(h.passiveReward)
            };
        }));
    }, [setHabits, settings.protocolReward]);

    const deleteHabit = useCallback((id) => {
        setHabits(prev => prev.filter(h => h.id !== id));
    }, [setHabits]);

    const toggleToday = useCallback((id, type) => {
        if (type === 'quest') {
            updateState((previous) => {
                const quest = previous.quests.find((entry) => entry.id === id);
                return setQuestFocus(previous, id, !quest?.isFocusedToday);
            });
        }
    }, [updateState]);

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
        logCalories,
        updateCalorieEntry,
        deleteCalorieEntry,
        createSavedFood,
        updateSavedFood,
        deleteSavedFood,
        setCalorieGoal,
        assignQuickSlotFood
    }), [
        calories,
        logCalories,
        updateCalorieEntry,
        deleteCalorieEntry,
        createSavedFood,
        updateSavedFood,
        deleteSavedFood,
        setCalorieGoal,
        assignQuickSlotFood
    ]);

    const contextValue = useMemo(() => ({
        stats, quests, habits, settings, coinHistory,
        addQuest, completeQuest, deleteQuest, restoreQuest, updateQuest, undoCompleteQuest,
        addHabit, completeHabit, skipHabitCycle,
        deleteHabit, toggleHabitActivation, updateHabitRewards,
        updateStats, updateSettings, spendCoins, purchaseGroceryItem, refundGroceryItem,
        toggleToday, exportAppState, importAppState
    }), [
        stats, quests, habits, settings, coinHistory,
        addQuest, completeQuest, deleteQuest, restoreQuest, updateQuest, undoCompleteQuest,
        addHabit, completeHabit, skipHabitCycle,
        deleteHabit, toggleHabitActivation, updateHabitRewards,
        updateStats, updateSettings, spendCoins, purchaseGroceryItem, refundGroceryItem,
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
