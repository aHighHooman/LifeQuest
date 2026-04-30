import { PROTOCOL_LOOKAHEAD_STORAGE_KEY } from '../constants/persistenceKeys.js';
import { safeGet, safeSet } from './persistence.js';

export const PORTABLE_FORMAT_VERSION = 2;
export const PORTABLE_APP_NAME = 'LifeQuest';
export const PORTABLE_BACKUP_PREFIX = 'lq_backup_transfer_pre_import';
export const DEFAULT_PROTOCOL_LOOKAHEAD_DAYS = 1;

const HEADER_KEYS = new Set(['formatVersion', 'generatedAt', 'appName']);
const SECTION_ORDER = [
    'stats',
    'settings',
    'budget',
    'ui',
    'quests',
    'habits',
    'calories',
    'calorieHistory',
    'calorieSavedFoods',
    'calorieRecentFoods',
    'coinHistory',
    'groceryList',
    'priceDatabase'
];

const SECTION_TYPES = {
    stats: 'scalar',
    settings: 'scalar',
    budget: 'scalar',
    ui: 'scalar',
    quests: 'json-array',
    habits: 'json-array',
    calories: 'scalar',
    calorieHistory: 'json-array',
    calorieSavedFoods: 'json-array',
    calorieRecentFoods: 'json-array',
    coinHistory: 'json-array',
    groceryList: 'json-array',
    priceDatabase: 'json-object'
};

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
        'preset100FoodId',
        'preset250FoodId',
        'preset400FoodId',
        'preset550FoodId'
    ])
};

const isCommentLine = (line) => {
    const trimmed = line.trim();
    return trimmed.startsWith('#') || trimmed.startsWith('//');
};

const parseScalarValue = (value, label) => {
    try {
        return JSON.parse(value);
    } catch {
        throw new Error(`Invalid value for ${label}. Use JSON literals like numbers, "strings", true, false, or null.`);
    }
};

const parseScalarSection = (sectionName, lines) => {
    const allowedKeys = ALLOWED_SCALAR_KEYS[sectionName];
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

        if (!allowedKeys?.has(key)) {
            throw new Error(`Unknown key "${key}" in [${sectionName}].`);
        }

        values[key] = parseScalarValue(rawValue, `${sectionName}.${key}`);
    });

    return values;
};

const parseJsonSection = (sectionName, lines) => {
    const jsonText = lines
        .filter((line) => {
            const trimmed = line.trim();
            return trimmed && !isCommentLine(trimmed);
        })
        .join('\n')
        .trim();

    if (!jsonText) {
        throw new Error(`Section [${sectionName}] is empty.`);
    }

    try {
        const parsed = JSON.parse(jsonText);
        const expectedType = SECTION_TYPES[sectionName];

        if (expectedType === 'json-array' && !Array.isArray(parsed)) {
            throw new Error(`Section [${sectionName}] must be a JSON array.`);
        }

        if (expectedType === 'json-object' && (Array.isArray(parsed) || parsed === null || typeof parsed !== 'object')) {
            throw new Error(`Section [${sectionName}] must be a JSON object.`);
        }

        return parsed;
    } catch (error) {
        if (error instanceof Error && error.message.startsWith('Section [')) {
            throw error;
        }

        throw new Error(`Invalid JSON in [${sectionName}]: ${error.message}`);
    }
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

    header[key] = parseScalarValue(rawValue, key);
};

const finalizeSection = (sectionName, lines, sections) => {
    if (!sectionName) return;

    if (!SECTION_TYPES[sectionName]) {
        throw new Error(`Unknown section [${sectionName}].`);
    }

    if (sectionName in sections) {
        throw new Error(`Duplicate section [${sectionName}].`);
    }

    sections[sectionName] = SECTION_TYPES[sectionName] === 'scalar'
        ? parseScalarSection(sectionName, lines)
        : parseJsonSection(sectionName, lines);
};

const getRequiredSectionsForVersion = (formatVersion) => {
    if (Number(formatVersion) < 2) {
        return SECTION_ORDER.filter((sectionName) => !['calorieSavedFoods', 'calorieRecentFoods'].includes(sectionName));
    }

    return SECTION_ORDER;
};

