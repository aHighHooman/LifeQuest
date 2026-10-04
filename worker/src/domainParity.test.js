import { describe, expect, it } from 'vitest';
import * as domain from '../../src/domain/transactions.js';
import * as worker from './stateEngine.js';
import { HttpError } from './errors.js';
import { protocolView } from '../../src/domain/views.js';

const now = new Date('2026-10-02T01:00:00.000Z');
const todayKey = '2026-10-01';
const event = (requestId = '', day = todayKey) => ({
    id: 'browser-event', date: now.toISOString(), todayKey: day, requestId
});
const makePair = () => {
    const state = worker.prepareSnapshot({
        formatVersion: 4,
        currencyUnitVersion: 2,
        stats: { level: 1, xp: 95, maxXp: 100, hp: 50, maxHp: 100, gold: 10 },
        budget: { earnedRewards: 1.234567, goldToUsdRatio: 0.3 },
        quests: [], habits: [], coinHistory: []
    });
    return { browser: structuredClone(state), api: structuredClone(state) };
};
const withoutId = ({ id: _id, ...record }) => record;
// Creation and ledger IDs belong to each adapter. Compare the gameplay state,
// including receipts, timestamps, request IDs, and explicit calendar cursors.
const relevantState = (state) => ({
    stats: state.stats,
    settings: state.settings,
    quests: state.quests.map(withoutId),
    habits: state.habits.map(withoutId),
    budget: state.budget,
    coinHistory: state.coinHistory.map(withoutId)
});
const expectParity = (browser, api) => expect(relevantState(api)).toEqual(relevantState(browser));
const scheduledProtocol = () => ({
    id: 'protocol-1', title: 'Practice', frequency: 'interval', frequencyParam: 4,
    history: { '2026-09-28': 1 }, isActive: true,
    lastCycleResetDateKey: '2026-09-28', passivePaidThrough: '2026-09-29',
    completionReward: 0.3, passiveReward: 0.1
});

