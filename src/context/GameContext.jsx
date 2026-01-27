import React, { createContext, useContext, useState, useEffect } from 'react';
import { useBudget } from './BudgetContext';
import { usePersistentState } from '../utils/persistence';
import { getDaysUntilDue } from '../utils/gameLogic';
import { getTodayISO } from '../utils/dateUtils';


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
        const today = getTodayISO();
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
        // ALLOW NEGATIVE: Removed check
        // if (stats.gold < amount) return false;

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
        const numAmount = Number(amount);
        setStats(prev => {
            let newXp = Number(prev.xp || 0) + numAmount;
            let newLevel = prev.level;
            let newMaxXp = prev.maxXp;
            let newHp = prev.hp;
            let newMaxHp = prev.maxHp;

            // Level Up Logic
            while (newXp >= newMaxXp) {
                newLevel += 1;
                newXp -= newMaxXp;
                newMaxXp = Math.floor(newMaxXp * 1.2);
                newHp = newMaxHp; // Heal on level up
            }

            // Level Down Logic (Handle Negative XP)
            while (newXp < 0 && newLevel > 1) {
                newLevel -= 1;
                // Reverse growth formula: Math.floor(prev * 1.2) -> Math.ceil(current / 1.2)
                newMaxXp = Math.ceil(newMaxXp / 1.2);
                newXp += newMaxXp;
            }

            return { ...prev, xp: newXp, level: newLevel, maxXp: newMaxXp, hp: newHp };
        });
    };

    const addGold = (amount, source = 'reward') => {
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
            // If customReward is passed, use it. Otherwise use defaults. Flag it.
            reward: customReward || defaultRewards[difficulty] || defaultRewards.easy,
            isCustomReward: !!customReward,
            createdAt: new Date().toISOString(),
        };
        setQuests(prev => [newQuest, ...prev]);
    };

    const updateQuest = (id, updates) => {
        setQuests(prev => prev.map(q => q.id === id ? { ...q, ...updates } : q));
    };

    const completeQuest = (id) => {
        const quest = quests.find(q => q.id === id);
        if (!quest || quest.completed) return;

        const diff = quest.difficulty || 'easy';
        const xpAmount = Number(quest.reward.xp || 0);
        let goldAmount = Number(quest.reward.gold || 0);

        // If not custom, force use of settings
        if (!quest.isCustomReward) {
            const settingVal = settings.questRewards[diff];
            if (settingVal !== undefined) {
                goldAmount = Number(settingVal);
            }
        }

        // Side Effects (Run only once)
        addXp(xpAmount);
        addGold(goldAmount, 'Quest');
        addRewardFromGold(goldAmount);

        setQuests(prev => prev.map(q => {
            if (q.id === id) {
                return {
                    ...q,
                    completed: true,
                    completedAt: new Date().toISOString(),
                    completedReward: { xp: xpAmount, gold: goldAmount } // Snapshot used for undo stability
                };
            }
            return q;
        }));
    };

    const undoCompleteQuest = (id) => {
        const quest = quests.find(q => q.id === id);
        if (!quest || !quest.completed) return;

        let xpAmount = 0;
        let goldAmount = 0;

        // Strategy 1: Use Snapshot (Best for accuracy)
        if (quest.completedReward) {
            xpAmount = Number(quest.completedReward.xp || 0);
            goldAmount = Number(quest.completedReward.gold || 0);
        } else {
            // Strategy 2: Reconstruct logic (Fallback for legacy data)
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

        // Update Quest State - clear snapshot
        setQuests(prev => prev.map(q => q.id === id ? { ...q, completed: false, completedAt: null, completedReward: null } : q));
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
        setHabits(prev => prev.map(h => {
            if (h.id === id) {
                // Reactive Update: If activating, check if due and add to dashboard
                let isToday = h.isToday;
                if (isActive) {
                    const daysUntil = getDaysUntilDue(h);
                    if (daysUntil <= 0) {
                        isToday = true;
                    }
                } else {
                    // Optionally remove from dashboard if deactivated?
                    // User said "move to database", implying it leaves the active view.
                    // It makes sense to set isToday = false if deactivated.
                    isToday = false;
                }

                return { ...h, isActive, isToday };
            }
            return h;
        }));
    };


    const checkHabit = (id, direction = 'positive') => {
        const today = getTodayISO();
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
        const today = getTodayISO();
        const lastLoginDate = stats.lastLoginDate;

        // --- DAILY RESET & AUTO-ADD LOGIC ---
        if (lastLoginDate !== today) {
            console.log("New Day Detected! Performing Daily Reset...");

            // 1. Reset 'isToday' for all
            // 2. Auto-Add Quests due today
            setQuests(prev => prev.map(q => {
                let shouldBeToday = false;
                // If it was already today, but day changed, we reset it (unless it's due today, then we read it)
                // Actually, logic: RESET everything. Then ADD what is due.

                // Check if due today
                if (q.dueDate === today && !q.completed) {
                    shouldBeToday = true;
                }

                return { ...q, isToday: shouldBeToday };
            }));

            // 3. Auto-Add Protocols due today
            setHabits(prev => prev.map(h => {
                // If inactive, ignore
                if (h.isActive === false) return { ...h, isToday: false };

                // Calculate if due
                const daysUntil = getDaysUntilDue(h);
                const isDue = daysUntil <= 0;

                return { ...h, isToday: isDue };
            }));

            // 4. Daily Calorie Reset
            setCalories(prev => ({ ...prev, current: 0 }));

            // Update Last Login Date
            setStats(prev => ({ ...prev, lastLoginDate: today }));
        }

        // MIGRATION: Ensure all existing habits have isActive: true
        setHabits(prev => prev.map(h => {
            if (h.isActive === undefined) {
                return { ...h, isActive: true };
            }
            return h;
        }));

    }, []); // Run once on mount (dependency array empty so it runs on load)

    return (
        <GameContext.Provider value={{
            stats, quests, habits, settings, calories, coinHistory,
            addQuest, completeQuest, deleteQuest, restoreQuest, updateQuest, permanentDeleteQuest, undoCompleteQuest,
            addHabit, checkHabit, deleteHabit, toggleHabitActivation,
            updateStats, updateSettings, addCalories, setCalorieGoal, spendCoins,
            toggleToday
        }}>
            {children}
        </GameContext.Provider>
    );
};
