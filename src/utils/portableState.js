import { PROTOCOL_LOOKAHEAD_STORAGE_KEY } from '../constants/persistenceKeys.js';
import {
    QUICK_SLOT_IDS,
    createDefaultQuickSlots,
    normalizeHabitRecord,
    normalizeQuestRecord,
    normalizeQuickSlots
} from '../domain/gameState.js';
import { getTodayISO, toLocalDateKey } from './dateUtils.js';
import { safeGet, safeSet } from './persistence.js';

export const PORTABLE_FORMAT_VERSION = 3;
export const PORTABLE_APP_NAME = 'LifeQuest';
export const PORTABLE_BACKUP_PREFIX = 'lq_backup_transfer_pre_import';
export const DEFAULT_PROTOCOL_LOOKAHEAD_DAYS = 1;

export const PORTABLE_SECTION_ORDER = [
    'stats',
    'settings',
    'budget',
    'ui',
    'calories',
    'quests',
    'habits',
    'calorieHistory',
    'calorieSavedFoods',
    'calorieRecentFoods',
    'calorieQuickSlots',
    'caloriePassiveLedger',
    'coinHistory',
    'groceryList',
    'priceDatabase'
];

export const PORTABLE_SNAPSHOT_KEYS = [
    'formatVersion',
    'generatedAt',
    'appName',
    'stats',
    'settings',
    'quests',
    'habits',
    'calories',
    'coinHistory',
    'budget',
    'ui'
];

const HEADER_KEYS = new Set(['formatVersion', 'generatedAt', 'appName']);
const LEGACY_FORMAT_VERSIONS = new Set([1, 2]);
const SUPPORTED_FORMAT_VERSIONS = new Set([...LEGACY_FORMAT_VERSIONS, PORTABLE_FORMAT_VERSION]);
const COLLECTION_SECTIONS = new Set([
    'quests',
    'habits',
    'calorieHistory',
    'calorieSavedFoods',
    'calorieRecentFoods',
    'calorieQuickSlots',
    'caloriePassiveLedger',
    'coinHistory',
    'groceryList',
    'priceDatabase'
]);

const SECTION_TYPES = Object.fromEntries(
    PORTABLE_SECTION_ORDER.map((sectionName) => [
        sectionName,
        COLLECTION_SECTIONS.has(sectionName) ? 'collection' : 'scalar'
    ])
);

const ALLOWED_SCALAR_KEYS = {
    stats: new Set(['level', 'xp', 'maxXp', 'hp', 'maxHp', 'gold', 'lastLoginDate']),
    settings: new Set([
        'protocolReward',
        'questRewardEasy',
        'questRewardMedium',
        'questRewardHard',
        'questRewardLegendary'
    ]),
    budget: new Set([
        'totalMonthlyBudget',
        'groceryAllocation',
        'earnedRewards',
        'groceryPeriod',
        'stipendAmount',
        'stipendPeriod',
        'stipendPaidThrough',
        'goldToUsdRatio'
    ]),
    ui: new Set(['protocolLookaheadDays']),
    calories: new Set([
        'current',
        'target',
        'passiveCheckpointDate',
        'passiveCheckpoints',
        'passiveCheckpointLedger',
        'quickSlots',
        'preset100FoodId',
        'preset250FoodId',
        'preset400FoodId',
        'preset550FoodId'
    ])
};

const INITIAL_STATS = {
    level: 1,
    xp: 0,
    maxXp: 100,
    hp: 0,
    maxHp: 100,
    gold: 0,
    lastLoginDate: null
};

const INITIAL_SETTINGS = {
    protocolReward: 1,
    questRewards: {
        easy: 5,
        medium: 15,
        hard: 40,
        legendary: 100
    }
};

const INITIAL_CALORIES = {
    current: 0,
    target: 2000,
    history: [],
    savedFoods: [],
    recentFoodIds: [],
    passiveCheckpointDate: null,
    passiveCheckpoints: [],
    passiveCheckpointLedger: {},
    quickSlots: createDefaultQuickSlots()
};

const INITIAL_BUDGET = {
    totalMonthlyBudget: 0,
    groceryAllocation: 0,
    earnedRewards: 0,
    groceryList: [],
    priceDatabase: {},
    groceryPeriod: 'weekly',
    stipendAmount: 0,
    stipendPeriod: 'weekly',
    stipendPaidThrough: null,
    goldToUsdRatio: 10
};

