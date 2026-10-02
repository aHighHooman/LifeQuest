import { CURRENCY_UNIT_VERSION } from '../constants/currency.js';
import { createInitialAppState } from '../domain/initialState.js';
import { safeGet } from './persistence.js';

export const APP_CHECKPOINT_KEY = 'lq_app_checkpoint';
const CHECKPOINT_VERSION = 1;

const LEGACY_GAME_KEYS = {
    stats: 'lq_stats',
    settings: 'lq_settings',
    quests: 'lq_quests',
    habits: 'lq_habits',
    calories: 'lq_calories',
    coinHistory: 'lq_coin_history'
};
const LEGACY_BUDGET_KEYS = {
    totalMonthlyBudget: 'lq_budget_total',
    groceryAllocation: 'lq_budget_grocery_alloc',
    earnedRewards: 'lq_budget_earned',
    groceryList: 'lq_grocery_list',
    priceDatabase: 'lq_price_db',
    groceryPeriod: 'lq_grocery_period',
    stipendAmount: 'lq_budget_stipend_amount',
    stipendPeriod: 'lq_budget_stipend_period',
    stipendPaidThrough: 'lq_budget_stipend_paid_through',
    goldToUsdRatio: 'lq_gold_ratio'
};

export const createAppCheckpoint = (state) => ({
    version: CHECKPOINT_VERSION,
    currencyUnitVersion: CURRENCY_UNIT_VERSION,
    state
});

export const readAppState = () => {
    // Legacy keys are only an initial migration source. A broken checkpoint
    // must not roll newer transactions back to those older values.
    if (localStorage.getItem(APP_CHECKPOINT_KEY) !== null) {
        const checkpoint = safeGet(APP_CHECKPOINT_KEY, null);
        if (!checkpoint || checkpoint.version !== CHECKPOINT_VERSION
            || checkpoint.currencyUnitVersion !== CURRENCY_UNIT_VERSION
            || !checkpoint.state?.stats || !checkpoint.state?.budget
            || !checkpoint.state?.settings || !checkpoint.state?.calories
            || !Array.isArray(checkpoint.state.quests)
            || !Array.isArray(checkpoint.state.habits)
            || !Array.isArray(checkpoint.state.coinHistory)) {
            throw new Error('This LifeQuest checkpoint cannot be read by this version of the app.');
        }
        return checkpoint.state;
    }

    // Existing keys remain a recovery copy. Once a checkpoint exists it is the
    // sole source of truth; mixing older keys into it could split a transaction.
    const state = createInitialAppState();
    for (const [field, key] of Object.entries(LEGACY_GAME_KEYS)) {
        state[field] = safeGet(key, state[field]);
    }
    for (const [field, key] of Object.entries(LEGACY_BUDGET_KEYS)) {
        state.budget[field] = safeGet(key, state.budget[field]);
    }
    return state;
};
