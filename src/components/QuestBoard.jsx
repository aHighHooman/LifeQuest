import React, { useState, useMemo, useCallback } from 'react';
import { useGame } from '../context/GameContext';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { CheckCircle, Trash2, Plus, Sword, Settings, Calendar, X, RotateCcw } from 'lucide-react';
import clsx from 'clsx';
import { SPRING_CONFIG } from '../constants/animations';
import { isWithinDays } from '../utils/dateUtils';

const QuestDeckCard = ({ quest, index, onComplete, onDismiss, onSkip, isTop, onUpdate, onPrevious, custom }) => {
    const x = useMotionValue(0);
    const y = useMotionValue(0);
    const rotate = useTransform(x, [-200, 200], [-30, 30]);

    // Background colors for swipe feedback
    const bgRight = useTransform(x, [0, 150], ["rgba(0,0,0,0)", "rgba(16, 185, 129, 0.5)"]);
    const bgLeft = useTransform(x, [-150, 0], ["rgba(244, 63, 94, 0.5)", "rgba(0,0,0,0)"]);

    const [showDetails, setShowDetails] = useState(false);
    const [isEditingBrief, setIsEditingBrief] = useState(false);
    const [localBrief, setLocalBrief] = useState(quest.missionBrief || '');

    const handleDragEnd = (event, info) => {
        const swipeThreshold = 100;
        if (info.offset.x > swipeThreshold) {
            onComplete(quest.id);
        } else if (info.offset.x < -swipeThreshold) {
            onDismiss(quest.id);
        } else if (info.offset.y < -swipeThreshold) {
            // Swipe Up - Skip/Cycle (Reorder)
            onSkip(quest.id);
        } else if (info.offset.y > swipeThreshold) {
            // Swipe Down - Previous
            if (onPrevious) onPrevious();
        }
    };

    const toggleDetails = () => {
        if (!isEditingBrief) {
            setShowDetails(!showDetails);
        }
    };

    const handleBriefLongPress = () => {
        if (showDetails) {
            setIsEditingBrief(true);
            setLocalBrief(quest.missionBrief || '');
        }
    };

    const saveBrief = (e) => {
        e.stopPropagation();
        onUpdate(quest.id, { missionBrief: localBrief });
        setIsEditingBrief(false);
    };

    const rarityColors = {
        // Updated 'easy' to be emerald/green based
        easy: { border: "border-emerald-500", text: "text-emerald-400", bg: "bg-slate-900", shadow: "shadow-emerald-500/20" },
        medium: { border: "border-blue-500", text: "text-blue-400", bg: "bg-slate-900", shadow: "shadow-blue-500/40" },
        hard: { border: "border-purple-500", text: "text-purple-400", bg: "bg-slate-900", shadow: "shadow-purple-500/40" },
        legendary: { border: "border-game-gold", text: "text-game-gold", bg: "bg-slate-950", shadow: "shadow-game-gold/40" }
    };

    const rarity = rarityColors[quest.difficulty] || rarityColors.easy;

    return (
        <motion.div
            style={{
                x,
                y: isTop ? y : 0,
                rotate: isTop ? rotate : 0,
                zIndex: 100 - index,
                scale: 1 - index * 0.05,
                top: index * 10
            }}
            drag={isTop && !isEditingBrief ? true : false}
            dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
            dragElastic={0.6}
            dragPropagation={false}
            data-no-swipe="true"
            onDragEnd={handleDragEnd}
            onTap={toggleDetails}

            onPanStart={(e) => e.stopPropagation()}
            onPan={(e) => e.stopPropagation()}
            onPanEnd={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}

            custom={custom}
            variants={{
                initial: (direction) => {
                    if (direction === -1) {
                        return { y: -300, opacity: 0, scale: 1.1 };
                    }
                    return { scale: 0.9, y: 40, opacity: 0 };
                },
                animate: {
                    y: index * 10,
                    scale: 1 - index * 0.05,
                    opacity: index > 2 ? 0 : 1
                },
                exit: (direction) => {
                    if (direction === 1) {
                        // Skip/Complete: fly up
                        return { y: -400, opacity: 0, transition: { duration: 0.2 } };
                    }
                    // Reverse/Previous: usually we don't 'exit' cards unless they fall off the stack
                    // But if we did, maybe they drop down?
                    return { y: 200, opacity: 0 };
                }
            }}
            transition={SPRING_CONFIG}
            initial="initial"
            animate="animate"
            exit="exit"
            className={clsx(
                "absolute w-[90%] max-w-md bg-slate-900 rounded-2xl border-2 overflow-hidden shadow-2xl origin-bottom touch-none left-0 right-0 mx-auto",
                rarity.border,
                rarity.shadow,
                isEditingBrief ? "cursor-default" : "cursor-grab active:cursor-grabbing"
            )}
        >
            {/* Swipe Feedback Overlays */}
            <motion.div style={{ opacity: useTransform(x, [0, 100], [0, 1]) }} className="absolute inset-0 bg-emerald-500/20 z-10 flex items-center justify-center pointer-events-none">
                <CheckCircle size={64} className="text-emerald-400 drop-shadow-[0_0_10px_rgba(16,185,129,0.8)]" />
            </motion.div>
            <motion.div style={{ opacity: useTransform(x, [-100, 0], [1, 0]) }} className="absolute inset-0 bg-rose-500/20 z-10 flex items-center justify-center pointer-events-none">
                <Trash2 size={64} className="text-rose-400 drop-shadow-[0_0_10px_rgba(244,63,94,0.8)]" />
            </motion.div>

            <div className={clsx("p-6 flex flex-col h-[300px] select-none", rarity.bg)}>
                <div className="flex justify-between items-start mb-4">
                    <span className={clsx("text-xs font-black uppercase tracking-widest px-2 py-1 rounded bg-black/40", rarity.text)}>
                        {quest.difficulty}
                    </span>
                    {/* DELETED: Reward pill from top right */}
                </div>

                <h3 className="text-2xl font-game font-bold text-white mb-2 leading-tight">
                    {quest.title}
                </h3>

                <div className="flex-1 overflow-visible">
                    {showDetails ? (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="bg-black/20 p-3 rounded-lg border border-white/5 text-sm text-gray-400 h-full flex flex-col"
                        >
                            <div className="flex items-center gap-2 mb-2 shrink-0">
                                <Calendar size={14} />
                                <span>Due: {quest.dueDate ? new Date(quest.dueDate).toLocaleDateString() : 'No Limit'}</span>
                            </div>

                            <div className="flex items-center justify-between mb-1 shrink-0">
                                <span className="text-xs uppercase font-bold text-gray-600">Mission Brief</span>
                                {!isEditingBrief && (
                                    <span className="text-[10px] text-gray-700 italic">Long press to edit</span>
                                )}
                            </div>

                            {isEditingBrief ? (
                                <div className="flex-1 flex flex-col">
                                    <textarea
                                        value={localBrief}
                                        onChange={(e) => setLocalBrief(e.target.value)}
                                        onClick={(e) => e.stopPropagation()} // Prevent card toggle
                                        className="w-full bg-slate-950/80 text-white text-xs p-2 rounded border border-emerald-500/50 focus:outline-none resize-none flex-1 font-mono"
                                        placeholder="Enter mission details..."
                                        autoFocus
                                    />
                                    <button
                                        onClick={saveBrief}
                                        className="mt-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-1 px-2 rounded self-end flex items-center gap-1"
                                    >
                                        <CheckCircle size={12} /> Save
                                    </button>
                                </div>
                            ) : (
                                <motion.div
                                    onPointerDown={(e) => {
                                        const timer = setTimeout(() => {
                                            handleBriefLongPress();
                                        }, 800);
                                        e.target.dataset.longPressTimer = timer;
                                    }}
                                    onPointerUp={(e) => {
                                        clearTimeout(e.target.dataset.longPressTimer);
                                    }}
                                    onPointerLeave={(e) => {
                                        clearTimeout(e.target.dataset.longPressTimer);
                                    }}
                                    className="italic overflow-y-auto custom-scrollbar flex-1 relative active:bg-white/5 rounded p-1 transition-colors"
                                >
                                    {quest.missionBrief ? quest.missionBrief : "Complete this objective to earn rewards."}
                                </motion.div>
                            )}
                        </motion.div>
                    ) : (
                        <div className="flex items-center justify-center h-full text-slate-600 font-game text-sm uppercase tracking-widest animate-pulse">
                            Tap for Info / Swipe Up to Skip
                        </div>
                    )}
                </div>

                <div className="mt-4 pt-4 border-t border-white/10 flex justify-between text-xs text-gray-500 font-mono">
                    <div className="flex items-center gap-1"><span className="text-emerald-400">►</span> COMPLETE</div>
                    <div className="flex items-center gap-1">DISMISS <span className="text-rose-400">◄</span></div>
                </div>
            </div>
        </motion.div>
    );
};

