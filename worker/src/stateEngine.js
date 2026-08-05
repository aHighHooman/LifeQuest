import {
    getDateKey,
    getPausedPassivePaidThrough,
    getProtocolCycleState
} from './date.js';
import { HttpError, assertHttp } from './errors.js';
import {
    CURRENT_CURRENCY_UNIT_VERSION,
    CURRENT_SNAPSHOT_FORMAT_VERSION,
    normalizeCurrencyAmount,
    normalizeNonNegativeCurrencyAmount,
    normalizeLifeQuestSnapshot
} from './snapshotFormat.js';

const DIFFICULTIES = new Set(['easy', 'medium', 'hard', 'legendary']);
const FREQUENCIES = new Set(['daily', 'weekly', 'monthly', 'interval']);
const DEFAULT_QUEST_XP = Object.freeze({
    easy: 10,
    medium: 25,
    hard: 60,
    legendary: 150
});

const numberOr = (value, fallback = 0) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
};

const nonNegativeNumber = (value, fallback = 0) => Math.max(0, numberOr(value, fallback));
const nonNegativeCurrency = (value, fallback = 0) => normalizeNonNegativeCurrencyAmount(value, fallback);
const positiveInteger = (value, fallback = 1) => Math.max(1, Math.round(numberOr(value, fallback)));
const positiveNumber = (value, fallback = 1) => Math.max(0.0001, numberOr(value, fallback));
const cleanText = (value) => `${value ?? ''}`.trim();
const makeId = (prefix) => `${prefix}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;

const cloneSnapshot = (snapshot) => normalizeLifeQuestSnapshot(snapshot);

const ensureShape = (snapshot) => {
    snapshot.stats = {
        level: 1,
        xp: 0,
        maxXp: 100,
        hp: 0,
        maxHp: 100,
        gold: 0,
        lastLoginDate: null,
        ...(snapshot.stats || {})
    };
    snapshot.settings = {
        protocolReward: 0.1,
        questRewards: { easy: 0.5, medium: 1.5, hard: 4, legendary: 10 },
        ...(snapshot.settings || {})
    };
    snapshot.settings.questRewards = {
        easy: 0.5,
        medium: 1.5,
        hard: 4,
        legendary: 10,
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

const addXp = (snapshot, amount) => {
    let xp = numberOr(snapshot.stats.xp) + numberOr(amount);
    let level = positiveInteger(snapshot.stats.level);
    let maxXp = positiveInteger(snapshot.stats.maxXp, 100);
    let hp = numberOr(snapshot.stats.hp);
    const maxHp = positiveInteger(snapshot.stats.maxHp, 100);

    while (xp >= maxXp) {
        level += 1;
        xp -= maxXp;
        maxXp = Math.floor(maxXp * 1.2);
        hp = maxHp;
    }
    while (xp < 0 && level > 1) {
        level -= 1;
        maxXp = Math.ceil(maxXp / 1.2);
        xp += maxXp;
    }

    snapshot.stats = { ...snapshot.stats, xp, level, maxXp, hp };
};

const addGold = (snapshot, amount, description, occurredAt, affectsEarnedRewards = true) => {
    const numericAmount = normalizeCurrencyAmount(amount);
    snapshot.stats.gold = normalizeCurrencyAmount(numberOr(snapshot.stats.gold) + numericAmount);
    if (numericAmount !== 0) {
        snapshot.coinHistory.push({
            id: makeId('coin'),
            amount: numericAmount,
            description,
            type: numericAmount > 0 ? 'earned' : 'spent',
            date: occurredAt
        });
    }
    if (affectsEarnedRewards) {
        const ratio = positiveNumber(snapshot.budget.goldToUsdRatio, 1);
        snapshot.budget.earnedRewards = normalizeCurrencyAmount(
            numberOr(snapshot.budget.earnedRewards) + (numericAmount / ratio)
        );
    }
};

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

const updateQuest = (snapshot, id, updater) => {
    const index = snapshot.quests.findIndex((entry) => entry.id === id);
    if (index === -1) throw new HttpError(404, `Quest "${id}" was not found.`, 'quest_not_found');
    snapshot.quests[index] = updater(snapshot.quests[index]);
    return snapshot.quests[index];
};

const updateProtocol = (snapshot, id, updater) => {
    const index = snapshot.habits.findIndex((entry) => entry.id === id);
    if (index === -1) throw new HttpError(404, `Protocol "${id}" was not found.`, 'protocol_not_found');
    snapshot.habits[index] = updater(snapshot.habits[index]);
    return snapshot.habits[index];
};

export const prepareSnapshot = (snapshot) => ensureShape(cloneSnapshot(snapshot));

export const createQuest = (snapshot, input, now = new Date()) => {
    const requestId = cleanText(input.requestId);
    if (requestId) {
        const existing = snapshot.quests.find((quest) => quest.actionRequestId === requestId);
        if (existing) return existing;
    }
    const title = cleanText(input.title);
    assertHttp(title, 400, 'Quest title is required.', 'invalid_quest');
    const difficulty = cleanText(input.difficulty || 'easy').toLowerCase();
    assertHttp(DIFFICULTIES.has(difficulty), 400, 'Quest difficulty must be easy, medium, hard, or legendary.', 'invalid_quest');
    const hasCustomReward = input.reward && (
        input.reward.xp !== undefined || input.reward.gold !== undefined
    );
    const reward = hasCustomReward
        ? {
            xp: nonNegativeNumber(input.reward.xp),
            gold: nonNegativeCurrency(input.reward.gold)
        }
        : {
            xp: DEFAULT_QUEST_XP[difficulty],
            gold: nonNegativeCurrency(snapshot.settings.questRewards[difficulty])
        };
    const quest = {
        id: makeId('quest'),
        title,
        difficulty,
        dueDate: cleanText(input.dueDate) || null,
        missionBrief: cleanText(input.missionBrief),
        completed: false,
        discarded: false,
        reward,
        isCustomReward: Boolean(hasCustomReward),
        isFocusedToday: Boolean(input.selectedForToday),
        ...(requestId ? { actionRequestId: requestId } : {}),
        createdAt: now.toISOString()
    };
    snapshot.quests.unshift(quest);
    return quest;
};

export const completeQuest = (snapshot, id, now = new Date()) => {
    const quest = findQuest(snapshot, id);
    if (quest.completed) return { quest, changed: false };
    assertHttp(!quest.discarded, 409, 'Restore the quest before completing it.', 'quest_discarded');

    const difficulty = DIFFICULTIES.has(quest.difficulty) ? quest.difficulty : 'easy';
    const xp = nonNegativeNumber(quest.reward?.xp);
    const gold = quest.isCustomReward
        ? nonNegativeCurrency(quest.reward?.gold)
        : nonNegativeCurrency(snapshot.settings.questRewards[difficulty], quest.reward?.gold);
    addXp(snapshot, xp);
    addGold(snapshot, gold, 'Earned from Quest', now.toISOString());
    const updated = updateQuest(snapshot, id, (current) => ({
        ...current,
        completed: true,
        completedAt: now.toISOString(),
        completedReward: { xp, gold }
    }));
    return { quest: updated, changed: true };
};

export const undoQuest = (snapshot, id, now = new Date()) => {
    const quest = findQuest(snapshot, id);
    if (!quest.completed) return { quest, changed: false };
    const difficulty = DIFFICULTIES.has(quest.difficulty) ? quest.difficulty : 'easy';
    const xp = nonNegativeNumber(quest.completedReward?.xp, quest.reward?.xp);
    const gold = quest.completedReward
        ? nonNegativeCurrency(quest.completedReward.gold)
        : quest.isCustomReward
            ? nonNegativeCurrency(quest.reward?.gold)
            : nonNegativeCurrency(snapshot.settings.questRewards[difficulty], quest.reward?.gold);
    addXp(snapshot, -xp);
    addGold(snapshot, -gold, 'Reverted Quest Undo', now.toISOString());
    const updated = updateQuest(snapshot, id, (current) => ({
        ...current,
        completed: false,
        completedAt: null,
        completedReward: null
    }));
    return { quest: updated, changed: true };
};

export const discardQuest = (snapshot, id, now = new Date()) => {
    const quest = findQuest(snapshot, id);
    if (quest.discarded) return { quest, changed: false };
    const updated = updateQuest(snapshot, id, (current) => ({
        ...current,
        discarded: true,
        discardedAt: now.toISOString()
    }));
    return { quest: updated, changed: true };
};

export const restoreQuest = (snapshot, id) => {
    const quest = findQuest(snapshot, id);
    if (!quest.discarded) return { quest, changed: false };
    const updated = updateQuest(snapshot, id, (current) => ({
        ...current,
        discarded: false,
        discardedAt: null
    }));
    return { quest: updated, changed: true };
};

export const setQuestToday = (snapshot, id, selected) => {
    const quest = findQuest(snapshot, id);
    assertHttp(!quest.discarded, 409, 'Restore the quest before selecting it for today.', 'quest_discarded');
    if (Boolean(quest.isFocusedToday) === selected) return { quest, changed: false };
    const updated = updateQuest(snapshot, id, (current) => ({
        ...current,
        isFocusedToday: selected
    }));
    return { quest: updated, changed: true };
};

export const createProtocol = (snapshot, input, now = new Date()) => {
    const requestId = cleanText(input.requestId);
    if (requestId) {
        const existing = snapshot.habits.find((protocol) => protocol.actionRequestId === requestId);
        if (existing) return existing;
    }
    const title = cleanText(input.title);
    assertHttp(title, 400, 'Protocol title is required.', 'invalid_protocol');
    const frequency = cleanText(input.frequency || 'daily').toLowerCase();
    assertHttp(FREQUENCIES.has(frequency), 400, 'Protocol frequency must be daily, weekly, monthly, or interval.', 'invalid_protocol');
    const protocol = {
        id: makeId('habit'),
        title,
        frequency,
        frequencyParam: frequency === 'interval' ? positiveInteger(input.frequencyParam) : 1,
        streak: 0,
        history: {},
        isActive: Boolean(input.active),
        completionReward: nonNegativeCurrency(input.completionReward, snapshot.settings.protocolReward),
        passiveReward: nonNegativeCurrency(input.passiveReward),
        passivePaidThrough: null,
        lastCycleResetDateKey: null,
        ...(requestId ? { actionRequestId: requestId } : {}),
        createdAt: now.toISOString()
    };
    snapshot.habits.unshift(protocol);
    return protocol;
};

export const activateProtocol = (snapshot, id) => {
    const protocol = findProtocol(snapshot, id);
    if (protocol.isActive !== false) return { protocol, changed: false };
    const updated = updateProtocol(snapshot, id, (current) => ({ ...current, isActive: true }));
    return { protocol: updated, changed: true };
};

export const deactivateProtocol = (snapshot, id, todayKey) => {
    const protocol = findProtocol(snapshot, id);
    if (protocol.isActive === false) return { protocol, changed: false };
    const updated = updateProtocol(snapshot, id, (current) => ({
        ...current,
        isActive: false,
        passivePaidThrough: getPausedPassivePaidThrough(current, todayKey)
    }));
    return { protocol: updated, changed: true };
};

export const completeProtocol = (snapshot, id, todayKey, now = new Date(), requestId = '') => {
    const protocol = findProtocol(snapshot, id);
    const normalizedRequestId = cleanText(requestId);
    if (normalizedRequestId && (protocol.actionReceipts || []).includes(normalizedRequestId)) {
        return { protocol, changed: false };
    }
    const cycle = getProtocolCycleState(protocol, todayKey);
    const reward = nonNegativeCurrency(protocol.completionReward, snapshot.settings.protocolReward);
    addXp(snapshot, 5);
    if (cycle.isDueToday && reward > 0) {
        addGold(snapshot, reward, `Protocol due bonus: ${protocol.title}`, now.toISOString());
    }
    const history = { ...(protocol.history || {}) };
    history[todayKey] = numberOr(history[todayKey]) + 1;
    const updated = updateProtocol(snapshot, id, (current) => ({
        ...current,
        streak: numberOr(current.streak) + 1,
        history,
        isActive: true,
        passivePaidThrough: todayKey,
        lastCycleResetDateKey: todayKey,
        completionReward: reward,
        passiveReward: nonNegativeCurrency(current.passiveReward),
        actionReceipts: normalizedRequestId
            ? [...(current.actionReceipts || []), normalizedRequestId].slice(-20)
            : (current.actionReceipts || [])
    }));
    return { protocol: updated, changed: true };
};

export const skipProtocol = (snapshot, id, todayKey) => {
    const protocol = findProtocol(snapshot, id);
    const updated = updateProtocol(snapshot, id, (current) => ({
        ...current,
        isActive: true,
        passivePaidThrough: todayKey,
        lastCycleResetDateKey: todayKey,
        completionReward: nonNegativeCurrency(current.completionReward, snapshot.settings.protocolReward),
        passiveReward: nonNegativeCurrency(current.passiveReward)
    }));
    return { protocol: updated, changed: true, previous: protocol };
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
