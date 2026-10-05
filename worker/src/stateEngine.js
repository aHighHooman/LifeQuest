import {
    completeQuest as completeQuestTransaction,
    undoQuest as undoQuestTransaction,
    completeProtocol as completeProtocolTransaction,
    createQuest as createQuestTransaction,
    discardQuest as discardQuestTransaction,
    restoreQuest as restoreQuestTransaction,
    setQuestFocus,
    createProtocol as createProtocolTransaction,
    setProtocolActive,
    skipProtocol as skipProtocolTransaction,
    updateProtocolDetails,
    updateQuestDetails,
    changeCoins,
    purchaseCalories,
    refundCalories
} from '../../src/domain/transactions.js';
import {
    createCalorieEntry,
    createSavedFood,
    getEditableCalorieDateKeys,
    normalizeCalorieNumber,
    normalizeSignedCalorieNumber
} from '../../src/domain/calories.js';
import { DEFAULT_QUEST_GOLD, DEFAULT_PROTOCOL_REWARD } from '../../src/domain/rewards.js';
import { getDateKey } from './date.js';
import { HttpError, assertHttp } from './errors.js';
import {
    CURRENT_CURRENCY_UNIT_VERSION,
    CURRENT_SNAPSHOT_FORMAT_VERSION,
    normalizeLifeQuestSnapshot
} from './snapshotFormat.js';

