/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import { useBudget } from './BudgetContext';
import { usePersistentState } from '../utils/persistence';
import {
    addDaysToDateKey,
    getDaysUntilDue,
    getHabitCycleState,
    getHabitDueDateKey,
    getHabitPassivePayoutDateKeys,
    getLatestHabitCompletionDateKey,
} from '../utils/gameLogic';
import { getTodayISO, isWithinDays } from '../utils/dateUtils';

const GameContext = createContext();

export const useGame = () => useContext(GameContext);

const INITIAL_STATS = {
    level: 1,
    xp: 0,
    maxXp: 100,
    hp: 0,
    maxHp: 100,
    gold: 0,
};

const INITIAL_TASKS = [];
const INITIAL_HABITS = [];

const INITIAL_SETTINGS = {
    protocolReward: 1,
    questRewards: {
        easy: 5,
        medium: 15,
        hard: 40,
        legendary: 100
    }
};

const INITIAL_CALORIES = { current: 0, target: 2000, history: [] };
const INITIAL_COIN_HISTORY = [];
const STIPEND_PERIOD_DAYS = {
    weekly: 7,
    'bi-weekly': 14,
    monthly: 30
};

const createLedgerTimestamp = (dateKey) => {
    if (!dateKey) return new Date().toISOString();

    const [year, month, day] = dateKey.split('-').map(Number);
    return new Date(year, month - 1, day, 12, 0, 0, 0).toISOString();
};

const createCoinHistoryEntry = ({ amount, description, type = 'earned', date = new Date().toISOString() }) => ({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    date,
    amount,
    description,
    type
});

const getDefaultPassivePaidThrough = (habit, todayKey) => {
    const latestCompletionDateKey = getLatestHabitCompletionDateKey(habit);
    if (!latestCompletionDateKey) return null;

    const dueDateKey = getHabitDueDateKey(habit);
    if (!dueDateKey) return latestCompletionDateKey;

    return todayKey < dueDateKey ? todayKey : dueDateKey;
};

const normalizeHabitRecord = (habit, protocolReward, todayKey) => {
    let nextHabit = habit;
    let didChange = false;

    if (nextHabit.isActive === undefined) {
        nextHabit = { ...nextHabit, isActive: true };
        didChange = true;
    }

    if (nextHabit.completionReward === undefined) {
        nextHabit = {
            ...nextHabit,
            completionReward: Number(protocolReward || 0)
        };
        didChange = true;
    }

    if (nextHabit.passiveReward === undefined) {
        nextHabit = {
            ...nextHabit,
            passiveReward: 0
        };
        didChange = true;
    }

    if (nextHabit.passivePaidThrough === undefined) {
        nextHabit = {
            ...nextHabit,
            passivePaidThrough: getDefaultPassivePaidThrough(nextHabit, todayKey)
        };
        didChange = true;
    }

    return didChange ? nextHabit : habit;
};

const refreshHabitDailyState = (habit) => {
    const isToday = habit.isActive === false ? false : getDaysUntilDue(habit) <= 0;

    if (habit.isToday === isToday) {
        return habit;
    }

    return { ...habit, isToday };
};

const getPausedPassivePaidThrough = (habit, todayKey) => {
    const dueDateKey = getHabitDueDateKey(habit);
    if (!dueDateKey) return habit.passivePaidThrough ?? null;

    const pauseBoundary = todayKey < dueDateKey ? todayKey : dueDateKey;
    if (!habit.passivePaidThrough || pauseBoundary > habit.passivePaidThrough) {
        return pauseBoundary;
    }

    return habit.passivePaidThrough;
};

const settlePassiveIncome = (habits, todayKey) => {
    let totalGold = 0;
    const ledgerEntries = [];
    let didChange = false;

    const updatedHabits = habits.map((habit) => {
        const payoutDateKeys = getHabitPassivePayoutDateKeys(habit, habit.passivePaidThrough, todayKey);
        if (!payoutDateKeys.length) {
            return habit;
        }

        const passiveReward = Number(habit.passiveReward || 0);
        totalGold += passiveReward * payoutDateKeys.length;
        payoutDateKeys.forEach((dateKey) => {
            ledgerEntries.push(createCoinHistoryEntry({
                amount: passiveReward,
                description: `Protocol passive income: ${habit.title}`,
                type: 'earned',
                date: createLedgerTimestamp(dateKey)
            }));
        });

        didChange = true;
        return {
            ...habit,
            passivePaidThrough: payoutDateKeys[payoutDateKeys.length - 1]
        };
    });

    return { updatedHabits, totalGold, ledgerEntries, didChange };
};

