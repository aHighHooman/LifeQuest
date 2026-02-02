import React, { useState } from 'react';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { X, CheckCircle, Circle, Shield, Swords, Crosshair } from 'lucide-react';
import { useGame } from '../context/GameContext';

const FocusSelectionModal = ({ isOpen, onClose }) => {
    const { quests, habits, toggleToday } = useGame();
    const [activeTab, setActiveTab] = useState('quests'); // 'quests' | 'protocols'
    const dragControls = useDragControls();

    if (!isOpen) return null;

    const availableQuests = quests.filter(q => !q.completed && !q.discarded);
    const availableHabits = habits; // All habits are always available

    const toggleItem = (id, type) => {
        toggleToday(id, type);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-start justify-center" data-no-swipe="true">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                    />

                    {/* Modal Content - Top Dropdown (Hanging Style) */}
                    <motion.div
                        initial={{ y: "-100%" }}
                        animate={{ y: 0 }}
                        exit={{ y: "-100%" }}
                        transition={{ type: "spring", damping: 25, stiffness: 200 }}
                        drag="y"
                        dragListener={false}
                        dragControls={dragControls}
                        dragConstraints={{ top: -600, bottom: 0 }}
                        dragElastic={0.1}
                        onDragEnd={(e, info) => {
                            if (info.offset.y < -100) {
                                onClose();
                            }
                        }}
                        // Hanging Style: rounded-b-2xl ONLY. No border-t.
                        className="relative w-full max-w-lg bg-slate-900 border-b-2 border-x border-slate-700/80 rounded-b-3xl shadow-[0_20px_50px_-12px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col max-h-[75vh]"
                        style={{ marginTop: 0, touchAction: 'none' }}
                    >
                        {/* Header */}
                        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/95 backdrop-blur z-10">
                            <h2 className="text-lg font-game font-bold text-white tracking-wider flex items-center gap-2">
                                <Swords size={20} className="text-game-accent" />
                                Mission Control
                            </h2>
                            {/* "X" Button Removed for Blindfold Style */}
                        </div>

                        {/* Content List - Middle (Scrollable) */}
                        {/* data-no-swipe="true" checks Navigation.jsx to prevent drag gestures from triggering tab switch */}
                        <div
                            className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0 bg-slate-950/30"
                            data-no-swipe="true"
                        >
                            {activeTab === 'quests' ? (
                                availableQuests.length === 0 ? (
                                    <div className="text-center py-8 text-gray-500 italic border-2 border-dashed border-slate-800 rounded-xl">
                                        No pending objectives found.
                                    </div>
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
                                                        quest.difficulty === 'hard' ? 'bg-purple-500/20 text-purple-400' :
                                                            quest.difficulty === 'medium' ? 'bg-blue-500/20 text-blue-400' :
                                                                'bg-emerald-500/20 text-emerald-400'
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
                                    <div className="text-center py-8 text-gray-500 italic border-2 border-dashed border-slate-800 rounded-xl">
                                        No protocols found.
                                    </div>
                                ) : (
                                    availableHabits.map(habit => (
                                        <div
                                            key={habit.id}
                                            onClick={() => toggleItem(habit.id, 'habit')}
                                            className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all active:scale-[0.98] ${habit.isToday
                                                ? 'bg-purple-500/10 border-purple-500/50'
                                                : 'bg-slate-800/50 border-slate-700 hover:bg-slate-800'
                                                }`}
                                        >
                                            <div className={`p-1 rounded-full ${habit.isToday ? 'text-purple-400' : 'text-gray-500'}`}>
                                                {habit.isToday ? <CheckCircle size={20} className="fill-current" /> : <Circle size={20} />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className={`font-bold text-sm truncate ${habit.isToday ? 'text-white' : 'text-gray-300'}`}>
                                                    {habit.title}
                                                </div>
                                                <div className="text-[10px] text-gray-500 mt-1 capitalize flex items-center gap-2">
                                                    <span className="bg-slate-800 px-1.5 py-0.5 rounded">{habit.frequency}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )
                            )}
                        </div>

                        {/* Tabs - Moved Below List */}
                        <div className="flex p-2 gap-2 bg-slate-900 border-t border-slate-800 z-10 shrink-0">
                            <button
                                onClick={() => setActiveTab('quests')}
                                className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${activeTab === 'quests'
                                    ? 'bg-game-accent text-slate-900 shadow-[0_0_15px_rgba(56,189,248,0.3)]'
                                    : 'bg-slate-800 text-gray-400 hover:bg-slate-700'
                                    }`}
                            >
                                <Crosshair size={16} /> Objectives
                            </button>
                            <button
                                onClick={() => setActiveTab('protocols')}
                                className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${activeTab === 'protocols'
                                    ? 'bg-purple-500 text-white shadow-[0_0_15px_rgba(168,85,247,0.3)]'
                                    : 'bg-slate-800 text-gray-400 hover:bg-slate-700'
                                    }`}
                            >
                                <Shield size={16} /> Protocols
                            </button>
                        </div>

                        {/* Footer Button */}
                        {/* Drag Handle (Footer) - Blindfold Pull-Up Indicator */}
                        <div
                            onPointerDown={(e) => dragControls.start(e)}
                            className="w-full flex justify-center pb-6 pt-4 bg-slate-900 border-t border-slate-800/50 cursor-grab active:cursor-grabbing z-20 shrink-0 touch-none"
                        >
                            <div className="w-16 h-1.5 bg-slate-600/50 rounded-full" />
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default FocusSelectionModal;