const PASSIVE_CALORIE_CHECKPOINT_IDS = new Set(['18:00', '23:59']);

const isPlainObject = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));

const isCommentLine = (line) => {
    const trimmed = line.trim();
    return trimmed.startsWith('#') || trimmed.startsWith('//');
};

const parseValue = (value, label) => {
    const trimmed = value.trim();
    if (!trimmed) return '';

    try {
        return JSON.parse(trimmed);
    } catch {
        throw new Error(`Invalid value for ${label}. Use JSON-safe values such as 12, true, null, or "text".`);
    }
};

const serializeValue = (value) => JSON.stringify(value ?? null);

const normalizeNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeInteger = (value, fallback = 0) => Math.round(normalizeNumber(value, fallback));

const normalizeNonNegativeInteger = (value, fallback = 0) => Math.max(0, normalizeInteger(value, fallback));

const normalizePositiveInteger = (value, fallback = 1) => Math.max(1, normalizeInteger(value, fallback));

const normalizeText = (value, fallback) => {
    const trimmed = `${value ?? ''}`.trim();
    return trimmed || fallback;
};

const sortObjectByKey = (value = {}) => Object.fromEntries(
    Object.entries(isPlainObject(value) ? value : {}).sort(([left], [right]) => left.localeCompare(right))
);

const compactObject = (value = {}) => Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined)
);

const parseKeyValueLines = (sectionName, lines, allowedKeys = null) => {
    const values = {};

    lines.forEach((line, index) => {
        const trimmed = line.trim();
        if (!trimmed || isCommentLine(trimmed)) return;

        const separatorIndex = trimmed.indexOf(':');
        if (separatorIndex === -1) {
            throw new Error(`Invalid line in [${sectionName}] at entry ${index + 1}. Expected "key: value".`);
        }

        const key = trimmed.slice(0, separatorIndex).trim();
        const rawValue = trimmed.slice(separatorIndex + 1).trim();

        if (allowedKeys && !allowedKeys.has(key)) {
            throw new Error(`Unknown key "${key}" in [${sectionName}].`);
        }

        values[key] = parseValue(rawValue, `${sectionName}.${key}`);
    });

    return values;
};

const parseJsonFallback = (sectionName, lines) => {
    const jsonText = lines
        .filter((line) => {
            const trimmed = line.trim();
            return trimmed && !isCommentLine(trimmed);
        })
        .join('\n')
        .trim();

    if (!jsonText) return [];

    try {
        return JSON.parse(jsonText);
    } catch (error) {
        throw new Error(`Invalid collection records in [${sectionName}]: ${error.message}`);
    }
};

const parseCollectionSection = (sectionName, lines) => {
    const records = [];
    let currentRecord = null;
    let currentLines = [];
    let sawRecord = false;

    const finishRecord = () => {
        if (!currentRecord) return;
        records.push(parseKeyValueLines(sectionName, currentLines));
        currentRecord = null;
        currentLines = [];
    };

    lines.forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed || isCommentLine(trimmed)) return;

        if (trimmed === `[[${sectionName}]]`) {
            finishRecord();
            sawRecord = true;
            currentRecord = sectionName;
            return;
        }

        if (!sawRecord) {
            return;
        }

        if (!currentRecord) {
            throw new Error(`Unexpected content after records in [${sectionName}].`);
        }

        currentLines.push(line);
    });

    if (!sawRecord) {
        return parseJsonFallback(sectionName, lines);
    }

    finishRecord();
    return records;
};

const parseSection = (sectionName, lines) => {
    if (!SECTION_TYPES[sectionName]) {
        throw new Error(`Unknown section [${sectionName}].`);
    }

    if (SECTION_TYPES[sectionName] === 'scalar') {
        return parseKeyValueLines(sectionName, lines, ALLOWED_SCALAR_KEYS[sectionName]);
    }

    return parseCollectionSection(sectionName, lines);
};

const parseHeaderLine = (header, line) => {
    const separatorIndex = line.indexOf(':');
    if (separatorIndex === -1) {
        throw new Error('Invalid metadata header. Expected "key: value".');
    }

    const key = line.slice(0, separatorIndex).trim();
    const rawValue = line.slice(separatorIndex + 1).trim();

    if (!HEADER_KEYS.has(key)) {
        throw new Error(`Unknown metadata key "${key}".`);
    }

    header[key] = parseValue(rawValue, key);
};

