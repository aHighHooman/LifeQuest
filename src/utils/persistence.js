import { useState, useEffect, useRef } from 'react';

export const APP_VERSION = '1.1.0'; // Incrementing for this update
export const VERSION_KEY = 'lq_version';

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
        safeSet(key, state);
    }, [key, state]);

    return [state, setState];
};

/**
 * Checks the app version and performs necessary migrations.
 * This ensures data persistence structure across versions.
 */
export const checkVersionAndEnsurePersistence = () => {
    const currentStoredVersion = localStorage.getItem(VERSION_KEY);

    if (currentStoredVersion !== APP_VERSION) {
        console.log(`Version change detected: ${currentStoredVersion} -> ${APP_VERSION}`);

        // 1. Perform Backup of critical data before any migration
        performSafetyBackup();

        // 2. Run specific migrations if needed
        // if (!currentStoredVersion || versionCompare(currentStoredVersion, '1.1.0') < 0) { ... }

        // 3. Update version
        localStorage.setItem(VERSION_KEY, APP_VERSION);
    }
};

const performSafetyBackup = () => {
    try {
        const keysToBackup = [
            'lq_stats', 'lq_quests', 'lq_habits', 'lq_settings',
            'lq_calories', 'lq_coin_history',
            'lq_budget_total', 'lq_grocery_list'
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