const DIFFICULTIES = new Set(Object.keys(DEFAULT_QUEST_GOLD));
const FREQUENCIES = new Set(['daily', 'weekly', 'monthly', 'interval']);
const cleanText = (value) => `${value ?? ''}`.trim();
const makeId = (prefix) => `${prefix}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;

const cloneSnapshot = (snapshot) => normalizeLifeQuestSnapshot(snapshot);

const ensureShape = (snapshot) => {
    snapshot.stats = {
        level: 1,
        xp: 0,
        maxXp: 100,
        gold: 0,
        lastLoginDate: null,
        ...(snapshot.stats || {})
    };
    snapshot.settings = {
        protocolReward: DEFAULT_PROTOCOL_REWARD,
        questRewards: { ...DEFAULT_QUEST_GOLD },
        ...(snapshot.settings || {})
    };
    snapshot.settings.questRewards = {
        ...DEFAULT_QUEST_GOLD,
        ...(snapshot.settings.questRewards || {})
    };
    snapshot.quests = Array.isArray(snapshot.quests) ? snapshot.quests : [];
    snapshot.habits = Array.isArray(snapshot.habits) ? snapshot.habits : [];
    snapshot.coinHistory = Array.isArray(snapshot.coinHistory) ? snapshot.coinHistory : [];
    snapshot.calories = { target: 2000, ...(snapshot.calories || {}) };
    ['history', 'savedFoods', 'recentFoodIds'].forEach((key) => {
        if (!Array.isArray(snapshot.calories[key])) snapshot.calories[key] = [];
    });
    snapshot.budget = {
        earnedRewards: 0,
        goldToUsdRatio: 1,
        ...(snapshot.budget || {})
    };
    snapshot.formatVersion = CURRENT_SNAPSHOT_FORMAT_VERSION;
    snapshot.currencyUnitVersion = CURRENT_CURRENCY_UNIT_VERSION;
    return snapshot;
};

const transactionEvent = (now, todayKey = getDateKey(now), prefix = 'coin') => ({
    id: makeId(prefix), date: now.toISOString(), todayKey
});

const findQuest = (snapshot, id) => {
    const quest = snapshot.quests.find((entry) => entry.id === id);
    if (!quest) throw new HttpError(404, `Quest "${id}" was not found.`, 'quest_not_found');
    return quest;
};

const findProtocol = (snapshot, id) => {
    const protocol = snapshot.habits.find((entry) => entry.id === id);
    if (!protocol) throw new HttpError(404, `Protocol "${id}" was not found.`, 'protocol_not_found');
    return protocol;
};

export const prepareSnapshot = (snapshot) => ensureShape(cloneSnapshot(snapshot));

export const createQuest = (snapshot, input, now = new Date(), todayKey = getDateKey(now)) => {
    const requestId = cleanText(input.requestId);
    if (requestId) {
        const existing = snapshot.quests.find((quest) => quest.actionRequestId === requestId);
        if (existing) return existing;
    }
    const title = cleanText(input.title);
    assertHttp(title, 400, 'Quest title is required.', 'invalid_quest');
    const difficulty = cleanText(input.difficulty || 'easy').toLowerCase();
    assertHttp(DIFFICULTIES.has(difficulty), 400, 'Quest difficulty must be easy, medium, hard, or legendary.', 'invalid_quest');
    Object.assign(snapshot, createQuestTransaction(snapshot, {
        ...input, title, difficulty, dueDate: cleanText(input.dueDate) || null,
        missionBrief: cleanText(input.missionBrief)
    }, { ...transactionEvent(now, todayKey, 'quest'), requestId }));
    return snapshot.quests[0];
};

export const completeQuest = (snapshot, id, now = new Date(), todayKey = getDateKey(now)) => {
    const quest = findQuest(snapshot, id);
    if (quest.completed) return { quest, changed: false };
    assertHttp(!quest.discarded, 409, 'Restore the quest before completing it.', 'quest_discarded');
    Object.assign(snapshot, completeQuestTransaction(snapshot, id, transactionEvent(now, todayKey)));
    return { quest: findQuest(snapshot, id), changed: true };
};

export const undoQuest = (snapshot, id, now = new Date(), todayKey = getDateKey(now)) => {
    const quest = findQuest(snapshot, id);
    if (!quest.completed) return { quest, changed: false };
    Object.assign(snapshot, undoQuestTransaction(snapshot, id, transactionEvent(now, todayKey)));
    return { quest: findQuest(snapshot, id), changed: true };
};

export const discardQuest = (snapshot, id, now = new Date(), todayKey = getDateKey(now)) => {
    const quest = findQuest(snapshot, id);
    if (quest.discarded) return { quest, changed: false };
    Object.assign(snapshot, discardQuestTransaction(snapshot, id, transactionEvent(now, todayKey)));
    return { quest: findQuest(snapshot, id), changed: true };
};

export const restoreQuest = (snapshot, id) => {
    const quest = findQuest(snapshot, id);
    if (!quest.discarded) return { quest, changed: false };
    Object.assign(snapshot, restoreQuestTransaction(snapshot, id));
    return { quest: findQuest(snapshot, id), changed: true };
};

export const setQuestToday = (snapshot, id, selected) => {
    const quest = findQuest(snapshot, id);
    assertHttp(!quest.discarded, 409, 'Restore the quest before selecting it for today.', 'quest_discarded');
    if (Boolean(quest.isFocusedToday) === selected) return { quest, changed: false };
    Object.assign(snapshot, setQuestFocus(snapshot, id, selected));
    return { quest: findQuest(snapshot, id), changed: true };
};

const QUEST_DETAIL_FIELDS = ['title', 'missionBrief', 'dueDate', 'difficulty', 'reward'];
const PROTOCOL_DETAIL_FIELDS = ['title', 'frequency', 'frequencyParam', 'completionReward', 'passiveReward'];

const pickChanges = (input, fields) => Object.fromEntries(
    fields.filter((key) => input[key] !== undefined && input[key] !== null).map((key) => [key, input[key]])
);

export const updateQuest = (snapshot, id, input) => {
    const quest = findQuest(snapshot, id);
    const changes = pickChanges(input, QUEST_DETAIL_FIELDS);
    assertHttp(Object.keys(changes).length, 400, 'Provide at least one quest detail to change.', 'invalid_quest');
    if (changes.title !== undefined) assertHttp(cleanText(changes.title), 400, 'Quest title cannot be empty.', 'invalid_quest');
    if (changes.difficulty !== undefined) {
        changes.difficulty = cleanText(changes.difficulty).toLowerCase();
        assertHttp(DIFFICULTIES.has(changes.difficulty), 400, 'Quest difficulty must be easy, medium, hard, or legendary.', 'invalid_quest');
    }
    if (changes.dueDate !== undefined) changes.dueDate = cleanText(changes.dueDate) || null;
    if (changes.missionBrief !== undefined) changes.missionBrief = cleanText(changes.missionBrief);
    assertHttp(
        !quest.completed || (changes.difficulty === undefined && changes.reward === undefined),
        409,
        'Undo the quest before changing its difficulty or reward; its completion already paid out.',
        'quest_completed'
    );
    const next = updateQuestDetails(snapshot, id, changes);
    if (next === snapshot) return { quest, changed: false };
    Object.assign(snapshot, next);
    return { quest: findQuest(snapshot, id), changed: true };
};

export const createProtocol = (snapshot, input, now = new Date(), todayKey = getDateKey(now)) => {
    const requestId = cleanText(input.requestId);
    if (requestId) {
        const existing = snapshot.habits.find((protocol) => protocol.actionRequestId === requestId);
        if (existing) return existing;
    }
    const title = cleanText(input.title);
    assertHttp(title, 400, 'Protocol title is required.', 'invalid_protocol');
    const frequency = cleanText(input.frequency || 'daily').toLowerCase();
    assertHttp(FREQUENCIES.has(frequency), 400, 'Protocol frequency must be daily, weekly, monthly, or interval.', 'invalid_protocol');
    Object.assign(snapshot, createProtocolTransaction(snapshot, { ...input, title, frequency }, {
        ...transactionEvent(now, todayKey, 'habit'), requestId
    }));
    return snapshot.habits[0];
};

export const activateProtocol = (snapshot, id, todayKey, now = new Date()) => {
    const protocol = findProtocol(snapshot, id);
    if (protocol.isActive !== false) return { protocol, changed: false };
    Object.assign(snapshot, setProtocolActive(snapshot, id, true, transactionEvent(now, todayKey)));
    return { protocol: findProtocol(snapshot, id), changed: true };
};

export const deactivateProtocol = (snapshot, id, todayKey, now = new Date()) => {
    const protocol = findProtocol(snapshot, id);
    if (protocol.isActive === false) return { protocol, changed: false };
    Object.assign(snapshot, setProtocolActive(snapshot, id, false, transactionEvent(now, todayKey)));
    return { protocol: findProtocol(snapshot, id), changed: true };
};

export const completeProtocol = (snapshot, id, todayKey, now = new Date(), requestId = '') => {
    const protocol = findProtocol(snapshot, id);
    const next = completeProtocolTransaction(snapshot, id, {
        ...transactionEvent(now, todayKey), requestId: cleanText(requestId)
    });
    if (next === snapshot) return { protocol, changed: false };
    Object.assign(snapshot, next);
    return { protocol: findProtocol(snapshot, id), changed: true };
};

export const skipProtocol = (snapshot, id, todayKey, now = new Date()) => {
    const protocol = findProtocol(snapshot, id);
    Object.assign(snapshot, skipProtocolTransaction(snapshot, id, transactionEvent(now, todayKey)));
    return { protocol: findProtocol(snapshot, id), changed: true, previous: protocol };
};

export const updateProtocol = (snapshot, id, input, todayKey, now = new Date()) => {
    const protocol = findProtocol(snapshot, id);
    const changes = pickChanges(input, PROTOCOL_DETAIL_FIELDS);
    assertHttp(Object.keys(changes).length, 400, 'Provide at least one protocol detail to change.', 'invalid_protocol');
    if (changes.title !== undefined) assertHttp(cleanText(changes.title), 400, 'Protocol title cannot be empty.', 'invalid_protocol');
    if (changes.frequency !== undefined) {
        changes.frequency = cleanText(changes.frequency).toLowerCase();
        assertHttp(FREQUENCIES.has(changes.frequency), 400, 'Protocol frequency must be daily, weekly, monthly, or interval.', 'invalid_protocol');
    }
    assertHttp(
        changes.frequencyParam === undefined || (changes.frequency ?? protocol.frequency) === 'interval',
        400,
        'frequencyParam only applies to interval protocols; set frequency to interval as well.',
        'invalid_protocol'
    );
    const next = updateProtocolDetails(snapshot, id, changes, transactionEvent(now, todayKey));
    if (next === snapshot) return { protocol, changed: false };
    Object.assign(snapshot, next);
    return { protocol: findProtocol(snapshot, id), changed: true };
};

// A requestId becomes part of the record ID, so a retried call finds the
// record it already made instead of logging or charging twice.
const requestRecordId = (prefix, requestId) => (
    requestId ? `${prefix}-req-${requestId}` : makeId(prefix)
);

export const logCalories = (snapshot, input, now = new Date(), todayKey = getDateKey(now)) => {
    const requestId = cleanText(input.requestId);
    const id = requestRecordId('cal', requestId);
    const existing = snapshot.calories.history.find((entry) => entry.id === id);
    if (existing) return { entry: existing, changed: false };

    const foodId = cleanText(input.foodId);
    const food = foodId ? snapshot.calories.savedFoods.find((entry) => entry.id === foodId) : null;
    if (foodId && !food) throw new HttpError(404, `Saved food "${foodId}" was not found.`, 'food_not_found');
    const calories = normalizeSignedCalorieNumber(input.calories ?? food?.calories);
    assertHttp(calories !== 0, 400, 'Calories must be a non-zero whole number; use a negative number for exercise.', 'invalid_calories');
    const label = cleanText(input.label) || food?.name || '';
    const coinCost = calories > 0 ? (input.coinCost ?? food?.coinCost ?? 0) : 0;
    const timestamp = now.toISOString();
    const savedFood = !food && input.saveAsFood && calories > 0
        ? createSavedFood({ id: makeId('food'), name: label, calories, coinCost, createdAt: timestamp })
        : null;
    const entry = createCalorieEntry({
        id,
        timestamp,
        dateKey: todayKey,
        calories,
        label,
        source: food || savedFood ? 'saved-food' : 'manual',
        foodId: food?.id || savedFood?.id || null,
        coinCost
    });
    Object.assign(snapshot, purchaseCalories(snapshot, entry, transactionEvent(now, todayKey), savedFood));
    return { entry: snapshot.calories.history.find((current) => current.id === id), changed: true };
};

export const removeCalorieEntry = (snapshot, id, now = new Date(), todayKey = getDateKey(now)) => {
    const entry = snapshot.calories.history.find((current) => current.id === id);
    if (!entry) throw new HttpError(404, `Calorie entry "${id}" was not found.`, 'calorie_entry_not_found');
    const editable = getEditableCalorieDateKeys(todayKey);
    assertHttp(editable.has(entry.dateKey), 409, 'Only entries from today or yesterday can be removed.', 'calorie_entry_locked');
    Object.assign(snapshot, refundCalories(snapshot, id, editable, transactionEvent(now, todayKey)));
    return { entry, changed: true };
};

export const setCalorieTarget = (snapshot, target) => {
    const safeTarget = normalizeCalorieNumber(target);
    assertHttp(safeTarget >= 1, 400, 'The calorie target must be at least 1.', 'invalid_calories');
    const changed = Number(snapshot.calories.target) !== safeTarget;
    snapshot.calories = { ...snapshot.calories, target: safeTarget };
    return { changed };
};

export const recordCoins = (snapshot, input, now = new Date(), todayKey = getDateKey(now)) => {
    const requestId = cleanText(input.requestId);
    const id = requestRecordId('coin', requestId);
    const existing = snapshot.coinHistory.find((entry) => entry.id === id);
    if (existing) return { transaction: existing, changed: false };
    const description = cleanText(input.description);
    assertHttp(description, 400, 'A description is required.', 'invalid_transaction');
    const amount = Number(input.amount);
    assertHttp(Number.isFinite(amount) && amount > 0, 400, 'The amount must be greater than zero.', 'invalid_transaction');
    const signed = input.type === 'earn' ? amount : -amount;
    Object.assign(snapshot, changeCoins(snapshot, signed, { id, date: now.toISOString(), todayKey }, description));
    const transaction = snapshot.coinHistory.find((entry) => entry.id === id);
    assertHttp(transaction, 400, 'The amount is too small to record.', 'invalid_transaction');
    return { transaction, changed: true };
};

export const touchSnapshot = (snapshot, now = new Date()) => {
    snapshot.generatedAt = now.toISOString();
    snapshot.appName = snapshot.appName || 'LifeQuest';
    snapshot.formatVersion = CURRENT_SNAPSHOT_FORMAT_VERSION;
    snapshot.currencyUnitVersion = CURRENT_CURRENCY_UNIT_VERSION;
    return snapshot;
};

export const getRequestClock = (env, now = new Date()) => ({
    now,
    todayKey: getDateKey(now, env.LIFEQUEST_TIME_ZONE || 'America/Vancouver')
});
