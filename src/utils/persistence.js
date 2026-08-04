import { useEffect, useState } from 'react';
import {
    CURRENCY_UNIT_VERSION,
    normalizeCurrencyAmount,
    scaleLegacyCurrencyAmount
} from '../constants/currency.js';

export const APP_VERSION = '1.5.0'; // Incrementing for this update
export const VERSION_KEY = 'lq_version';
export const CURRENCY_VERSION_KEY = 'lq_currency_unit_version';
const PERSISTENCE_DEBOUNCE_MS = 180;
const pendingWrites = new Map();
const scheduledWrites = new Map();

const supportsIdleCallback = () => typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function';

const cancelScheduledWrite = (key) => {
    const scheduled = scheduledWrites.get(key);
    if (!scheduled) return;

    if (scheduled.type === 'idle' && typeof window !== 'undefined' && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(scheduled.handle);
    } else {
        clearTimeout(scheduled.handle);
    }

    scheduledWrites.delete(key);
};

const flushPendingWrite = (key) => {
    if (!pendingWrites.has(key)) return;

    const value = pendingWrites.get(key);
    pendingWrites.delete(key);
    cancelScheduledWrite(key);
    safeSet(key, value);
};

const flushAllPendingWrites = () => {
    [...pendingWrites.keys()].forEach(flushPendingWrite);
};

const scheduleSafeSet = (key, value) => {
    pendingWrites.set(key, value);
    cancelScheduledWrite(key);

    if (supportsIdleCallback()) {
        const handle = window.requestIdleCallback(() => {
            flushPendingWrite(key);
        }, { timeout: PERSISTENCE_DEBOUNCE_MS * 2 });

        scheduledWrites.set(key, { type: 'idle', handle });
        return;
    }

    const handle = window.setTimeout(() => {
        flushPendingWrite(key);
    }, PERSISTENCE_DEBOUNCE_MS);

    scheduledWrites.set(key, { type: 'timeout', handle });
};

if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', flushAllPendingWrites);
    window.addEventListener('beforeunload', flushAllPendingWrites);
}

/**
 * Safely retrieves an item from localStorage.
 * If parsing fails, backs up the corrupted data and returns initialValue.
 */
export const safeGet = (key, initialValue) => {
    try {
        const item = localStorage.getItem(key);
        if (item === null) return initialValue;
        return JSON.parse(item);
    } catch (error) {
        console.error(`Error reading ${key} from localStorage:`, error);
        // Backup corrupted data
        const raw = localStorage.getItem(key);
        if (raw) {
            const backupKey = `${key}_corrupted_${Date.now()}`;
            console.warn(`Backing up corrupted data to ${backupKey}`);
            localStorage.setItem(backupKey, raw);
        }
        return initialValue;
    }
};

/**
 * Safely writes an item to localStorage.
 */
export const safeSet = (key, value) => {
    try {
        const serialized = JSON.stringify(value);
        localStorage.setItem(key, serialized);
    } catch (error) {
        console.error(`Error writing ${key} to localStorage:`, error);
    }
};

/**
 * Custom hook to manage persistent state.
 * Replaces the repetitive useState + useEffect(localStorage) pattern.
 */
export const usePersistentState = (key, initialValue) => {
    // efficient initialization: function passed to useState only runs once
    const [state, setState] = useState(() => safeGet(key, initialValue));

    // useRef to track if it's the first render to avoid unnecessary writes, 
    // although safeSet is cheap enough usually.
    // However, we DO want to write immediately if the key didn't exist 
    // (to Initialize defaults), or just wait for updates.
    // The original code wrote on every change, including mount if dependencies matched.
    // Let's stick to standard behavior: write whenever state changes.

    useEffect(() => {
        scheduleSafeSet(key, state);
    }, [key, state]);

    useEffect(() => {
        return () => {
            flushPendingWrite(key);
        };
    }, [key]);

    return [state, setState];
};

