import React, { useState, useMemo, useCallback } from 'react';
import { useGame } from '../context/GameContext';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { CheckCircle, Trash2, Plus, Zap, Settings, X, RotateCcw, Power } from 'lucide-react';
import clsx from 'clsx';

// Constants
const LOOKAHEAD_DAYS_DEFAULT = 1;

// Shared utilities
import { getDaysUntilDue } from '../utils/gameLogic';
import { getTodayISO } from '../utils/dateUtils';
import { SPRING_CONFIG } from '../constants/animations';

// --- COMPONENTS ---



const ProtocolDeckCard = ({ habit, index, onComplete, onDismiss, onSkip, onCycleNext, onCyclePrev, isTop, isTopInDeck, isLast, custom }) => {
    const x = useMotionValue(0);
    const y = useMotionValue(0);
    const rotate = useTransform(x, [-200, 200], [-30, 30]);

    // Background colors for swipe feedback
    const bgRight = useTransform(x, [0, 150], ["rgba(0,0,0,0)", "rgba(168, 85, 247, 0.5)"]); // Purple (Complete)
    const bgLeft = useTransform(x, [-150, 0], ["rgba(244, 63, 94, 0.5)", "rgba(0,0,0,0)"]); // Rose (Skip)

    const handleDragEnd = (event, info) => {
        const swipeThreshold = 100;
        if (info.offset.x > swipeThreshold) {
            // Right Swipe -> Complete
            onComplete(habit.id);
        } else if (info.offset.x < -swipeThreshold) {
            // Left Swipe -> Skip (Dismiss)
            onSkip(habit.id);
        } else if (info.offset.y < -swipeThreshold) {
            // Swipe Up -> Cycle Next
            onCycleNext(habit.id);
        } else if (info.offset.y > swipeThreshold) {
            // Swipe Down -> Cycle Previous
            if (onCyclePrev) onCyclePrev();
        }
    };

    return (
        <motion.div
            style={{
                x,
                y: isTopInDeck ? y : 0, // Only move top card with drag
                rotate: isTopInDeck ? rotate : 0,
                zIndex: 100 - index,
                scale: 1 - index * 0.05,
                top: index * 10
            }}
            drag={isTopInDeck ? true : false}
            dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
            dragElastic={0.6}
            dragPropagation={false}
            data-no-swipe="true"
            onDragEnd={handleDragEnd}

            custom={custom}
            variants={{
                initial: (direction) => {
                    // Cycle Prev (Drop In)
                    if (direction < 0) {
                        // MATCH QUESTBOARD: Start from -300 instead of -800 for consistent feel
                        return { y: -300, opacity: 0, scale: 1.1 };
                    }
                    // Next (Enter from bottom/stack)
                    return { scale: 0.9, y: 40, opacity: 0 };
                },
                animate: {
                    y: index * 10,
                    scale: 1 - index * 0.05,
                    opacity: index > 2 ? 0 : 1
                },
                exit: (direction) => {
                    if (direction === 1) {
                        // Complete (Right): Fly Right
                        return { x: 200, opacity: 0, transition: { duration: 0.2 } };
                    }
                    if (direction === -1) {
                        // Skip (Left): Fly Left
                        return { x: -200, opacity: 0, transition: { duration: 0.2 } };
                    }
                    if (direction === 2) {
                        // Cycle Next (Swipe Up): Fly Up (MATCH QUESTBOARD)
                        // Changed from y: -800 / duration 0.25 to y: -400 / duration 0.2
                        return { y: -400, opacity: 0, transition: { duration: 0.2 } };
                    }
                    // Cycle Prev (Swipe Down): The card that was at the top and is now moving to the bottom of the stack.
                    return { opacity: 0, scale: 0.9 };
                }
            }}
            transition={SPRING_CONFIG}
            initial="initial"
            animate="animate"
            exit="exit"

            className="absolute w-[90%] max-w-md bg-slate-900 rounded-2xl border-2 border-purple-500 overflow-hidden shadow-[0_0_20px_rgba(168,85,247,0.2)] origin-bottom touch-none left-0 right-0 mx-auto h-[300px]"
        >
            {/* Swipe Feedback Overlays */}
            <motion.div style={{ opacity: useTransform(x, [0, 100], [0, 1]) }} className="absolute inset-0 bg-purple-500/20 z-10 flex items-center justify-center pointer-events-none">
                <CheckCircle size={64} className="text-purple-400 drop-shadow-[0_0_10px_rgba(168,85,247,0.8)]" />
            </motion.div>
            <motion.div style={{ opacity: useTransform(x, [-100, 0], [1, 0]) }} className="absolute inset-0 bg-slate-500/20 z-10 flex items-center justify-center pointer-events-none">
                {/* Skip Icon (Left) */}
                <X size={64} className="text-slate-400 drop-shadow-[0_0_10px_rgba(148,163,184,0.8)]" />
            </motion.div>

            <div className="p-6 flex flex-col h-full select-none bg-slate-900/80 backdrop-blur-sm">
                <div className="flex justify-between items-start mb-4">
                    <span className="text-xs font-black uppercase tracking-widest px-2 py-1 rounded bg-purple-900/50 text-purple-300 border border-purple-500/30">
                        Protocol
                    </span>
                    <span className="text-xs font-bold text-gray-500 uppercase">
                        {habit.frequency}
                    </span>
                </div>

                <h3 className="text-2xl font-game font-bold text-white mb-2 leading-tight">
                    {habit.title}
                </h3>

                <div className="flex-1 flex flex-col justify-center items-center text-center opacity-70">
                    <Zap size={48} className="text-purple-500 mb-4 opacity-50" />
                    <p className="text-sm text-purple-200/60 font-mono">
                        {habit.frequency === 'interval'
                            ? `Every ${habit.frequencyParam} Days`
                            : `${habit.frequency.charAt(0).toUpperCase() + habit.frequency.slice(1)} Routine`}
                    </p>
                </div>

                <div className="mt-4 pt-4 border-t border-white/10 flex justify-between text-xs text-gray-500 font-mono">
                    <div className="flex items-center gap-1"><span className="text-purple-400">►</span> COMPLETE</div>
                    <div className="flex items-center gap-1">SKIP <span className="text-rose-400">◄</span></div>
                </div>
            </div>
        </motion.div>
    );
};

