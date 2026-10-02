import { describe, expect, it } from 'vitest';
import { questView as sharedQuestView, protocolView as sharedProtocolView } from '../../src/domain/views.js';
import { buildLlmSnapshot } from '../../src/utils/llmInterface.js';
import { dashboardView, listQuestView, listProtocolView, questView, protocolView } from './views.js';

const now = new Date(2026, 9, 2, 12);
const todayKey = '2026-10-02';
const makeState = () => ({
    stats: { hp: 50, maxHp: 100, level: 2, xp: 25, maxXp: 120, gold: 10 },
    settings: { questRewards: { easy: 3, medium: 6, hard: 8 } },
    quests: [
        { id: 'pending', title: 'Pending', difficulty: 'easy', isFocusedToday: true, reward: { xp: 10, gold: 0.5 } },
        { id: 'custom', title: 'Custom', difficulty: 'medium', isCustomReward: true, reward: { xp: 17, gold: 1.2345 } },
        { id: 'completed', title: 'Completed', difficulty: 'hard', completed: true, isFocusedToday: true,
            reward: { xp: 60, gold: 4 }, completedReward: { xp: 50, gold: 2, earnedRewardsDelta: 1 / 3 } },
        { id: 'discarded', title: 'Discarded', difficulty: 'easy', discarded: true, isFocusedToday: false, reward: { xp: 10, gold: 0.5 } }
    ],
    habits: [
        { id: 'due', title: 'Due', frequency: 'interval', frequencyParam: 4, history: { '2026-09-28': 1 }, completionReward: 0.3, passiveReward: 0.1 },
        { id: 'early', title: 'Early', frequency: 'weekly', history: { '2026-09-28': 1 } },
        { id: 'overdue', title: 'Overdue', frequency: 'daily', history: { '2026-09-29': 1 } },
        { id: 'completed', title: 'Done today', frequency: 'daily', history: { [todayKey]: 2 } },
        { id: 'inactive', title: 'Inactive', frequency: 'daily', isActive: false, history: {} }
    ]
});

describe('shared browser and worker summary views', () => {
    it('keeps worker projection exports compatible', () => {
        expect(questView).toBe(sharedQuestView);
        expect(protocolView).toBe(sharedProtocolView);
    });

    it('shows configured pending rewards, custom rewards, and completed receipts consistently', () => {
        const state = makeState();
        const browser = buildLlmSnapshot(state, now);
        const api = listQuestView(state, todayKey, new URLSearchParams({ status: 'all' }));
        expect(api.quests).toEqual(browser.quests);
        expect(browser.quests.map((quest) => quest.reward)).toEqual([
            { xp: 10, gold: 3 }, { xp: 17, gold: 1.2345 }, { xp: 50, gold: 2 }, { xp: 10, gold: 3 }
        ]);
        expect(browser.quests[2].reward).not.toHaveProperty('earnedRewardsDelta');
        const dashboard = dashboardView(state, todayKey);
        expect(dashboard.quests).toEqual(browser.dashboard.today.quests);
        expect(dashboard.quests.map((quest) => quest.id)).toEqual(['pending']);
    });

    it('uses the same explicit protocol day and preserves today selection rules', () => {
        const state = makeState();
        const browser = buildLlmSnapshot(state, now);
        const api = listProtocolView(state, todayKey, new URLSearchParams({ status: 'all' }));
        expect(browser.interface.today).toBe(todayKey);
        expect(api.protocols).toEqual(browser.protocols);
        expect(browser.protocols[0]).toMatchObject({ dueDate: todayKey, daysUntilDue: 0, selectedForToday: true });
        expect(browser.protocols[1]).toMatchObject({ dueDate: '2026-10-05', daysUntilDue: 3, selectedForToday: false });
        expect(browser.protocols[2]).toMatchObject({ isOverdue: true, selectedForToday: true });
        expect(browser.protocols[3]).toMatchObject({ completedToday: true, completionsToday: 2 });
        expect(browser.protocols[4]).toMatchObject({ status: 'inactive', selectedForToday: false });
        const dashboard = dashboardView(state, todayKey);
        expect(dashboard.protocols).toEqual(browser.dashboard.today.protocols);
        expect(dashboard.protocols.map((protocol) => protocol.id)).toEqual(['due', 'overdue']);
        expect(protocolView(state.habits[0], '2026-10-03')).toMatchObject({ daysUntilDue: -1, isOverdue: true });
    });

    it('retains stored quest rewards when callers omit settings', () => {
        const state = makeState();
        delete state.settings;
        expect(buildLlmSnapshot(state, now).quests[0].reward).toEqual({ xp: 10, gold: 0.5 });
        expect(questView(state.quests[0]).reward).toEqual({ xp: 10, gold: 0.5 });
    });
});
