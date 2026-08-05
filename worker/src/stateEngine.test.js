import { describe, expect, it } from 'vitest';
import {
    completeProtocol,
    completeQuest,
    createProtocol,
    createQuest,
    deactivateProtocol,
    discardQuest,
    prepareSnapshot,
    restoreQuest,
    undoQuest
} from './stateEngine.js';

const makeSnapshot = () => prepareSnapshot({
    formatVersion: 4,
    generatedAt: '2026-07-29T12:00:00.000Z',
    appName: 'LifeQuest',
    currencyUnitVersion: 2,
    stats: { level: 1, xp: 0, maxXp: 100, hp: 50, maxHp: 100, gold: 0 },
    settings: {
        protocolReward: 0.2,
        questRewards: { easy: 0.5, medium: 1.5, hard: 4, legendary: 10 }
    },
    quests: [{
        id: 'quest-1',
        title: 'Ship it',
        difficulty: 'medium',
        reward: { xp: 25, gold: 1.5 },
        completed: false,
        discarded: false
    }],
    habits: [{
        id: 'habit-1',
        title: 'Walk',
        frequency: 'daily',
        frequencyParam: 1,
        streak: 0,
        history: {},
        isActive: true,
        completionReward: 0.2,
        passiveReward: 0
    }],
    coinHistory: [],
    budget: { earnedRewards: 0, goldToUsdRatio: 0.8 }
});

describe('LifeQuest Action state engine', () => {
    it('completes and undoes a quest with its rewards', () => {
        const snapshot = makeSnapshot();
        const now = new Date('2026-07-29T18:00:00.000Z');

        expect(completeQuest(snapshot, 'quest-1', now).changed).toBe(true);
        expect(snapshot.quests[0].completed).toBe(true);
        expect(snapshot.stats).toMatchObject({ xp: 25, gold: 1.5 });
        expect(snapshot.budget.earnedRewards).toBe(1.875);

        expect(undoQuest(snapshot, 'quest-1', now).changed).toBe(true);
        expect(snapshot.quests[0].completed).toBe(false);
        expect(snapshot.stats).toMatchObject({ xp: 0, gold: 0 });
        expect(snapshot.budget.earnedRewards).toBe(0);
    });

    it('discards and restores quests reversibly', () => {
        const snapshot = makeSnapshot();
        snapshot.quests[0].isFocusedToday = true;

        discardQuest(snapshot, 'quest-1', new Date('2026-07-29T18:00:00.000Z'));
        expect(snapshot.quests[0]).toMatchObject({
            discarded: true,
            isFocusedToday: true
        });

        restoreQuest(snapshot, 'quest-1');
        expect(snapshot.quests[0]).toMatchObject({
            discarded: false,
            discardedAt: null
        });
    });

    it('deactivates a protocol explicitly', () => {
        const snapshot = makeSnapshot();
        const result = deactivateProtocol(snapshot, 'habit-1', '2026-07-29');
        expect(result.changed).toBe(true);
        expect(snapshot.habits[0].isActive).toBe(false);
    });

    it('deduplicates creation requests', () => {
        const snapshot = makeSnapshot();
        const firstQuest = createQuest(snapshot, {
            title: 'Passport',
            difficulty: 'medium',
            requestId: 'create-quest-123'
        });
        const secondQuest = createQuest(snapshot, {
            title: 'Passport',
            difficulty: 'medium',
            requestId: 'create-quest-123'
        });
        expect(secondQuest.id).toBe(firstQuest.id);
        expect(snapshot.quests.filter((quest) => quest.title === 'Passport')).toHaveLength(1);

        const firstProtocol = createProtocol(snapshot, {
            title: 'Stretch',
            requestId: 'create-protocol-123'
        });
        const secondProtocol = createProtocol(snapshot, {
            title: 'Stretch',
            requestId: 'create-protocol-123'
        });
        expect(secondProtocol.id).toBe(firstProtocol.id);
        expect(snapshot.habits.filter((protocol) => protocol.title === 'Stretch')).toHaveLength(1);
    });

    it('deduplicates retried protocol completions', () => {
        const snapshot = makeSnapshot();
        const now = new Date('2026-07-29T18:00:00.000Z');
        completeProtocol(snapshot, 'habit-1', '2026-07-29', now, 'complete-123');
        completeProtocol(snapshot, 'habit-1', '2026-07-29', now, 'complete-123');
        expect(snapshot.habits[0].history['2026-07-29']).toBe(1);
        expect(snapshot.stats.xp).toBe(5);
        expect(snapshot.stats.gold).toBe(0.2);
        expect(snapshot.budget.earnedRewards).toBe(0.25);
    });
});
