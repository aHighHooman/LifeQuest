import { normalizeCurrencyAmount } from '../constants/currency.js';
import { getProtocolCycleState } from './protocols.js';
import { resolveQuestReward } from './rewards.js';

export const questView = (quest, settings = {}) => {
    const reward = resolveQuestReward(settings, quest);
    return {
        id: quest.id,
        title: quest.title,
        status: quest.discarded ? 'discarded' : quest.completed ? 'completed' : 'active',
        selectedForToday: Boolean(quest.isFocusedToday),
        difficulty: quest.difficulty || 'easy',
        dueDate: quest.dueDate || null,
        missionBrief: quest.missionBrief || '',
        reward: {
            xp: reward.xp,
            gold: reward.gold
        },
        createdAt: quest.createdAt || null,
        completedAt: quest.completedAt || null,
        discardedAt: quest.discardedAt || null
    };
};

export const protocolView = (protocol, todayKey) => {
    const cycle = getProtocolCycleState(protocol, todayKey);
    const completionsToday = Number(protocol.history?.[todayKey] || 0);
    return {
        id: protocol.id,
        title: protocol.title,
        status: protocol.isActive === false ? 'inactive' : 'active',
        selectedForToday: protocol.isActive !== false && cycle.daysUntilDue <= 0,
        completedToday: completionsToday > 0,
        completionsToday,
        frequency: protocol.frequency || 'daily',
        frequencyParam: Number(protocol.frequencyParam || 1),
        streak: Number(protocol.streak || 0),
        completionReward: normalizeCurrencyAmount(protocol.completionReward),
        passiveReward: normalizeCurrencyAmount(protocol.passiveReward),
        dueDate: cycle.dueDateKey,
        daysUntilDue: cycle.daysUntilDue,
        isOverdue: cycle.isOverdue,
        createdAt: protocol.createdAt || null
    };
};