const readStoredJson = (key) => {
    const raw = localStorage.getItem(key);
    if (raw === null) return { exists: false, value: null };

    try {
        return { exists: true, value: JSON.parse(raw) };
    } catch {
        return { exists: true, value: null };
    }
};

const writeStoredJson = (key, value) => {
    localStorage.setItem(key, JSON.stringify(value));
};

const scaleRewardRecord = (record = {}) => {
    if (!record || typeof record !== 'object' || Array.isArray(record)) return record;

    return {
        ...record,
        ...(Object.prototype.hasOwnProperty.call(record, 'gold')
            ? { gold: scaleLegacyCurrencyAmount(record.gold) }
            : {})
    };
};

const scalePersistedCurrencyState = () => {
    const stats = readStoredJson('lq_stats');
    if (stats.exists && stats.value && typeof stats.value === 'object' && !Array.isArray(stats.value)) {
        writeStoredJson('lq_stats', {
            ...stats.value,
            ...(Object.prototype.hasOwnProperty.call(stats.value, 'gold')
                ? { gold: scaleLegacyCurrencyAmount(stats.value.gold) }
                : {})
        });
    }

    const settings = readStoredJson('lq_settings');
    if (settings.exists && settings.value && typeof settings.value === 'object' && !Array.isArray(settings.value)) {
        const questRewards = settings.value.questRewards && typeof settings.value.questRewards === 'object'
            ? Object.fromEntries(
                Object.entries(settings.value.questRewards).map(([key, value]) => [key, scaleLegacyCurrencyAmount(value)])
            )
            : settings.value.questRewards;

        writeStoredJson('lq_settings', {
            ...settings.value,
            ...(Object.prototype.hasOwnProperty.call(settings.value, 'protocolReward')
                ? { protocolReward: scaleLegacyCurrencyAmount(settings.value.protocolReward) }
                : {}),
            ...(questRewards ? { questRewards } : {}),
            ...Object.fromEntries(
                ['easy', 'medium', 'hard', 'legendary']
                    .filter((key) => Object.prototype.hasOwnProperty.call(settings.value, `questReward${key[0].toUpperCase()}${key.slice(1)}`))
                    .map((key) => [
                        `questReward${key[0].toUpperCase()}${key.slice(1)}`,
                        scaleLegacyCurrencyAmount(settings.value[`questReward${key[0].toUpperCase()}${key.slice(1)}`])
                    ])
            )
        });
    }

    const quests = readStoredJson('lq_quests');
    if (Array.isArray(quests.value)) {
        writeStoredJson('lq_quests', quests.value.map((quest) => (
            quest && typeof quest === 'object'
                ? {
                    ...quest,
                    ...(Object.prototype.hasOwnProperty.call(quest, 'reward')
                        ? { reward: scaleRewardRecord(quest.reward) }
                        : {}),
                    ...(Object.prototype.hasOwnProperty.call(quest, 'completedReward')
                        ? { completedReward: scaleRewardRecord(quest.completedReward) }
                        : {})
                }
                : quest
        )));
    }

    const habits = readStoredJson('lq_habits');
    if (Array.isArray(habits.value)) {
        writeStoredJson('lq_habits', habits.value.map((habit) => (
            habit && typeof habit === 'object'
                ? {
                    ...habit,
                    ...(Object.prototype.hasOwnProperty.call(habit, 'completionReward')
                        ? { completionReward: scaleLegacyCurrencyAmount(habit.completionReward) }
                        : {}),
                    ...(Object.prototype.hasOwnProperty.call(habit, 'passiveReward')
                        ? { passiveReward: scaleLegacyCurrencyAmount(habit.passiveReward) }
                        : {})
                }
                : habit
        )));
    }

    const calories = readStoredJson('lq_calories');
    if (calories.exists && calories.value && typeof calories.value === 'object' && !Array.isArray(calories.value)) {
        const history = Array.isArray(calories.value.history)
            ? calories.value.history.map((entry) => (
                entry && typeof entry === 'object' && Object.prototype.hasOwnProperty.call(entry, 'coinCost')
                    ? { ...entry, coinCost: scaleLegacyCurrencyAmount(entry.coinCost) }
                    : entry
            ))
            : calories.value.history;
        const savedFoods = Array.isArray(calories.value.savedFoods)
            ? calories.value.savedFoods.map((food) => (
                food && typeof food === 'object' && Object.prototype.hasOwnProperty.call(food, 'coinCost')
                    ? { ...food, coinCost: scaleLegacyCurrencyAmount(food.coinCost) }
                    : food
            ))
            : calories.value.savedFoods;

        writeStoredJson('lq_calories', {
            ...calories.value,
            ...(history ? { history } : {}),
            ...(savedFoods ? { savedFoods } : {})
        });
    }

    const coinHistory = readStoredJson('lq_coin_history');
    if (Array.isArray(coinHistory.value)) {
        writeStoredJson('lq_coin_history', coinHistory.value.map((entry) => (
            entry && typeof entry === 'object' && Object.prototype.hasOwnProperty.call(entry, 'amount')
                ? { ...entry, amount: scaleLegacyCurrencyAmount(entry.amount) }
                : entry
        )));
    }

    const stipend = readStoredJson('lq_budget_stipend_amount');
    if (stipend.exists) {
        writeStoredJson('lq_budget_stipend_amount', scaleLegacyCurrencyAmount(stipend.value));
    }

    const ratio = readStoredJson('lq_gold_ratio');
    if (ratio.exists) {
        writeStoredJson(
            'lq_gold_ratio',
            Math.max(0.0001, normalizeCurrencyAmount(scaleLegacyCurrencyAmount(ratio.value), 1))
        );
    }
};