describe('browser domain and worker adapter parity', () => {
    it.each([
        [{ title: 'Default quest' }, { xp: 10, gold: 0.5 }],
        [{ title: 'Legendary quest', difficulty: 'legendary' }, { xp: 150, gold: 10 }],
        [{ title: 'Custom quest', difficulty: 'hard', reward: { xp: 9, gold: 1.23456 } }, { xp: 9, gold: 1.2346 }]
    ])('creates, replays, completes, and undoes quest %j equivalently', (payload, reward) => {
        let { browser, api } = makePair();
        const input = { ...payload, requestId: 'create-quest', selectedForToday: true };
        browser = domain.createQuest(browser, input, event(input.requestId));
        const created = worker.createQuest(api, input, now, todayKey);
        expect(created.reward).toEqual(reward);
        expectParity(browser, api);

        const beforeReplay = structuredClone(api);
        expect(domain.createQuest(browser, { ...input, title: 'Changed retry' }, event(input.requestId))).toBe(browser);
        expect(worker.createQuest(api, { ...input, title: 'Changed retry' }, now, todayKey)).toBe(created);
        expect(api).toEqual(beforeReplay);

        browser = domain.completeQuest(browser, browser.quests[0].id, event());
        expect(worker.completeQuest(api, created.id, now, todayKey).changed).toBe(true);
        expectParity(browser, api);
        expect(domain.completeQuest(browser, browser.quests[0].id, event())).toBe(browser);
        expect(worker.completeQuest(api, created.id, now, todayKey).changed).toBe(false);

        browser.settings.questRewards = { ...browser.settings.questRewards, [created.difficulty]: 99 };
        api.settings.questRewards = { ...api.settings.questRewards, [created.difficulty]: 99 };
        browser.budget.goldToUsdRatio = api.budget.goldToUsdRatio = 4;
        browser = domain.undoQuest(browser, browser.quests[0].id, event());
        expect(worker.undoQuest(api, created.id, now, todayKey).changed).toBe(true);
        expectParity(browser, api);
        expect(api.stats).toMatchObject({ level: 1, xp: 95, maxXp: 100, gold: 10 });
        expect(api.budget.earnedRewards).toBeCloseTo(1.234567, 12);
    });

    it('uses configured quest rewards while retaining default XP', () => {
        let { browser, api } = makePair();
        browser.settings.questRewards.medium = api.settings.questRewards.medium = 7.5;
        const input = { title: 'Configured quest', difficulty: 'medium' };
        browser = domain.createQuest(browser, input, event());
        expect(worker.createQuest(api, input, now, todayKey).reward).toEqual({ xp: 25, gold: 7.5 });
        expectParity(browser, api);
    });

    it('clears focus on discard, keeps it cleared on restore, and permits selecting it again', () => {
        let { browser, api } = makePair();
        const quest = { id: 'quest-1', title: 'Focused quest', isFocusedToday: true, discarded: false };
        browser.quests = [structuredClone(quest)];
        api.quests = [structuredClone(quest)];
        browser = domain.discardQuest(browser, quest.id, event());
        expect(worker.discardQuest(api, quest.id, now, todayKey).changed).toBe(true);
        expectParity(browser, api);
        expect(api.quests[0]).toMatchObject({ discarded: true, isFocusedToday: false });
        expect(domain.discardQuest(browser, quest.id, event())).toBe(browser);
        expect(worker.discardQuest(api, quest.id, now, todayKey).changed).toBe(false);

        browser = domain.restoreQuest(browser, quest.id);
        expect(worker.restoreQuest(api, quest.id).changed).toBe(true);
        expectParity(browser, api);
        expect(api.quests[0]).toMatchObject({ discarded: false, discardedAt: null, isFocusedToday: false });
        browser = domain.setQuestFocus(browser, quest.id, true);
        expect(worker.setQuestToday(api, quest.id, true).changed).toBe(true);
        expectParity(browser, api);
        expect(domain.setQuestFocus(browser, quest.id, true)).toBe(browser);
        expect(worker.setQuestToday(api, quest.id, true).changed).toBe(false);
    });

    it.each([
        [{ title: 'Default protocol' }, { frequency: 'daily', frequencyParam: 1, completionReward: 0.1, passiveReward: 0, isActive: false }],
        [{ title: 'Custom protocol', frequency: 'interval', frequencyParam: 3.7, completionReward: 0.12345, passiveReward: -1, active: true },
            { frequency: 'interval', frequencyParam: 4, completionReward: 0.1235, passiveReward: 0, isActive: true }]
    ])('creates and replays protocol %j equivalently', (payload, expected) => {
        let { browser, api } = makePair();
        const input = { ...payload, requestId: 'create-protocol' };
        browser = domain.createProtocol(browser, input, event(input.requestId));
        const created = worker.createProtocol(api, input, now, todayKey);
        expect(created).toMatchObject(expected);
        expectParity(browser, api);
        expect(domain.createProtocol(browser, input, event(input.requestId))).toBe(browser);
        const beforeReplay = structuredClone(api);
        expect(worker.createProtocol(api, input, now, todayKey)).toBe(created);
        expect(api).toEqual(beforeReplay);
    });

    // Passive income is owed from the cursor (09-29) through the day or the due day (10-02).
    // The streak continues only when the completion is within the 4-day interval.
    it.each([
        ['early', '2026-10-01', 0.2, 2],
        ['due', '2026-10-02', 0.6, 2],
        ['overdue', '2026-10-03', 0.3, 1]
    ])('completes an %s protocol using the supplied day and replays once', (_label, day, gold, streak) => {
        let { browser, api } = makePair();
        browser.habits = [scheduledProtocol()];
        api.habits = [scheduledProtocol()];
        browser = domain.completeProtocol(browser, 'protocol-1', event('complete-protocol', day));
        expect(worker.completeProtocol(api, 'protocol-1', day, now, 'complete-protocol').changed).toBe(true);
        expectParity(browser, api);
        expect(api.stats.gold).toBeCloseTo(10 + gold, 4);
        expect(api.stats).toMatchObject({ level: 2, xp: 0 });
        expect(api.habits[0]).toMatchObject({
            history: { [day]: 1 }, passivePaidThrough: day, lastCycleResetDateKey: day
        });
        expect(protocolView(api.habits[0], day).streak).toBe(streak);
        const beforeReplay = structuredClone(api);
        expect(domain.completeProtocol(browser, 'protocol-1', event('complete-protocol', '2026-10-09'))).toBe(browser);
        expect(worker.completeProtocol(api, 'protocol-1', '2026-10-09', now, 'complete-protocol').changed).toBe(false);
        expect(api).toEqual(beforeReplay);
    });

    it.each([
        ['2026-10-01', '2026-10-01', 2],
        ['2026-10-07', '2026-10-02', 3]
    ])('pays owed days and pauses with the same cursor on %s, then activates and skips', (day, pausedCursor, paidDays) => {
        let { browser, api } = makePair();
        browser.habits = [scheduledProtocol()];
        api.habits = [scheduledProtocol()];
        browser = domain.setProtocolActive(browser, 'protocol-1', false, event('', day));
        expect(worker.deactivateProtocol(api, 'protocol-1', day, now).changed).toBe(true);
        expectParity(browser, api);
        expect(api.habits[0]).toMatchObject({ isActive: false, passivePaidThrough: pausedCursor });
        expect(api.coinHistory).toHaveLength(paidDays);
        expect(domain.setProtocolActive(browser, 'protocol-1', false, event('', day))).toBe(browser);
        expect(worker.deactivateProtocol(api, 'protocol-1', day).changed).toBe(false);

        browser = domain.setProtocolActive(browser, 'protocol-1', true, event('', day));
        expect(worker.activateProtocol(api, 'protocol-1').changed).toBe(true);
        expectParity(browser, api);
        expect(api.habits[0].passivePaidThrough).toBe(pausedCursor);
        const beforeSkipStats = structuredClone(api.stats);
        const beforeSkipLedger = api.coinHistory.length;
        browser = domain.skipProtocol(browser, 'protocol-1', event('', day));
        worker.skipProtocol(api, 'protocol-1', day, now);
        expectParity(browser, api);
        expect(api.habits[0]).toMatchObject({
            history: { '2026-09-28': 1 }, passivePaidThrough: day, lastCycleResetDateKey: day
        });
        expect(api.stats).toEqual(beforeSkipStats);
        expect(api.coinHistory).toHaveLength(beforeSkipLedger);
        const afterSkip = structuredClone(api);
        worker.skipProtocol(api, 'protocol-1', day, now);
        expect(api).toEqual(afterSkip);
    });
});