const getStipendPayoutDateKeys = (paidThroughDateKey, period, todayKey) => {
    if (!paidThroughDateKey) return [];

    const intervalDays = STIPEND_PERIOD_DAYS[period] || STIPEND_PERIOD_DAYS.weekly;
    const payoutDateKeys = [];
    let cursor = addDaysToDateKey(paidThroughDateKey, intervalDays);

    while (cursor && cursor <= todayKey) {
        payoutDateKeys.push(cursor);
        cursor = addDaysToDateKey(cursor, intervalDays);
    }

    return payoutDateKeys;
};

const settleBudgetStipend = (amount, period, paidThroughDateKey, todayKey) => {
    const stipendAmount = Number(amount || 0);
    if (stipendAmount <= 0 || !paidThroughDateKey) {
        return { totalGold: 0, ledgerEntries: [], paidThrough: paidThroughDateKey };
    }

    const payoutDateKeys = getStipendPayoutDateKeys(paidThroughDateKey, period, todayKey);
    if (!payoutDateKeys.length) {
        return { totalGold: 0, ledgerEntries: [], paidThrough: paidThroughDateKey };
    }

    return {
        totalGold: stipendAmount * payoutDateKeys.length,
        ledgerEntries: payoutDateKeys.map((dateKey) => createCoinHistoryEntry({
            amount: stipendAmount,
            description: 'Budget stipend',
            type: 'earned',
            date: createLedgerTimestamp(dateKey)
        })),
        paidThrough: payoutDateKeys[payoutDateKeys.length - 1]
    };
};

