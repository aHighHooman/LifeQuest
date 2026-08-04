import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
    PORTABLE_SECTION_ORDER,
    PORTABLE_SNAPSHOT_KEYS,
    formatPortableSnapshot,
    isPortableSnapshotCurrent,
    migrateLegacyPortableSnapshot,
    normalizePortableSnapshot,
    parsePortableSnapshot,
    summarizePortableSnapshot
} from './portableState.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = (name) => readFileSync(join(__dirname, '__fixtures__', name), 'utf8');

const populatedSnapshot = {
    formatVersion: 4,
    generatedAt: '2026-01-15T12:00:00.000Z',
    appName: 'LifeQuest',
    currencyUnitVersion: 2,
    stats: {
        level: 4,
        xp: 42,
        maxXp: 150,
        hp: 80,
        maxHp: 100,
        gold: 12.3,
        lastLoginDate: '2026-01-15'
    },
    settings: {
        protocolReward: 0.3,
        questRewards: {
            easy: 0.5,
            medium: 1.5,
            hard: 4,
            legendary: 10
        }
    },
    quests: [
        {
            id: 'quest-1',
            title: 'File taxes',
            difficulty: 'hard',
            dueDate: '2026-01-30',
            completed: false,
            discarded: false,
            reward: { xp: 60, gold: 4 },
            isCustomReward: false,
            createdAt: '2026-01-10T00:00:00.000Z',
            isFocusedToday: true
        }
    ],
    habits: [
        {
            id: 'habit-1',
            title: 'Read',
            frequency: 'daily',
            frequencyParam: 1,
            streak: 7,
            history: { '2026-01-14': 1 },
            isActive: true,
            completionReward: 0.3,
            passiveReward: 0.1,
            passivePaidThrough: '2026-01-14',
            lastCycleResetDateKey: '2026-01-14',
            createdAt: '2026-01-01T00:00:00.000Z'
        }
    ],
    calories: {
        current: 0,
        target: 2100,
        passiveCheckpointDate: '2026-01-15',
        passiveCheckpoints: ['18:00'],
        passiveCheckpointLedger: { '2026-01-15': ['18:00'] },
        history: [
            {
                id: 'cal-1',
                timestamp: '2026-01-15T18:00:00.000Z',
                dateKey: '2026-01-15',
                calories: 650,
                label: 'Rice bowl',
                source: 'saved-food',
                foodId: 'food-1',
                coinCost: 0.2
            }
        ],
        savedFoods: [
            {
                id: 'food-1',
                name: 'Rice bowl',
                calories: 650,
                coinCost: 0.2,
                createdAt: '2026-01-10T00:00:00.000Z',
                updatedAt: '2026-01-11T00:00:00.000Z'
            }
        ],
        recentFoodIds: ['food-1'],
        quickSlots: {
            preset100: 'food-1',
            preset250: null,
            preset400: null,
            preset550: null
        }
    },
    coinHistory: [
        {
            id: 'coin-1',
            date: '2026-01-12T00:00:00.000Z',
            amount: 1,
            description: 'Quest',
            type: 'earned'
        }
    ],
    budget: {
        totalMonthlyBudget: 900,
        groceryAllocation: 250,
        earnedRewards: 12.5,
        groceryList: [
            {
                id: 'grocery-1',
                name: 'Milk',
                quantity: 2,
                price: 4.5,
                completed: false,
                completedDateKey: null,
                completedAt: null
            }
        ],
        priceDatabase: { Milk: 4.5 },
        groceryPeriod: 'weekly',
        stipendAmount: 2,
        stipendPeriod: 'bi-weekly',
        stipendPaidThrough: '2026-01-01',
        goldToUsdRatio: 0.8
    },
    ui: {
        protocolLookaheadDays: 5
    }
};

const legacySnapshot = {
    ...populatedSnapshot,
    formatVersion: 3,
    currencyUnitVersion: 0,
    stats: {
        ...populatedSnapshot.stats,
        gold: 123
    },
    settings: {
        ...populatedSnapshot.settings,
        protocolReward: 3,
        questRewards: {
            easy: 5,
            medium: 15,
            hard: 40,
            legendary: 100
        }
    },
    quests: [
        {
            ...populatedSnapshot.quests[0],
            reward: { ...populatedSnapshot.quests[0].reward, gold: 40 }
        }
    ],
    habits: [
        {
            ...populatedSnapshot.habits[0],
            completionReward: 3,
            passiveReward: 1
        }
    ],
    calories: {
        ...populatedSnapshot.calories,
        history: [{ ...populatedSnapshot.calories.history[0], coinCost: 2 }],
        savedFoods: [{ ...populatedSnapshot.calories.savedFoods[0], coinCost: 2 }]
    },
    coinHistory: [{ ...populatedSnapshot.coinHistory[0], amount: 10 }],
    budget: {
        ...populatedSnapshot.budget,
        stipendAmount: 20,
        goldToUsdRatio: 8
    }
};

