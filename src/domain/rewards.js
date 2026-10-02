import { normalizeNonNegativeCurrencyAmount } from '../constants/currency.js';

export const DEFAULT_PROTOCOL_REWARD = 0.1;
export const DEFAULT_QUEST_GOLD = Object.freeze({ easy: 0.5, medium: 1.5, hard: 4, legendary: 10 });
export const DEFAULT_QUEST_XP = Object.freeze({ easy: 10, medium: 25, hard: 60, legendary: 150 });

const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const nonNegativeNumber = (value) => Math.max(0, numberOr(value));

export const createQuestReward = (settings, difficulty, customReward = null) => customReward
    ? { xp: nonNegativeNumber(customReward.xp), gold: normalizeNonNegativeCurrencyAmount(customReward.gold) }
    : {
        xp: DEFAULT_QUEST_XP[difficulty] ?? DEFAULT_QUEST_XP.easy,
        gold: normalizeNonNegativeCurrencyAmount(settings.questRewards?.[difficulty], DEFAULT_QUEST_GOLD[difficulty] ?? DEFAULT_QUEST_GOLD.easy)
    };

export const resolveQuestReward = (settings, quest) => {
    const receipt = quest.completed && quest.completedReward;
    return {
        xp: nonNegativeNumber(receipt ? receipt.xp : quest.reward?.xp),
        gold: normalizeNonNegativeCurrencyAmount(
            receipt ? receipt.gold : quest.isCustomReward ? quest.reward?.gold : settings.questRewards?.[quest.difficulty || 'easy'],
            normalizeNonNegativeCurrencyAmount(quest.reward?.gold)
        )
    };
};

export const applyXp = (stats, amount) => {
    let xp = numberOr(stats.xp) + numberOr(amount);
    let level = Math.max(1, numberOr(stats.level, 1));
    let maxXp = Math.max(1, numberOr(stats.maxXp, 100));
    let hp = numberOr(stats.hp);
    while (xp >= maxXp) {
        level += 1;
        xp -= maxXp;
        maxXp = Math.floor(maxXp * 1.2);
        hp = stats.maxHp;
    }
    while (xp < 0 && level > 1) {
        level -= 1;
        maxXp = Math.ceil(maxXp / 1.2);
        xp += maxXp;
    }
    return { ...stats, xp, level, maxXp, hp };
};
