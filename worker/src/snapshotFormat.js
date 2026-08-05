import { HttpError, assertHttp } from './errors.js';

export const CURRENT_SNAPSHOT_FORMAT_VERSION = 4;
export const CURRENT_CURRENCY_UNIT_VERSION = 2;

const LEGACY_CURRENCY_DIVISOR = 10;
const CURRENCY_PRECISION = 4;
const LEGACY_FORMAT_VERSIONS = new Set([1, 2, 3]);

const isPlainObject = (value) => Boolean(
    value && typeof value === 'object' && !Array.isArray(value)
);

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

export const normalizeCurrencyAmount = (value, fallback = 0) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;

    const factor = 10 ** CURRENCY_PRECISION;
    return Math.round((parsed + Number.EPSILON) * factor) / factor;
};

export const normalizeNonNegativeCurrencyAmount = (value, fallback = 0) => (
    Math.max(0, normalizeCurrencyAmount(value, fallback))
);

const scaleLegacyCurrencyAmount = (value) => {
    if (value === null || value === undefined || value === '') return value;

    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return value;

    return normalizeCurrencyAmount(parsed / LEGACY_CURRENCY_DIVISOR);
};

const scaleLegacyReward = (reward) => {
    if (!isPlainObject(reward)) return reward;

    return {
        ...reward,
        ...(hasOwn(reward, 'gold') ? { gold: scaleLegacyCurrencyAmount(reward.gold) } : {}),
    };
};

const scaleLegacyPortableCurrency = (snapshot) => {
    const source = isPlainObject(snapshot) ? snapshot : {};
    const stats = isPlainObject(source.stats) ? source.stats : {};
    const rawSettings = isPlainObject(source.settings) ? source.settings : {};
    const questRewards = isPlainObject(rawSettings.questRewards)
        ? Object.fromEntries(
            Object.entries(rawSettings.questRewards).map(([key, value]) => [
                key,
                scaleLegacyCurrencyAmount(value)
            ])
        )
        : rawSettings.questRewards;
    const quests = Array.isArray(source.quests)
        ? source.quests.map((quest) => (
            isPlainObject(quest)
                ? {
                    ...quest,
                    ...(hasOwn(quest, 'reward') ? { reward: scaleLegacyReward(quest.reward) } : {}),
                    ...(hasOwn(quest, 'completedReward')
                        ? { completedReward: scaleLegacyReward(quest.completedReward) }
                        : {})
                }
                : quest
        ))
        : source.quests;
    const habits = Array.isArray(source.habits)
        ? source.habits.map((habit) => (
            isPlainObject(habit)
                ? {
                    ...habit,
                    ...(hasOwn(habit, 'completionReward')
                        ? { completionReward: scaleLegacyCurrencyAmount(habit.completionReward) }
                        : {}),
                    ...(hasOwn(habit, 'passiveReward')
                        ? { passiveReward: scaleLegacyCurrencyAmount(habit.passiveReward) }
                        : {})
                }
                : habit
        ))
        : source.habits;
    const calories = isPlainObject(source.calories) ? source.calories : {};
    const history = Array.isArray(calories.history)
        ? calories.history.map((entry) => (
            isPlainObject(entry) && hasOwn(entry, 'coinCost')
                ? { ...entry, coinCost: scaleLegacyCurrencyAmount(entry.coinCost) }
                : entry
        ))
        : calories.history;
    const savedFoods = Array.isArray(calories.savedFoods)
        ? calories.savedFoods.map((food) => (
            isPlainObject(food) && hasOwn(food, 'coinCost')
                ? { ...food, coinCost: scaleLegacyCurrencyAmount(food.coinCost) }
                : food
        ))
        : calories.savedFoods;
    const coinHistory = Array.isArray(source.coinHistory)
        ? source.coinHistory.map((entry) => (
            isPlainObject(entry) && hasOwn(entry, 'amount')
                ? { ...entry, amount: scaleLegacyCurrencyAmount(entry.amount) }
                : entry
        ))
        : source.coinHistory;
    const budget = isPlainObject(source.budget) ? source.budget : {};

    return {
        ...source,
        stats: {
            ...stats,
            ...(hasOwn(stats, 'gold') ? { gold: scaleLegacyCurrencyAmount(stats.gold) } : {})
        },
        settings: {
            ...rawSettings,
            ...(hasOwn(rawSettings, 'protocolReward')
                ? { protocolReward: scaleLegacyCurrencyAmount(rawSettings.protocolReward) }
                : {}),
            ...(questRewards ? { questRewards } : {}),
            ...Object.fromEntries(
                ['easy', 'medium', 'hard', 'legendary']
                    .map((key) => `questReward${key[0].toUpperCase()}${key.slice(1)}`)
                    .filter((key) => hasOwn(rawSettings, key))
                    .map((key) => [key, scaleLegacyCurrencyAmount(rawSettings[key])])
            )
        },
        quests,
        habits,
        calories: {
            ...calories,
            ...(history ? { history } : {}),
            ...(savedFoods ? { savedFoods } : {})
        },
        coinHistory,
        budget: {
            ...budget,
            ...(hasOwn(budget, 'stipendAmount')
                ? { stipendAmount: scaleLegacyCurrencyAmount(budget.stipendAmount) }
                : {}),
            ...(hasOwn(budget, 'goldToUsdRatio')
                ? { goldToUsdRatio: scaleLegacyCurrencyAmount(budget.goldToUsdRatio) }
                : {})
        }
    };
};

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
    const defaultQuestRewards = {
        easy: 0.5,
        medium: 1.5,
        hard: 4,
        legendary: 10
    };

    normalized.formatVersion = CURRENT_SNAPSHOT_FORMAT_VERSION;
    normalized.currencyUnitVersion = CURRENT_CURRENCY_UNIT_VERSION;
    normalized.stats = {
        ...stats,
        gold: normalizeCurrencyAmount(stats.gold)
    };
    normalized.settings = {
        ...settings,
        protocolReward: normalizeNonNegativeCurrencyAmount(settings.protocolReward, 0.1),
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
        earnedRewards: normalizeCurrencyAmount(budget.earnedRewards),
        stipendAmount: normalizeNonNegativeCurrencyAmount(budget.stipendAmount),
        goldToUsdRatio: Math.max(0.0001, normalizeCurrencyAmount(budget.goldToUsdRatio, 1))
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
