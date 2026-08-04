import { getHabitCycleState } from './gameLogic';
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

export const buildLlmSnapshot = ({ stats = {}, quests = [], habits = [] }, now = new Date()) => {
    const todayKey = toLocalDateKey(now);
    const normalizedQuests = quests.map((quest) => ({
        id: quest.id,
        title: quest.title,
        status: quest.discarded ? 'discarded' : quest.completed ? 'completed' : 'active',
        selectedForToday: Boolean(quest.isFocusedToday),
        difficulty: quest.difficulty || 'easy',
        dueDate: quest.dueDate || null,
        missionBrief: quest.missionBrief || '',
        reward: {
            ...(quest.reward || { xp: 0, gold: 0 }),
            gold: normalizeCurrencyAmount(quest.reward?.gold)
        },
        createdAt: quest.createdAt || null,
        completedAt: quest.completedAt || null,
        discardedAt: quest.discardedAt || null
    }));
    const normalizedProtocols = habits.map((habit) => {
        const cycle = getHabitCycleState(habit, now);
        const completionsToday = Number(habit.history?.[todayKey] || 0);

        return {
            id: habit.id,
            title: habit.title,
            status: habit.isActive === false ? 'inactive' : 'active',
            selectedForToday: habit.isActive !== false && cycle.daysUntilDue <= 0,
            completedToday: completionsToday > 0,
            completionsToday,
            frequency: habit.frequency || 'daily',
            frequencyParam: Number(habit.frequencyParam || 1),
            streak: Number(habit.streak || 0),
            completionReward: normalizeCurrencyAmount(habit.completionReward),
            passiveReward: normalizeCurrencyAmount(habit.passiveReward),
            dueDate: cycle.dueDateKey,
            daysUntilDue: cycle.daysUntilDue,
            isOverdue: cycle.isOverdue,
            createdAt: habit.createdAt || null
        };
    });
    const timeRemaining = getDayTimeRemaining(now);

    return {
        interface: {
            name: 'LifeQuest LLM Interface',
            version: 1,
            generatedAt: now.toISOString(),
            today: todayKey
        },
        dashboard: {
            health: {
                current: Number(stats.hp || 0),
                maximum: Number(stats.maxHp || 0)
            },
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