const getRequiredSectionsForVersion = (formatVersion) => {
    const version = Number(formatVersion);
    if (version < 2) {
        return PORTABLE_SECTION_ORDER.filter((sectionName) => ![
            'calorieSavedFoods',
            'calorieRecentFoods',
            'calorieQuickSlots',
            'caloriePassiveLedger'
        ].includes(sectionName));
    }

    if (version < 3) {
        return PORTABLE_SECTION_ORDER.filter((sectionName) => ![
            'calorieQuickSlots',
            'caloriePassiveLedger'
        ].includes(sectionName));
    }

    return PORTABLE_SECTION_ORDER;
};

const validateSectionPresence = (sections, formatVersion) => {
    getRequiredSectionsForVersion(formatVersion).forEach((sectionName) => {
        if (!(sectionName in sections)) {
            throw new Error(`Missing required section [${sectionName}].`);
        }
    });
};

const renderScalarSection = (name, entries) => [
    `[${name}]`,
    ...Object.entries(entries).map(([key, value]) => `${key}: ${serializeValue(value)}`)
].join('\n');

const renderCollectionSection = (name, records, fieldOrder = null) => {
    const lines = [`[${name}]`];

    records.forEach((record) => {
        lines.push(`[[${name}]]`);
        const entries = fieldOrder
            ? fieldOrder.filter((key) => Object.prototype.hasOwnProperty.call(record, key)).map((key) => [key, record[key]])
            : Object.entries(record);

        entries.forEach(([key, value]) => {
            lines.push(`${key}: ${serializeValue(value)}`);
        });
    });

    return lines.join('\n');
};

const normalizeCalorieHistoryEntry = (entry = {}, index = 0) => {
    const timestamp = entry.timestamp || entry.date || new Date(0).toISOString();
    const calories = normalizeInteger(entry.calories ?? entry.amount, 0);
    const source = normalizeText(entry.source, 'manual');

    return {
        id: normalizeText(entry.id, `cal-${index}`),
        timestamp,
        dateKey: entry.dateKey || toLocalDateKey(timestamp),
        calories,
        label: normalizeText(
            entry.label,
            source === 'preset' ? `Quick Add ${Math.abs(calories)}` : calories < 0 ? 'Exercise Burn' : 'Manual Entry'
        ),
        source,
        foodId: entry.foodId || null,
        coinCost: normalizeNonNegativeInteger(entry.coinCost, 0)
    };
};

const normalizeSavedFood = (food = {}, index = 0) => {
    const createdAt = food.createdAt || new Date(0).toISOString();
    return {
        id: normalizeText(food.id, `food-${index}`),
        name: normalizeText(food.name, 'Untitled Food'),
        calories: normalizePositiveInteger(food.calories, 1),
        coinCost: normalizeNonNegativeInteger(food.coinCost, 0),
        createdAt,
        updatedAt: food.updatedAt || createdAt
    };
};

const normalizePassiveCheckpoints = (checkpoints) => {
    if (!Array.isArray(checkpoints)) return [];
    return [...new Set(checkpoints.filter((checkpointId) => PASSIVE_CALORIE_CHECKPOINT_IDS.has(checkpointId)))];
};

const normalizePassiveCheckpointLedger = (ledger) => {
    if (!isPlainObject(ledger)) return {};

    return Object.fromEntries(
        Object.entries(ledger)
            .filter(([dateKey]) => /^\d{4}-\d{2}-\d{2}$/.test(dateKey))
            .map(([dateKey, checkpoints]) => [dateKey, normalizePassiveCheckpoints(checkpoints)])
            .sort(([left], [right]) => left.localeCompare(right))
    );
};

const recomputeCalorieCurrent = (history, todayKey = getTodayISO()) => history.reduce((sum, entry) => (
    entry.dateKey === todayKey ? sum + normalizeInteger(entry.calories, 0) : sum
), 0);

