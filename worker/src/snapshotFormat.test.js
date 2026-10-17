import { describe, expect, it } from 'vitest';
import { migrateLegacyPortableSnapshot } from '../../src/utils/portableState.js';
import {
    CURRENT_CURRENCY_UNIT_VERSION,
    CURRENT_SNAPSHOT_FORMAT_VERSION,
    normalizeLifeQuestSnapshot
} from './snapshotFormat.js';

describe('LifeQuest Action snapshot format', () => {
    it.each([1, 2, 3, 4])('keeps browser and API currency migration in agreement for format %i', (formatVersion) => {
        const usdDelta = 0.5 / 0.3;
        const source = {
            formatVersion,
            currencyUnitVersion: formatVersion === 4 ? CURRENT_CURRENCY_UNIT_VERSION : 0,
            stats: { gold: -12.34567 },
            settings: { protocolReward: 3, questRewardEasy: 5 },
            quests: [{ reward: { gold: 40 }, completedReward: { gold: 40, earnedRewardsDelta: usdDelta } }],
            habits: [{ completionReward: 3, passiveReward: 1 }],
            calories: { history: [{ coinCost: 2 }], savedFoods: [{ coinCost: 2 }] },
            coinHistory: [{ amount: -10 }],
            budget: { earnedRewards: usdDelta, stipendAmount: 20, goldToUsdRatio: 8 }
        };
        const unchanged = structuredClone(source);
        const api = normalizeLifeQuestSnapshot(source);
        const browser = migrateLegacyPortableSnapshot(source);
        const currencyFields = (snapshot) => ({
            gold: snapshot.stats.gold,
            settings: { protocolReward: snapshot.settings.protocolReward, questRewards: snapshot.settings.questRewards },
            reward: snapshot.quests[0].reward,
            receipt: snapshot.quests[0].completedReward,
            completionReward: snapshot.habits[0].completionReward,
            passiveReward: snapshot.habits[0].passiveReward,
            foodCost: snapshot.calories.history[0].coinCost,
            savedFoodCost: snapshot.calories.savedFoods[0].coinCost,
            historyAmount: snapshot.coinHistory[0].amount,
            stipendAmount: snapshot.budget.stipendAmount,
            ratio: snapshot.budget.goldToUsdRatio,
            earnedRewards: snapshot.budget.earnedRewards
        });

        expect(currencyFields(api)).toEqual(currencyFields(browser));
        expect(api.quests[0].completedReward.earnedRewardsDelta).toBe(usdDelta);
        expect(api.budget.earnedRewards).toBe(usdDelta);
        expect(api.quests[0].reward.gold).toBe(formatVersion === 4 ? 40 : 4);
        expect(api).toMatchObject({
            formatVersion: CURRENT_SNAPSHOT_FORMAT_VERSION,
            currencyUnitVersion: CURRENT_CURRENCY_UNIT_VERSION,
            stats: { gold: formatVersion === 4 ? -12.3457 : -1.2346 },
            habits: [{ completionReward: formatVersion === 4 ? 3 : 0.3, passiveReward: formatVersion === 4 ? 1 : 0.1 }],
            calories: { history: [{ coinCost: formatVersion === 4 ? 2 : 0.2 }], savedFoods: [{ coinCost: formatVersion === 4 ? 2 : 0.2 }] },
            coinHistory: [{ amount: formatVersion === 4 ? -10 : -1 }],
            budget: { stipendAmount: formatVersion === 4 ? 20 : 2, goldToUsdRatio: formatVersion === 4 ? 8 : 0.8 }
        });
        expect(normalizeLifeQuestSnapshot(api)).toEqual(api);
        expect(currencyFields(migrateLegacyPortableSnapshot(browser))).toEqual(currencyFields(browser));
        expect(source).toEqual(unchanged);
    });

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

    it('rejects a future snapshot instead of guessing its schema', () => {
        expect(() => normalizeLifeQuestSnapshot({
            formatVersion: CURRENT_SNAPSHOT_FORMAT_VERSION + 1,
            currencyUnitVersion: CURRENT_CURRENCY_UNIT_VERSION
        })).toThrow(expect.objectContaining({ status: 409, code: 'unsupported_snapshot' }));
    });
});
