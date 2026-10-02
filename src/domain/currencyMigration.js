import { scaleLegacyCurrencyAmount } from '../constants/currency.js';

const isPlainObject = (value) => Boolean(
    value && typeof value === 'object' && !Array.isArray(value)
);

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

// Scale only legacy credit fields. USD balances and receipt conversion deltas
// retain their original precision. Callers guard this at the migration boundary.
const scaleLegacyReward = (reward) => {
    if (!isPlainObject(reward)) return reward;

    return {
        ...reward,
        ...(hasOwn(reward, 'gold') ? { gold: scaleLegacyCurrencyAmount(reward.gold) } : {}),
    };
};

export const scaleLegacyPortableCurrency = (snapshot) => {
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
