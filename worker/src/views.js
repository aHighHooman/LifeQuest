import { healthView, questView, protocolView } from '../../src/domain/views.js';
import { getEditableCalorieDateKeys } from '../../src/domain/calories.js';
import { normalizeCurrencyAmount } from '../../src/constants/currency.js';

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

export const calorieEntryView = (entry) => ({
    id: entry.id,
    time: entry.timestamp || null,
    label: entry.label,
    calories: Number(entry.calories || 0),
    coinCost: normalizeCurrencyAmount(entry.coinCost),
    source: entry.source || 'manual',
    foodId: entry.foodId || null
});

export const calorieDayView = (snapshot, dateKey, todayKey) => ({
    date: dateKey,
    editable: getEditableCalorieDateKeys(todayKey).has(dateKey),
    ...healthView(snapshot.calories, dateKey),
    entries: snapshot.calories.history
        .filter((entry) => entry.dateKey === dateKey)
        .sort((a, b) => `${a.timestamp}`.localeCompare(`${b.timestamp}`))
        .map(calorieEntryView)
});

export const listSavedFoodView = (snapshot, searchParams) => {
    const query = `${searchParams.get('query') || ''}`.trim().toLowerCase();
    const items = snapshot.calories.savedFoods
        .filter((food) => !query || `${food.name}`.toLowerCase().includes(query))
        .slice(0, boundedLimit(searchParams.get('limit')))
        .map((food) => ({
            id: food.id,
            name: food.name,
            calories: Number(food.calories || 0),
            coinCost: normalizeCurrencyAmount(food.coinCost)
        }));
    return { count: items.length, foods: items };
};

export const transactionView = (entry, toDateKey) => ({
    id: entry.id,
    date: entry.date,
    day: toDateKey(entry.date),
    type: entry.type,
    amount: normalizeCurrencyAmount(entry.amount),
    description: entry.description || ''
});

// `toDateKey` turns a stored instant into the owner's local day.
export const listLedgerView = (snapshot, searchParams, toDateKey) => {
    const type = searchParams.get('type') || 'all';
    const since = searchParams.get('since') || '';
    const query = `${searchParams.get('query') || ''}`.trim().toLowerCase();
    const matches = snapshot.coinHistory
        .map((entry) => transactionView(entry, toDateKey))
        .filter((entry) => type === 'all' || entry.type === type)
        .filter((entry) => !since || entry.day >= since)
        .filter((entry) => !query || entry.description.toLowerCase().includes(query))
        .sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0));
    const total = (kind) => normalizeCurrencyAmount(matches
        .filter((entry) => entry.type === kind)
        .reduce((sum, entry) => sum + entry.amount, 0));
    return {
        coinsOnHand: Number(snapshot.stats.gold || 0),
        type,
        since: since || null,
        matched: matches.length,
        totals: { earned: total('earned'), spent: total('spent') },
        transactions: matches.slice(0, boundedLimit(searchParams.get('limit')))
    };
};
