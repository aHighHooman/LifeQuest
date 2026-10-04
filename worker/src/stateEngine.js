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
    updateQuestDetails
} from '../../src/domain/transactions.js';
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