const normalizeStats = (stats = {}) => ({
    ...INITIAL_STATS,
    ...stats,
    level: normalizePositiveInteger(stats.level ?? INITIAL_STATS.level, INITIAL_STATS.level),
    xp: normalizeNonNegativeInteger(stats.xp ?? INITIAL_STATS.xp, INITIAL_STATS.xp),
    maxXp: normalizePositiveInteger(stats.maxXp ?? INITIAL_STATS.maxXp, INITIAL_STATS.maxXp),
    hp: normalizeNonNegativeInteger(stats.hp ?? INITIAL_STATS.hp, INITIAL_STATS.hp),
    maxHp: normalizePositiveInteger(stats.maxHp ?? INITIAL_STATS.maxHp, INITIAL_STATS.maxHp),
    gold: normalizeInteger(stats.gold ?? INITIAL_STATS.gold, INITIAL_STATS.gold),
    lastLoginDate: stats.lastLoginDate ?? null
});

const normalizeSettings = (settings = {}) => ({
    ...INITIAL_SETTINGS,
    ...settings,
    protocolReward: normalizeNonNegativeInteger(settings.protocolReward ?? INITIAL_SETTINGS.protocolReward, INITIAL_SETTINGS.protocolReward),
    questRewards: {
        easy: normalizeNonNegativeInteger(settings.questRewards?.easy ?? settings.questRewardEasy ?? INITIAL_SETTINGS.questRewards.easy, INITIAL_SETTINGS.questRewards.easy),
        medium: normalizeNonNegativeInteger(settings.questRewards?.medium ?? settings.questRewardMedium ?? INITIAL_SETTINGS.questRewards.medium, INITIAL_SETTINGS.questRewards.medium),
        hard: normalizeNonNegativeInteger(settings.questRewards?.hard ?? settings.questRewardHard ?? INITIAL_SETTINGS.questRewards.hard, INITIAL_SETTINGS.questRewards.hard),
        legendary: normalizeNonNegativeInteger(settings.questRewards?.legendary ?? settings.questRewardLegendary ?? INITIAL_SETTINGS.questRewards.legendary, INITIAL_SETTINGS.questRewards.legendary)
    }
});

const normalizeCalories = (calories = {}) => {
    const savedFoods = Array.isArray(calories.savedFoods)
        ? calories.savedFoods.map(normalizeSavedFood)
        : [];
    const savedFoodIds = new Set(savedFoods.map((food) => food.id));
    const history = Array.isArray(calories.history)
        ? calories.history.map(normalizeCalorieHistoryEntry)
        : [];
    const recentFoodIds = Array.isArray(calories.recentFoodIds)
        ? calories.recentFoodIds.filter((foodId) => savedFoodIds.has(foodId)).slice(0, 10)
        : [];
    const passiveCheckpointDate = calories.passiveCheckpointDate ?? null;
    const passiveCheckpoints = normalizePassiveCheckpoints(calories.passiveCheckpoints);
    const passiveCheckpointLedger = normalizePassiveCheckpointLedger({
        ...(calories.passiveCheckpointLedger || {}),
        ...(passiveCheckpointDate ? { [passiveCheckpointDate]: passiveCheckpoints } : {})
    });

    const normalized = {
        ...INITIAL_CALORIES,
        ...calories,
        current: recomputeCalorieCurrent(history),
        target: normalizePositiveInteger(calories.target ?? INITIAL_CALORIES.target, INITIAL_CALORIES.target),
        history,
        savedFoods,
        recentFoodIds,
        passiveCheckpointDate,
        passiveCheckpoints,
        passiveCheckpointLedger,
        quickSlots: normalizeQuickSlots(calories, savedFoodIds)
    };

    delete normalized.preset100FoodId;
    delete normalized.preset250FoodId;
    delete normalized.preset400FoodId;
    delete normalized.preset550FoodId;

    return normalized;
};

const normalizeBudget = (budget = {}) => ({
    ...INITIAL_BUDGET,
    ...budget,
    totalMonthlyBudget: normalizeNumber(budget.totalMonthlyBudget ?? INITIAL_BUDGET.totalMonthlyBudget, INITIAL_BUDGET.totalMonthlyBudget),
    groceryAllocation: normalizeNumber(budget.groceryAllocation ?? INITIAL_BUDGET.groceryAllocation, INITIAL_BUDGET.groceryAllocation),
    earnedRewards: normalizeNumber(budget.earnedRewards ?? INITIAL_BUDGET.earnedRewards, INITIAL_BUDGET.earnedRewards),
    groceryList: Array.isArray(budget.groceryList) ? budget.groceryList : [],
    priceDatabase: sortObjectByKey(budget.priceDatabase),
    groceryPeriod: budget.groceryPeriod || INITIAL_BUDGET.groceryPeriod,
    stipendAmount: normalizeNumber(budget.stipendAmount ?? INITIAL_BUDGET.stipendAmount, INITIAL_BUDGET.stipendAmount),
    stipendPeriod: budget.stipendPeriod || INITIAL_BUDGET.stipendPeriod,
    stipendPaidThrough: budget.stipendPaidThrough ?? null,
    goldToUsdRatio: normalizePositiveInteger(budget.goldToUsdRatio ?? INITIAL_BUDGET.goldToUsdRatio, INITIAL_BUDGET.goldToUsdRatio)
});