describe('worker HTTP validation boundary', () => {
    it.each([
        ['quest title', (state) => worker.createQuest(state, { title: '  ' }), 400, 'invalid_quest'],
        ['quest difficulty', (state) => worker.createQuest(state, { title: 'Quest', difficulty: 'unknown' }), 400, 'invalid_quest'],
        ['protocol title', (state) => worker.createProtocol(state, { title: '' }), 400, 'invalid_protocol'],
        ['protocol frequency', (state) => worker.createProtocol(state, { title: 'Protocol', frequency: 'unknown' }), 400, 'invalid_protocol'],
        ['missing quest', (state) => worker.completeQuest(state, 'missing'), 404, 'quest_not_found'],
        ['missing protocol', (state) => worker.completeProtocol(state, 'missing', todayKey), 404, 'protocol_not_found'],
        ['discarded quest completion', (state) => worker.completeQuest(state, 'discarded'), 409, 'quest_discarded'],
        ['discarded quest focus', (state) => worker.setQuestToday(state, 'discarded', true), 409, 'quest_discarded']
    ])('retains %s validation without changing the snapshot', (_label, operation, status, code) => {
        const { api } = makePair();
        api.quests = [{ id: 'discarded', discarded: true, completed: false }];
        const before = structuredClone(api);
        expect(operation.bind(null, api)).toThrow(HttpError);
        expect(operation.bind(null, api)).toThrow(expect.objectContaining({ status, code }));
        expect(api).toEqual(before);
    });
});
