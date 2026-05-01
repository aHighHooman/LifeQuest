import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
    PORTABLE_SECTION_ORDER,
    PORTABLE_SNAPSHOT_KEYS,
    formatPortableSnapshot,
    normalizePortableSnapshot,
    parsePortableSnapshot,
    summarizePortableSnapshot
} from './portableState.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = (name) => readFileSync(join(__dirname, '__fixtures__', name), 'utf8');

const populatedSnapshot = {
    formatVersion: 3,
    generatedAt: '2026-01-15T12:00:00.000Z',
    appName: 'LifeQuest',
    stats: {
        level: 4,
        xp: 42,
        maxXp: 150,
        hp: 80,
        maxHp: 100,
        gold: 123,
        lastLoginDate: '2026-01-15'
    },
    settings: {
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
            id: 'quest-1',
            title: 'File taxes',
            difficulty: 'hard',
            dueDate: '2026-01-30',
            completed: false,
            discarded: false,
            reward: { xp: 60, gold: 40 },
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
            completionReward: 3,
            passiveReward: 1,
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
                coinCost: 2
            }
        ],
        savedFoods: [
            {
                id: 'food-1',
                name: 'Rice bowl',
                calories: 650,
                coinCost: 2,
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
            amount: 10,
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
        stipendAmount: 20,
        stipendPeriod: 'bi-weekly',
        stipendPaidThrough: '2026-01-01',
        goldToUsdRatio: 8
    },
    ui: {
        protocolLookaheadDays: 5
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

    it('parses the v3 regression fixture and preserves nested transfer state', () => {
        const parsed = parsePortableSnapshot(fixture('portableState.v3.lq.txt'));

        expect(parsed.calories.savedFoods).toHaveLength(1);
        expect(parsed.calories.recentFoodIds).toEqual(['food-1']);
        expect(parsed.calories.quickSlots.preset100).toBe('food-1');
        expect(parsed.calories.passiveCheckpointLedger).toEqual({ '2026-01-15': ['18:00'] });
        expect(parsed.budget.stipendAmount).toBe(20);
        expect(parsed.budget.stipendPeriod).toBe('bi-weekly');
        expect(parsed.budget.stipendPaidThrough).toBe('2026-01-01');
        expect(parsed.budget.groceryList[0].name).toBe('Milk');
        expect(parsed.budget.priceDatabase).toEqual({ Milk: 4.5 });
    });

    it('imports current legacy JSON-heavy v2 exports', () => {
        const parsed = parsePortableSnapshot(fixture('portableState.v2-legacy.lq.txt'));

        expect(parsed.quests[0].isFocusedToday).toBe(true);
        expect(parsed.calories.savedFoods[0].id).toBe('food-old');
        expect(parsed.calories.recentFoodIds).toEqual(['food-old']);
        expect(parsed.calories.quickSlots.preset100).toBe('food-old');
        expect(parsed.budget.priceDatabase).toEqual({ Eggs: 3 });
    });

    it('normalizes sparse and partially legacy snapshots into a safe full shape', () => {
        const normalized = normalizePortableSnapshot({
            settings: { questRewardEasy: 9 },
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
        expect(normalized.settings.questRewards.easy).toBe(9);
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
            goldToUsdRatio: 10
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
        expect(() => parsePortableSnapshot('')).toThrow(/empty/i);
        expect(() => parsePortableSnapshot(fixture('portableState.v3.lq.txt').replace('[stats]', '[unknown]'))).toThrow(/Unknown section/);
        expect(() => parsePortableSnapshot(`${fixture('portableState.v3.lq.txt')}\n\n[stats]\nlevel: 1`)).toThrow(/Duplicate section/);
        expect(() => parsePortableSnapshot(fixture('portableState.v3.lq.txt').replace('level: 4', 'level = 4'))).toThrow(/Expected "key: value"/);
        expect(() => parsePortableSnapshot(fixture('portableState.v3.lq.txt').replace(/\n\[budget\][\s\S]*?\n\[ui\]/, '\n[ui]'))).toThrow(/Missing required section/);
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
