// The operations an assistant can perform on LifeQuest: each loads the cloud
// snapshot, applies shared domain rules, and saves under a revision guard.
import { HttpError, assertHttp } from './errors.js';
import { getDateKey } from './date.js';
import { loadSnapshot, saveSnapshot } from './snapshotStore.js';
import {
    activateProtocol,
    completeProtocol,
    completeQuest,
    createProtocol,
    createQuest,
    deactivateProtocol,
    discardQuest,
    getRequestClock,
    logCalories,
    prepareSnapshot,
    recordCoins,
    removeCalorieEntry,
    setCalorieTarget,
    restoreQuest,
    setQuestToday,
    skipProtocol,
    touchSnapshot,
    undoQuest,
    updateProtocol,
    updateQuest
} from './stateEngine.js';
import {
    calorieDayView,
    calorieEntryView,
    dashboardView,
    listLedgerView,
    listProtocolView,
    listQuestView,
    listSavedFoodView,
    protocolView,
    questView,
    transactionView
} from './views.js';

const QUEST_ACTIONS = {
    complete: (snapshot, id, clock) => completeQuest(snapshot, id, clock.now, clock.todayKey),
    undo: (snapshot, id, clock) => undoQuest(snapshot, id, clock.now, clock.todayKey),
    discard: (snapshot, id, clock) => discardQuest(snapshot, id, clock.now, clock.todayKey),
    restore: (snapshot, id) => restoreQuest(snapshot, id),
    'select-for-today': (snapshot, id) => setQuestToday(snapshot, id, true),
    'remove-from-today': (snapshot, id) => setQuestToday(snapshot, id, false)
};

const PROTOCOL_ACTIONS = {
    complete: (snapshot, id, clock, input) => completeProtocol(snapshot, id, clock.todayKey, clock.now, input.requestId),
    skip: (snapshot, id, clock) => skipProtocol(snapshot, id, clock.todayKey, clock.now),
    activate: (snapshot, id, clock) => activateProtocol(snapshot, id, clock.todayKey, clock.now),
    deactivate: (snapshot, id, clock) => deactivateProtocol(snapshot, id, clock.todayKey, clock.now)
};

export const QUEST_ACTION_NAMES = Object.keys(QUEST_ACTIONS);
export const PROTOCOL_ACTION_NAMES = Object.keys(PROTOCOL_ACTIONS);

const loadState = async (env) => {
    const clock = getRequestClock(env);
    const loaded = await loadSnapshot(env);
    return { clock, loaded, snapshot: prepareSnapshot(loaded.snapshot) };
};

const timeZone = (env) => env.LIFEQUEST_TIME_ZONE || 'America/Vancouver';

// How each kind of change describes the record it touched.
const RESULT_VIEWS = {
    quest: (result, snapshot) => ({ quest: questView(result.quest, snapshot.settings) }),
    protocol: (result, snapshot, clock) => ({ protocol: protocolView(result.protocol, clock.todayKey) }),
    calories: (result, snapshot, clock) => ({
        ...(result.entry ? { entry: calorieEntryView(result.entry) } : {}),
        today: calorieDayView(snapshot, clock.todayKey, clock.todayKey)
    }),
    transaction: (result, snapshot, clock, env) => ({
        transaction: transactionView(result.transaction, (date) => getDateKey(date, timeZone(env))),
        coinsOnHand: Number(snapshot.stats.gold || 0)
    })
};

const mutate = async (env, kind, apply) => {
    const { clock, loaded, snapshot } = await loadState(env);
    const result = apply(snapshot, clock);
    touchSnapshot(snapshot, clock.now);
    const metadata = await saveSnapshot(env, loaded, snapshot);
    return {
        ok: true,
        changed: result.changed !== false,
        ...RESULT_VIEWS[kind](result, snapshot, clock, env),
        dashboard: dashboardView(snapshot, clock.todayKey),
        revisionId: metadata.revisionId
    };
};

export const getToday = async (env) => {
    const { clock, snapshot } = await loadState(env);
    return { dashboard: dashboardView(snapshot, clock.todayKey) };
};

// `searchParams` only needs `get(name)`.
export const listQuests = async (env, searchParams) => {
    const { clock, snapshot } = await loadState(env);
    return listQuestView(snapshot, clock.todayKey, searchParams);
};

export const listProtocols = async (env, searchParams) => {
    const { clock, snapshot } = await loadState(env);
    return listProtocolView(snapshot, clock.todayKey, searchParams);
};

export const createQuestRecord = (env, input) => mutate(env, 'quest', (snapshot, clock) => ({
    quest: createQuest(snapshot, input, clock.now, clock.todayKey),
    changed: true
}));

export const createProtocolRecord = (env, input) => mutate(env, 'protocol', (snapshot, clock) => ({
    protocol: createProtocol(snapshot, input, clock.now, clock.todayKey),
    changed: true
}));

export const applyQuestAction = (env, id, action) => {
    const run = QUEST_ACTIONS[action];
    if (!run) throw new HttpError(404, 'Unknown quest action.', 'route_not_found');
    assertHttp(id, 400, 'A quest ID is required.', 'invalid_quest');
    return mutate(env, 'quest', (snapshot, clock) => run(snapshot, id, clock));
};

export const applyProtocolAction = (env, id, action, input = {}) => {
    const run = PROTOCOL_ACTIONS[action];
    if (!run) throw new HttpError(404, 'Unknown protocol action.', 'route_not_found');
    assertHttp(id, 400, 'A protocol ID is required.', 'invalid_protocol');
    return mutate(env, 'protocol', (snapshot, clock) => run(snapshot, id, clock, input));
};

export const updateQuestRecord = (env, id, input) => {
    assertHttp(id, 400, 'A quest ID is required.', 'invalid_quest');
    return mutate(env, 'quest', (snapshot) => updateQuest(snapshot, id, input));
};

export const updateProtocolRecord = (env, id, input) => {
    assertHttp(id, 400, 'A protocol ID is required.', 'invalid_protocol');
    return mutate(env, 'protocol', (snapshot, clock) => updateProtocol(snapshot, id, input, clock.todayKey, clock.now));
};

export const getCalories = async (env, date) => {
    const { clock, snapshot } = await loadState(env);
    return calorieDayView(snapshot, date || clock.todayKey, clock.todayKey);
};

export const listSavedFoods = async (env, searchParams) => {
    const { snapshot } = await loadState(env);
    return listSavedFoodView(snapshot, searchParams);
};

export const listLedger = async (env, searchParams) => {
    const { snapshot } = await loadState(env);
    return listLedgerView(snapshot, searchParams, (date) => getDateKey(date, timeZone(env)));
};

export const logCalorieEntry = (env, input) => mutate(env, 'calories', (snapshot, clock) => (
    logCalories(snapshot, input, clock.now, clock.todayKey)
));

export const removeCalorieRecord = (env, id) => mutate(env, 'calories', (snapshot, clock) => (
    removeCalorieEntry(snapshot, id, clock.now, clock.todayKey)
));

export const setCalorieGoal = (env, target) => mutate(env, 'calories', (snapshot) => setCalorieTarget(snapshot, target));

export const recordCoinTransaction = (env, input) => mutate(env, 'transaction', (snapshot, clock) => (
    recordCoins(snapshot, input, clock.now, clock.todayKey)
));
