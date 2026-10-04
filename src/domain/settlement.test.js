import { describe, expect, it } from 'vitest';
import { createInitialAppState } from './initialState.js';
import { settleDaily } from './settlement.js';
import { setProtocolActive, completeProtocol, skipProtocol } from './transactions.js';

const event = {
    id: 'rollover-1', todayKey: '2026-03-15', date: '2026-03-15T12:00:00.000Z',
    dateForDay: (day) => `${day}T12:00:00.000Z`
};
const makeState = () => {
    const state = createInitialAppState();
    state.stats = { ...state.stats, gold: 10, lastLoginDate: '2026-03-07' };
    state.budget = { ...state.budget, earnedRewards: 2, goldToUsdRatio: 2 };
    state.habits = [{
        id: 'weekly', title: 'Walk', frequency: 'weekly', history: { '2026-03-07': 1 },
        isActive: true, completionReward: 0.2, passiveReward: 0.1,
        passivePaidThrough: '2026-03-07', lastCycleResetDateKey: '2026-03-07'
    }];
    return state;
};

describe('daily LifeQuest settlement', () => {
    it('settles through the due day once, even when reopening after the passive window', () => {
        const original = makeState();
        const before = structuredClone(original);
        const settled = settleDaily(original, event);
        expect(original).toEqual(before);
        expect(settled.stats).toMatchObject({ gold: 10.7, lastLoginDate: event.todayKey });
        expect(settled.budget.earnedRewards).toBe(2.35);
        expect(settled.habits[0].passivePaidThrough).toBe('2026-03-14');
        expect(settled.coinHistory.map((entry) => entry.date.slice(0, 10))).toEqual([
            '2026-03-08', '2026-03-09', '2026-03-10', '2026-03-11', '2026-03-12', '2026-03-13', '2026-03-14'
        ]);
        expect(settleDaily(settled, event)).toBe(settled);
        const nextDay = settleDaily(settled, { ...event, todayKey: '2026-03-16' });
        expect(nextDay.stats.gold).toBe(10.7);
        expect(nextDay.coinHistory).toHaveLength(7);
    });

    it('preserves omitted versus explicit-null legacy cursors without retroactive migration payouts', () => {
        const omitted = makeState();
        delete omitted.habits[0].passivePaidThrough;
        expect(settleDaily(omitted, event).stats.gold).toBe(10);
        const explicitNull = makeState();
        explicitNull.habits[0].passivePaidThrough = null;
        expect(settleDaily(explicitNull, event).stats.gold).toBe(10.7);
    });

    it('pays owed days on pause, then resumes from that cursor without paying inactive days', () => {
        const paused = setProtocolActive(makeState(), 'weekly', false, { ...event, todayKey: '2026-03-10' });
        expect(paused.stats.gold).toBe(10.3);
        const inactive = settleDaily(paused, { ...event, todayKey: '2026-03-10' });
        expect(inactive.stats.gold).toBe(10.3);
        expect(inactive.habits[0].passivePaidThrough).toBe('2026-03-10');
        const resumed = setProtocolActive(inactive, 'weekly', true, { ...event, todayKey: '2026-03-11' });
        expect(settleDaily(resumed, event).coinHistory.map((entry) => entry.date.slice(0, 10))).toEqual([
            '2026-03-08', '2026-03-09', '2026-03-10', '2026-03-11', '2026-03-12', '2026-03-13', '2026-03-14'
        ]);
    });

    it('pays the old window before skipping or completing moves the cycle anchor', () => {
        const skipped = skipProtocol(makeState(), 'weekly', { ...event, todayKey: '2026-03-10' });
        expect(skipped.coinHistory).toHaveLength(3);
        const afterSkip = settleDaily(skipped, event);
        expect(afterSkip.coinHistory).toHaveLength(8);
        const early = completeProtocol(makeState(), 'weekly', { ...event, todayKey: '2026-03-10' });
        expect(early.stats.gold).toBe(10.3);
        expect(early.stats.xp).toBe(5);
        expect(settleDaily(early, event).stats.gold).toBe(10.8);
    });

    it('pays nothing extra when the day was already settled before the action', () => {
        const settled = settleDaily(makeState(), { ...event, todayKey: '2026-03-10' });
        const completed = completeProtocol(settled, 'weekly', { ...event, todayKey: '2026-03-10' });
        expect(completed.stats.gold).toBe(settled.stats.gold);
        expect(completed.coinHistory).toHaveLength(settled.coinHistory.length);
    });

    it('keeps the bi-weekly stipend schedule, conversion precision and same-day idempotence', () => {
        const state = makeState();
        state.habits = [];
        state.budget = { ...state.budget, earnedRewards: 1.234567, stipendAmount: 1.234567,
            stipendPeriod: 'bi-weekly', stipendPaidThrough: '2026-03-01' };
        const settled = settleDaily(state, { ...event, todayKey: '2026-03-31' });
        expect(settled.coinHistory.map((entry) => entry.date.slice(0, 10))).toEqual(['2026-03-15', '2026-03-29']);
        expect(settled.stats.gold).toBe(12.4691);
        expect(settled.budget.earnedRewards).toBe(1.234567);
        expect(settled.budget.stipendPaidThrough).toBe('2026-03-29');
        expect(settleDaily(settled, { ...event, todayKey: '2026-03-31' })).toBe(settled);
    });

    it('initializes a stipend cursor without back pay and cleans day-scoped UI data together', () => {
        const state = makeState();
        state.habits = [];
        state.budget.stipendAmount = 3;
        state.budget.groceryList = [
            { id: 'old', completed: true, completedDateKey: '2026-03-14' },
            { id: 'today', completed: true, completedDateKey: event.todayKey },
            { id: 'pending', completed: false }
        ];
        state.calories.history = [{ dateKey: '2026-03-14', calories: 200 }, { dateKey: event.todayKey, calories: 300 }];
        const settled = settleDaily(state, event);
        expect(settled.stats.gold).toBe(10);
        expect(settled.budget.stipendPaidThrough).toBe(event.todayKey);
        expect(settled.budget.groceryList.map((item) => item.id)).toEqual(['today', 'pending']);
        expect(settled.calories.current).toBe(300);
    });
});
