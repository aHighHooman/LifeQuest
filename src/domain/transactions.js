import {
    normalizeCurrencyAmount,
    normalizeNonNegativeCurrencyAmount,
    creditsToUsd,
    usdToCredits
} from '../constants/currency.js';
import { applyXp, createQuestReward, resolveQuestReward } from './rewards.js';
import { markQuestDiscarded } from './gameState.js';
import {
    getProtocolCycleState,
    getPausedPassivePaidThrough,
    getProtocolPassivePayoutDateKeys
} from './protocols.js';

const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

// Wallet and ledger always move together. Spending is stored as a positive
// amount with type "spent", matching the ledger's existing display contract.
export const changeCoins = (state, amount, event, description, earnedRewardsDelta = 0) => {
    const gold = normalizeCurrencyAmount(amount);
    const earnedRewards = numberOr(earnedRewardsDelta);
    if (gold === 0 && earnedRewards === 0) return state;
    return {
        ...state,
        stats: { ...state.stats, gold: normalizeCurrencyAmount(numberOr(state.stats.gold) + gold) },
        budget: earnedRewards === 0 ? state.budget : {
            ...state.budget,
            earnedRewards: numberOr(state.budget.earnedRewards) + earnedRewards
        },
        coinHistory: gold === 0 ? state.coinHistory : [...state.coinHistory, {
            id: event.id,
            date: event.date,
            amount: Math.abs(gold),
            type: gold > 0 ? 'earned' : 'spent',
            description,
            ...(earnedRewards !== 0 ? { earnedRewardsDelta: earnedRewards } : {})
        }]
    };
};

// A balance typed in Settings is recorded as the difference, so the ledger
// still adds up to the wallet.
export const setCoinBalance = (state, balance, event) => changeCoins(
    state,
    normalizeCurrencyAmount(normalizeCurrencyAmount(balance) - numberOr(state.stats.gold)),
    event,
    'Manual adjustment'
);

const grantReward = (state, xp, gold, event, description) => {
    const safeXp = Math.max(0, numberOr(xp));
    const safeGold = normalizeNonNegativeCurrencyAmount(gold);
    // Capture the balance change after rounding, not just the exchange rate.
    const nextEarned = safeGold === 0
        ? numberOr(state.budget.earnedRewards)
        : normalizeCurrencyAmount(numberOr(state.budget.earnedRewards) + creditsToUsd(safeGold, state.budget.goldToUsdRatio));
    const earnedRewardsDelta = nextEarned - numberOr(state.budget.earnedRewards);
    const next = changeCoins(state, safeGold, event, description, earnedRewardsDelta);
    return {
        state: { ...next, stats: applyXp(next.stats, safeXp) },
        receipt: { xp: safeXp, gold: safeGold, earnedRewardsDelta }
    };
};

export const createQuest = (state, input, event) => {
    if (event.requestId && state.quests.some((quest) => quest.actionRequestId === event.requestId)) return state;
    const difficulty = input.difficulty || 'easy';
    const customReward = input.reward && (input.reward.xp !== undefined || input.reward.gold !== undefined)
        ? input.reward : null;
    const quest = {
        id: event.id, title: `${input.title ?? ''}`.trim(), difficulty,
        dueDate: input.dueDate || null, missionBrief: input.missionBrief || '',
        completed: false, discarded: false,
        reward: createQuestReward(state.settings, difficulty, customReward),
        isCustomReward: Boolean(customReward), isFocusedToday: Boolean(input.selectedForToday),
        ...(event.requestId ? { actionRequestId: event.requestId } : {}),
        createdAt: event.date
    };
    return { ...state, quests: [quest, ...state.quests] };
};

export const discardQuest = (state, id, event) => {
    const quest = state.quests.find((entry) => entry.id === id);
    if (!quest || quest.discarded) return state;
    return { ...state, quests: state.quests.map((entry) => entry.id === id ? markQuestDiscarded(entry, event.date) : entry) };
};

export const restoreQuest = (state, id) => {
    const quest = state.quests.find((entry) => entry.id === id);
    if (!quest?.discarded) return state;
    return { ...state, quests: state.quests.map((entry) => entry.id === id ? {
        ...entry, discarded: false, discardedAt: null
    } : entry) };
};

export const setQuestFocus = (state, id, selected) => {
    const quest = state.quests.find((entry) => entry.id === id);
    if (!quest || quest.discarded || Boolean(quest.isFocusedToday) === selected) return state;
    return { ...state, quests: state.quests.map((entry) => entry.id === id ? { ...entry, isFocusedToday: selected } : entry) };
};