export const normalizePortableSnapshot = (snapshot = {}) => {
    const settings = normalizeSettings(snapshot.settings);
    const todayKey = getTodayISO();

    return {
        formatVersion: PORTABLE_FORMAT_VERSION,
        generatedAt: snapshot.generatedAt || new Date().toISOString(),
        appName: snapshot.appName || PORTABLE_APP_NAME,
        stats: normalizeStats(snapshot.stats),
        settings,
        quests: Array.isArray(snapshot.quests) ? snapshot.quests.map(normalizeQuestRecord) : [],
        habits: Array.isArray(snapshot.habits)
            ? snapshot.habits.map((habit) => normalizeHabitRecord(habit, settings.protocolReward, todayKey))
            : [],
        calories: normalizeCalories(snapshot.calories),
        coinHistory: Array.isArray(snapshot.coinHistory) ? snapshot.coinHistory : [],
        budget: normalizeBudget(snapshot.budget),
        ui: {
            protocolLookaheadDays: Math.max(
                1,
                normalizeInteger(snapshot.ui?.protocolLookaheadDays ?? DEFAULT_PROTOCOL_LOOKAHEAD_DAYS, DEFAULT_PROTOCOL_LOOKAHEAD_DAYS)
            )
        }
    };
};

const collectionRecordsFromSnapshot = (snapshot, sectionName) => {
    switch (sectionName) {
        case 'quests':
            return snapshot.quests.map(compactObject);
        case 'habits':
            return snapshot.habits.map(compactObject);
        case 'calorieHistory':
            return snapshot.calories.history.map(compactObject);
        case 'calorieSavedFoods':
            return snapshot.calories.savedFoods.map(compactObject);
        case 'calorieRecentFoods':
            return snapshot.calories.recentFoodIds.map((foodId) => ({ foodId }));
        case 'calorieQuickSlots':
            return QUICK_SLOT_IDS.map((slotId) => ({ slotId, foodId: snapshot.calories.quickSlots[slotId] ?? null }));
        case 'caloriePassiveLedger':
            return Object.entries(snapshot.calories.passiveCheckpointLedger)
                .map(([dateKey, checkpoints]) => ({ dateKey, checkpoints }))
                .sort((left, right) => left.dateKey.localeCompare(right.dateKey));
        case 'coinHistory':
            return snapshot.coinHistory.map(compactObject);
        case 'groceryList':
            return snapshot.budget.groceryList.map(compactObject);
        case 'priceDatabase':
            return Object.entries(snapshot.budget.priceDatabase)
                .map(([name, price]) => ({ name, price }))
                .sort((left, right) => left.name.localeCompare(right.name));
        default:
            return [];
    }
};

const COLLECTION_FIELD_ORDER = {
    calorieHistory: ['id', 'timestamp', 'dateKey', 'calories', 'label', 'source', 'foodId', 'coinCost'],
    calorieSavedFoods: ['id', 'name', 'calories', 'coinCost', 'createdAt', 'updatedAt'],
    calorieRecentFoods: ['foodId'],
    calorieQuickSlots: ['slotId', 'foodId'],
    caloriePassiveLedger: ['dateKey', 'checkpoints'],
    priceDatabase: ['name', 'price']
};

export const readProtocolLookaheadDays = () => Math.max(
    1,
    Number(safeGet(PROTOCOL_LOOKAHEAD_STORAGE_KEY, DEFAULT_PROTOCOL_LOOKAHEAD_DAYS)) || DEFAULT_PROTOCOL_LOOKAHEAD_DAYS
);

export const writeProtocolLookaheadDays = (value) => {
    safeSet(
        PROTOCOL_LOOKAHEAD_STORAGE_KEY,
        Math.max(1, Number(value) || DEFAULT_PROTOCOL_LOOKAHEAD_DAYS)
    );
};