export const GameProvider = ({ children }) => {
    const {
        addRewardFromGold,
        removeRewardFromGold,
        stipendAmount,
        stipendPeriod,
        stipendPaidThrough,
        setStipendPaidThrough,
        removeCompletedGroceriesBefore
    } = useBudget();
    const dailyRolloverRef = useRef('');

    const [stats, setStats] = usePersistentState('lq_stats', INITIAL_STATS);
    const [quests, setQuests] = usePersistentState('lq_quests', INITIAL_TASKS);
    const [habits, setHabits] = usePersistentState('lq_habits', INITIAL_HABITS);
    const [settings, setSettings] = usePersistentState('lq_settings', INITIAL_SETTINGS);
    const [calories, setCalories] = usePersistentState('lq_calories', INITIAL_CALORIES);
    const [coinHistory, setCoinHistory] = usePersistentState('lq_coin_history', INITIAL_COIN_HISTORY);

    const updateStats = useCallback((newStats) => {
        setStats(prev => ({ ...prev, ...newStats }));
    }, [setStats]);

    const updateSettings = useCallback((newSettings) => {
        setSettings(prev => ({ ...prev, ...newSettings }));
    }, [setSettings]);

    const addCalories = useCallback((amount) => {
        setCalories(prev => {
            const newCurrent = Math.max(0, prev.current + amount);
            const newEntry = { date: new Date().toISOString(), amount };
            return { ...prev, current: newCurrent, history: [...prev.history, newEntry] };
        });
    }, [setCalories]);

    const setCalorieGoal = useCallback((amount) => {
        setCalories(prev => ({ ...prev, target: amount }));
    }, [setCalories]);

    const appendCoinHistoryEntries = useCallback((entries) => {
        if (!entries.length) return;
        setCoinHistory(prev => [...prev, ...entries]);
    }, [setCoinHistory]);

    const spendCoins = useCallback((amount, description) => {
        setStats(prev => ({ ...prev, gold: prev.gold - amount }));
        appendCoinHistoryEntries([
            createCoinHistoryEntry({
                amount,
                description,
                type: 'spent'
            })
        ]);
        return true;
    }, [appendCoinHistoryEntries, setStats]);

    const addXp = useCallback((amount) => {
        const numAmount = Number(amount);
        setStats(prev => {
            let newXp = Number(prev.xp || 0) + numAmount;
            let newLevel = prev.level;
            let newMaxXp = prev.maxXp;
            let newHp = prev.hp;
            let newMaxHp = prev.maxHp;

            while (newXp >= newMaxXp) {
                newLevel += 1;
                newXp -= newMaxXp;
                newMaxXp = Math.floor(newMaxXp * 1.2);
                newHp = newMaxHp;
            }

            while (newXp < 0 && newLevel > 1) {
                newLevel -= 1;
                newMaxXp = Math.ceil(newMaxXp / 1.2);
                newXp += newMaxXp;
            }

            return { ...prev, xp: newXp, level: newLevel, maxXp: newMaxXp, hp: newHp };
        });
    }, [setStats]);

    const addGold = useCallback((amount, source = 'reward', options = {}) => {
        const numAmount = Number(amount);
        setStats(prev => ({ ...prev, gold: Number(prev.gold || 0) + numAmount }));

        if (numAmount !== 0) {
            appendCoinHistoryEntries([
                createCoinHistoryEntry({
                    amount: numAmount,
                    description: options.description || (numAmount > 0 ? `Earned from ${source}` : `Reverted ${source}`),
                    type: numAmount > 0 ? 'earned' : 'spent',
                    date: options.date || new Date().toISOString()
                })
            ]);
        }
    }, [appendCoinHistoryEntries, setStats]);

    const takeDamage = useCallback((amount) => {
        setStats(prev => ({
            ...prev,
            hp: Math.max(0, prev.hp - amount)
        }));
    }, [setStats]);

    const addQuest = useCallback((title, difficulty = 'easy', dueDate = null, customReward = null, missionBrief = '') => {
        const defaultRewards = {
            easy: { xp: 10, gold: settings.questRewards.easy },
            medium: { xp: 25, gold: settings.questRewards.medium },
            hard: { xp: 60, gold: settings.questRewards.hard },
            legendary: { xp: 150, gold: settings.questRewards.legendary },
        };

        const newQuest = {
            id: Date.now().toString(),
            title,
            difficulty,
            dueDate,
            missionBrief,
            completed: false,
            discarded: false,
            reward: customReward || defaultRewards[difficulty] || defaultRewards.easy,
            isCustomReward: !!customReward,
            createdAt: new Date().toISOString(),
        };

        setQuests(prev => [newQuest, ...prev]);
    }, [setQuests, settings.questRewards]);

    const updateQuest = useCallback((id, updates) => {
        setQuests(prev => prev.map(q => q.id === id ? { ...q, ...updates } : q));
    }, [setQuests]);

    const completeQuest = useCallback((id) => {
        const quest = quests.find(q => q.id === id);
        if (!quest || quest.completed) return;

        const diff = quest.difficulty || 'easy';
        const xpAmount = Number(quest.reward.xp || 0);
        let goldAmount = Number(quest.reward.gold || 0);

        if (!quest.isCustomReward) {
            const settingVal = settings.questRewards[diff];
            if (settingVal !== undefined) {
                goldAmount = Number(settingVal);
            }
        }

        addXp(xpAmount);
        addGold(goldAmount, 'Quest');
        addRewardFromGold(goldAmount);

        setQuests(prev => prev.map(q => {
            if (q.id === id) {
                return {
                    ...q,
                    completed: true,
                    completedAt: new Date().toISOString(),
                    completedReward: { xp: xpAmount, gold: goldAmount }
                };
            }
            return q;
        }));
    }, [addGold, addRewardFromGold, addXp, quests, setQuests, settings.questRewards]);

    const undoCompleteQuest = useCallback((id) => {
        const quest = quests.find(q => q.id === id);
        if (!quest || !quest.completed) return;

        let xpAmount = 0;
        let goldAmount = 0;

        if (quest.completedReward) {
            xpAmount = Number(quest.completedReward.xp || 0);
            goldAmount = Number(quest.completedReward.gold || 0);
        } else {
            const diff = quest.difficulty || 'easy';
            xpAmount = Number(quest.reward.xp || 0);
            goldAmount = Number(quest.reward.gold || 0);

            if (!quest.isCustomReward) {
                const settingVal = settings.questRewards[diff];
                if (settingVal !== undefined) {
                    goldAmount = Number(settingVal);
                }
            }
        }

        addXp(-xpAmount);
        addGold(-goldAmount, 'Quest Undo');
        removeRewardFromGold(goldAmount);

        setQuests(prev => prev.map(q => (
            q.id === id ? { ...q, completed: false, completedAt: null, completedReward: null } : q
        )));
    }, [addGold, addXp, quests, removeRewardFromGold, setQuests, settings.questRewards]);

    const deleteQuest = useCallback((id) => {
        setQuests(prev => prev.map(q => (
            q.id === id ? { ...q, discarded: true, discardedAt: new Date().toISOString() } : q
        )));
    }, [setQuests]);

    const restoreQuest = useCallback((id) => {
        setQuests(prev => prev.map(q => (
            q.id === id ? { ...q, discarded: false, discardedAt: null } : q
        )));
    }, [setQuests]);

    const permanentDeleteQuest = useCallback((id) => {
        setQuests(prev => prev.filter(q => q.id !== id));
    }, [setQuests]);

    const addHabit = useCallback((title, frequency = 'daily', frequencyParam = 1, rewardConfig = {}) => {
        const newHabit = {
            id: Date.now().toString(),
            title,
            frequency,
            frequencyParam,
            streak: 0,
            history: {},
            isActive: false,
            isToday: false,
            completionReward: Number(rewardConfig.completionReward ?? settings.protocolReward) || 0,
            passiveReward: Number(rewardConfig.passiveReward ?? 0) || 0,
            passivePaidThrough: null,
            createdAt: new Date().toISOString(),
        };

        setHabits(prev => [newHabit, ...prev]);
    }, [setHabits, settings.protocolReward]);

    const toggleHabitActivation = useCallback((id, isActive) => {
        const todayKey = getTodayISO();

        setHabits(prev => prev.map(h => {
            if (h.id !== id) return h;

            if (isActive) {
                return {
                    ...h,
                    isActive: true,
                    isToday: getDaysUntilDue(h) <= 0
                };
            }

            return {
                ...h,
                isActive: false,
                isToday: false,
                passivePaidThrough: getPausedPassivePaidThrough(h, todayKey)
            };
        }));
    }, [setHabits]);

    const checkHabit = useCallback((id, direction = 'positive') => {
        const today = getTodayISO();
        const currentHabit = habits.find(h => h.id === id);

        if (!currentHabit) return;

        if (direction === 'positive') {
            const { isDueToday } = getHabitCycleState(currentHabit, today);
            const completionReward = Number(currentHabit.completionReward ?? settings.protocolReward) || 0;

            addXp(5);

            if (isDueToday && completionReward > 0) {
                addGold(completionReward, 'Protocol', {
                    description: `Protocol due bonus: ${currentHabit.title}`
                });
                addRewardFromGold(completionReward);
            }

            setHabits(prev => prev.map(h => {
                if (h.id !== id) return h;

                const newHistory = { ...(h.history || {}) };
                const count = Number(newHistory[today] || 0);

                return {
                    ...h,
                    streak: Number(h.streak || 0) + 1,
                    history: { ...newHistory, [today]: count + 1 },
                    isActive: true,
                    isToday: false,
                    passivePaidThrough: today,
                    completionReward: Number(h.completionReward ?? settings.protocolReward) || 0,
                    passiveReward: Number(h.passiveReward || 0) || 0
                };
            }));
            return;
        }

        takeDamage(5);
        setHabits(prev => prev.map(h => {
            if (h.id !== id) return h;

            const newHistory = { ...(h.history || {}) };
            const count = Number(newHistory[today] || 0);

            return {
                ...h,
                streak: 0,
                history: { ...newHistory, [today]: count - 1 }
            };
        }));
    }, [addGold, addRewardFromGold, addXp, habits, setHabits, settings.protocolReward, takeDamage]);

    const deleteHabit = useCallback((id) => {
        setHabits(prev => prev.filter(h => h.id !== id));
    }, [setHabits]);

    const toggleToday = useCallback((id, type) => {
        if (type === 'quest') {
            setQuests(prev => prev.map(q => q.id === id ? { ...q, isToday: !q.isToday } : q));
            return;
        }

        if (type === 'habit') {
            setHabits(prev => prev.map(h => h.id === id ? { ...h, isToday: !h.isToday } : h));
        }
    }, [setHabits, setQuests]);

    useEffect(() => {
        const todayKey = getTodayISO();
        const normalizedHabits = habits.map(habit => normalizeHabitRecord(habit, settings.protocolReward, todayKey));
        const hasChanges = normalizedHabits.some((habit, index) => habit !== habits[index]);

        if (!hasChanges) return;

        setHabits(normalizedHabits);
    }, [habits, setHabits, settings.protocolReward]);

    useEffect(() => {
        const today = getTodayISO();
        const lastLoginDate = stats.lastLoginDate;
        const rolloverKey = `${lastLoginDate || 'none'}=>${today}`;

        if (lastLoginDate === today) {
            dailyRolloverRef.current = '';
            return;
        }

        if (dailyRolloverRef.current === rolloverKey) {
            return;
        }

        dailyRolloverRef.current = rolloverKey;

        const normalizedHabits = habits.map(habit => normalizeHabitRecord(habit, settings.protocolReward, today));
        const passiveSettlement = settlePassiveIncome(normalizedHabits, today);
        const stipendSettlement = settleBudgetStipend(stipendAmount, stipendPeriod, stipendPaidThrough, today);
        const nextHabits = passiveSettlement.updatedHabits.map(refreshHabitDailyState);
        const habitsChanged = nextHabits.some((habit, index) => habit !== habits[index]);

        setQuests(prev => prev.map(q => ({
            ...q,
            isToday: q.dueDate === today && !q.completed
        })));

        if (habitsChanged) {
            setHabits(nextHabits);
        }

        removeCompletedGroceriesBefore(today);

        if (Number(stipendAmount) > 0 && !stipendPaidThrough) {
            setStipendPaidThrough(today);
        } else if (stipendSettlement.paidThrough !== stipendPaidThrough) {
            setStipendPaidThrough(stipendSettlement.paidThrough);
        }

        const totalRolloverGold = passiveSettlement.totalGold + stipendSettlement.totalGold;
        const rolloverLedgerEntries = [
            ...passiveSettlement.ledgerEntries,
            ...stipendSettlement.ledgerEntries
        ];

        if (totalRolloverGold > 0) {
            setStats(prev => ({
                ...prev,
                gold: Number(prev.gold || 0) + totalRolloverGold,
                lastLoginDate: today
            }));
            appendCoinHistoryEntries(rolloverLedgerEntries);
            addRewardFromGold(passiveSettlement.totalGold);
        } else {
            setStats(prev => ({ ...prev, lastLoginDate: today }));
        }

        setCalories(prev => ({ ...prev, current: 0 }));
    }, [
        addRewardFromGold,
        appendCoinHistoryEntries,
        habits,
        removeCompletedGroceriesBefore,
        setCalories,
        setHabits,
        setQuests,
        setStipendPaidThrough,
        setStats,
        settings.protocolReward,
        stats.lastLoginDate,
        stipendAmount,
        stipendPaidThrough,
        stipendPeriod
    ]);

    useEffect(() => {
        const hasExpiredDiscardedQuests = quests.some(
            quest => quest.discarded && quest.discardedAt && !isWithinDays(quest.discardedAt, 7)
        );

        if (!hasExpiredDiscardedQuests) return;

        setQuests(prev => prev.filter(
            quest => !(quest.discarded && quest.discardedAt && !isWithinDays(quest.discardedAt, 7))
        ));
    }, [quests, setQuests]);

    const contextValue = useMemo(() => ({
        stats, quests, habits, settings, calories, coinHistory,
        addQuest, completeQuest, deleteQuest, restoreQuest, updateQuest, permanentDeleteQuest, undoCompleteQuest,
        addHabit, checkHabit, deleteHabit, toggleHabitActivation,
        updateStats, updateSettings, addCalories, setCalorieGoal, spendCoins, addGold,
        toggleToday
    }), [
        stats, quests, habits, settings, calories, coinHistory,
        addQuest, completeQuest, deleteQuest, restoreQuest, updateQuest, permanentDeleteQuest, undoCompleteQuest,
        addHabit, checkHabit, deleteHabit, toggleHabitActivation,
        updateStats, updateSettings, addCalories, setCalorieGoal, spendCoins, addGold,
        toggleToday
    ]);

    return (
        <GameContext.Provider value={contextValue}>
            {children}
        </GameContext.Provider>
    );
};