const QuestDeck = ({ quests, onComplete, onDelete, onSkip, onUpdate, onPrevious, slideDirection = 1 }) => {
    const visibleQuests = quests.slice(0, 4);

    if (quests.length === 0) {
        return (
            <div className="h-[300px] flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-slate-800 rounded-2xl bg-slate-900/50 mb-8">
                <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4 text-slate-600">
                    <Sword size={32} />
                </div>
                <h3 className="text-xl font-bold text-slate-500 font-game">All Clear</h3>
                <p className="text-slate-600 mt-2">No active quests in the deck.</p>
            </div>
        );
    }

    return (
        <div className="relative h-[320px] w-full max-w-md mx-auto perspective-1000 mb-8">
            <AnimatePresence custom={slideDirection}>
                {visibleQuests.map((quest, index) => (
                    <QuestDeckCard
                        key={quest.id}
                        quest={quest}
                        index={index}
                        isTop={index === 0}
                        onComplete={onComplete}
                        onDismiss={onDelete}
                        onSkip={onSkip}
                        onUpdate={onUpdate}
                        onPrevious={onPrevious}
                        custom={slideDirection}
                    />
                ))}
            </AnimatePresence>
        </div>
    );
};

const LogModal = ({ title, items, onClose, type, onRestore }) => {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm max-h-[70vh] flex flex-col shadow-2xl overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950">
                    <h3 className={clsx("font-game font-bold text-lg", type === 'victory' ? 'text-emerald-400' : 'text-rose-400')}>
                        {title}
                    </h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={20} /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {items.length === 0 && <div className="text-center text-gray-500 italic py-4">No records found.</div>}
                    {items.map(item => (
                        <div key={item.id} className="bg-slate-800/50 p-3 rounded-lg flex items-center justify-between border border-slate-700">
                            <div>
                                <div className="font-bold text-slate-200 text-sm">{item.title}</div>
                                <div className="text-[10px] text-gray-500">
                                    {type === 'victory'
                                        ? `Completed: ${new Date(item.completedAt).toLocaleDateString()}`
                                        : `Discarded: ${new Date(item.discardedAt).toLocaleDateString()}`
                                    }
                                </div>
                            </div>
                            {(type === 'discarded' || type === 'victory') && (
                                <button
                                    onClick={() => onRestore(item.id)}
                                    className="p-2 bg-slate-700 hover:bg-emerald-600 text-white rounded-full transition-colors"
                                    title="Restore"
                                >
                                    <RotateCcw size={14} />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </motion.div>
        </div>
    );
};

const QuestBoard = () => {
    const { quests, addQuest, completeQuest, deleteQuest, restoreQuest, updateQuest, undoCompleteQuest } = useGame();

    // Form States
    const [newQuestTitle, setNewQuestTitle] = useState('');
    const [difficulty, setDifficulty] = useState('easy');
    const [dueDate, setDueDate] = useState('');
    const [missionBrief, setMissionBrief] = useState('');
    const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
    const [customReward, setCustomReward] = useState({ xp: null, gold: null });

    // UI States
    const [showVictoryLog, setShowVictoryLog] = useState(false);
    const [showDiscardedLog, setShowDiscardedLog] = useState(false);

    // Animation State
    const [slideDirection, setSlideDirection] = useState(1); // 1 = Next/Skip, -1 = Previous/Reverse

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!newQuestTitle.trim()) return;

        const reward = (customReward.xp !== null || customReward.gold !== null)
            ? { xp: Number(customReward.xp || 0), gold: Number(customReward.gold || 0) }
            : null;

        addQuest(newQuestTitle, difficulty, dueDate || null, reward, missionBrief);

        // Reset
        setNewQuestTitle('');
        setDueDate('');
        setMissionBrief('');
        setCustomReward({ xp: null, gold: null });
        setIsAdvancedOpen(false);
        setDifficulty('easy');
    };

    const [skippedOffsets, setSkippedOffsets] = useState({});

    const handleSkip = (id) => {
        setSlideDirection(1);
        setSkippedOffsets(prev => ({ ...prev, [id]: Date.now() }));
    };

    const handlePrevious = () => {
        setSlideDirection(-1);
        // Calculate current order to find the last item
        const active = quests
            .filter(q => !q.completed && !q.discarded)
            .sort((a, b) => (skippedOffsets[a.id] || 0) - (skippedOffsets[b.id] || 0));

        if (active.length === 0) return;

        // Get the last item (bottom of the deck)
        const lastQuest = active[active.length - 1];

        // To bring it to the front, we need an offset smaller than any current offset
        const currentOffsets = Object.values(skippedOffsets);
        const minOffset = currentOffsets.length > 0 ? Math.min(...currentOffsets) : 0;

        // Assign a new negative offset to force it to the top
        setSkippedOffsets(prev => ({
            ...prev,
            [lastQuest.id]: Math.min(0, minOffset) - 1
        }));
    };

    // Filter Logic (memoized)
    const activeQuests = useMemo(() =>
        quests
            .filter(q => !q.completed && !q.discarded)
            .sort((a, b) => (skippedOffsets[a.id] || 0) - (skippedOffsets[b.id] || 0)),
        [quests, skippedOffsets]
    );

    const completedQuests = useMemo(() =>
        quests.filter(q => q.completed),
        [quests]
    );

    // Victory Log: Last 3 Days (using shared utility)
    const recentVictories = useMemo(() =>
        completedQuests.filter(q => isWithinDays(q.completedAt, 3)),
        [completedQuests]
    );

    const discardedQuests = quests.filter(q => q.discarded);

    return (
        <div className="pb-4 md:pb-0 relative flex flex-col w-full">
            <div className="flex justify-between items-center mb-5 px-6" style={{ touchAction: 'none' }}>
                <div>
                    <h2 className="text-3xl font-game font-bold text-emerald-400 tracking-widest uppercase text-glow">
                        Active Quests
                    </h2>
                    <p className="text-sm text-emerald-400/60">Current objectives.</p>
                </div>
                <span className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-4 py-1 rounded-full text-xs font-bold shadow-[0_0_10px_rgba(16,185,129,0.2)]">
                    {activeQuests.length} ACTIVE
                </span>
            </div>

            {/* 1. THE CARDS (Moved to Top) */}
            <div className="mb-0 z-10 relative">
                <QuestDeck
                    quests={activeQuests}
                    onComplete={completeQuest}
                    onDelete={deleteQuest}
                    onSkip={handleSkip}
                    onUpdate={updateQuest}
                    onPrevious={handlePrevious}
                    slideDirection={slideDirection}
                />
            </div>

            {/* 2. QUEST CREATION (Moved Below) */}
            <div className="bg-emerald-900/10 p-4 rounded-xl border border-emerald-500/20 mb-2 relative overflow-hidden z-20">
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <div className="flex flex-col md:flex-row gap-4 items-end">
                        <div className="flex-1 w-full relative">
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">New Objective</label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={newQuestTitle}
                                    onChange={(e) => setNewQuestTitle(e.target.value)}
                                    placeholder="Enter quest title..."
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
                            className="w-full md:w-auto bg-emerald-500 hover:bg-emerald-400 text-slate-900 px-6 py-2 rounded-lg transition-colors flex items-center justify-center font-bold gap-2 shadow-neon h-[42px]"
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
                                className="pt-4 overflow-hidden border-t border-emerald-500/20 mt-2"
                            >
                                <div className="space-y-4">
                                    {/* Difficulty Selector */}
                                    <div className="grid grid-cols-4 gap-2">
                                        {[
                                            { id: 'easy', label: 'Cmn', color: 'emerald', fullLabel: 'Common' },
                                            { id: 'medium', label: 'Rare', color: 'blue', fullLabel: 'Rare' },
                                            { id: 'hard', label: 'Epic', color: 'purple', fullLabel: 'Epic' },
                                            { id: 'legendary', label: 'Leg', color: 'yellow', fullLabel: 'Legendary' }
                                        ].map((level) => {
                                            const isActive = difficulty === level.id;
                                            return (
                                                <button
                                                    key={level.id}
                                                    type="button"
                                                    onClick={() => setDifficulty(level.id)}
                                                    className={clsx(
                                                        "flex flex-col items-center justify-center py-2 rounded-lg border transition-all relative overflow-hidden",
                                                        isActive
                                                            ? `border-${level.color}-500 shadow-[0_0_10px_rgba(0,0,0,0.3)]`
                                                            : "bg-slate-900/50 border-slate-700 opacity-60 hover:opacity-100 hover:border-slate-500"
                                                    )}
                                                    style={{ backgroundColor: isActive ? `rgba(var(--color-${level.color}-500), 0.2)` : '' }}
                                                >
                                                    {isActive && (
                                                        <motion.div
                                                            layoutId="active-difficulty"
                                                            className={clsx("absolute inset-0 z-0 opacity-20", `bg-${level.color}-400`)}
                                                        />
                                                    )}
                                                    <span className={clsx(
                                                        "relative z-10 text-[10px] font-black uppercase tracking-widest",
                                                        isActive ? `text-${level.color}-400` : "text-gray-500"
                                                    )}>
                                                        {level.label}
                                                    </span>
                                                </button>
                                            )
                                        })}
                                    </div>

                                    {/* Mission Brief - Moved Up */}
                                    <textarea
                                        value={missionBrief}
                                        onChange={(e) => setMissionBrief(e.target.value)}
                                        placeholder="// Enter mission parameters..."
                                        rows={1}
                                        className="relative w-full bg-slate-950 border border-emerald-500/20 rounded-lg px-3 py-2 text-xs text-emerald-100 placeholder-emerald-900/50 focus:outline-none focus:border-emerald-500/50 resize-none font-mono"
                                    />

                                    {/* Compact Control Row: [Date | Gold | XP] */}
                                    <div className="flex gap-4">
                                        {/* Date Plugin */}
                                        <div className="flex-1 space-y-2">
                                            <div className="flex items-center gap-2 bg-slate-950 border border-emerald-500/30 rounded-lg px-2 py-1.5 hover:border-emerald-500/60 transition-colors group">
                                                <Calendar size={14} className="text-emerald-500/50 group-hover:text-emerald-400" />
                                                <input
                                                    type="date"
                                                    value={dueDate}
                                                    onChange={(e) => setDueDate(e.target.value)}
                                                    className="bg-transparent border-none text-xs text-emerald-100 focus:outline-none w-full font-mono uppercase [color-scheme:dark]"
                                                />
                                                {dueDate && (
                                                    <button type="button" onClick={() => setDueDate('')} className="text-emerald-900 hover:text-emerald-400 p-1">
                                                        <X size={14} />
                                                    </button>
                                                )}
                                            </div>
                                            <div className="flex justify-between w-full px-1">
                                                <button
                                                    type="button"
                                                    onClick={() => setDueDate(new Date().toISOString().split('T')[0])}
                                                    className="text-[10px] uppercase font-bold text-emerald-600 hover:text-emerald-400 transition-colors"
                                                >
                                                    Today
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const d = new Date();
                                                        d.setDate(d.getDate() + 1);
                                                        setDueDate(d.toISOString().split('T')[0]);
                                                    }}
                                                    className="text-[10px] uppercase font-bold text-emerald-600 hover:text-emerald-400 transition-colors"
                                                >
                                                    Tomorrow
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setDueDate('')}
                                                    className="text-[10px] uppercase font-bold text-emerald-600 hover:text-emerald-400 transition-colors"
                                                >
                                                    None
                                                </button>
                                            </div>
                                        </div>

                                        {/* Stacked Bounty Inputs */}
                                        <div className="shrink-0 bg-slate-950 border border-game-gold/20 rounded-lg p-2 flex flex-col gap-1 w-28">
                                            <div className="flex items-center gap-2 border-b border-gray-800 pb-1">
                                                <span className="text-[10px] font-bold text-game-gold w-4">G</span>
                                                <input
                                                    type="number"
                                                    value={customReward.gold || ''}
                                                    onChange={(e) => setCustomReward(p => ({ ...p, gold: e.target.value }))}
                                                    className="w-full bg-transparent text-[10px] text-game-gold focus:outline-none text-right font-mono"
                                                    placeholder="-"
                                                />
                                            </div>
                                            <div className="flex items-center gap-2 pt-0.5">
                                                <span className="text-[10px] font-bold text-blue-400 w-4">XP</span>
                                                <input
                                                    type="number"
                                                    value={customReward.xp || ''}
                                                    onChange={(e) => setCustomReward(p => ({ ...p, xp: e.target.value }))}
                                                    className="w-full bg-transparent text-[10px] text-blue-400 focus:outline-none text-right font-mono"
                                                    placeholder="-"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </form>
            </div>

            {/* 3. LOGS & HISTORY (Moved from Radial) */}
            {/* 3. LOGS & HISTORY (Moved from Radial) */}
            <div className="px-4 grid grid-cols-2 gap-8 mb-24 md:mb-8" data-no-swipe="true">
                {/* VICTORY LOG (LEFT) */}
                <div
                    onClick={() => setShowVictoryLog(true)}
                    className="transition-all cursor-pointer group flex flex-col relative overflow-hidden opacity-70 hover:opacity-100"
                >
                    <div className="flex items-center gap-3 mb-2">
                        <span className="text-xs font-bold text-emerald-600/70 uppercase tracking-widest group-hover:text-emerald-400 transition-colors">Victory Log</span>
                        <span className="text-emerald-400/70 text-xs font-mono font-bold">{recentVictories.length}</span>
                    </div>

                    <div className="flex gap-[-8px] relative h-10 items-center">
                        {recentVictories.length === 0 && (
                            <div className="text-emerald-900/40 text-xs italic">No clear records</div>
                        )}
                        {recentVictories.slice(0, 5).map((q, i) => (
                            <div
                                key={q.id}
                                className={`w-8 h-8 rounded-full border border-slate-950 bg-slate-900 flex items-center justify-center shadow-lg relative -ml-3 first:ml-0 transition-all group-hover:scale-110 hover:!scale-125 z-10 hover:z-20 ${['text-emerald-900', 'text-emerald-800', 'text-emerald-600', 'text-emerald-500', 'text-emerald-400'][i] || 'text-emerald-400'
                                    }`}
                                title={q.title}
                            >
                                <CheckCircle size={20} />
                            </div>
                        ))}
                    </div>
                </div>

                {/* DISCARDED LOG (RIGHT) */}
                <div
                    onClick={() => setShowDiscardedLog(true)}
                    className="transition-all cursor-pointer group flex flex-col items-end relative overflow-hidden opacity-50 hover:opacity-80"
                >
                    <div className="flex items-center gap-3 mb-2 flex-row-reverse">
                        <span className="text-xs font-bold text-red-600/70 uppercase tracking-widest group-hover:text-red-400 transition-colors">Discarded</span>
                        <span className="text-red-400/60 text-xs font-mono font-bold">{discardedQuests.length}</span>
                    </div>

                    <div className="flex gap-[-8px] relative h-10 items-center justify-end flex-row-reverse">
                        {discardedQuests.length === 0 && (
                            <div className="text-red-900/30 text-xs italic">Bin empty</div>
                        )}
                        {discardedQuests.slice(0, 5).map((q, i) => (
                            <div
                                key={q.id}
                                className={`w-8 h-8 rounded-full border border-slate-950 bg-slate-900 flex items-center justify-center shadow-lg relative -mr-3 first:mr-0 transition-all group-hover:scale-110 hover:!scale-125 z-10 hover:z-20 ${['text-red-950', 'text-red-900', 'text-red-700', 'text-red-500', 'text-red-400'][i] || 'text-red-400'
                                    }`}
                                title={q.title}
                            >
                                <Trash2 size={20} />
                            </div>
                        ))}
                    </div>
                </div>



            </div>

            <AnimatePresence>
                {showVictoryLog && (
                    <LogModal
                        title="Recent Victories"
                        type="victory"
                        items={recentVictories}
                        onClose={() => setShowVictoryLog(false)}
                        onRestore={(id) => {
                            undoCompleteQuest(id);
                        }}
                    />
                )}
                {showDiscardedLog && (
                    <LogModal
                        title="Discarded Quests"
                        type="discarded"
                        items={discardedQuests}
                        onClose={() => setShowDiscardedLog(false)}
                        onRestore={(id) => {
                            restoreQuest(id);
                            // Optional: Close modal or keep open
                        }}
                    />
                )}
            </AnimatePresence>
        </div>
    );
};

export default QuestBoard;