const ProtocolDeck = ({ habits, cycleOffsets, onComplete, onSkip, onCycleNext, onCyclePrev, slideDirection = 1 }) => {
    // Only show top 4
    const visibleHabits = habits.slice(0, 4);

    if (habits.length === 0) {
        return (
            <div className="h-[300px] flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-slate-800 rounded-2xl bg-slate-900/50 mb-8">
                <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4 text-slate-600">
                    <Zap size={32} />
                </div>
                <h3 className="text-xl font-bold text-slate-500 font-game">Systems Nominal</h3>
                <p className="text-slate-600 mt-2">All active protocols executed.</p>
            </div>
        );
    }

    return (
        <div className="relative h-[320px] w-full max-w-md mx-auto perspective-1000 mb-8">
            <AnimatePresence custom={slideDirection}>
                {visibleHabits.map((habit, index) => (
                    <ProtocolDeckCard
                        key={`${habit.id}-${cycleOffsets[habit.id] || 0}`}
                        habit={habit}
                        index={index}
                        isTopInDeck={index === 0}
                        onComplete={onComplete}
                        onSkip={onSkip}
                        onCycleNext={onCycleNext}
                        onCyclePrev={onCyclePrev}
                        custom={slideDirection}
                    />
                ))}
            </AnimatePresence>
        </div>
    );
};

