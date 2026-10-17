import { describe, expect, it } from 'vitest';
import {
    assertSnapshotTotals,
    completeQuest,
    createProtocol,
    createQuest,
    logCalories,
    prepareSnapshot,
    recordCoins,
    setCalorieTarget,
    undoQuest,
    updateProtocol,
    updateQuest
} from './stateEngine.js';

const makeSnapshot = () => prepareSnapshot({
    formatVersion: 4,
    generatedAt: '2026-07-29T12:00:00.000Z',
    appName: 'LifeQuest',
    currencyUnitVersion: 2,
    stats: { level: 1, xp: 0, maxXp: 100, gold: 0 },
    settings: {
        questRewards: { medium: 1.5 }
    },
    quests: [{
        id: 'quest-1',
        title: 'Ship it',
        difficulty: 'medium',
        reward: { xp: 25, gold: 1.5 },
        completed: false,
        discarded: false
    }],
    budget: { earnedRewards: 0, goldToUsdRatio: 0.8 }
});

describe('LifeQuest Action state engine', () => {
    it('undoes an assistant completion using the recorded conversion delta after a rate change', () => {
        const snapshot = makeSnapshot();
        completeQuest(snapshot, 'quest-1');
        expect(snapshot.quests[0].completedReward).toEqual({ xp: 25, gold: 1.5, earnedRewardsDelta: 1.875 });
        snapshot.budget.goldToUsdRatio = 2;
        snapshot.settings.questRewards.medium = 8;
        undoQuest(snapshot, 'quest-1');
        expect(snapshot.stats).toMatchObject({ xp: 0, gold: 0 });
        expect(snapshot.budget.earnedRewards).toBe(0);
        expect(snapshot.coinHistory[1]).toMatchObject({ type: 'spent', amount: 1.5 });
    });

    it('keeps conversion receipts usable after a snapshot reload', () => {
        const snapshot = makeSnapshot();
        snapshot.budget.earnedRewards = 1.234567;
        completeQuest(snapshot, 'quest-1');
        snapshot.habits = [null, 'malformed legacy record'];
        const reloaded = prepareSnapshot(JSON.parse(JSON.stringify(snapshot)));
        reloaded.budget.goldToUsdRatio = 2;
        undoQuest(reloaded, 'quest-1');
        expect(prepareSnapshot(reloaded).budget.earnedRewards).toBeCloseTo(1.234567, 12);
    });

    // MCP schemas already cap these; the engine must hold even without them.
    it('rejects coin and reward amounts too large to store', () => {
        const snapshot = makeSnapshot();
        const before = JSON.stringify(snapshot);
        [
            () => recordCoins(snapshot, { type: 'earn', amount: 1e308, description: 'Typo' }),
            () => logCalories(snapshot, { calories: 500, label: 'Typo meal', coinCost: 1e308 }),
            () => createQuest(snapshot, { title: 'Typo quest', reward: { gold: 1e304 } }),
            () => updateQuest(snapshot, 'quest-1', { reward: { xp: 1e304 } }),
            () => createProtocol(snapshot, { title: 'Typo protocol', completionReward: 1e304 })
        ].forEach((attempt) => expect(attempt).toThrow(/cannot exceed/));
        createProtocol(snapshot, { title: 'Walk' });
        expect(() => updateProtocol(snapshot, snapshot.habits[0].id, { passiveReward: Infinity }, '2026-07-29')).toThrow(/cannot exceed/);
        expect(JSON.stringify({ ...snapshot, habits: [] })).toBe(JSON.stringify({ ...JSON.parse(before), habits: [] }));
    });

    it('rejects intervals and calorie values too large to store', () => {
        const snapshot = makeSnapshot();
        expect(() => createProtocol(snapshot, { title: 'Rare', frequency: 'interval', frequencyParam: 1e308 })).toThrow(/interval cannot exceed/);
        createProtocol(snapshot, { title: 'Rare', frequency: 'interval', frequencyParam: 3 });
        expect(() => updateProtocol(snapshot, snapshot.habits[0].id, { frequencyParam: 1e308 }, '2026-07-29')).toThrow(/interval cannot exceed/);
        expect(() => logCalories(snapshot, { calories: 1e308, label: 'Typo' })).toThrow(/Calories cannot exceed/);
        expect(() => logCalories(snapshot, { calories: -Infinity, label: 'Typo' })).toThrow(/Calories cannot exceed/);
        expect(() => setCalorieTarget(snapshot, 1e308)).toThrow(/between 1 and/);
        expect(snapshot.calories.history).toHaveLength(0);
    });

    it('refuses to save totals that overflowed through default rewards', () => {
        const snapshot = makeSnapshot();
        snapshot.settings.questRewards.easy = 1e304;
        [createQuest(snapshot, { title: 'One' }), createQuest(snapshot, { title: 'Two' })]
            .forEach((quest) => completeQuest(snapshot, quest.id));
        expect(snapshot.stats.gold).toBe(Infinity);
        expect(() => assertSnapshotTotals(snapshot)).toThrow(/overflow/);
        expect(() => assertSnapshotTotals(makeSnapshot())).not.toThrow();
    });
});
