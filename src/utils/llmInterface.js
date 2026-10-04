import { healthView, questView, protocolView } from '../domain/views.js';
import { toLocalDateKey } from './dateUtils';
import { normalizeCurrencyAmount } from '../constants/currency.js';

export const LLM_INTERFACE_ROUTE = import.meta.env.VITE_LLM_INTERFACE_ROUTE || '';

const normalizeRoute = (value = '') => `/${`${value}`.replace(/^#?\/?/, '').replace(/\/+$/, '')}`;

export const isLlmInterfaceLocation = (
    location = window.location,
    configuredRoute = LLM_INTERFACE_ROUTE
) => {
    if (!configuredRoute) return false;

    const pathname = normalizeRoute(location.pathname);
    const hashPath = normalizeRoute(location.hash);
    const route = normalizeRoute(configuredRoute);

    return pathname.endsWith(route) || hashPath === route;
};

export const getDayTimeRemaining = (now = new Date()) => {
    const endOfDay = new Date(now);
    endOfDay.setHours(24, 0, 0, 0);

    const totalSeconds = Math.max(0, Math.floor((endOfDay.getTime() - now.getTime()) / 1000));

    return {
        totalSeconds,
        hours: Math.floor(totalSeconds / 3600),
        minutes: Math.floor((totalSeconds % 3600) / 60),
        seconds: totalSeconds % 60
    };
};

export const applyCloudSnapshotToDevice = (cloud, importAppState) => {
    if (!cloud) {
        return { status: 'empty', backupKey: null };
    }

    if (cloud.manifest?.kind !== 'lifequest') {
        throw new Error('The cloud account does not contain a supported LifeQuest snapshot. Device data was not changed.');
    }

    const { backupKey } = importAppState(cloud.snapshot);
    return { status: 'loaded', backupKey };
};

export const buildLlmSnapshot = ({ stats = {}, settings = {}, quests = [], habits = [], calories = {} }, now = new Date()) => {
    const todayKey = toLocalDateKey(now);
    const normalizedQuests = quests.map((quest) => questView(quest, settings));
    const normalizedProtocols = habits.map((habit) => protocolView(habit, todayKey));
    const timeRemaining = getDayTimeRemaining(now);

    return {
        interface: {
            name: 'LifeQuest LLM Interface',
            version: 1,
            generatedAt: now.toISOString(),
            today: todayKey
        },
        dashboard: {
            health: healthView(calories, todayKey),
            coinsOnHand: normalizeCurrencyAmount(stats.gold),
            level: Number(stats.level || 1),
            xp: {
                current: Number(stats.xp || 0),
                nextLevelAt: Number(stats.maxXp || 0)
            },
            timeRemainingToday: timeRemaining,
            today: {
                quests: normalizedQuests.filter(
                    (quest) => quest.selectedForToday && quest.status === 'active'
                ),
                protocols: normalizedProtocols.filter(
                    (protocol) => protocol.selectedForToday && !protocol.completedToday
                )
            }
        },
        quests: normalizedQuests,
        protocols: normalizedProtocols
    };
};
