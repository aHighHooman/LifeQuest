import { describe, expect, it } from 'vitest';
import {
    completeQuest,
    prepareSnapshot,
    undoQuest
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
});
