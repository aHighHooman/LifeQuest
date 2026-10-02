import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialAppState } from '../domain/initialState.js';
import { completeQuest, purchaseGrocery } from '../domain/transactions.js';
import { APP_CHECKPOINT_KEY, createAppCheckpoint, readAppState } from './appStatePersistence.js';
import { checkVersionAndEnsurePersistence, safeSet } from './persistence.js';

let storage;
beforeEach(() => {
    const values = new Map();
    storage = {
        getItem: (key) => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, String(value)),
        get length() { return values.size; },
        key: (index) => [...values.keys()][index] ?? null
    };
    vi.stubGlobal('localStorage', storage);
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('one local LifeQuest checkpoint', () => {
    it('reads the existing per-key saves after their currency migration', () => {
        safeSet('lq_stats', { gold: 50, xp: 8 });
        safeSet('lq_quests', [{ id: 'quest-old', completedReward: { xp: 10, gold: 5 } }]);
        safeSet('lq_grocery_list', [{ id: 'grocery-old', price: 3, completed: true }]);
        safeSet('lq_budget_earned', 4.5);
        safeSet('lq_gold_ratio', 10);
        checkVersionAndEnsurePersistence();
        const state = readAppState();
        expect(state.stats).toEqual({ gold: 5, xp: 8 });
        expect(state.quests[0].completedReward.gold).toBe(0.5);
        expect(state.budget).toMatchObject({ earnedRewards: 4.5, goldToUsdRatio: 1 });
        expect(state.budget.groceryList[0].price).toBe(3);
        expect(state.calories.target).toBe(2000);
    });

    it('reloads balances, ledger, and receipts from the same checkpoint instead of older keys', () => {
        const state = createInitialAppState();
        state.quests = [{ id: 'quest-1', difficulty: 'easy', reward: { xp: 10, gold: 0.5 } }];
        state.budget.groceryList = [{ id: 'grocery-1', name: 'Milk', price: 0.1, quantity: 1 }];
        const event = { id: 'coin-1', date: '2026-10-02T12:00:00.000Z', todayKey: '2026-10-02' };
        const completed = completeQuest(state, 'quest-1', event);
        const purchased = purchaseGrocery(completed, 'grocery-1', { ...event, id: 'coin-2' });
        const writes = vi.spyOn(storage, 'setItem');
        safeSet(APP_CHECKPOINT_KEY, createAppCheckpoint(purchased));
        expect(writes).toHaveBeenCalledTimes(1);
        safeSet('lq_stats', { gold: 999 });
        safeSet('lq_quests', []);
        expect(readAppState()).toEqual(purchased);
        expect(readAppState().quests[0].completedReward.earnedRewardsDelta).toBe(0.5);
        expect(readAppState().budget.groceryList[0].coinCost).toBe(0.1);
    });

    it('retains the whole previous checkpoint when storage refuses a new write', () => {
        const state = createInitialAppState();
        safeSet(APP_CHECKPOINT_KEY, createAppCheckpoint(state));
        const previous = storage.getItem(APP_CHECKPOINT_KEY);
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(storage, 'setItem').mockImplementation(() => { throw new Error('Quota exceeded'); });
        safeSet(APP_CHECKPOINT_KEY, createAppCheckpoint({ ...state, stats: { ...state.stats, gold: 42 } }));
        expect(storage.getItem(APP_CHECKPOINT_KEY)).toBe(previous);
        expect(readAppState()).toEqual(state);
    });

    it('refuses an unsupported checkpoint instead of falling back to older balances', () => {
        safeSet('lq_stats', { gold: 999 });
        safeSet(APP_CHECKPOINT_KEY, { ...createAppCheckpoint(createInitialAppState()), version: 2 });
        expect(readAppState).toThrow('cannot be read');
    });

    it.each(['{"state":', 'null'])('leaves an invalid checkpoint untouched instead of restoring stale keys: %s', (raw) => {
        safeSet('lq_stats', { gold: 999 });
        storage.setItem(APP_CHECKPOINT_KEY, raw);
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        expect(readAppState).toThrow('cannot be read');
        expect(storage.getItem(APP_CHECKPOINT_KEY)).toBe(raw);
    });

    it('includes the checkpoint in the existing safety backup', () => {
        const checkpoint = createAppCheckpoint(createInitialAppState());
        safeSet(APP_CHECKPOINT_KEY, checkpoint);
        storage.setItem('lq_currency_unit_version', '2');
        checkVersionAndEnsurePersistence();
        const backupKey = [...Array(storage.length).keys()].map((index) => storage.key(index))
            .find((key) => key.startsWith('lq_backup_pre_'));
        expect(JSON.parse(storage.getItem(backupKey))[APP_CHECKPOINT_KEY]).toBe(JSON.stringify(checkpoint));
    });
});
