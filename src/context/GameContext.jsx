import React, { createContext, useContext, useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useBudget } from './BudgetContext';
import { usePersistentState } from '../utils/persistence';

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
    const { addRewardFromGold } = useBudget();

    // Using usePersistentState for automatic localStorage handling and backup on corruption
    const [stats, setStats] = usePersistentState('lq_stats', INITIAL_STATS);
    const [quests, setQuests] = usePersistentState('lq_quests', INITIAL_TASKS);
    const [habits, setHabits] = usePersistentState('lq_habits', INITIAL_HABITS);
    const [settings, setSettings] = usePersistentState('lq_settings', INITIAL_SETTINGS);
    const [calories, setCalories] = usePersistentState('lq_calories', INITIAL_CALORIES);
    const [coinHistory, setCoinHistory] = usePersistentState('lq_coin_history', INITIAL_COIN_HISTORY);

    // --- ACTIONS ---

    // Direct Stats Modification (for Debug/Settings Menu)
    const updateStats = (newStats) => {
        setStats(prev => ({ ...prev, ...newStats }));
    };

    const updateSettings = (newSettings) => {
        setSettings(prev => ({ ...prev, ...newSettings }));
    };

    // Calorie Tracking
    const addCalories = (amount) => {
        const today = new Date().toISOString().split('T')[0];
        setCalories(prev => {
            const newCurrent = Math.max(0, prev.current + amount);
            // Simple history tracking: array of { date, amount }
            const newEntry = { date: new Date().toISOString(), amount: amount };
            return { ...prev, current: newCurrent, history: [...prev.history, newEntry] };
        });
    };

    const setCalorieGoal = (amount) => {
        setCalories(prev => ({ ...prev, target: amount }));
    };

    // Misc Coin Spending
    const spendCoins = (amount, description) => {
        if (stats.gold < amount) return false;

        setStats(prev => ({ ...prev, gold: prev.gold - amount }));
        setCoinHistory(prev => [...prev, {
            id: Date.now().toString(),
            date: new Date().toISOString(),
            amount,
            description,
            type: 'spent'
        }]);
        return true;
    };

    const addXp = (amount) => {
        setStats(prev => {
            let newXp = prev.xp + amount;
            let newLevel = prev.level;
            let newMaxXp = prev.maxXp;
            let newHp = prev.hp;
            let newMaxHp = prev.maxHp;

            if (newXp >= prev.maxXp) {
                newLevel += 1;
                newXp -= prev.maxXp;
                newMaxXp = Math.floor(prev.maxXp * 1.2);
                newHp = newMaxHp; // Heal on level up
            }

            return { ...prev, xp: newXp, level: newLevel, maxXp: newMaxXp, hp: newHp };
        });
    };

    const addGold = (amount, source = 'reward') => {
        setStats(prev => ({ ...prev, gold: prev.gold + amount }));
        if (amount > 0) {
            setCoinHistory(prev => [...prev, {
                id: Date.now().toString(),
                date: new Date().toISOString(),
                amount,
                description: `Earned from ${source}`,
                type: 'earned'
            }]);
        }
    };

    const takeDamage = (amount) => {
        setStats(prev => {
            const newHp = Math.max(0, prev.hp - amount);
            return { ...prev, hp: newHp };
        });
    };

    // --- QUESTS ---
    const addQuest = (title, difficulty = 'easy', dueDate = null, customReward = null, missionBrief = '') => {
        // Use settings for rewards if not custom
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
            createdAt: new Date().toISOString(),
        };
        setQuests(prev => [newQuest, ...prev]);
    };

    const updateQuest = (id, updates) => {
        setQuests(prev => prev.map(q => q.id === id ? { ...q, ...updates } : q));
    };

    const completeQuest = (id) => {
        setQuests(prev => prev.map(q => {
            if (q.id === id && !q.completed) {
                addXp(q.reward.xp);
                addGold(q.reward.gold, 'Quest');
                addRewardFromGold(q.reward.gold);
                return { ...q, completed: true, completedAt: new Date().toISOString() };
            }
            return q;
        }));
    };

    const deleteQuest = (id) => {
        // Soft delete (discard)
        setQuests(prev => prev.map(q => q.id === id ? { ...q, discarded: true, discardedAt: new Date().toISOString() } : q));
    };

    const restoreQuest = (id) => {
        setQuests(prev => prev.map(q => q.id === id ? { ...q, discarded: false, discardedAt: null } : q));
    };

    const permanentDeleteQuest = (id) => {
        setQuests(prev => prev.filter(q => q.id !== id));
    };

    // --- HABITS ---
    const addHabit = (title, frequency = 'daily', frequencyParam = 1) => {
        const newHabit = {
            id: Date.now().toString(),
            title,
            frequency,
            frequencyParam,
            streak: 0,
            history: {},
            isActive: false, // Default to inactive until first success or manual activation
            createdAt: new Date().toISOString(),
        };
        setHabits(prev => [newHabit, ...prev]);
    };

    const toggleHabitActivation = (id, isActive) => {
        setHabits(prev => prev.map(h => h.id === id ? { ...h, isActive } : h));
    };

    const checkHabit = (id, direction = 'positive') => {
        const today = new Date().toISOString().split('T')[0];
        setHabits(prev => prev.map(h => {
            if (h.id === id) {
                const newHistory = { ...h.history };
                const count = newHistory[today] || 0;

                if (direction === 'positive') {
                    addXp(5);
                    addGold(settings.protocolReward, 'Protocol');
                    addRewardFromGold(settings.protocolReward);

                    // Auto-activate on first success
                    return {
                        ...h,
                        streak: h.streak + 1,
                        history: { ...newHistory, [today]: count + 1 },
                        isActive: true
                    };
                } else {
                    takeDamage(5);
                    return { ...h, streak: 0, history: { ...newHistory, [today]: count - 1 } };
                }
            }
            return h;
        }));
    };

    const deleteHabit = (id) => {
        setHabits(prev => prev.filter(h => h.id !== id));
    };

    // --- TODAY'S FOCUS MANAGEMENT ---
    const toggleToday = (id, type) => {
        if (type === 'quest') {
            setQuests(prev => prev.map(q => {
                if (q.id === id) {
                    return { ...q, isToday: !q.isToday };
                }
                return q;
            }));
        } else if (type === 'habit') {
            setHabits(prev => prev.map(h => {
                if (h.id === id) {
                    return { ...h, isToday: !h.isToday };
                }
                return h;
            }));
        }
    };

    // Auto-populate logic (run on load or day change)
    useEffect(() => {
        const today = new Date().toISOString().split('T')[0];

        setQuests(prev => prev.map(q => {
            // If due date is today AND not completed/already in focus
            if (q.dueDate === today && !q.completed && !q.isToday) {
                return { ...q, isToday: true };
            }
            return q;
        }));

        // MIGRATION: Ensure all existing habits have isActive: true
        setHabits(prev => prev.map(h => {
            if (h.isActive === undefined) {
                return { ...h, isActive: true };
            }
            return h;
        }));

    }, []); // Run once on mount for now

    return (
        <GameContext.Provider value={{
            stats, quests, habits, settings, calories, coinHistory,
            addQuest, completeQuest, deleteQuest, restoreQuest, updateQuest, permanentDeleteQuest,
            addHabit, checkHabit, deleteHabit, toggleHabitActivation,
            updateStats, updateSettings, addCalories, setCalorieGoal, spendCoins,
            toggleToday
        }}>
            {children}
        </GameContext.Provider>
    );
};
