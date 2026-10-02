import { DEFAULT_CREDITS_PER_USD } from '../constants/currency.js';
import { createDefaultQuickSlots } from './gameState.js';
import { DEFAULT_HOME_SCREEN_ICON_ID } from '../utils/homeScreenIcons.js';
import { DEFAULT_PROTOCOL_REWARD, DEFAULT_QUEST_GOLD } from './rewards.js';

export const createInitialAppState = () => ({
    stats: { level: 1, xp: 0, maxXp: 100, hp: 0, maxHp: 100, gold: 0 },
    settings: {
        protocolReward: DEFAULT_PROTOCOL_REWARD,
        homeScreenIconId: DEFAULT_HOME_SCREEN_ICON_ID,
        questRewards: { ...DEFAULT_QUEST_GOLD }
    },
    quests: [],
    habits: [],
    calories: {
        current: 0,
        target: 2000,
        history: [],
        savedFoods: [],
        recentFoodIds: [],
        passiveCheckpointDate: null,
        passiveCheckpoints: [],
        passiveCheckpointLedger: {},
        quickSlots: createDefaultQuickSlots()
    },
    coinHistory: [],
    budget: {
        totalMonthlyBudget: 0,
        groceryAllocation: 0,
        earnedRewards: 0,
        groceryList: [],
        priceDatabase: {},
        groceryPeriod: 'weekly',
        stipendAmount: 0,
        stipendPeriod: 'weekly',
        stipendPaidThrough: null,
        goldToUsdRatio: DEFAULT_CREDITS_PER_USD
    }
});