export const createPortableSnapshot = (state) => normalizePortableSnapshot({
    ...state,
    generatedAt: new Date().toISOString(),
    appName: PORTABLE_APP_NAME
});

export const formatPortableSnapshot = (snapshot) => {
    const normalized = normalizePortableSnapshot(snapshot);
    const sections = [
        '# LifeQuest Transfer',
        '# Edit values after the colon. Strings stay quoted; blank collections are left as empty sections.',
        '# Repeated records use [[sectionName]] so lists can be scanned and diffed without JSON blocks.',
        `formatVersion: ${serializeValue(PORTABLE_FORMAT_VERSION)}`,
        `generatedAt: ${serializeValue(normalized.generatedAt)}`,
        `appName: ${serializeValue(normalized.appName)}`,
        '',
        renderScalarSection('stats', {
            level: normalized.stats.level,
            xp: normalized.stats.xp,
            maxXp: normalized.stats.maxXp,
            hp: normalized.stats.hp,
            maxHp: normalized.stats.maxHp,
            gold: normalized.stats.gold,
            lastLoginDate: normalized.stats.lastLoginDate
        }),
        '',
        renderScalarSection('settings', {
            protocolReward: normalized.settings.protocolReward,
            questRewardEasy: normalized.settings.questRewards.easy,
            questRewardMedium: normalized.settings.questRewards.medium,
            questRewardHard: normalized.settings.questRewards.hard,
            questRewardLegendary: normalized.settings.questRewards.legendary
        }),
        '',
        renderScalarSection('budget', {
            totalMonthlyBudget: normalized.budget.totalMonthlyBudget,
            groceryAllocation: normalized.budget.groceryAllocation,
            earnedRewards: normalized.budget.earnedRewards,
            groceryPeriod: normalized.budget.groceryPeriod,
            stipendAmount: normalized.budget.stipendAmount,
            stipendPeriod: normalized.budget.stipendPeriod,
            stipendPaidThrough: normalized.budget.stipendPaidThrough,
            goldToUsdRatio: normalized.budget.goldToUsdRatio
        }),
        '',
        renderScalarSection('ui', {
            protocolLookaheadDays: normalized.ui.protocolLookaheadDays
        }),
        '',
        renderScalarSection('calories', {
            current: normalized.calories.current,
            target: normalized.calories.target,
            passiveCheckpointDate: normalized.calories.passiveCheckpointDate,
            passiveCheckpoints: normalized.calories.passiveCheckpoints
        })
    ];

    [
        'quests',
        'habits',
        'calorieHistory',
        'calorieSavedFoods',
        'calorieRecentFoods',
        'calorieQuickSlots',
        'caloriePassiveLedger',
        'coinHistory',
        'groceryList',
        'priceDatabase'
    ].forEach((sectionName) => {
        sections.push(
            '',
            renderCollectionSection(
                sectionName,
                collectionRecordsFromSnapshot(normalized, sectionName),
                COLLECTION_FIELD_ORDER[sectionName]
            )
        );
    });

    return sections.join('\n');
};

