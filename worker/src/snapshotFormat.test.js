import { describe, expect, it } from 'vitest';
import {
    CURRENT_CURRENCY_UNIT_VERSION,
    CURRENT_SNAPSHOT_FORMAT_VERSION,
    normalizeLifeQuestSnapshot
} from './snapshotFormat.js';

describe('LifeQuest Action snapshot format', () => {
    it('accepts the current v4 decimal-credit snapshot', () => {
        const snapshot = normalizeLifeQuestSnapshot({
            formatVersion: 4,
            currencyUnitVersion: 2,
            stats: { gold: 12.34567 },
            settings: {
                protocolReward: 0.3,
                questRewards: { easy: 0.5, medium: 1.5, hard: 4, legendary: 10 }
            },
            quests: [{
                id: 'quest-1',
                reward: { xp: 10, gold: 4.12567 }
            }],
            habits: [{
                id: 'habit-1',
                completionReward: 0.25,
                passiveReward: 0.1
            }],
            budget: { goldToUsdRatio: 0.8 }
        });

        expect(snapshot).toMatchObject({
            formatVersion: CURRENT_SNAPSHOT_FORMAT_VERSION,
            currencyUnitVersion: CURRENT_CURRENCY_UNIT_VERSION,
            stats: { gold: 12.3457 },
            settings: { protocolReward: 0.3 },
            budget: { goldToUsdRatio: 0.8 },
            quests: [{ reward: { gold: 4.1257 } }],
            habits: [{ completionReward: 0.25, passiveReward: 0.1 }]
        });
    });

    it('migrates v3 whole-unit currency once at the API boundary', () => {
        const snapshot = normalizeLifeQuestSnapshot({
            formatVersion: 3,
            appName: 'LifeQuest',
            stats: { gold: 123 },
            settings: {
                protocolReward: 3,
                questRewards: { easy: 5, medium: 15, hard: 40, legendary: 100 }
            },
            quests: [{ reward: { gold: 40 } }],
            habits: [{ completionReward: 3, passiveReward: 1 }],
            coinHistory: [{ amount: 10 }],
            calories: { history: [{ coinCost: 2 }], savedFoods: [{ coinCost: 2 }] },
            budget: { stipendAmount: 20, goldToUsdRatio: 8 }
        });

        expect(snapshot).toMatchObject({
            formatVersion: CURRENT_SNAPSHOT_FORMAT_VERSION,
            currencyUnitVersion: CURRENT_CURRENCY_UNIT_VERSION,
            stats: { gold: 12.3 },
            settings: {
                protocolReward: 0.3,
                questRewards: { easy: 0.5, medium: 1.5, hard: 4, legendary: 10 }
            },
            quests: [{ reward: { gold: 4 } }],
            habits: [{ completionReward: 0.3, passiveReward: 0.1 }],
            coinHistory: [{ amount: 1 }],
            budget: { stipendAmount: 2, goldToUsdRatio: 0.8 }
        });
        expect(snapshot.currencyUnitVersion).toBe(2);
        expect(snapshot.calories.history[0].coinCost).toBe(0.2);
        expect(snapshot.calories.savedFoods[0].coinCost).toBe(0.2);
    });

    it('rejects a future snapshot instead of guessing its schema', () => {
        expect(() => normalizeLifeQuestSnapshot({
            formatVersion: CURRENT_SNAPSHOT_FORMAT_VERSION + 1,
            currencyUnitVersion: CURRENT_CURRENCY_UNIT_VERSION
        })).toThrow(/supports LifeQuest snapshot format version 4/);
    });
});