describe('portableState', () => {
    it('round-trips a populated snapshot through the readable format', () => {
        const normalized = normalizePortableSnapshot(populatedSnapshot);
        const text = formatPortableSnapshot(populatedSnapshot);
        const parsed = parsePortableSnapshot(text);

        expect(text).toContain('[quests]\n[[quests]]');
        expect(text).not.toContain('[\n  {');
        expect(parsed).toEqual(normalized);
    });

    it('migrates legacy currency fields once at the explicit boundary', () => {
        const migrated = migrateLegacyPortableSnapshot(legacySnapshot);

        expect(migrated.currencyUnitVersion).toBe(2);
        expect(migrated.formatVersion).toBe(4);
        expect(isPortableSnapshotCurrent(migrated)).toBe(true);
        expect(migrated.stats.gold).toBe(12.3);
        expect(migrated.settings.protocolReward).toBe(0.3);
        expect(migrated.settings.questRewards).toEqual({
            easy: 0.5,
            medium: 1.5,
            hard: 4,
            legendary: 10
        });
        expect(migrated.quests[0].reward.gold).toBe(4);
        expect(migrated.habits[0].completionReward).toBe(0.3);
        expect(migrated.habits[0].passiveReward).toBe(0.1);
        expect(migrated.calories.history[0].coinCost).toBe(0.2);
        expect(migrated.calories.savedFoods[0].coinCost).toBe(0.2);
        expect(migrated.coinHistory[0].amount).toBe(1);
        expect(migrated.budget.stipendAmount).toBe(2);
        expect(migrated.budget.goldToUsdRatio).toBe(0.8);
        expect(migrated.budget.totalMonthlyBudget).toBe(900);
        expect(migrated.budget.earnedRewards).toBe(12.5);
        expect(migrated.budget.priceDatabase).toEqual({ Milk: 4.5 });
        expect(migrateLegacyPortableSnapshot(migrated)).toEqual(migrated);
        expect(() => normalizePortableSnapshot(legacySnapshot)).toThrow(/Migrate legacy data/);
    });

    it('rejects legacy portable text instead of keeping compatibility branches', () => {
        expect(() => parsePortableSnapshot(fixture('portableState.v3.lq.txt'))).toThrow(/Expected 4/);
        expect(() => parsePortableSnapshot(fixture('portableState.v2-legacy.lq.txt'))).toThrow(/Expected 4/);
    });

    it('normalizes sparse and partially legacy snapshots into a safe full shape', () => {
        const normalized = normalizePortableSnapshot({
            formatVersion: 4,
            currencyUnitVersion: 2,
            settings: { questRewardEasy: 0.9 },
            quests: [{ id: 'q', isToday: true }],
            calories: {
                target: 0,
                savedFoods: [{ id: 'food-a', name: 'Apple', calories: 95 }],
                recentFoodIds: ['food-a', 'missing'],
                preset100FoodId: 'food-a'
            },
            budget: {
                priceDatabase: ['bad']
            }
        });

        expect(Object.keys(normalized)).toEqual(PORTABLE_SNAPSHOT_KEYS);
        expect(normalized.settings.questRewards.easy).toBe(0.9);
        expect(normalized.settings.homeScreenIconId).toBe('abstract-path-compass-v2');
        expect(normalized.quests[0].isFocusedToday).toBe(true);
        expect(normalized.calories.target).toBe(1);
        expect(normalized.calories.recentFoodIds).toEqual(['food-a']);
        expect(normalized.calories.quickSlots.preset100).toBe('food-a');
        expect(normalized.budget).toMatchObject({
            groceryList: [],
            priceDatabase: {},
            stipendAmount: 0,
            stipendPeriod: 'weekly',
            stipendPaidThrough: null,
            goldToUsdRatio: 1
        });
    });

    it('formats fields and sections deterministically', () => {
        const text = formatPortableSnapshot({
            ...populatedSnapshot,
            budget: {
                ...populatedSnapshot.budget,
                priceDatabase: { Zucchini: 2, Apples: 1 }
            }
        });
        const sectionIndexes = PORTABLE_SECTION_ORDER.map((sectionName) => text.indexOf(`[${sectionName}]`));

        expect(sectionIndexes.every((index) => index >= 0)).toBe(true);
        expect(sectionIndexes).toEqual([...sectionIndexes].sort((left, right) => left - right));
        expect(text.indexOf('name: "Apples"')).toBeLessThan(text.indexOf('name: "Zucchini"'));
        expect(text).toContain('homeScreenIconId: "abstract-path-compass-v2"');
        expect(formatPortableSnapshot(populatedSnapshot)).toBe(formatPortableSnapshot(populatedSnapshot));
    });

    it('fails with actionable errors for malformed transfer text', () => {
        const currentText = formatPortableSnapshot(populatedSnapshot);

        expect(() => parsePortableSnapshot('')).toThrow(/empty/i);
        expect(() => parsePortableSnapshot(currentText.replace('[stats]', '[unknown]'))).toThrow(/Unknown section/);
        expect(() => parsePortableSnapshot(`${currentText}\n\n[stats]\nlevel: 1`)).toThrow(/Duplicate section/);
        expect(() => parsePortableSnapshot(currentText.replace('level: 4', 'level = 4'))).toThrow(/Expected "key: value"/);
        expect(() => parsePortableSnapshot(currentText.replace(/\n\[budget\][\s\S]*?\n\[ui\]/, '\n[ui]'))).toThrow(/Missing required section/);
    });

    it('summarizes normalized snapshots without dropping sections', () => {
        const summary = summarizePortableSnapshot(populatedSnapshot);

        expect(summary).toEqual({
            quests: 1,
            habits: 1,
            coinHistory: 1,
            groceryList: 1,
            priceDatabase: 1,
            calorieHistory: 1
        });
    });
});