const validateSectionPresence = (sections, formatVersion) => {
    getRequiredSectionsForVersion(formatVersion).forEach((sectionName) => {
        if (!(sectionName in sections)) {
            throw new Error(`Missing required section [${sectionName}].`);
        }
    });
};

const serializeScalarValue = (value) => JSON.stringify(value ?? null);

const renderScalarSection = (name, entries) => {
    const lines = Object.entries(entries).map(([key, value]) => `${key}: ${serializeScalarValue(value)}`);
    return [`[${name}]`, ...lines].join('\n');
};

const renderJsonSection = (name, value) => {
    return [`[${name}]`, JSON.stringify(value, null, 2)].join('\n');
};

export const readProtocolLookaheadDays = () => {
    return Math.max(
        1,
        Number(safeGet(PROTOCOL_LOOKAHEAD_STORAGE_KEY, DEFAULT_PROTOCOL_LOOKAHEAD_DAYS)) || DEFAULT_PROTOCOL_LOOKAHEAD_DAYS
    );
};

export const writeProtocolLookaheadDays = (value) => {
    safeSet(
        PROTOCOL_LOOKAHEAD_STORAGE_KEY,
        Math.max(1, Number(value) || DEFAULT_PROTOCOL_LOOKAHEAD_DAYS)
    );
};

export const createPortableSnapshot = ({
    stats,
    settings,
    quests,
    habits,
    calories,
    coinHistory,
    budget,
    ui
}) => ({
    formatVersion: PORTABLE_FORMAT_VERSION,
    generatedAt: new Date().toISOString(),
    appName: PORTABLE_APP_NAME,
    stats,
    settings,
    quests,
    habits,
    calories,
    coinHistory,
    budget,
    ui
});

