// The operations an assistant can perform on LifeQuest: each loads the cloud
// snapshot, applies shared domain rules, and saves under a revision guard.
import { HttpError, assertHttp } from './errors.js';
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
    prepareSnapshot,
    restoreQuest,
    setQuestToday,
    skipProtocol,
    touchSnapshot,
    undoQuest,
    updateProtocol,
    updateQuest
} from './stateEngine.js';
import {
    dashboardView,
    listProtocolView,
    listQuestView,
    protocolView,
    questView
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

const mutate = async (env, kind, apply) => {
    const { clock, loaded, snapshot } = await loadState(env);
    const result = apply(snapshot, clock);
    touchSnapshot(snapshot, clock.now);
    const metadata = await saveSnapshot(env, loaded, snapshot);
    return {
        ok: true,
        changed: result.changed !== false,
        [kind]: kind === 'quest'
            ? questView(result.quest, snapshot.settings)
            : protocolView(result.protocol, clock.todayKey),
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