const sectionsToSnapshot = (header, sections) => {
    const calorieQuickSlots = Array.isArray(sections.calorieQuickSlots)
        ? Object.fromEntries(sections.calorieQuickSlots.map((record) => [record.slotId, record.foodId ?? null]))
        : null;
    const caloriePassiveLedger = Array.isArray(sections.caloriePassiveLedger)
        ? Object.fromEntries(sections.caloriePassiveLedger.map((record) => [record.dateKey, record.checkpoints || []]))
        : null;

    return normalizePortableSnapshot({
        formatVersion: Number(header.formatVersion),
        generatedAt: header.generatedAt,
        appName: header.appName || PORTABLE_APP_NAME,
        stats: sections.stats,
        settings: {
            protocolReward: sections.settings.protocolReward,
            questRewards: {
                easy: sections.settings.questRewardEasy,
                medium: sections.settings.questRewardMedium,
                hard: sections.settings.questRewardHard,
                legendary: sections.settings.questRewardLegendary
            }
        },
        quests: Array.isArray(sections.quests) ? sections.quests : [],
        habits: Array.isArray(sections.habits) ? sections.habits : [],
        calories: {
            current: sections.calories.current,
            target: sections.calories.target,
            passiveCheckpointDate: sections.calories.passiveCheckpointDate ?? null,
            passiveCheckpoints: sections.calories.passiveCheckpoints || [],
            passiveCheckpointLedger: caloriePassiveLedger || sections.calories.passiveCheckpointLedger || {},
            quickSlots: calorieQuickSlots || sections.calories.quickSlots || null,
            preset100FoodId: sections.calories.preset100FoodId ?? null,
            preset250FoodId: sections.calories.preset250FoodId ?? null,
            preset400FoodId: sections.calories.preset400FoodId ?? null,
            preset550FoodId: sections.calories.preset550FoodId ?? null,
            history: Array.isArray(sections.calorieHistory) ? sections.calorieHistory : [],
            savedFoods: Array.isArray(sections.calorieSavedFoods) ? sections.calorieSavedFoods : [],
            recentFoodIds: Array.isArray(sections.calorieRecentFoods)
                ? sections.calorieRecentFoods.map((record) => (isPlainObject(record) ? record.foodId : record))
                : []
        },
        coinHistory: Array.isArray(sections.coinHistory) ? sections.coinHistory : [],
        budget: {
            totalMonthlyBudget: sections.budget.totalMonthlyBudget,
            groceryAllocation: sections.budget.groceryAllocation,
            earnedRewards: sections.budget.earnedRewards,
            groceryPeriod: sections.budget.groceryPeriod,
            stipendAmount: sections.budget.stipendAmount,
            stipendPeriod: sections.budget.stipendPeriod,
            stipendPaidThrough: sections.budget.stipendPaidThrough,
            goldToUsdRatio: sections.budget.goldToUsdRatio,
            groceryList: Array.isArray(sections.groceryList) ? sections.groceryList : [],
            priceDatabase: Array.isArray(sections.priceDatabase)
                ? Object.fromEntries(sections.priceDatabase.map((record) => [record.name, record.price]))
                : sections.priceDatabase || {}
        },
        ui: {
            protocolLookaheadDays: sections.ui.protocolLookaheadDays
        }
    });
};

export const parsePortableSnapshot = (text) => {
    if (!text || !text.trim()) {
        throw new Error('Import text is empty.');
    }

    const lines = text.replace(/\r\n/g, '\n').split('\n');
    const header = {};
    const sections = {};
    let currentSection = null;
    let sectionLines = [];

    const finalizeSection = () => {
        if (!currentSection) return;
        if (currentSection in sections) {
            throw new Error(`Duplicate section [${currentSection}].`);
        }
        sections[currentSection] = parseSection(currentSection, sectionLines);
        currentSection = null;
        sectionLines = [];
    };

    lines.forEach((line) => {
        const trimmed = line.trim();

        if (/^\[[A-Za-z][A-Za-z0-9]*\]$/.test(trimmed)) {
            finalizeSection();
            currentSection = trimmed.slice(1, -1);
            if (!SECTION_TYPES[currentSection]) {
                throw new Error(`Unknown section [${currentSection}].`);
            }
            return;
        }

        if (!currentSection) {
            if (!trimmed || isCommentLine(trimmed)) return;
            parseHeaderLine(header, trimmed);
            return;
        }

        sectionLines.push(line);
    });

    finalizeSection();

    const formatVersion = Number(header.formatVersion);

    if (!SUPPORTED_FORMAT_VERSIONS.has(formatVersion)) {
        throw new Error(`Unsupported formatVersion "${header.formatVersion}". Expected 1, 2, or ${PORTABLE_FORMAT_VERSION}.`);
    }

    if (!header.generatedAt) {
        throw new Error('Missing required metadata key "generatedAt".');
    }

    validateSectionPresence(sections, formatVersion);
    return sectionsToSnapshot(header, sections);
};

export const summarizePortableSnapshot = (snapshot) => {
    const normalized = normalizePortableSnapshot(snapshot);

    return {
        quests: normalized.quests.length,
        habits: normalized.habits.length,
        coinHistory: normalized.coinHistory.length,
        groceryList: normalized.budget.groceryList.length,
        priceDatabase: Object.keys(normalized.budget.priceDatabase).length,
        calorieHistory: normalized.calories.history.length
    };
};

export const storePortableImportBackup = (snapshot) => {
    const key = `${PORTABLE_BACKUP_PREFIX}_${Date.now()}`;
    safeSet(key, {
        createdAt: new Date().toISOString(),
        snapshot: normalizePortableSnapshot(snapshot)
    });
    return key;
};
