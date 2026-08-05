import { getProtocolCycleState } from './date.js';

export const questView = (quest) => ({
    id: quest.id,
    title: quest.title,
    status: quest.discarded ? 'discarded' : quest.completed ? 'completed' : 'active',
    selectedForToday: Boolean(quest.isFocusedToday),
    difficulty: quest.difficulty || 'easy',
    dueDate: quest.dueDate || null,
    missionBrief: quest.missionBrief || '',
    reward: {
        xp: Number(quest.reward?.xp || 0),
        gold: Number(quest.reward?.gold || 0)
    },
    createdAt: quest.createdAt || null,
    completedAt: quest.completedAt || null,
    discardedAt: quest.discardedAt || null
});

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
        completionReward: Number(protocol.completionReward || 0),
        passiveReward: Number(protocol.passiveReward || 0),
        dueDate: cycle.dueDateKey,
        daysUntilDue: cycle.daysUntilDue,
        isOverdue: cycle.isOverdue,
        createdAt: protocol.createdAt || null
    };
};

export const dashboardView = (snapshot, todayKey) => {
    const quests = snapshot.quests.map(questView);
    const protocols = snapshot.habits.map((protocol) => protocolView(protocol, todayKey));
    return {
        today: todayKey,
        health: {
            current: Number(snapshot.stats.hp || 0),
            maximum: Number(snapshot.stats.maxHp || 0)
        },
        coinsOnHand: Number(snapshot.stats.gold || 0),
        level: Number(snapshot.stats.level || 1),
        xp: {
            current: Number(snapshot.stats.xp || 0),
            nextLevelAt: Number(snapshot.stats.maxXp || 0)
        },
        quests: quests.filter((quest) => quest.selectedForToday && quest.status === 'active'),
        protocols: protocols.filter(
            (protocol) => protocol.selectedForToday && !protocol.completedToday
        )
    };
};

const boundedLimit = (value) => Math.min(100, Math.max(1, Number(value) || 50));

export const listQuestView = (snapshot, todayKey, searchParams) => {
    const status = searchParams.get('status') || 'active';
    const query = `${searchParams.get('query') || ''}`.trim().toLowerCase();
    const items = snapshot.quests
        .map(questView)
        .filter((quest) => status === 'all' || quest.status === status)
        .filter((quest) => !query || quest.title.toLowerCase().includes(query))
        .slice(0, boundedLimit(searchParams.get('limit')));
    return { today: todayKey, status, count: items.length, quests: items };
};

export const listProtocolView = (snapshot, todayKey, searchParams) => {
    const status = searchParams.get('status') || 'active';
    const query = `${searchParams.get('query') || ''}`.trim().toLowerCase();
    const items = snapshot.habits
        .map((protocol) => protocolView(protocol, todayKey))
        .filter((protocol) => status === 'all' || protocol.status === status)
        .filter((protocol) => !query || protocol.title.toLowerCase().includes(query))
        .slice(0, boundedLimit(searchParams.get('limit')));
    return { today: todayKey, status, count: items.length, protocols: items };
};
