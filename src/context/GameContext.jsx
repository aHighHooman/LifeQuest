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
            return saved ? JSON.parse(saved) : INITIAL_STATS;
        } catch (e) {
            console.error("Error loading stats:", e);
            return INITIAL_STATS;
        }
    });

    const [quests, setQuests] = useState(() => {
        try {
            const saved = localStorage.getItem('lq_quests');
            return saved ? JSON.parse(saved) : INITIAL_TASKS;
        } catch (e) {
            console.error("Error loading quests:", e);
            return INITIAL_TASKS;
        }
    });

    const [habits, setHabits] = useState(() => {
        try {
            const saved = localStorage.getItem('lq_habits');
            return saved ? JSON.parse(saved) : INITIAL_HABITS;
        } catch (e) {
            console.error("Error loading habits:", e);
            return INITIAL_HABITS;
        }
    });

    const [widgetMode, setWidgetMode] = useState(false);

    useEffect(() => {
        localStorage.setItem('lq_stats', JSON.stringify(stats));
        localStorage.setItem('lq_quests', JSON.stringify(quests));
        localStorage.setItem('lq_habits', JSON.stringify(habits));
    }, [stats, quests, habits]);

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
                // Play level up sound/effect here?
            }

            return { ...prev, xp: newXp, level: newLevel, maxXp: newMaxXp, hp: newHp };
        });
    };

    const addGold = (amount) => {
        setStats(prev => ({ ...prev, gold: prev.gold + amount }));
    };

    const takeDamage = (amount) => {
        setStats(prev => {
            const newHp = Math.max(0, prev.hp - amount);
            return { ...prev, hp: newHp };
        });
    };

    // --- QUESTS ---
    const addQuest = (title, difficulty = 'easy', dueDate = null, customReward = null) => {
        const defaultRewards = {
            easy: { xp: 10, gold: 5 },
            medium: { xp: 25, gold: 15 },
            hard: { xp: 50, gold: 40 },
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
                addGold(q.reward.gold);
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
        // frequency: 'daily', 'weekly', 'interval' (every X days), 'monthly'
        // frequencyParam: number (e.g. 2 for "every 2 days")
        const newHabit = {
            id: Date.now().toString(),
            title,
            frequency,
            frequencyParam,
            streak: 0,
            history: {}, // { "YYYY-MM-DD": 1 }
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

                // Prevent double checking for the same day if we want to be strict, 
                // but for a game, we might allow grinding. 
                // Let's allow grinding for now but maybe limit XP?

                if (direction === 'positive') {
                    // Bonus for maintaining streak vs simple completion?
                    // For now simple add.
                    addXp(5);
                    addGold(1);
                    addRewardFromGold(1);

                    // Logic to calculate if streak continues could be complex with custom intervals.
                    // We'll increment streak if this is the FIRST check of the "period".
                    // Simplified: just inc streak on check for now.

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
            stats, quests, habits, widgetMode, setWidgetMode,
            addQuest, completeQuest, deleteQuest,
            addHabit, checkHabit, deleteHabit
        }}>
            {children}
        </GameContext.Provider>
    );
};
