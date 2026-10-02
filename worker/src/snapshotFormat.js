import { assertHttp } from './errors.js';
import {
    CURRENCY_UNIT_VERSION,
    normalizeCurrencyAmount,
    normalizeNonNegativeCurrencyAmount,
    normalizeConversionRate
} from '../../src/constants/currency.js';
import { scaleLegacyPortableCurrency } from '../../src/domain/currencyMigration.js';
import { DEFAULT_PROTOCOL_REWARD, DEFAULT_QUEST_GOLD } from '../../src/domain/rewards.js';

export const CURRENT_SNAPSHOT_FORMAT_VERSION = 4;
export const CURRENT_CURRENCY_UNIT_VERSION = CURRENCY_UNIT_VERSION;

const LEGACY_FORMAT_VERSIONS = new Set([1, 2, 3]);

const isPlainObject = (value) => Boolean(
    value && typeof value === 'object' && !Array.isArray(value)
);

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

const normalizeReward = (reward) => {
    if (!isPlainObject(reward)) return reward;

    return {
        ...reward,
        ...(hasOwn(reward, 'gold')
            ? { gold: normalizeCurrencyAmount(reward.gold) }
            : {})
    };
};

const normalizeSnapshotCurrency = (snapshot) => {
    const normalized = structuredClone(snapshot);
    const stats = isPlainObject(normalized.stats) ? normalized.stats : {};
    const settings = isPlainObject(normalized.settings) ? normalized.settings : {};
    const budget = isPlainObject(normalized.budget) ? normalized.budget : {};
    const questRewards = isPlainObject(settings.questRewards) ? settings.questRewards : {};
    const defaultQuestRewards = DEFAULT_QUEST_GOLD;

    normalized.formatVersion = CURRENT_SNAPSHOT_FORMAT_VERSION;
    normalized.currencyUnitVersion = CURRENT_CURRENCY_UNIT_VERSION;
    normalized.stats = {
        ...stats,
        gold: normalizeCurrencyAmount(stats.gold)
    };
    normalized.settings = {
        ...settings,
        protocolReward: normalizeNonNegativeCurrencyAmount(settings.protocolReward, DEFAULT_PROTOCOL_REWARD),
        questRewards: {
            ...defaultQuestRewards,
            easy: normalizeNonNegativeCurrencyAmount(
                questRewards.easy ?? settings.questRewardEasy,
                defaultQuestRewards.easy
            ),
            medium: normalizeNonNegativeCurrencyAmount(
                questRewards.medium ?? settings.questRewardMedium,
                defaultQuestRewards.medium
            ),
            hard: normalizeNonNegativeCurrencyAmount(
                questRewards.hard ?? settings.questRewardHard,
                defaultQuestRewards.hard
            ),
            legendary: normalizeNonNegativeCurrencyAmount(
                questRewards.legendary ?? settings.questRewardLegendary,
                defaultQuestRewards.legendary
            )
        }
    };
    normalized.quests = Array.isArray(normalized.quests)
        ? normalized.quests.map((quest) => {
            if (!isPlainObject(quest)) return quest;
            const { isToday, ...rest } = quest;
            return {
                ...rest,
                ...(hasOwn(rest, 'reward') ? { reward: normalizeReward(rest.reward) } : {}),
                ...(hasOwn(rest, 'completedReward')
                    ? { completedReward: normalizeReward(rest.completedReward) }
                    : {}),
                ...(hasOwn(quest, 'isFocusedToday')
                    ? { isFocusedToday: Boolean(quest.isFocusedToday) }
                    : (isToday === undefined ? {} : { isFocusedToday: Boolean(isToday) }))
            };
        })
        : [];
    normalized.habits = Array.isArray(normalized.habits)
        ? normalized.habits.map((habit) => (
            isPlainObject(habit)
                ? {
                    ...habit,
                    completionReward: normalizeCurrencyAmount(habit.completionReward, normalized.settings.protocolReward),
                    passiveReward: normalizeCurrencyAmount(habit.passiveReward)
                }
                : habit
        ))
        : [];
    normalized.calories = isPlainObject(normalized.calories) ? normalized.calories : {};
    if (Array.isArray(normalized.calories.history)) {
        normalized.calories.history = normalized.calories.history.map((entry) => (
            isPlainObject(entry) && hasOwn(entry, 'coinCost')
                ? { ...entry, coinCost: normalizeCurrencyAmount(entry.coinCost) }
                : entry
        ));
    }
    if (Array.isArray(normalized.calories.savedFoods)) {
        normalized.calories.savedFoods = normalized.calories.savedFoods.map((food) => (
            isPlainObject(food) && hasOwn(food, 'coinCost')
                ? { ...food, coinCost: normalizeCurrencyAmount(food.coinCost) }
                : food
        ));
    }
    normalized.coinHistory = Array.isArray(normalized.coinHistory)
        ? normalized.coinHistory.map((entry) => (
            isPlainObject(entry) && hasOwn(entry, 'amount')
                ? { ...entry, amount: normalizeCurrencyAmount(entry.amount) }
                : entry
        ))
        : [];
    normalized.budget = {
        ...budget,
        // USD balances may contain conversion precision. Preserve it so a
        // recorded completion delta can be reversed without losing value.
        earnedRewards: Number.isFinite(Number(budget.earnedRewards)) ? Number(budget.earnedRewards) : 0,
        stipendAmount: normalizeNonNegativeCurrencyAmount(budget.stipendAmount),
        goldToUsdRatio: normalizeConversionRate(budget.goldToUsdRatio)
    };

    return normalized;
};

export const normalizeLifeQuestSnapshot = (snapshot) => {
    assertHttp(
        snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot),
        502,
        'The LifeQuest cloud snapshot is invalid.',
        'invalid_snapshot'
    );

    const formatVersion = Number(snapshot.formatVersion);
    assertHttp(
        Number.isInteger(formatVersion) && (
            formatVersion === CURRENT_SNAPSHOT_FORMAT_VERSION
            || LEGACY_FORMAT_VERSIONS.has(formatVersion)
        ),
        409,
        `This API supports LifeQuest snapshot format version ${CURRENT_SNAPSHOT_FORMAT_VERSION} and migrates versions 1–3.`,
        'unsupported_snapshot'
    );

    const currencyVersion = Number(snapshot.currencyUnitVersion);
    const isCurrent = (
        formatVersion === CURRENT_SNAPSHOT_FORMAT_VERSION
        && currencyVersion >= CURRENT_CURRENCY_UNIT_VERSION
    );
    const source = isCurrent ? snapshot : scaleLegacyPortableCurrency(snapshot);

    return normalizeSnapshotCurrency(source);
};
