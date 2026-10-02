import { describe, expect, it } from 'vitest';
import { scaleLegacyPortableCurrency } from './currencyMigration.js';

describe('legacy portable currency scaling', () => {
    it('scales credit fields without changing USD values or receipt deltas', () => {
        const usdDelta = 1 / 3;
        const source = {
            stats: { gold: '12.34567', xp: 50 },
            settings: { protocolReward: 3, questRewardEasy: 5, questRewards: { easy: 5, custom: 12 } },
            quests: [{ reward: { xp: 60, gold: 40 }, completedReward: { xp: 60, gold: 40, earnedRewardsDelta: usdDelta } }],
            habits: [{ completionReward: 3, passiveReward: -1, completionRewards: { day: usdDelta } }],
            calories: { history: [{ coinCost: 2, calories: 200 }], savedFoods: [{ coinCost: 2 }] },
            coinHistory: [{ amount: -10 }],
            budget: {
                earnedRewards: usdDelta,
                totalMonthlyBudget: 900,
                groceryAllocation: 250,
                stipendAmount: 20,
                goldToUsdRatio: 8,
                groceryList: [{ price: 3, coinCost: 24 }],
                priceDatabase: { Milk: 3 }
            }
        };
        const unchanged = structuredClone(source);

        expect(scaleLegacyPortableCurrency(source)).toEqual({
            ...source,
            stats: { gold: 1.2346, xp: 50 },
            settings: { protocolReward: 0.3, questRewardEasy: 0.5, questRewards: { easy: 0.5, custom: 1.2 } },
            quests: [{ reward: { xp: 60, gold: 4 }, completedReward: { xp: 60, gold: 4, earnedRewardsDelta: usdDelta } }],
            habits: [{ completionReward: 0.3, passiveReward: -0.1, completionRewards: { day: usdDelta } }],
            calories: { history: [{ coinCost: 0.2, calories: 200 }], savedFoods: [{ coinCost: 0.2 }] },
            coinHistory: [{ amount: -1 }],
            budget: { ...source.budget, stipendAmount: 2, goldToUsdRatio: 0.8 }
        });
        expect(source).toEqual(unchanged);
    });

    it('preserves absent fields, malformed records, and unparseable amounts for boundary normalization', () => {
        const result = scaleLegacyPortableCurrency({
            stats: { gold: null },
            settings: { protocolReward: '', questRewards: { easy: 'invalid' } },
            quests: [{ reward: { xp: 50 } }, null, { completedReward: [] }],
            habits: [{ passiveReward: undefined }, 'invalid'],
            calories: { history: [{ coinCost: 'invalid' }, null], savedFoods: [{ coinCost: '' }] },
            coinHistory: [{ amount: Infinity }, null]
        });

        expect(result.stats.gold).toBeNull();
        expect(result.settings).toEqual({ protocolReward: '', questRewards: { easy: 'invalid' } });
        expect(result.quests).toEqual([{ reward: { xp: 50 } }, null, { completedReward: [] }]);
        expect(result.habits).toEqual([{ passiveReward: undefined }, 'invalid']);
        expect(result.calories).toEqual({ history: [{ coinCost: 'invalid' }, null], savedFoods: [{ coinCost: '' }] });
        expect(result.coinHistory).toEqual([{ amount: Infinity }, null]);
        expect(result.budget).toEqual({});
    });
});