const hasCurrencyMigration = () => (
    Number(localStorage.getItem(CURRENCY_VERSION_KEY)) >= CURRENCY_UNIT_VERSION
);

const migrateCurrencyPersistence = () => {
    if (hasCurrencyMigration()) return;

    scalePersistedCurrencyState();
    localStorage.setItem(CURRENCY_VERSION_KEY, `${CURRENCY_UNIT_VERSION}`);
};

/**
 * Checks the app version and performs necessary migrations.
 * This ensures data persistence structure across versions.
 */
export const checkVersionAndEnsurePersistence = () => {
    if (typeof localStorage === 'undefined') return;

    const currentStoredVersion = localStorage.getItem(VERSION_KEY);
    const versionChanged = currentStoredVersion !== APP_VERSION;
    const currencyMigrationNeeded = !hasCurrencyMigration();

    if (versionChanged || currencyMigrationNeeded) {
        console.log(`Version change detected: ${currentStoredVersion} -> ${APP_VERSION}`);

        // 1. Perform Backup of critical data before any migration
        performSafetyBackup();

        // 2. Run specific migrations if needed
        migrateCurrencyPersistence();

        // 3. Update version
        localStorage.setItem(VERSION_KEY, APP_VERSION);
    }
};

const performSafetyBackup = () => {
    try {
        const keysToBackup = [
            'lq_stats', 'lq_quests', 'lq_habits', 'lq_settings',
            'lq_calories', 'lq_coin_history',
            'lq_budget_total', 'lq_grocery_list', 'lq_price_db', 'lq_grocery_period',
            'lq_budget_grocery_alloc', 'lq_budget_earned', 'lq_gold_ratio',
            'lq_budget_stipend_amount', 'lq_budget_stipend_period', 'lq_budget_stipend_paid_through'
        ];

        const backup = {};
        keysToBackup.forEach(k => {
            const val = localStorage.getItem(k);
            if (val) backup[k] = val;
        });

        if (Object.keys(backup).length > 0) {
            const backupKey = `lq_backup_pre_v${APP_VERSION.replace(/\./g, '_')}_${Date.now()}`;
            localStorage.setItem(backupKey, JSON.stringify(backup));
            console.log(`Safety backup created: ${backupKey}`);
        }
    } catch (e) {
        console.error("Failed to create safety backup:", e);
    }
};
