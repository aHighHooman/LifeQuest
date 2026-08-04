import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
    APP_VERSION,
    CURRENCY_VERSION_KEY,
    VERSION_KEY,
    checkVersionAndEnsurePersistence
} from './persistence.js';

const originalLocalStorage = globalThis.localStorage;

const createStorage = () => {
    const values = new Map();

    return {
        get length() {
            return values.size;
        },
        key: (index) => [...values.keys()][index] ?? null,
        getItem: (key) => values.get(`${key}`) ?? null,
        setItem: (key, value) => values.set(`${key}`, `${value}`),
        removeItem: (key) => values.delete(`${key}`),
        clear: () => values.clear()
    };
};

const setJson = (key, value) => localStorage.setItem(key, JSON.stringify(value));
const getJson = (key) => JSON.parse(localStorage.getItem(key));

describe('persistence currency migration', () => {
    beforeEach(() => {
        globalThis.localStorage = createStorage();
    });

    afterEach(() => {
        if (originalLocalStorage === undefined) {
            delete globalThis.localStorage;
        } else {
            globalThis.localStorage = originalLocalStorage;
        }
    });

    it('scales local rewards, balances, costs, history, and ratios exactly once', () => {
        setJson('lq_stats', { gold: 50 });
        setJson('lq_settings', {
            protocolReward: 3,
            questRewards: { easy: 5, medium: 15, hard: 40, legendary: 100 },
            questRewardEasy: 7
        });
        setJson('lq_quests', [{
            reward: { xp: 10, gold: 40 },
            completedReward: { xp: 10, gold: 20 }
        }]);
        setJson('lq_habits', [{ completionReward: 3, passiveReward: 1 }]);
        setJson('lq_calories', {
            history: [{ coinCost: 2 }],
            savedFoods: [{ coinCost: 4 }]
        });
        setJson('lq_coin_history', [{ amount: 10 }]);
        setJson('lq_budget_stipend_amount', 20);
        setJson('lq_gold_ratio', 10);
        setJson('lq_budget_total', 900);
        setJson('lq_budget_grocery_alloc', 250);
        setJson('lq_budget_earned', 12.5);
        setJson('lq_grocery_list', [{ price: 4.5 }]);
        setJson('lq_price_db', { Milk: 4.5 });
        localStorage.setItem(VERSION_KEY, '1.4.0');

        checkVersionAndEnsurePersistence();

        expect(getJson('lq_stats').gold).toBe(5);
        expect(getJson('lq_settings')).toMatchObject({
            protocolReward: 0.3,
            questRewards: { easy: 0.5, medium: 1.5, hard: 4, legendary: 10 },
            questRewardEasy: 0.7
        });
        expect(getJson('lq_quests')[0]).toEqual({
            reward: { xp: 10, gold: 4 },
            completedReward: { xp: 10, gold: 2 }
        });
        expect(getJson('lq_habits')[0]).toEqual({ completionReward: 0.3, passiveReward: 0.1 });
        expect(getJson('lq_calories')).toEqual({
            history: [{ coinCost: 0.2 }],
            savedFoods: [{ coinCost: 0.4 }]
        });
        expect(getJson('lq_coin_history')[0].amount).toBe(1);
        expect(getJson('lq_budget_stipend_amount')).toBe(2);
        expect(getJson('lq_gold_ratio')).toBe(1);
        expect(getJson('lq_budget_total')).toBe(900);
        expect(getJson('lq_budget_grocery_alloc')).toBe(250);
        expect(getJson('lq_budget_earned')).toBe(12.5);
        expect(getJson('lq_grocery_list')[0].price).toBe(4.5);
        expect(getJson('lq_price_db')).toEqual({ Milk: 4.5 });
        expect(localStorage.getItem(CURRENCY_VERSION_KEY)).toBe('2');
        expect(localStorage.getItem(VERSION_KEY)).toBe(APP_VERSION);

        const migratedStats = localStorage.getItem('lq_stats');
        const backupKeys = [...Array(localStorage.length).keys()]
            .map((index) => localStorage.key(index))
            .filter((key) => key?.startsWith('lq_backup_pre_v1_5_0_'));

        checkVersionAndEnsurePersistence();

        expect(localStorage.getItem('lq_stats')).toBe(migratedStats);
        expect(backupKeys).toHaveLength(1);
        expect([...Array(localStorage.length).keys()]
            .map((index) => localStorage.key(index))
            .filter((key) => key?.startsWith('lq_backup_pre_v1_5_0_'))).toHaveLength(1);
    });
});