export const completeQuest = (state, id, event) => {
    const quest = state.quests.find((entry) => entry.id === id);
    if (!quest || quest.completed || quest.discarded) return state;
    const reward = resolveQuestReward(state.settings, quest);
    const { state: next, receipt } = grantReward(state, reward.xp, reward.gold, event, 'Earned from Quest');
    return {
        ...next,
        quests: next.quests.map((entry) => entry.id === id ? {
            ...entry, completed: true, completedAt: event.date, completedReward: receipt
        } : entry)
    };
};

export const undoQuest = (state, id, event) => {
    const quest = state.quests.find((entry) => entry.id === id);
    if (!quest?.completed) return state;
    const receipt = quest.completedReward || resolveQuestReward(state.settings, quest);
    const gold = normalizeNonNegativeCurrencyAmount(receipt.gold);
    // Old saves did not record the USD delta. Retain their previous fallback;
    // new completions never need to reconstruct it using today's settings.
    const earnedRewardsDelta = receipt.earnedRewardsDelta ?? creditsToUsd(gold, state.budget.goldToUsdRatio);
    const next = changeCoins(state, -gold, event, 'Reverted Quest Undo', -earnedRewardsDelta);
    return {
        ...next,
        stats: applyXp(next.stats, -Math.max(0, numberOr(receipt.xp))),
        quests: next.quests.map((entry) => entry.id === id ? {
            ...entry, completed: false, completedAt: null, completedReward: null
        } : entry)
    };
};

// Completing, skipping, or pausing ends a protocol's passive window, so pay
// what that window still owes first. After the browser's daily settlement this
// is empty; for writers that never settle, such as the action worker, it is not.
// An omitted cursor is a legacy record whose migration grants no back pay.
const payOwedPassiveIncome = (state, id, event) => {
    const protocol = state.habits.find((entry) => entry.id === id);
    if (!protocol || protocol.passivePaidThrough === undefined) return state;
    const dates = getProtocolPassivePayoutDateKeys(protocol, protocol.passivePaidThrough, event.todayKey);
    if (!dates.length) return state;
    const reward = normalizeCurrencyAmount(protocol.passiveReward);
    const gold = normalizeCurrencyAmount(reward * dates.length);
    return {
        ...state,
        stats: { ...state.stats, gold: normalizeCurrencyAmount(numberOr(state.stats.gold) + gold) },
        budget: {
            ...state.budget,
            earnedRewards: normalizeCurrencyAmount(
                numberOr(state.budget.earnedRewards) + creditsToUsd(gold, state.budget.goldToUsdRatio)
            )
        },
        coinHistory: [...state.coinHistory, ...dates.map((dateKey) => ({
            id: `${event.id}-${id}-${dateKey}`,
            date: event.dateForDay ? event.dateForDay(dateKey) : `${dateKey}T12:00:00.000Z`,
            amount: reward, type: 'earned', description: `Protocol passive income: ${protocol.title}`
        }))],
        habits: state.habits.map((entry) => entry.id === id
            ? { ...entry, passivePaidThrough: dates[dates.length - 1] }
            : entry)
    };
};

export const completeProtocol = (state, id, event) => {
    const protocol = state.habits.find((entry) => entry.id === id);
    if (!protocol || (event.requestId && (protocol.actionReceipts || []).includes(event.requestId))) return state;
    const reward = normalizeNonNegativeCurrencyAmount(protocol.completionReward, state.settings.protocolReward);
    const { isDueToday } = getProtocolCycleState(protocol, event.todayKey);
    const { state: next } = grantReward(
        payOwedPassiveIncome(state, id, event), 5, isDueToday ? reward : 0, event, `Protocol due bonus: ${protocol.title}`
    );
    return {
        ...next,
        habits: next.habits.map((entry) => entry.id === id ? {
            ...entry,
            history: { ...entry.history, [event.todayKey]: Math.max(0, numberOr(entry.history?.[event.todayKey])) + 1 },
            isActive: true,
            passivePaidThrough: event.todayKey,
            lastCycleResetDateKey: event.todayKey,
            completionReward: reward,
            passiveReward: normalizeNonNegativeCurrencyAmount(entry.passiveReward),
            ...(event.requestId ? { actionReceipts: [...(entry.actionReceipts || []), event.requestId].slice(-20) } : {})
        } : entry)
    };
};

export const createProtocol = (state, input, event) => {
    if (event.requestId && state.habits.some((protocol) => protocol.actionRequestId === event.requestId)) return state;
    const frequency = input.frequency || 'daily';
    const protocol = {
        id: event.id, title: `${input.title ?? ''}`.trim(), frequency,
        frequencyParam: frequency === 'interval' ? Math.max(1, Math.round(numberOr(input.frequencyParam, 1))) : 1,
        history: {}, isActive: Boolean(input.active),
        completionReward: normalizeNonNegativeCurrencyAmount(input.completionReward, state.settings.protocolReward),
        passiveReward: normalizeNonNegativeCurrencyAmount(input.passiveReward),
        passivePaidThrough: null, lastCycleResetDateKey: null,
        ...(event.requestId ? { actionRequestId: event.requestId } : {}),
        createdAt: event.date
    };
    return { ...state, habits: [protocol, ...state.habits] };
};

