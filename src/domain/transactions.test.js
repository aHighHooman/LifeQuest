import { describe, expect, it } from 'vitest';
import { createInitialAppState } from './initialState.js';
import { usdToCredits, creditsToUsd } from '../constants/currency.js';
import {
    changeCoins, completeQuest, undoQuest, completeProtocol,
    purchaseGrocery, refundGrocery, purchaseCalories, refundCalories
} from './transactions.js';

const event = { id: 'coin-1', date: '2026-10-02T12:00:00.000Z', todayKey: '2026-10-02' };
const makeState = () => {
    const state = createInitialAppState();
    state.stats.gold = 10;
    state.budget.earnedRewards = 2;
    state.budget.goldToUsdRatio = 2;
    state.quests = [{ id: 'quest-1', difficulty: 'easy', reward: { xp: 10, gold: 0.5 }, completed: false }];
    state.budget.groceryList = [{ id: 'grocery-1', name: 'Milk', quantity: 2, price: 1.5, completed: false }];
    return state;
};

describe('LifeQuest transactions', () => {
    it('uses the display conversion rule for purchases, including older unusual exchange rates', () => {
        for (const ratio of [2, 2.123456, 0, -2, 0.00001, 'invalid']) {
            const state = makeState();
            state.budget.goldToUsdRatio = ratio;
            const expectedCost = usdToCredits(3, ratio);
            const purchased = purchaseGrocery(state, 'grocery-1', event);
            expect(purchased.budget.groceryList[0].coinCost).toBe(expectedCost);
            expect(purchased.stats.gold).toBeCloseTo(10 - expectedCost, 4);
            expect(refundGrocery(purchased, 'grocery-1', event).stats.gold).toBe(10);
        }
    });

    it('keeps USD conversion precision until the applied reward balance is rounded', () => {
        expect(creditsToUsd(0.1, 3)).toBe(0.1 / 3);
        expect(creditsToUsd(usdToCredits(3.2, 2), 2)).toBe(3.2);
        const state = makeState();
        state.budget.goldToUsdRatio = 3;
        state.settings.questRewards.easy = 0.1;
        const completed = completeQuest(state, 'quest-1', event);
        expect(completed.budget.earnedRewards).toBe(2.0333);
        expect(undoQuest(completed, 'quest-1', event).budget.earnedRewards).toBe(2);
    });

    it('completes and undoes once, retaining the actual reward despite settings changes', () => {
        const original = makeState();
        const before = structuredClone(original);
        const completed = completeQuest(original, 'quest-1', event);
        expect(original).toEqual(before);
        expect(completed.stats).toMatchObject({ xp: 10, gold: 10.5 });
        expect(completed.budget.earnedRewards).toBe(2.25);
        expect(completed.quests[0].completedReward).toEqual({ xp: 10, gold: 0.5, earnedRewardsDelta: 0.25 });
        expect(completeQuest(completed, 'quest-1', event)).toBe(completed);

        const changed = {
            ...completed,
            settings: { ...completed.settings, questRewards: { easy: 8 } },
            budget: { ...completed.budget, goldToUsdRatio: 4 }
        };
        const undone = undoQuest(changed, 'quest-1', { ...event, id: 'coin-2' });
        expect(undone.stats).toMatchObject({ xp: 0, gold: 10 });
        expect(undone.budget.earnedRewards).toBe(2);
        expect(undone.quests[0]).toMatchObject({ completed: false, completedReward: null });
        expect(undone.coinHistory.map(({ type, amount }) => ({ type, amount }))).toEqual([
            { type: 'earned', amount: 0.5 }, { type: 'spent', amount: 0.5 }
        ]);
        expect(undoQuest(undone, 'quest-1', event)).toBe(undone);
    });

    it('records a conversion that rounds to no budget change, and undoes exactly that', () => {
        const state = makeState();
        state.settings.questRewards.easy = 0.0001;
        state.budget.goldToUsdRatio = 3;
        const completed = completeQuest(state, 'quest-1', event);
        expect(completed.quests[0].completedReward.earnedRewardsDelta).toBe(0);
        completed.budget.goldToUsdRatio = 0.5;
        expect(undoQuest(completed, 'quest-1', event).budget.earnedRewards).toBe(2);
    });

    it('reverses XP across a level boundary without reverting intervening purchases', () => {
        const state = makeState();
        state.stats.xp = 95;
        const completed = completeQuest(state, 'quest-1', event);
        expect(completed.stats).toMatchObject({ level: 2, xp: 5, maxXp: 120 });
        const spent = changeCoins(completed, -2, { ...event, id: 'coin-2' }, 'Other purchase');
        const undone = undoQuest(spent, 'quest-1', { ...event, id: 'coin-3' });
        expect(undone.stats).toMatchObject({ level: 1, xp: 95, maxXp: 100, gold: 8 });
    });

    it('records the applied delta when an older USD balance has more precision', () => {
        const state = makeState();
        state.budget.earnedRewards = 1.234567;
        const completed = completeQuest(state, 'quest-1', event);
        expect(completed.budget.earnedRewards).toBeCloseTo(1.4846, 12);
        expect(completed.quests[0].completedReward.earnedRewardsDelta)
            .toBe(completed.budget.earnedRewards - state.budget.earnedRewards);
        completed.budget.goldToUsdRatio = 4;
        expect(undoQuest(completed, 'quest-1', event).budget.earnedRewards).toBeCloseTo(1.234567, 12);
    });

    it('keeps XP-only completions from rounding an existing budget balance', () => {
        const state = makeState();
        state.budget.earnedRewards = 1.234567;
        state.settings.questRewards.easy = 0;
        state.habits = [{ id: 'habit-1', title: 'Walk', history: { '2026-10-02': 1 }, completionReward: 0.2 }];
        const completed = completeQuest(state, 'quest-1', event);
        expect(completed.budget).toBe(state.budget);
        expect(completed.quests[0].completedReward.earnedRewardsDelta).toBe(0);
        const protocol = completeProtocol(completed, 'habit-1', event);
        expect(protocol.budget).toBe(state.budget);
        expect(protocol.coinHistory).toHaveLength(0);
    });

    it('rejects discarded or missing quests and reads old completion receipts', () => {
        const state = makeState();
        state.quests[0].discarded = true;
        expect(completeQuest(state, 'quest-1', event)).toBe(state);
        expect(completeQuest(state, 'missing', event)).toBe(state);
        state.quests[0] = { ...state.quests[0], completed: true, completedReward: { xp: 10, gold: 0.5 } };
        state.stats = { ...state.stats, xp: 10, gold: 10.5 };
        state.budget.earnedRewards = 2.25;
        expect(undoQuest(state, 'quest-1', event).budget.earnedRewards).toBe(2);
    });

    it('completes a protocol with its reward and history in one transition, deduplicating request IDs', () => {
        const state = makeState();
        state.habits = [{ id: 'habit-1', title: 'Walk', history: {}, completionReward: 0.2, passiveReward: 0 }];
        const completed = completeProtocol(state, 'habit-1', { ...event, requestId: 'request-1' });
        expect(completed.stats).toMatchObject({ xp: 5, gold: 10.2 });
        expect(completed.budget.earnedRewards).toBe(2.1);
        expect(completed.habits[0]).toMatchObject({ history: { '2026-10-02': 1 }, lastCycleResetDateKey: '2026-10-02' });
        expect(completeProtocol(completed, 'habit-1', { ...event, requestId: 'request-1' })).toBe(completed);
        const early = completeProtocol(completed, 'habit-1', event);
        expect(early.stats).toMatchObject({ xp: 10, gold: 10.2 });
    });

    it('purchases and refunds groceries once at the original cost after a rate or price edit', () => {
        const state = makeState();
        const purchased = purchaseGrocery(state, 'grocery-1', event);
        expect(purchased.stats.gold).toBe(4);
        expect(purchased.budget.groceryList[0]).toMatchObject({ completed: true, coinCost: 6 });
        expect(purchased.budget.earnedRewards).toBe(2);
        expect(purchaseGrocery(purchased, 'grocery-1', event)).toBe(purchased);
        purchased.budget.goldToUsdRatio = 5;
        purchased.budget.groceryList[0].price = 7;
        const refunded = refundGrocery(purchased, 'grocery-1', { ...event, id: 'coin-2' });
        expect(refunded.stats.gold).toBe(10);
        expect(refunded.budget.groceryList[0]).toMatchObject({ completed: false, coinCost: null });
        expect(refunded.coinHistory).toHaveLength(2);
        expect(refundGrocery(refunded, 'grocery-1', event)).toBe(refunded);
    });

    it('keeps the grocery refund window and the fallback for old purchases', () => {
        const purchased = purchaseGrocery(makeState(), 'grocery-1', event);
        expect(refundGrocery(purchased, 'grocery-1', { ...event, todayKey: '2026-10-03' })).toBe(purchased);
        delete purchased.budget.groceryList[0].coinCost;
        expect(refundGrocery(purchased, 'grocery-1', event).stats.gold).toBe(10);
    });

    it('creates a saved food, pays, and logs it together, then refunds the receipt once', () => {
        const state = makeState();
        const food = { id: 'food-1', name: 'Lunch', calories: 500, coinCost: 2 };
        const entry = { id: 'cal-1', dateKey: event.todayKey, timestamp: event.date, foodId: food.id, label: food.name, calories: 500, coinCost: 2 };
        const purchased = purchaseCalories(state, entry, event, food);
        expect(purchased.stats.gold).toBe(8);
        expect(purchased.calories).toMatchObject({ current: 500, history: [entry], savedFoods: [food], recentFoodIds: ['food-1'] });
        expect(purchaseCalories(purchased, entry, event, food)).toBe(purchased);
        purchased.calories.savedFoods[0].coinCost = 9;
        const editable = new Set([event.todayKey]);
        const refunded = refundCalories(purchased, 'cal-1', editable, { ...event, id: 'coin-2' });
        expect(refunded.stats.gold).toBe(10);
        expect(refunded.calories).toMatchObject({ current: 0, history: [] });
        expect(refunded.coinHistory).toHaveLength(2);
        expect(refundCalories(refunded, 'cal-1', editable, event)).toBe(refunded);
    });

    it('keeps free entries and exercise free, and refuses refunds outside the editing window', () => {
        const state = makeState();
        const entry = { id: 'cal-1', dateKey: '2026-09-29', calories: -200, coinCost: 5, label: 'Exercise' };
        const logged = purchaseCalories(state, entry, event);
        expect(logged.stats.gold).toBe(10);
        expect(logged.calories.history[0].coinCost).toBe(0);
        expect(logged.coinHistory).toHaveLength(0);
        expect(refundCalories(logged, entry.id, new Set([event.todayKey]), event)).toBe(logged);
    });
});