export const formatPortableSnapshot = (snapshot) => {
    const sections = [
        '# LifeQuest Transfer',
        '# Scalar sections use key: value. Collection sections use JSON.',
        `formatVersion: ${serializeScalarValue(snapshot.formatVersion)}`,
        `generatedAt: ${serializeScalarValue(snapshot.generatedAt)}`,
        `appName: ${serializeScalarValue(snapshot.appName || PORTABLE_APP_NAME)}`,
        '',
        renderScalarSection('stats', {
            level: snapshot.stats.level,
            xp: snapshot.stats.xp,
            maxXp: snapshot.stats.maxXp,
            hp: snapshot.stats.hp,
            maxHp: snapshot.stats.maxHp,
            gold: snapshot.stats.gold,
            lastLoginDate: snapshot.stats.lastLoginDate ?? null
        }),
        '',
        renderScalarSection('settings', {
            protocolReward: snapshot.settings.protocolReward,
            questRewardEasy: snapshot.settings.questRewards.easy,
            questRewardMedium: snapshot.settings.questRewards.medium,
            questRewardHard: snapshot.settings.questRewards.hard,
            questRewardLegendary: snapshot.settings.questRewards.legendary
        }),
        '',
        renderScalarSection('budget', {
            totalMonthlyBudget: snapshot.budget.totalMonthlyBudget,
            groceryAllocation: snapshot.budget.groceryAllocation,
            earnedRewards: snapshot.budget.earnedRewards,
            groceryPeriod: snapshot.budget.groceryPeriod,
            stipendAmount: snapshot.budget.stipendAmount,
            stipendPeriod: snapshot.budget.stipendPeriod,
            stipendPaidThrough: snapshot.budget.stipendPaidThrough ?? null,
            goldToUsdRatio: snapshot.budget.goldToUsdRatio
        }),
        '',
        renderScalarSection('ui', {
            protocolLookaheadDays: snapshot.ui.protocolLookaheadDays
        }),
        '',
        renderJsonSection('quests', snapshot.quests),
        '',
        renderJsonSection('habits', snapshot.habits),
        '',
        renderScalarSection('calories', {
            current: snapshot.calories.current,
            target: snapshot.calories.target,
            passiveCheckpointDate: snapshot.calories.passiveCheckpointDate ?? null,
            passiveCheckpoints: snapshot.calories.passiveCheckpoints || [],
            preset100FoodId: snapshot.calories.preset100FoodId ?? null,
            preset250FoodId: snapshot.calories.preset250FoodId ?? null,
            preset400FoodId: snapshot.calories.preset400FoodId ?? null,
            preset550FoodId: snapshot.calories.preset550FoodId ?? null
        }),
        '',
        renderJsonSection('calorieHistory', snapshot.calories.history || []),
        '',
        renderJsonSection('calorieSavedFoods', snapshot.calories.savedFoods || []),
        '',
        renderJsonSection('calorieRecentFoods', snapshot.calories.recentFoodIds || []),
        '',
        renderJsonSection('coinHistory', snapshot.coinHistory),
        '',
        renderJsonSection('groceryList', snapshot.budget.groceryList),
        '',
        renderJsonSection('priceDatabase', snapshot.budget.priceDatabase)
    ];

    return sections.join('\n');
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

    lines.forEach((line) => {
        const trimmed = line.trim();

        if (/^\[[A-Za-z][A-Za-z0-9]*\]$/.test(trimmed)) {
            finalizeSection(currentSection, sectionLines, sections);
            currentSection = trimmed.slice(1, -1);
            sectionLines = [];
            return;
        }

        if (!currentSection) {
            if (!trimmed || isCommentLine(trimmed)) return;
            parseHeaderLine(header, trimmed);
            return;
        }

        sectionLines.push(line);
    });

    finalizeSection(currentSection, sectionLines, sections);

    const formatVersion = Number(header.formatVersion);

    if (![1, PORTABLE_FORMAT_VERSION].includes(formatVersion)) {
        throw new Error(`Unsupported formatVersion "${header.formatVersion}". Expected 1 or ${PORTABLE_FORMAT_VERSION}.`);
    }

    if (!header.generatedAt) {
        throw new Error('Missing required metadata key "generatedAt".');
    }

    validateSectionPresence(sections, formatVersion);

    return {
        formatVersion,
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
        quests: sections.quests,
        habits: sections.habits,
        calories: {
            current: sections.calories.current,
            target: sections.calories.target,
            passiveCheckpointDate: sections.calories.passiveCheckpointDate ?? null,
            passiveCheckpoints: sections.calories.passiveCheckpoints || [],
            preset100FoodId: sections.calories.preset100FoodId ?? null,
            preset250FoodId: sections.calories.preset250FoodId ?? null,
            preset400FoodId: sections.calories.preset400FoodId ?? null,
            preset550FoodId: sections.calories.preset550FoodId ?? null,
            history: sections.calorieHistory,
            savedFoods: sections.calorieSavedFoods || [],
            recentFoodIds: sections.calorieRecentFoods || []
        },
        coinHistory: sections.coinHistory,
        budget: {
            totalMonthlyBudget: sections.budget.totalMonthlyBudget,
            groceryAllocation: sections.budget.groceryAllocation,
            earnedRewards: sections.budget.earnedRewards,
            groceryPeriod: sections.budget.groceryPeriod,
            stipendAmount: sections.budget.stipendAmount,
            stipendPeriod: sections.budget.stipendPeriod,
            stipendPaidThrough: sections.budget.stipendPaidThrough,
            goldToUsdRatio: sections.budget.goldToUsdRatio,
            groceryList: sections.groceryList,
            priceDatabase: sections.priceDatabase
        },
        ui: {
            protocolLookaheadDays: sections.ui.protocolLookaheadDays
        }
    };
};

export const summarizePortableSnapshot = (snapshot) => ({
    quests: Array.isArray(snapshot.quests) ? snapshot.quests.length : 0,
    habits: Array.isArray(snapshot.habits) ? snapshot.habits.length : 0,
    coinHistory: Array.isArray(snapshot.coinHistory) ? snapshot.coinHistory.length : 0,
    groceryList: Array.isArray(snapshot.budget?.groceryList) ? snapshot.budget.groceryList.length : 0,
    priceDatabase: snapshot.budget?.priceDatabase ? Object.keys(snapshot.budget.priceDatabase).length : 0,
    calorieHistory: Array.isArray(snapshot.calories?.history) ? snapshot.calories.history.length : 0
});

export const storePortableImportBackup = (snapshot) => {
    const key = `${PORTABLE_BACKUP_PREFIX}_${Date.now()}`;
    safeSet(key, {
        createdAt: new Date().toISOString(),
        snapshot
    });
    return key;
};
