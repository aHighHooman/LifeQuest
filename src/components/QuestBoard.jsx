import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, Circle, Trash2, Plus, Sword, Settings, Calendar, DollarSign, X } from 'lucide-react';
import clsx from 'clsx';

const QuestItem = ({ quest, onComplete, onDelete }) => {
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    const rarityColors = {
        easy: { border: "border-slate-500", text: "text-gray-300", bg: "bg-slate-700/30", glow: "shadow-none", label: "Common" },
        medium: { border: "border-blue-500", text: "text-blue-400", bg: "bg-blue-900/20", glow: "shadow-[0_0_15px_rgba(56,189,248,0.2)]", label: "Rare" },
        hard: { border: "border-purple-500", text: "text-purple-400", bg: "bg-purple-900/20", glow: "shadow-[0_0_20px_rgba(168,85,247,0.3)]", label: "Epic" },
        legendary: { border: "border-game-gold", text: "text-game-gold", bg: "bg-game-gold/10", glow: "shadow-[0_0_25px_rgba(255,215,0,0.4)]", label: "Legendary" }
    };

    const rarity = rarityColors[quest.difficulty] || rarityColors.easy;

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            whileHover={{ scale: 1.01, transition: { duration: 0.2 } }}
            className={clsx(
                "relative p-4 rounded-xl border-l-4 mb-3 transition-all group overflow-hidden",
                quest.completed
                    ? "bg-slate-900/50 border-game-muted opacity-60"
                    : `${rarity.bg} ${rarity.border} ${rarity.glow} hover:border-l-[8px]`
            )}
        >
            {/* Background Glow Effect */}
            {!quest.completed && (
                <div className={clsx(
                    "absolute top-0 right-0 w-32 h-32 -mr-16 -mt-16 rounded-full blur-3xl opacity-20 transition-colors",
                    rarity.text.replace('text-', 'bg-')
                )} />
            )}

            <div className="flex justify-between items-start gap-4 relative z-10">
                <div className="flex-1 min-w-0">
                    <h3 className={clsx(
                        "font-bold font-game text-lg truncate transition-colors",
                        quest.completed ? "text-gray-500 line-through" : "text-slate-100"
                    )}>
                        {quest.title}
                    </h3>
                    <div className="flex flex-wrap gap-2 mt-2 text-[10px] md:text-xs">
                        <span className={clsx(
                            "px-2 py-0.5 rounded-full uppercase font-black tracking-widest border",
                            quest.completed ? "bg-slate-800 border-slate-700 text-gray-500" : `bg-black/40 ${rarity.border} ${rarity.text}`
                        )}>
                            {rarity.label}
                        </span>
                        <span className="flex items-center gap-1 text-game-gold font-bold bg-black/40 px-2 py-0.5 rounded-full border border-game-gold/20">
                            <Sword size={12} /> {quest.reward.xp + quest.reward.gold} VAL
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-1 md:gap-2 shrink-0">
                    {!quest.completed && (
                        <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => onComplete(quest.id)}
                            className={clsx(
                                "p-2 rounded-full transition-all",
                                `hover:${rarity.bg} ${rarity.text}`
                            )}
                        >
                            <Circle size={28} strokeWidth={2.5} />
                        </motion.button>
                    )}
                    {quest.completed && (
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="p-2 text-game-success"
                        >
                            <CheckCircle size={28} strokeWidth={2.5} />
                        </motion.div>
                    )}
                    <button
                        onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                        className="p-2 rounded-full hover:bg-slate-800 text-gray-400 transition-colors"
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
                        className="mt-4 pt-4 border-t border-slate-700/50 overflow-hidden relative z-10"
                    >
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Mission Specs</label>
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
                                <p className="text-[10px] text-gray-500 uppercase font-bold">Logged</p>
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
                        <div className="flex-1 w-full relative">
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Quest Directive</label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={newQuestTitle}
                                    onChange={(e) => setNewQuestTitle(e.target.value)}
                                    placeholder="New Objective..."
                                    className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-game-accent focus:shadow-neon transition-all"
                                />
                                <button
                                    type="button"
                                    onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
                                    className={clsx(
                                        "p-2 rounded-lg border transition-all shrink-0",
                                        isAdvancedOpen ? "bg-game-accent/20 border-game-accent text-game-accent" : "bg-slate-800 border-slate-700 text-gray-400 hover:text-white"
                                    )}
                                    title="Advanced Settings"
                                >
                                    <Settings size={20} />
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            className="w-full md:w-auto bg-game-accent hover:bg-cyan-400 text-slate-900 px-6 py-2 rounded-lg transition-colors flex items-center justify-center font-bold gap-2 shadow-neon h-[42px]" // Added height to match input+padding roughly
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
                                            <option value="easy">Common</option>
                                            <option value="medium">Rare</option>
                                            <option value="hard">Epic</option>
                                            <option value="legendary">Legendary</option>
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
