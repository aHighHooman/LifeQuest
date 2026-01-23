import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, Circle, Shield, Swords } from 'lucide-react';
import { useGame } from '../context/GameContext';

const FocusSelectionModal = ({ isOpen, onClose }) => {
    const { quests, habits, toggleToday } = useGame();
    const [activeTab, setActiveTab] = useState('quests'); // 'quests' | 'protocols'

    if (!isOpen) return null;

    const availableQuests = quests.filter(q => !q.completed);
    const availableHabits = habits; // All habits are always available

    const toggleItem = (id, type) => {
        toggleToday(id, type);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                    />

                    {/* Modal Content */}
                    <motion.div
                        initial={{ y: "100%" }}
                        animate={{ y: 0 }}
                        exit={{ y: "100%" }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        className="relative w-full max-w-lg bg-slate-900 border-t border-slate-700 rounded-t-2xl sm:rounded-2xl sm:border max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
                    >
                        {/* Header */}
                        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/90 backdrop-blur z-10">
                            <h2 className="text-lg font-game font-bold text-white tracking-wider">Plan Your Day</h2>
                            <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-800 text-gray-400 hover:text-white transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Tabs */}
                        <div className="flex p-2 gap-2 bg-slate-950/50">
                            <button
                                onClick={() => setActiveTab('quests')}
                                className={`flex-1 py-2 px-4 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${activeTab === 'quests'
                                    ? 'bg-game-accent text-slate-900 shadow-[0_0_10px_rgba(56,189,248,0.4)]'
                                    : 'bg-slate-800 text-gray-400 hover:bg-slate-700'
                                    }`}
                            >
                                <Swords size={16} /> Objectives
                            </button>
                            <button
                                onClick={() => setActiveTab('protocols')}
                                className={`flex-1 py-2 px-4 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${activeTab === 'protocols'
                                    ? 'bg-game-gold text-slate-900 shadow-[0_0_10px_rgba(255,215,0,0.4)]'
                                    : 'bg-slate-800 text-gray-400 hover:bg-slate-700'
                                    }`}
                            >
                                <Shield size={16} /> Protocols
                            </button>
                        </div>

                        {/* Content List */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-20">
                            {activeTab === 'quests' ? (
                                availableQuests.length === 0 ? (
                                    <div className="text-center py-10 text-gray-500 italic">No pending objectives found.</div>
                                ) : (
                                    availableQuests.map(quest => (
                                        <div
                                            key={quest.id}
                                            onClick={() => toggleItem(quest.id, 'quest')}
                                            className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all active:scale-[0.98] ${quest.isToday
                                                ? 'bg-game-accent/10 border-game-accent/50'
                                                : 'bg-slate-800/50 border-slate-700 hover:bg-slate-800'
                                                }`}
                                        >
                                            <div className={`p-1 rounded-full ${quest.isToday ? 'text-game-accent' : 'text-gray-500'}`}>
                                                {quest.isToday ? <CheckCircle size={20} className="fill-current" /> : <Circle size={20} />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className={`font-bold text-sm truncate ${quest.isToday ? 'text-white' : 'text-gray-300'}`}>
                                                    {quest.title}
                                                </div>
                                                <div className="flex gap-2 text-[10px] mt-1">
                                                    <span className={`px-1.5 py-0.5 rounded capitalize ${quest.difficulty === 'legendary' ? 'bg-orange-500/20 text-orange-400' :
                                                            quest.difficulty === 'hard' ? 'bg-red-500/20 text-red-400' :
                                                                quest.difficulty === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                                                                    'bg-green-500/20 text-green-400'
                                                        }`}>
                                                        {quest.difficulty}
                                                    </span>
                                                    {quest.dueDate && (
                                                        <span className="text-gray-500">Due: {quest.dueDate}</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )
                            ) : (
                                // Protocols Tab
                                availableHabits.length === 0 ? (
                                    <div className="text-center py-10 text-gray-500 italic">No protocols found.</div>
                                ) : (
                                    availableHabits.map(habit => (
                                        <div
                                            key={habit.id}
                                            onClick={() => toggleItem(habit.id, 'habit')}
                                            className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all active:scale-[0.98] ${habit.isToday
                                                ? 'bg-game-gold/10 border-game-gold/50'
                                                : 'bg-slate-800/50 border-slate-700 hover:bg-slate-800'
                                                }`}
                                        >
                                            <div className={`p-1 rounded-full ${habit.isToday ? 'text-game-gold' : 'text-gray-500'}`}>
                                                {habit.isToday ? <CheckCircle size={20} className="fill-current" /> : <Circle size={20} />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className={`font-bold text-sm truncate ${habit.isToday ? 'text-white' : 'text-gray-300'}`}>
                                                    {habit.title}
                                                </div>
                                                <div className="text-[10px] text-gray-500 mt-1 capitalize">
                                                    {habit.frequency}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )
                            )}
                        </div>

                        {/* Footer Button (Mobile Sticky) */}
                        <div className="p-4 border-t border-slate-800 bg-slate-900/95 backdrop-blur absolute bottom-0 w-full">
                            <button
                                onClick={onClose}
                                className="w-full bg-white text-slate-900 font-game font-bold py-3 rounded-xl shadow-lg active:scale-[0.98] transition-transform"
                            >
                                Confirm Selection
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default FocusSelectionModal;