const ProtocolListModal = ({ title, items, onClose, type, onAction, actionLabel, onSecondaryAction, secondaryActionLabel }) => {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-slate-900 border border-purple-500/30 rounded-2xl w-full max-w-sm max-h-[70vh] flex flex-col shadow-2xl overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950">
                    <h3 className={clsx("font-game font-bold text-lg", type === 'active' ? 'text-purple-400' : 'text-slate-400')}>
                        {title}
                    </h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={20} /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {items.length === 0 && <div className="text-center text-gray-500 italic py-4">No protocols found.</div>}

                    {items.map(habit => {
                        const daysUntil = getDaysUntilDue(habit);
                        const isDue = daysUntil <= 0;

                        return (
                            <div key={habit.id} className="bg-slate-800/50 p-3 rounded-lg flex items-center justify-between border border-slate-700">
                                <div className="flex-1 min-w-0 pr-2">
                                    <div className="font-bold text-slate-200 text-sm truncate">{habit.title}</div>
                                    <div className="text-[10px] text-gray-500 flex items-center gap-2">
                                        <span className="uppercase">{habit.frequency}</span>
                                        {type === 'active' && (
                                            <span className={clsx("font-mono", isDue ? "text-purple-400" : "text-slate-600")}>
                                                {isDue ? "DUE NOW" : `Due in ${daysUntil}d`}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="flex gap-2">
                                    {/* Primary Action (Activate / Deactivate) */}
                                    {onAction && (
                                        <button
                                            onClick={() => onAction(habit.id)}
                                            className={clsx(
                                                "p-2 rounded-lg transition-colors",
                                                type === 'inactive'
                                                    ? "bg-purple-600 hover:bg-purple-500 text-white" // Activate
                                                    : "bg-slate-700 hover:bg-slate-600 text-gray-300" // Deactivate
                                            )}
                                            title={actionLabel}
                                        >
                                            {/* Icon based on type */}
                                            {type === 'inactive' ? <Power size={14} /> : <Power size={14} className="opacity-50" />}
                                        </button>
                                    )}

                                    {/* Secondary Action (Delete) */}
                                    {onSecondaryAction && (
                                        <button
                                            onClick={() => onSecondaryAction(habit.id)}
                                            className="p-2 bg-rose-900/20 hover:bg-rose-900/50 text-rose-500 rounded-lg transition-colors border border-rose-900/30"
                                            title={secondaryActionLabel}
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </motion.div>
        </div>
    );
};

const HabitTracker = () => {
    const { habits, addHabit, checkHabit, deleteHabit, toggleHabitActivation } = useGame();

    // Form States
    const [title, setTitle] = useState('');
    const [frequency, setFrequency] = useState('daily');
    const [intervalParam, setIntervalParam] = useState(2);
    const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

    // Filter Config
    const [lookaheadDays, setLookaheadDays] = useState(LOOKAHEAD_DAYS_DEFAULT);

    // Modal States
    const [showActiveList, setShowActiveList] = useState(false);
    const [showInactiveList, setShowInactiveList] = useState(false);

    // Deck Logic
    const [cycleOffsets, setCycleOffsets] = useState({});
    const [dismissedHabits, setDismissedHabits] = useState([]);
    const [slideDirection, setSlideDirection] = useState(1); // 1 = Right, -1 = Left (Skip)

    // --- DATA ---
    const allHabits = Array.isArray(habits) ? habits : [];

    // Active & Inactive Split (memoized)
    const activeHabits = useMemo(() =>
        allHabits.filter(h => h.isActive !== false),
        [allHabits]
    );
    const inactiveHabits = useMemo(() =>
        allHabits.filter(h => h.isActive === false),
        [allHabits]
    );

    // Deck Filter (memoized with shared utility)
    const todayStr = useMemo(() => getTodayISO(), []);
    const isCompletedToday = useCallback(
        (h) => (h.history?.[todayStr] || 0) > 0,
        [todayStr]
    );

    const deckHabits = useMemo(() => {
        return activeHabits.filter(h => {
            if (isCompletedToday(h)) return false;
            if (dismissedHabits.includes(h.id)) return false;

            const daysUntil = getDaysUntilDue(h);
            return daysUntil <= lookaheadDays;
        }).sort((a, b) => {
            const cycleA = cycleOffsets[a.id] || 0;
            const cycleB = cycleOffsets[b.id] || 0;
            return cycleA - cycleB;
        });
    }, [activeHabits, dismissedHabits, lookaheadDays, cycleOffsets, isCompletedToday]);


    // --- HANDLERS ---
    const handleSubmit = (e) => {
        e.preventDefault();
        if (!title.trim()) return;

        let param = 1;
        if (frequency === 'interval') param = intervalParam;

        addHabit(title, frequency, param);

        // Reset
        setTitle('');
        setFrequency('daily');
        setIsAdvancedOpen(false);
    };

    const handleComplete = (id) => {
        setSlideDirection(1); // Right
        checkHabit(id, 'positive');
    };

    const handleSkip = (id) => {
        setSlideDirection(-1); // Left
        setDismissedHabits(prev => [...prev, id]);
    };

    const handleCycleNext = (id) => {
        setSlideDirection(2); // Up (Fly Up)
        // Move to bottom of deck
        setCycleOffsets(prev => ({ ...prev, [id]: Date.now() }));
    };

    const handleCyclePrev = () => {
        setSlideDirection(-2); // Down (Drop In - Initial variant handles negative direction appropriately if matched)

        // 1. Identify items currently in the deck (including cycled ones)
        // We want to find the one that was cycled *last* (highest timestamp) and force it to top.
        // Actually, we need to find the one with the highest cycle offset and give it the lowest offset.

        const inDeck = activeHabits.filter(h => {
            if (isCompletedToday(h)) return false;
            if (dismissedHabits.includes(h.id)) return false;
            const daysUntil = getDaysUntilDue(h);
            return daysUntil <= lookaheadDays;
        });

        if (inDeck.length === 0) return;

        // Sort by current cycle offsets
        const sorted = [...inDeck].sort((a, b) => {
            const cycleA = cycleOffsets[a.id] || 0;
            const cycleB = cycleOffsets[b.id] || 0;
            return cycleA - cycleB;
        });

        // The last item (highest offset) is the one we want to bring back to top
        const lastHabit = sorted[sorted.length - 1];

        const currentOffsets = Object.values(cycleOffsets);
        const minOffset = currentOffsets.length > 0 ? Math.min(...currentOffsets) : 0;

        setCycleOffsets(prev => ({
            ...prev,
            [lastHabit.id]: Math.min(0, minOffset) - 1
        }));
    };

    const handleDeactivate = (id) => {
        toggleHabitActivation(id, false);
    };

    const handleActivate = (id) => {
        toggleHabitActivation(id, true);
        setCycleOffsets(prev => {
            const next = { ...prev };
            delete next[id];
            return next;
        });
    };

    return (
        <div className="pb-4 md:pb-0 relative flex flex-col w-full">
            {/* HEADER */}


            <div className="flex justify-between items-center mb-5 px-6" style={{ touchAction: 'none' }}>
                <div>
                    <h2 className="text-3xl font-game font-bold text-purple-400 tracking-widest uppercase text-glow">
                        Protocols
                    </h2>
                    <p className="text-sm text-purple-400/60">System routines.</p>
                </div>

                <span className="text-purple-400 px-4 py-1 rounded-full text-xs font-bold">
                    {deckHabits.length} PENDING
                </span>

            </div>

            {/* DECK */}
            <div className="mb-0 z-10 relative">
                <ProtocolDeck
                    habits={deckHabits}
                    cycleOffsets={cycleOffsets}
                    onComplete={handleComplete}
                    onSkip={handleSkip}
                    onCycleNext={handleCycleNext}
                    onCyclePrev={handleCyclePrev}
                    slideDirection={slideDirection}
                />
            </div>

            {/* CREATION FORM */}
            <div className="px-4 pt-4 pb-0 rounded-xl mb-2 relative overflow-hidden z-20">

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <div className="flex flex-col md:flex-row gap-4 items-end">
                        <div className="flex-1 w-full relative">
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">New Protocol</label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="Enter protocol name..."
                                    className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500/50 focus:shadow-[0_0_10px_rgba(168,85,247,0.3)] transition-all"
                                />
                                <button
                                    type="button"
                                    onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
                                    className={clsx(
                                        "p-2 rounded-lg transition-all shrink-0",
                                        isAdvancedOpen ? "text-purple-400" : "text-gray-400 hover:text-white"
                                    )}

                                    title="Advanced Settings"
                                >
                                    <Settings size={20} />
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            className="w-full md:w-auto bg-purple-600 hover:bg-purple-500 text-white px-6 py-2 rounded-lg transition-colors flex items-center justify-center font-bold gap-2 shadow-lg shadow-purple-900/20 h-[42px]"
                        >
                            <Plus size={20} /> <span className="md:hidden">Add Protocol</span>
                        </button>
                    </div>

                    <AnimatePresence>
                        {isAdvancedOpen && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="pt-4 overflow-hidden border-t border-purple-500/20 mt-2 space-y-4"
                            >
                                <div className="flex flex-col gap-3">
                                    {/* ROW 1: Inputs & Controls (Side-by-Side on Mobile) */}
                                    <div className="flex gap-3">
                                        {/* Frequency Input - Compact */}
                                        <div className="flex-1 flex items-center gap-2 bg-slate-950 border border-purple-500/30 rounded-lg px-2 py-1.5 hover:border-purple-500/60 transition-colors group h-10">
                                            <RotateCcw size={16} className="text-purple-500/50 group-hover:text-purple-400 shrink-0" />
                                            <input
                                                type="number"
                                                min="1"
                                                max="365"
                                                value={frequency === 'interval' ? intervalParam : (frequency === 'daily' ? 1 : (frequency === 'weekly' ? 7 : 30))}
                                                onChange={(e) => {
                                                    const val = parseInt(e.target.value) || 1;
                                                    setFrequency('interval');
                                                    setIntervalParam(val);
                                                }}
                                                className="bg-transparent border-none text-sm text-purple-100 focus:outline-none w-full font-mono text-center"
                                            />
                                            <span className="text-[10px] text-gray-500 font-mono shrink-0">Days</span>
                                        </div>

                                        {/* Horizon Control - Compact */}
                                        <div className="flex-1 flex items-center justify-between bg-slate-950 border border-purple-500/30 rounded-lg px-2 py-1.5 h-10">
                                            <div className="flex items-center gap-2">
                                                <Zap size={16} className="text-purple-500/50 shrink-0" />
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setLookaheadDays(Math.max(0, lookaheadDays - 1))}
                                                    className="w-6 h-6 flex items-center justify-center bg-slate-900 text-purple-400 rounded hover:bg-purple-500/20 transition-colors font-mono font-bold text-xs"
                                                >
                                                    -
                                                </button>
                                                <span className="text-sm font-mono text-white w-4 text-center">{lookaheadDays}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => setLookaheadDays(Math.min(30, lookaheadDays + 1))}
                                                    className="w-6 h-6 flex items-center justify-center bg-slate-900 text-purple-400 rounded hover:bg-purple-500/20 transition-colors font-mono font-bold text-xs"
                                                >
                                                    +
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* ROW 2: Frequency Buttons */}
                                    <div className="flex justify-between w-full gap-2">
                                        {[
                                            { label: 'Daily', val: 1, freq: 'daily' },
                                            { label: 'Weekly', val: 7, freq: 'weekly' },
                                            { label: 'Monthly', val: 30, freq: 'monthly' }
                                        ].map((btn) => (
                                            <button
                                                key={btn.label}
                                                type="button"
                                                onClick={() => {
                                                    setFrequency(btn.freq);
                                                    setIntervalParam(btn.val);
                                                }}
                                                className={clsx(
                                                    "flex-1 py-1.5 rounded text-[10px] uppercase font-bold transition-colors border",
                                                    (frequency === btn.freq)
                                                        ? "bg-purple-500/20 border-purple-500 text-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.2)]"
                                                        : "bg-slate-900/50 border-slate-700/50 text-purple-600/70 hover:text-purple-400 hover:border-purple-500/30"
                                                )}
                                            >
                                                {btn.label}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="flex justify-end pr-1">
                                        <span className="text-[9px] text-gray-600 italic">Horizon: +{lookaheadDays}d</span>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </form>
            </div>

            {/* 3. PROTOCOLS & DATABASE */}
            <div className="px-4 grid grid-cols-2 gap-8 mb-24 md:mb-8" data-no-swipe="true">
                {/* ACTIVE (LEFT) */}
                <div
                    onClick={() => setShowActiveList(true)}
                    className="transition-all cursor-pointer group flex flex-col relative overflow-hidden opacity-70 hover:opacity-100"
                >
                    <div className="flex items-center gap-3 mb-2">
                        {/* MATCH "NEW PROTOCOL" HEADER: text-xs font-bold text-gray-500 uppercase */}
                        <span className="text-xs font-bold text-purple-600/70 uppercase tracking-widest group-hover:text-purple-400 transition-colors">Active</span>
                        <span className="text-purple-400/70 text-xs font-mono font-bold">{activeHabits.length}</span>
                    </div>

                    <div className="flex gap-[-8px] relative h-10 items-center">
                        {activeHabits.length === 0 && (
                            <div className="text-purple-900/40 text-xs italic">System idle</div>
                        )}
                        {activeHabits.slice(0, 5).map((h, i) => (
                            <div
                                key={h.id}
                                className={`w-8 h-8 rounded-full border border-slate-950 bg-slate-900 flex items-center justify-center shadow-lg relative -ml-3 first:ml-0 transition-all group-hover:scale-110 hover:!scale-125 z-10 hover:z-20 ${['text-purple-900', 'text-purple-800', 'text-purple-600', 'text-purple-500', 'text-purple-400'][i] || 'text-purple-400'
                                    }`}
                                title={h.title}
                            >
                                <Zap size={20} />
                            </div>
                        ))}
                    </div>
                </div>

                {/* INACTIVE (RIGHT) - MIRRORED */}
                <div
                    onClick={() => setShowInactiveList(true)}
                    className="transition-all cursor-pointer group flex flex-col items-end relative overflow-hidden opacity-50 hover:opacity-80"
                >
                    <div className="flex items-center gap-3 mb-2 flex-row-reverse">
                        <span className="text-xs font-bold text-slate-500/70 uppercase tracking-widest group-hover:text-slate-300 transition-colors">Database</span>
                        <span className="text-slate-600 text-xs font-mono font-bold">{inactiveHabits.length}</span>
                    </div>

                    <div className="flex gap-[-8px] relative h-10 items-center justify-end flex-row-reverse">
                        {inactiveHabits.length === 0 && (
                            <div className="text-slate-800 text-xs italic">Empty</div>
                        )}
                        {inactiveHabits.slice(0, 5).map((h, i) => (
                            <div
                                key={h.id}
                                className={`w-8 h-8 rounded-full border border-slate-950 bg-slate-900 flex items-center justify-center shadow-lg relative -mr-3 first:mr-0 transition-all group-hover:scale-110 hover:!scale-125 z-10 hover:z-20 ${['text-slate-800', 'text-slate-700', 'text-slate-600', 'text-slate-500', 'text-slate-400'][i] || 'text-slate-400'
                                    }`}
                                title={h.title}
                            >
                                <Power size={20} />
                            </div>
                        ))}
                    </div>
                </div>
            </div>




            {/* MODALS */}
            <AnimatePresence>
                {showActiveList && (
                    <ProtocolListModal
                        title="Active Systems"
                        type="active"
                        items={activeHabits}
                        onClose={() => setShowActiveList(false)}
                        onAction={handleDeactivate}
                        actionLabel="Deactivate (Move to Database)"
                        onSecondaryAction={deleteHabit}
                        secondaryActionLabel="Delete Permanently"
                    />
                )}
                {showInactiveList && (
                    <ProtocolListModal
                        title="Inactive Database"
                        type="inactive"
                        items={inactiveHabits}
                        onClose={() => setShowInactiveList(false)}
                        onAction={handleActivate}
                        actionLabel="Activate"
                        onSecondaryAction={deleteHabit}
                        secondaryActionLabel="Delete Permanently"
                    />
                )}
            </AnimatePresence>
        </div>
    );
};

export default HabitTracker;