export const setProtocolActive = (state, id, active, event) => {
    const protocol = state.habits.find((entry) => entry.id === id);
    if (!protocol || (protocol.isActive !== false) === active) return state;
    const paid = active ? state : payOwedPassiveIncome(state, id, event);
    return { ...paid, habits: paid.habits.map((entry) => entry.id === id ? {
        ...entry, isActive: active,
        ...(!active ? { passivePaidThrough: getPausedPassivePaidThrough(entry, event.todayKey) } : {})
    } : entry) };
};

export const skipProtocol = (state, id, event) => {
    if (!state.habits.some((entry) => entry.id === id)) return state;
    const todayKey = event.todayKey;
    const paid = payOwedPassiveIncome(state, id, event);
    return { ...paid, habits: paid.habits.map((entry) => entry.id === id ? {
        ...entry, isActive: true, passivePaidThrough: todayKey, lastCycleResetDateKey: todayKey,
        completionReward: normalizeNonNegativeCurrencyAmount(entry.completionReward, state.settings.protocolReward),
        passiveReward: normalizeNonNegativeCurrencyAmount(entry.passiveReward)
    } : entry) };
};

export const purchaseGrocery = (state, id, event) => {
    const item = state.budget.groceryList.find((entry) => entry.id === id);
    if (!item || item.completed) return state;
    const quantity = Math.max(1, numberOr(item.quantity, 1));
    const coinCost = normalizeNonNegativeCurrencyAmount(usdToCredits(numberOr(item.price) * quantity, state.budget.goldToUsdRatio));
    const next = changeCoins(state, -coinCost, event, `Groceries: ${item.name} x${quantity}`);
    return {
        ...next,
        budget: {
            ...next.budget,
            groceryList: next.budget.groceryList.map((entry) => entry.id === id ? {
                ...entry, completed: true, completedDateKey: event.todayKey, completedAt: event.date, coinCost
            } : entry)
        }
    };
};

export const refundGrocery = (state, id, event) => {
    const item = state.budget.groceryList.find((entry) => entry.id === id);
    if (!item?.completed || item.completedDateKey !== event.todayKey) return state;
    const quantity = Math.max(1, numberOr(item.quantity, 1));
    const coinCost = normalizeNonNegativeCurrencyAmount(
        item.coinCost ?? usdToCredits(numberOr(item.price) * quantity, state.budget.goldToUsdRatio)
    );
    const next = changeCoins(state, coinCost, event, `Grocery refund: ${item.name} x${quantity}`);
    return {
        ...next,
        budget: {
            ...next.budget,
            groceryList: next.budget.groceryList.map((entry) => entry.id === id ? {
                ...entry, completed: false, completedDateKey: null, completedAt: null, coinCost: null
            } : entry)
        }
    };
};

const calorieTotal = (history, todayKey) => history.reduce(
    (sum, entry) => entry.dateKey === todayKey ? sum + numberOr(entry.calories) : sum, 0
);

export const purchaseCalories = (state, entry, event, savedFood = null) => {
    if (state.calories.history.some((current) => current.id === entry.id)) return state;
    const coinCost = entry.calories > 0 ? normalizeNonNegativeCurrencyAmount(entry.coinCost) : 0;
    const next = changeCoins(state, -coinCost, event, `${entry.foodId ? 'Food' : 'Manual'} inject: ${entry.label}`);
    const history = [...state.calories.history, { ...entry, coinCost }];
    const recentFoodIds = entry.foodId
        ? [entry.foodId, ...state.calories.recentFoodIds.filter((id) => id !== entry.foodId)].slice(0, 10)
        : state.calories.recentFoodIds;
    return {
        ...next,
        calories: {
            ...state.calories,
            history,
            current: calorieTotal(history, event.todayKey),
            recentFoodIds,
            savedFoods: savedFood ? [...state.calories.savedFoods, savedFood] : state.calories.savedFoods
        }
    };
};

export const refundCalories = (state, id, editableDateKeys, event) => {
    const entry = state.calories.history.find((current) => current.id === id);
    if (!entry || !editableDateKeys.has(entry.dateKey)) return state;
    const savedFood = state.calories.savedFoods.find((food) => food.id === entry.foodId);
    const coinCost = normalizeNonNegativeCurrencyAmount(entry.coinCost ?? savedFood?.coinCost);
    const next = changeCoins(state, coinCost, event, `Refunded food removal: ${entry.label || 'Calorie entry'}`);
    const history = state.calories.history.filter((current) => current.id !== id);
    return {
        ...next,
        calories: { ...state.calories, history, current: calorieTotal(history, event.todayKey) }
    };
};
