import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, Circle, Trash2, Plus, Sword, Settings, Calendar, DollarSign, X } from 'lucide-react';
import clsx from 'clsx';

const QuestItem = ({ quest, onComplete, onDelete }) => {
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className={clsx(
                "relative p-4 rounded-lg border-l-4 mb-3 transition-all group overflow-hidden",
                quest.completed ? "bg-slate-900/50 border-game-muted" : "bg-game-panel border-game-accent hover:shadow-neon hover:border-l-[6px]"
            )}
        >
            <div className="flex justify-between items-start gap-4">
                <div className="flex-1 min-w-0">
                    <h3 className={clsx("font-bold font-game text-lg truncate", quest.completed && "text-gray-500 line-through")}>
                        {quest.title}
                    </h3>
                    <div className="flex flex-wrap gap-2 mt-2 text-[10px] md:text-xs text-gray-400">
                        <span className={clsx(
                            "px-2 py-0.5 rounded uppercase font-bold tracking-wider",
                            quest.difficulty === 'easy' && "bg-slate-700 text-gray-300",
                            quest.difficulty === 'medium' && "bg-blue-900/50 text-blue-300",
                            quest.difficulty === 'hard' && "bg-red-900/50 text-red-300"
                        )}>
                            {quest.difficulty.toUpperCase()}
                        </span>
                        <span className="flex items-center gap-1 text-game-gold font-bold">
                            <Sword size={12} /> {quest.reward.xp + quest.reward.gold} VAL
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-1 md:gap-2 shrink-0">
                    {!quest.completed && (
                        <button
                            onClick={() => onComplete(quest.id)}
                            className="p-2 rounded-full hover:bg-game-accent/20 text-game-accent transition-colors"
                        >
                            <Circle size={24} />
                        </button>
                    )}
                    {quest.completed && (
                        <div className="p-2 text-game-success">
                            <CheckCircle size={24} />
                        </div>
                    )}
                    <button
                        onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                        className="p-2 rounded-full hover:bg-slate-700 text-gray-400 transition-colors"
                    >
                        <Settings size={18} />
                    </button>
                    <button
                        onClick={() => onDelete(quest.id)}
                        className="p-2 rounded-full hover:bg-rose-500/20 text-gray-600 hover:text-rose-500 md:opacity-0 group-hover:opacity-100 transition-all"
                    >
                        <Trash2 size={18} />
                    </button>
                </div>
            </div>

            <AnimatePresence>
                {isSettingsOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="mt-4 pt-4 border-t border-slate-700 overflow-hidden"
                    >
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Parameters</label>
                                <div className="space-y-1">
                                    {quest.dueDate && (
                                        <div className="flex items-center gap-2 text-xs text-game-accent font-medium">
                                            <Calendar size={12} /> {new Date(quest.dueDate).toLocaleDateString()}
                                        </div>
                                    )}
                                    <div className="flex items-center gap-2 text-xs text-game-gold font-medium">
                                        <DollarSign size={12} /> XP: {quest.reward.xp} | Gold: {quest.reward.gold}
                                    </div>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] text-gray-500 uppercase font-bold">Created</p>
                                <p className="text-[10px] text-gray-400">{new Date(quest.createdAt).toLocaleDateString()}</p>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

const QuestBoard = () => {
    const { quests, addQuest, completeQuest, deleteQuest } = useGame();
    const [newQuestTitle, setNewQuestTitle] = useState('');
    const [difficulty, setDifficulty] = useState('easy');
    const [dueDate, setDueDate] = useState('');
    const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
    const [customReward, setCustomReward] = useState({ xp: null, gold: null });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!newQuestTitle.trim()) return;

        const reward = (customReward.xp !== null || customReward.gold !== null)
            ? { xp: Number(customReward.xp || 0), gold: Number(customReward.gold || 0) }
            : null;

        addQuest(newQuestTitle, difficulty, dueDate || null, reward);
        setNewQuestTitle('');
        setDueDate('');
        setCustomReward({ xp: null, gold: null });
        setIsAdvancedOpen(false);
    };

    const activeQuests = quests.filter(q => !q.completed);
    const completedQuests = quests.filter(q => q.completed);

    return (
        <div className="pb-24 md:pb-0">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-3xl font-game font-bold text-white tracking-widest uppercase text-glow">
                        Active Quests
                    </h2>
                    <p className="text-sm text-gray-500">Current objectives and mission parameters.</p>
                </div>
                <span className="bg-game-accent/10 border border-game-accent/30 text-game-accent px-4 py-1 rounded-full text-xs font-bold shadow-[0_0_10px_rgba(56,189,248,0.2)]">
                    {activeQuests.length} ACTIVE
                </span>
            </div>

            <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700 mb-8 relative overflow-hidden">
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <div className="flex flex-col md:flex-row gap-4 items-end">
                        <div className="flex-1 w-full">
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Quest Directive</label>
                            <input
                                type="text"
                                value={newQuestTitle}
                                onChange={(e) => setNewQuestTitle(e.target.value)}
                                placeholder="New Objective..."
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-game-accent focus:shadow-neon transition-all"
                            />
                        </div>

                        <button
                            type="button"
                            onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
                            className={clsx(
                                "p-2 rounded-lg border transition-all",
                                isAdvancedOpen ? "bg-game-accent/20 border-game-accent text-game-accent" : "bg-slate-800 border-slate-700 text-gray-400 hover:text-white"
                            )}
                            title="Advanced Settings"
                        >
                            <Settings size={20} />
                        </button>

                        <button
                            type="submit"
                            className="w-full md:w-auto bg-game-accent hover:bg-cyan-400 text-slate-900 px-6 py-2 rounded-lg transition-colors flex items-center justify-center font-bold gap-2 shadow-neon"
                        >
                            <Plus size={20} /> <span className="md:hidden">Add Quest</span>
                        </button>
                    </div>

                    <AnimatePresence>
                        {isAdvancedOpen && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="space-y-4 pt-2 overflow-hidden border-t border-slate-800 mt-2"
                            >
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Difficulty</label>
                                        <select
                                            value={difficulty}
                                            onChange={(e) => setDifficulty(e.target.value)}
                                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-game-accent"
                                        >
                                            <option value="easy">Easy</option>
                                            <option value="medium">Medium</option>
                                            <option value="hard">Hard</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Due Date</label>
                                        <input
                                            type="date"
                                            value={dueDate}
                                            onChange={(e) => setDueDate(e.target.value)}
                                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:border-game-accent [color-scheme:dark]"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Custom Bounty (XP / Gold)</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="number"
                                                placeholder="XP"
                                                value={customReward.xp || ''}
                                                onChange={(e) => setCustomReward(p => ({ ...p, xp: e.target.value }))}
                                                className="w-1/2 bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-game-gold"
                                            />
                                            <input
                                                type="number"
                                                placeholder="Gold"
                                                value={customReward.gold || ''}
                                                onChange={(e) => setCustomReward(p => ({ ...p, gold: e.target.value }))}
                                                className="w-1/2 bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-game-gold"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </form>
            </div>

            <div className="space-y-4">
                <AnimatePresence mode='popLayout'>
                    {activeQuests.length === 0 && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-center text-gray-500 py-10 italic border-2 border-dashed border-slate-800 rounded-xl"
                        >
                            No active quests. Time to rest... or plan?
                        </motion.div>
                    )}

                    {activeQuests.map(quest => (
                        <QuestItem
                            key={quest.id}
                            quest={quest}
                            onComplete={completeQuest}
                            onDelete={deleteQuest}
                        />
                    ))}

                    {completedQuests.length > 0 && (
                        <div className="mt-12 pt-8 border-t border-slate-800">
                            <h4 className="text-gray-500 text-sm font-bold uppercase mb-6 tracking-widest">Mission Log (Completed)</h4>
                            {completedQuests.map(quest => (
                                <QuestItem
                                    key={quest.id}
                                    quest={quest}
                                    onComplete={() => { }}
                                    onDelete={deleteQuest}
                                />
                            ))}
                        </div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default QuestBoard;
