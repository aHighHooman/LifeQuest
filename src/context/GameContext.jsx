import React, { createContext, useContext, useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useBudget } from './BudgetContext';

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

export const GameProvider = ({ children }) => {
    const { addRewardFromGold } = useBudget();
    const [stats, setStats] = useState(() => {
        try {
            const saved = localStorage.getItem('lq_stats');
            const parsed = saved ? JSON.parse(saved) : null;
            return parsed || INITIAL_STATS;
        } catch (e) {
            console.error("Error loading stats:", e);
            return INITIAL_STATS;
        }
    });

    const [quests, setQuests] = useState(() => {
        try {
            const saved = localStorage.getItem('lq_quests');
            const parsed = saved ? JSON.parse(saved) : null;
            return Array.isArray(parsed) ? parsed : INITIAL_TASKS;
        } catch (e) {
            console.error("Error loading quests:", e);
            return INITIAL_TASKS;
        }
    });

    const [habits, setHabits] = useState(() => {
        try {
            const saved = localStorage.getItem('lq_habits');
            const parsed = saved ? JSON.parse(saved) : null;
            return Array.isArray(parsed) ? parsed : INITIAL_HABITS;
        } catch (e) {
            console.error("Error loading habits:", e);
            return INITIAL_HABITS;
        }
    });

    // --- DATA LOGGING & SETTINGS ---
    const [settings, setSettings] = useState(() => {
        try {
            const saved = localStorage.getItem('lq_settings');
            return saved ? JSON.parse(saved) : {
                protocolReward: 1,
                questRewards: {
                    easy: 5,
                    medium: 15,
                    hard: 40,
                    legendary: 100
                }
            };
        } catch (e) {
            return {
                protocolReward: 1,
                questRewards: {
                    easy: 5,
                    medium: 15,
                    hard: 40,
                    legendary: 100
                }
            };
        }
    });

    const [calories, setCalories] = useState(() => {
        try {
            const saved = localStorage.getItem('lq_calories');
            return saved ? JSON.parse(saved) : { current: 0, target: 2000, history: [] };
        } catch (e) {
            return { current: 0, target: 2000, history: [] };
        }
    });

    const [coinHistory, setCoinHistory] = useState(() => {
        try {
            const saved = localStorage.getItem('lq_coin_history');
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            return [];
        }
    });

    useEffect(() => {
        localStorage.setItem('lq_stats', JSON.stringify(stats));
        localStorage.setItem('lq_quests', JSON.stringify(quests));
        localStorage.setItem('lq_habits', JSON.stringify(habits));
        localStorage.setItem('lq_settings', JSON.stringify(settings));
        localStorage.setItem('lq_calories', JSON.stringify(calories));
        localStorage.setItem('lq_coin_history', JSON.stringify(coinHistory));
    }, [stats, quests, habits, settings, calories, coinHistory]);

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
            // Or aggregate by day? Let's do simple transaction log for now, aggregate data later for charts
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
    const addQuest = (title, difficulty = 'easy', dueDate = null, customReward = null) => {
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
            completed: false,
            reward: customReward || defaultRewards[difficulty] || defaultRewards.easy,
            createdAt: new Date().toISOString(),
        };
        setQuests(prev => [newQuest, ...prev]);
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
            createdAt: new Date().toISOString(),
        };
        setHabits(prev => [newHabit, ...prev]);
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

                    return { ...h, streak: h.streak + 1, history: { ...newHistory, [today]: count + 1 } };
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

    return (
        <GameContext.Provider value={{
            stats, quests, habits, settings, calories, coinHistory,
            addQuest, completeQuest, deleteQuest,
            addHabit, checkHabit, deleteHabit,
            updateStats, updateSettings, addCalories, setCalorieGoal, spendCoins
        }}>
            {children}
        </GameContext.Provider>
    );
};
