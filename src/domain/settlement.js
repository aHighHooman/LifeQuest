import { addDays } from './calendar.js';
import { getProtocolPassivePayoutDateKeys } from './protocols.js';
import { normalizeHabitRecord } from './gameState.js';
import { normalizeCurrencyAmount, creditsToUsd } from '../constants/currency.js';

const STIPEND_PERIOD_DAYS = { weekly: 7, 'bi-weekly': 14, monthly: 30 };

// The adapter supplies one event ID and a deterministic day-to-instant
// conversion. Settlement itself reads no clock, storage, or timezone.
export const settleDaily = (state, event) => {
    const todayKey = event.todayKey;
    if (state.stats.lastLoginDate === todayKey) return state;
    let passiveGold = 0;
    let stipendGold = 0;
    const ledger = [];
    const payout = (amount, description, dateKey, sourceId) => ledger.push({
        id: `${event.id}-${sourceId}-${dateKey}`,
        date: event.dateForDay(dateKey),
        amount: normalizeCurrencyAmount(amount), type: 'earned', description
    });
    const habits = state.habits.map((record) => {
        const protocol = normalizeHabitRecord(record, state.settings.protocolReward, todayKey);
        const dates = getProtocolPassivePayoutDateKeys(protocol, protocol.passivePaidThrough, todayKey);
        if (!dates.length) return protocol;
        const reward = normalizeCurrencyAmount(protocol.passiveReward);
        passiveGold = normalizeCurrencyAmount(passiveGold + reward * dates.length);
        dates.forEach((dateKey) => payout(reward, `Protocol passive income: ${protocol.title}`, dateKey, protocol.id));
        return { ...protocol, passivePaidThrough: dates[dates.length - 1] };
    });
    let stipendPaidThrough = state.budget.stipendPaidThrough;
    const stipendAmount = Number(state.budget.stipendAmount || 0);
    if (stipendAmount > 0 && !stipendPaidThrough) {
        stipendPaidThrough = todayKey;
    } else if (stipendAmount > 0) {
        const interval = STIPEND_PERIOD_DAYS[state.budget.stipendPeriod] || STIPEND_PERIOD_DAYS.weekly;
        let payoutCount = 0;
        for (let dateKey = addDays(stipendPaidThrough, interval); dateKey && dateKey <= todayKey; dateKey = addDays(dateKey, interval)) {
            payoutCount += 1;
            payout(stipendAmount, 'Budget stipend', dateKey, 'stipend');
            stipendPaidThrough = dateKey;
        }
        stipendGold = normalizeCurrencyAmount(stipendAmount * payoutCount);
    }
    return {
        ...state,
        stats: {
            ...state.stats,
            gold: normalizeCurrencyAmount(Number(state.stats.gold || 0) + passiveGold + stipendGold),
            lastLoginDate: todayKey
        },
        habits,
        budget: {
            ...state.budget,
            groceryList: state.budget.groceryList.filter((item) => !item.completed || item.completedDateKey >= todayKey),
            stipendPaidThrough,
            earnedRewards: passiveGold > 0 ? normalizeCurrencyAmount(
                Number(state.budget.earnedRewards || 0) + creditsToUsd(passiveGold, state.budget.goldToUsdRatio)
            ) : state.budget.earnedRewards
        },
        coinHistory: [...state.coinHistory, ...ledger],
        calories: {
            ...state.calories,
            current: (state.calories.history || []).reduce((sum, entry) => (
                entry.dateKey === todayKey ? sum + Math.round(Number(entry.calories) || 0) : sum
            ), 0)
        }
    };
};
