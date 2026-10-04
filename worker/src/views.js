import { healthView, questView, protocolView } from '../../src/domain/views.js';

export { questView, protocolView } from '../../src/domain/views.js';

export const dashboardView = (snapshot, todayKey) => {
    const quests = snapshot.quests.map((quest) => questView(quest, snapshot.settings));
    const protocols = snapshot.habits.map((protocol) => protocolView(protocol, todayKey));
    return {
        today: todayKey,
        health: healthView(snapshot.calories, todayKey),
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
        .map((quest) => questView(quest, snapshot.settings))
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
