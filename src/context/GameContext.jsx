import React, { createContext, useCallback, useContext, useEffect, useMemo } from 'react';
import { useBudget } from './BudgetContext';
import { usePersistentState } from '../utils/persistence';
import { getDaysUntilDue } from '../utils/gameLogic';
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

export const GameProvider = ({ children }) => {
    const { addRewardFromGold, removeRewardFromGold } = useBudget();

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

    const spendCoins = useCallback((amount, description) => {
        setStats(prev => ({ ...prev, gold: prev.gold - amount }));
        setCoinHistory(prev => [...prev, {
            id: Date.now().toString(),
            date: new Date().toISOString(),
            amount,
            description,
            type: 'spent'
        }]);
        return true;
    }, [setCoinHistory, setStats]);

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

    const addGold = useCallback((amount, source = 'reward') => {
        const numAmount = Number(amount);
        setStats(prev => ({ ...prev, gold: Number(prev.gold || 0) + numAmount }));

        if (numAmount !== 0) {
            setCoinHistory(prev => [...prev, {
                id: Date.now().toString(),
                date: new Date().toISOString(),
                amount: numAmount,
                description: numAmount > 0 ? `Earned from ${source}` : `Reverted ${source}`,
                type: numAmount > 0 ? 'earned' : 'spent'
            }]);
        }
    }, [setCoinHistory, setStats]);

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

    const addHabit = useCallback((title, frequency = 'daily', frequencyParam = 1) => {
        const newHabit = {
            id: Date.now().toString(),
            title,
            frequency,
            frequencyParam,
            streak: 0,
            history: {},
            isActive: false,
            createdAt: new Date().toISOString(),
        };

        setHabits(prev => [newHabit, ...prev]);
    }, [setHabits]);

    const toggleHabitActivation = useCallback((id, isActive) => {
        setHabits(prev => prev.map(h => {
            if (h.id !== id) return h;

            let isToday = h.isToday;
            if (isActive) {
                const daysUntil = getDaysUntilDue(h);
                if (daysUntil <= 0) {
                    isToday = true;
                }
            } else {
                isToday = false;
            }

            return { ...h, isActive, isToday };
        }));
    }, [setHabits]);

    const checkHabit = useCallback((id, direction = 'positive') => {
        const today = getTodayISO();
        setHabits(prev => prev.map(h => {
            if (h.id !== id) return h;

            const newHistory = { ...h.history };
            const count = newHistory[today] || 0;

            if (direction === 'positive') {
                addXp(5);
                addGold(settings.protocolReward, 'Protocol');
                addRewardFromGold(settings.protocolReward);

                return {
                    ...h,
                    streak: h.streak + 1,
                    history: { ...newHistory, [today]: count + 1 },
                    isActive: true
                };
            }

            takeDamage(5);
            return { ...h, streak: 0, history: { ...newHistory, [today]: count - 1 } };
        }));
    }, [addGold, addRewardFromGold, addXp, setHabits, settings.protocolReward, takeDamage]);

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
        const today = getTodayISO();
        const lastLoginDate = stats.lastLoginDate;

        if (lastLoginDate !== today) {
            setQuests(prev => prev.map(q => ({
                ...q,
                isToday: q.dueDate === today && !q.completed
            })));

            setHabits(prev => prev.map(h => {
                if (h.isActive === false) return { ...h, isToday: false };

                const isDue = getDaysUntilDue(h) <= 0;
                return { ...h, isToday: isDue };
            }));

            setCalories(prev => ({ ...prev, current: 0 }));
            setStats(prev => ({ ...prev, lastLoginDate: today }));
        }

        const hasLegacyHabit = habits.some(h => h.isActive === undefined);
        if (hasLegacyHabit) {
            setHabits(prev => prev.map(h => (
                h.isActive === undefined ? { ...h, isActive: true } : h
            )));
        }
    }, [habits, setCalories, setHabits, setQuests, setStats, stats.lastLoginDate]);

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
        updateStats, updateSettings, addCalories, setCalorieGoal, spendCoins,
        toggleToday
    }), [
        stats, quests, habits, settings, calories, coinHistory,
        addQuest, completeQuest, deleteQuest, restoreQuest, updateQuest, permanentDeleteQuest, undoCompleteQuest,
        addHabit, checkHabit, deleteHabit, toggleHabitActivation,
        updateStats, updateSettings, addCalories, setCalorieGoal, spendCoins,
        toggleToday
    ]);

    return (
        <GameContext.Provider value={contextValue}>
            {children}
        </GameContext.Provider>
    );
};
