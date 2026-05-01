import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useGame } from '../context/GameContext';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { CheckCircle, Trash2, Plus, Zap, X, RotateCcw, Power, Coins } from 'lucide-react';
import clsx from 'clsx';
import { usePersistentState } from '../utils/persistence';
import { PROTOCOL_LOOKAHEAD_STORAGE_KEY } from '../constants/persistenceKeys.js';
import { useDeckOrder } from '../hooks/useDeckOrder';

// Constants
const LOOKAHEAD_DAYS_DEFAULT = 1;
const REWARD_EDIT_HOLD_MS = 800;
const PROTOCOL_CARD_THEME = {
    card: 'bg-slate-900 border-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.2)]',
    content: 'bg-slate-900/80',
    badge: 'bg-purple-900/50 text-purple-300 border-purple-500/30',
    icon: 'text-purple-500',
    routineText: 'text-purple-200/60',
    actionAccent: 'text-purple-400'
};

// Shared utilities
import { getDaysUntilDue, getHabitCycleState } from '../utils/gameLogic';
import { SPRING_CONFIG } from '../constants/animations';

// --- COMPONENTS ---
const MotionDiv = motion.div;

const formatRoutineLabel = (habit) => (
    habit.frequency === 'interval'
        ? `Every ${habit.frequencyParam} Days`
        : `${habit.frequency.charAt(0).toUpperCase() + habit.frequency.slice(1)} Routine`
);

const getDueStatusLabel = (habit) => {
    const { dueDateKey, daysUntilDue, isDueToday, isOverdue } = getHabitCycleState(habit);

    if (!dueDateKey) return 'Due Today';
    if (isDueToday) return `Due today · ${dueDateKey}`;
    if (isOverdue) return `Overdue by ${Math.abs(daysUntilDue)}d · ${dueDateKey}`;
    return `Due in ${daysUntilDue}d · ${dueDateKey}`;
};

const getRewardSummary = (habit) => ({
    completionReward: Number(habit.completionReward || 0),
    passiveReward: Number(habit.passiveReward || 0)
});

const ProtocolRewardField = ({
    label,
    value,
    accentBorderClass,
    labelClassName,
    onBeginEdit
}) => {
    const holdTimerRef = useRef(null);

    const clearHoldTimer = useCallback(() => {
        if (holdTimerRef.current) {
            clearTimeout(holdTimerRef.current);
            holdTimerRef.current = null;
        }
    }, []);

    useEffect(() => () => {
        clearHoldTimer();
    }, [clearHoldTimer]);

    const handlePointerDown = useCallback((e) => {
        e.stopPropagation();
        clearHoldTimer();
        holdTimerRef.current = setTimeout(() => {
            onBeginEdit(value);
        }, REWARD_EDIT_HOLD_MS);
    }, [clearHoldTimer, onBeginEdit, value]);

    const handlePointerRelease = useCallback((e) => {
        e?.stopPropagation?.();
        clearHoldTimer();
    }, [clearHoldTimer]);

    return (
        <div className={clsx("min-w-0 border-l pl-3", accentBorderClass)}>
            <div className="min-h-[2.4rem]">
                <p className={clsx("text-[10px] font-bold uppercase tracking-[0.2em] leading-tight", labelClassName)}>
                    {label}
                </p>
            </div>
            <button
                type="button"
                onPointerDown={handlePointerDown}
                onPointerUp={handlePointerRelease}
                onPointerLeave={handlePointerRelease}
                onPointerCancel={handlePointerRelease}
                onClick={(e) => e.stopPropagation()}
                className="mt-3 text-left"
            >
                <span className="text-3xl font-game leading-none text-white">{value}</span>
            </button>
        </div>
    );
};

const ProtocolDeckCard = ({ habit, index, onComplete, onSkip, onCycleNext, onCyclePrev, onUpdateRewards, isTopInDeck, custom }) => {
    const x = useMotionValue(0);
    const y = useMotionValue(0);
    const rotate = useTransform(x, [-200, 200], [-30, 30]);
    const [showDetails, setShowDetails] = useState(false);
    const [editingRewardField, setEditingRewardField] = useState(null);
    const [rewardDraftValue, setRewardDraftValue] = useState('');
    const daysUntilDue = getDaysUntilDue(habit);
    const isDueToday = daysUntilDue === 0;
    const isOverdue = daysUntilDue < 0;
    const dueStatusLabel = getDueStatusLabel(habit);
    const { completionReward, passiveReward } = getRewardSummary(habit);
    const isEditingReward = Boolean(editingRewardField);
    const editingRewardLabel = editingRewardField === 'passiveReward' ? 'Passive Generation' : 'Due-Day Bonus';
    const accentTheme = isDueToday ? {
        badge: 'bg-violet-200/10 text-violet-100 border-violet-200/40',
        icon: 'text-violet-200 drop-shadow-[0_0_12px_rgba(196,181,253,0.35)]',
        routineText: 'text-violet-100/80',
        actionAccent: 'text-violet-200'
    } : isOverdue ? {
        badge: 'bg-fuchsia-300/10 text-fuchsia-100 border-fuchsia-300/35',
        icon: 'text-fuchsia-200 drop-shadow-[0_0_12px_rgba(244,114,182,0.28)]',
        routineText: 'text-fuchsia-100/75',
        actionAccent: 'text-fuchsia-200'
    } : PROTOCOL_CARD_THEME;

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

    const toggleDetails = () => {
        if (isEditingReward) return;
        setShowDetails((prev) => {
            if (prev) {
                setEditingRewardField(null);
                setRewardDraftValue('');
            }

            return !prev;
        });
    };

    const handleBeginRewardEdit = useCallback((field, currentValue) => {
        setEditingRewardField(field);
        setRewardDraftValue(String(currentValue));
    }, []);

    const handleRewardSave = useCallback(() => {
        if (!editingRewardField) return;

        onUpdateRewards(habit.id, {
            [editingRewardField]: Math.max(0, parseInt(rewardDraftValue, 10) || 0)
        });
        setEditingRewardField(null);
        setRewardDraftValue('');
    }, [editingRewardField, habit.id, onUpdateRewards, rewardDraftValue]);

    const handleRewardCancel = useCallback(() => {
        setEditingRewardField(null);
        setRewardDraftValue('');
    }, []);

    const handleRewardEditorKeyDown = useCallback((e) => {
        if (e.key === 'Enter') {
            e.stopPropagation();
            handleRewardSave();
            return;
        }

        if (e.key === 'Escape') {
            e.stopPropagation();
            handleRewardCancel();
        }
    }, [handleRewardCancel, handleRewardSave]);

    return (
        <MotionDiv
            style={{
                x,
                y: isTopInDeck ? y : 0, // Only move top card with drag
                rotate: isTopInDeck ? rotate : 0,
                zIndex: 100 - index,
                scale: 1 - index * 0.05,
                top: index * 10
            }}
            drag={isTopInDeck && !isEditingReward ? true : false}
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

            className={clsx(
                "absolute w-[90%] max-w-md rounded-2xl border-2 overflow-hidden origin-bottom touch-none left-0 right-0 mx-auto h-[300px]",
                PROTOCOL_CARD_THEME.card,
                isDueToday && "border-violet-300 shadow-[0_0_34px_rgba(196,181,253,0.26),0_0_14px_rgba(168,85,247,0.18)]",
                isOverdue && "border-fuchsia-400 shadow-[0_0_28px_rgba(217,70,239,0.22)]"
            )}
        >
            {(isDueToday || isOverdue) && (
                <div
                    aria-hidden="true"
                    className={clsx(
                        "pointer-events-none absolute inset-[6px] rounded-[18px] border",
                        isDueToday && "border-violet-200/40 shadow-[inset_0_0_18px_rgba(196,181,253,0.08)]",
                        isOverdue && "border-fuchsia-300/30 shadow-[inset_0_0_18px_rgba(217,70,239,0.08)]"
                    )}
                />
            )}
            {/* Swipe Feedback Overlays */}
            <MotionDiv style={{ opacity: useTransform(x, [0, 100], [0, 1]) }} className="absolute inset-0 bg-purple-500/20 z-10 flex items-center justify-center pointer-events-none">
                <CheckCircle size={64} className="text-purple-400 drop-shadow-[0_0_10px_rgba(168,85,247,0.8)]" />
            </MotionDiv>
            <MotionDiv style={{ opacity: useTransform(x, [-100, 0], [1, 0]) }} className="absolute inset-0 bg-slate-500/20 z-10 flex items-center justify-center pointer-events-none">
                {/* Skip Icon (Left) */}
                <X size={64} className="text-slate-400 drop-shadow-[0_0_10px_rgba(148,163,184,0.8)]" />
            </MotionDiv>

            <div className={clsx("relative p-6 flex flex-col h-full select-none backdrop-blur-sm", PROTOCOL_CARD_THEME.content)}>
                <div className="flex items-start mb-4">
                    <span className={clsx("text-xs font-black uppercase tracking-widest px-2 py-1 rounded border", accentTheme.badge)}>
                        Protocol
                    </span>
                </div>

                <h3 className="text-2xl font-mono font-bold text-white mb-2 leading-tight tracking-tight">
                    {habit.title}
                </h3>

                <div className={clsx(
                    "flex-1 flex flex-col items-center text-center",
                    showDetails ? "justify-start pt-3 pb-16" : "justify-center opacity-70 pb-14"
                )}>
                    {showDetails ? (
                        <MotionDiv
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="w-full max-w-[248px] text-left"
                        >
                            <div className="mb-4 flex items-center justify-between">
                                <p className="text-[10px] font-game uppercase tracking-[0.28em] text-violet-200/70">
                                    Protocol Economy
                                </p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <ProtocolRewardField
                                    label="Due-Day Bonus"
                                    value={completionReward}
                                    accentBorderClass="border-violet-300/20"
                                    labelClassName="text-violet-200/75"
                                    onBeginEdit={(currentValue) => handleBeginRewardEdit('completionReward', currentValue)}
                                />
                                <ProtocolRewardField
                                    label="Passive Generation"
                                    value={passiveReward}
                                    accentBorderClass="border-fuchsia-300/20"
                                    labelClassName="text-fuchsia-100/75"
                                    onBeginEdit={(currentValue) => handleBeginRewardEdit('passiveReward', currentValue)}
                                />
                            </div>
                        </MotionDiv>
                    ) : (
                        <>
                            <Zap size={48} className={clsx("mb-4 opacity-70", accentTheme.icon)} />
                            <p className={clsx("text-sm font-mono", accentTheme.routineText)}>
                                {formatRoutineLabel(habit)}
                            </p>
                            <p className="mt-3 text-[11px] font-mono text-slate-300">
                                {dueStatusLabel}
                            </p>
                        </>
                    )}
                </div>

                {showDetails && isEditingReward && (
                    <MotionDiv
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="absolute left-6 right-6 top-[108px] bottom-20 z-30 flex items-center justify-center pointer-events-none"
                    >
                        <div
                            className="w-full max-w-[248px] rounded-xl border border-white/10 bg-slate-950/95 p-3 shadow-[0_14px_36px_rgba(0,0,0,0.4)] pointer-events-auto"
                            onClick={(e) => e.stopPropagation()}
                            onPointerDown={(e) => e.stopPropagation()}
                        >
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-200/65">
                                Editing {editingRewardLabel}
                            </p>
                            <input
                                type="number"
                                min="0"
                                value={rewardDraftValue}
                                onChange={(e) => setRewardDraftValue(e.target.value)}
                                onKeyDown={handleRewardEditorKeyDown}
                                className="mt-3 w-full rounded-lg border border-white/15 bg-black/70 px-3 py-3 text-right font-mono text-2xl text-white focus:outline-none focus:border-violet-300/60"
                                autoFocus
                            />
                            <div className="mt-3 flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleRewardSave();
                                    }}
                                    className="flex-1 rounded-md bg-violet-500/90 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-white transition-colors hover:bg-violet-400"
                                >
                                    Save
                                </button>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleRewardCancel();
                                    }}
                                    className="flex-1 rounded-md border border-white/10 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-300 transition-colors hover:border-white/20 hover:text-white"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </MotionDiv>
                )}

                <div className="absolute bottom-6 left-6 right-6 z-10 border-t border-white/10 pt-4 flex justify-between text-xs text-gray-500 font-mono">
                    <div className="flex items-center gap-1"><span className={accentTheme.actionAccent}>►</span> COMPLETE</div>
                    <div className="flex items-center gap-1">SKIP <span className="text-rose-400">◄</span></div>
                </div>
            </div>
        </MotionDiv>
    );
};

const ProtocolDeck = ({ habits, onComplete, onSkip, onCycleNext, onCyclePrev, onUpdateRewards, slideDirection = 1 }) => {
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
                        key={habit.id}
                        habit={habit}
                        index={index}
                        isTopInDeck={index === 0}
                        onComplete={onComplete}
                        onSkip={onSkip}
                        onCycleNext={onCycleNext}
                        onCyclePrev={onCyclePrev}
                        onUpdateRewards={onUpdateRewards}
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
            <MotionDiv
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
                        const { completionReward, passiveReward } = getRewardSummary(habit);

                        return (
                            <div key={habit.id} className="bg-slate-800/50 p-3 rounded-lg flex items-center justify-between border border-slate-700">
                                <div className="flex-1 min-w-0 pr-2">
                                    <div className="font-bold text-slate-200 text-sm truncate">{habit.title}</div>
                                    <div className="mt-1 text-[10px] text-gray-500 flex flex-wrap items-center gap-2">
                                        <span className="uppercase">{habit.frequency}</span>
                                        {type === 'active' && (
                                            <span className={clsx("font-mono", isDue ? "text-purple-400" : "text-slate-500")}>
                                                {getDueStatusLabel(habit)}
                                            </span>
                                        )}
                                    </div>
                                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] font-mono">
                                        <span className="rounded-full border border-amber-400/15 bg-amber-500/10 px-2 py-1 text-amber-200">
                                            Bonus {completionReward}
                                        </span>
                                        <span className="rounded-full border border-emerald-400/15 bg-emerald-500/10 px-2 py-1 text-emerald-200">
                                            Passive {passiveReward}/day
                                        </span>
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
            </MotionDiv>
        </div>
    );
};

const ProtocolCreationPanel = ({ isOpen, onClose, onAdd, lookaheadDays, setLookaheadDays, defaultCompletionReward }) => {
    const [title, setTitle] = useState('');
    const [frequency, setFrequency] = useState('daily');
    const [intervalParam, setIntervalParam] = useState(2);
    const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
    const [completionReward, setCompletionReward] = useState(defaultCompletionReward);
    const [passiveReward, setPassiveReward] = useState(0);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!title.trim()) return;

        let param = 1;
        if (frequency === 'interval') param = intervalParam;

        onAdd(title, frequency, param, {
            completionReward,
            passiveReward
        });

        // Reset
        setTitle('');
        setFrequency('daily');
        setIntervalParam(2);
        setCompletionReward(Number(defaultCompletionReward || 0));
        setPassiveReward(0);
        onClose();
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <MotionDiv
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
                        onClick={onClose}
                    />
                    <MotionDiv
                        initial={{ y: "-100%" }}
                        animate={{ y: 0 }}
                        exit={{ y: "-100%" }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        className="fixed top-0 left-0 right-0 z-50 bg-slate-900 border-b-2 border-purple-500 shadow-2xl px-6 pb-6 pt-[calc(1.5rem+env(safe-area-inset-top))] rounded-b-3xl"
                        drag="y"
                        dragConstraints={{ top: 0, bottom: 0 }}
                        onDragEnd={(e, { offset, velocity }) => {
                            if (offset.y < -50 || velocity.y < -500) {
                                onClose();
                            }
                        }}
                    >
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-game font-bold text-white flex items-center gap-2">
                                <Plus size={20} className="text-purple-400" />
                                New Protocol
                            </h2>
                            <button onClick={onClose} className="p-2 bg-slate-800 rounded-full text-slate-400 hover:text-white">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                            <div className="flex flex-col gap-2">
                                <label className="text-xs font-bold text-gray-500 uppercase">Protocol Name</label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="E.g. Neural Link Calibration..."
                                    autoFocus
                                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 focus:shadow-[0_0_15px_rgba(168,85,247,0.3)] transition-all font-game"
                                />
                            </div>

                            <div className="p-4 bg-slate-950/50 rounded-xl border border-white/5 space-y-4">
                                <div className="flex items-center justify-between" onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}>
                                    <span className="text-xs font-bold text-gray-500 uppercase">Configuration</span>
                                    <button type="button" className="text-purple-400 text-xs font-bold">
                                        {isAdvancedOpen ? 'HIDE' : 'SHOW'}
                                    </button>
                                </div>

                                {isAdvancedOpen && (
                                    <MotionDiv
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        className="space-y-4 pt-2"
                                    >
                                        {/* Frequency Selection */}
                                        <div className="space-y-2">
                                            <label className="text-xs text-slate-500">Frequency</label>
                                            <div className="flex gap-2">
                                                {[
                                                    { label: 'Daily', val: 1, freq: 'daily' },
                                                    { label: 'Weekly', val: 7, freq: 'weekly' },
                                                    { label: 'Interval', val: intervalParam, freq: 'interval' }
                                                ].map((btn) => (
                                                    <button
                                                        key={btn.label}
                                                        type="button"
                                                        onClick={() => setFrequency(btn.freq)}
                                                        className={clsx(
                                                            "flex-1 py-2 rounded-lg text-xs font-bold transition-all border",
                                                            (frequency === btn.freq)
                                                                ? "bg-purple-600 text-white border-purple-500"
                                                                : "bg-slate-900 text-slate-400 border-slate-700 hover:border-slate-600"
                                                        )}
                                                    >
                                                        {btn.label}
                                                    </button>
                                                ))}
                                            </div>
                                            {frequency === 'interval' && (
                                                <div className="flex items-center gap-2 mt-2 bg-slate-900 p-2 rounded-lg border border-slate-700">
                                                    <RotateCcw size={14} className="text-purple-500" />
                                                    <span className="text-xs text-slate-400">Every</span>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        value={intervalParam}
                                                        onChange={(e) => setIntervalParam(Math.max(1, parseInt(e.target.value) || 1))}
                                                        className="w-12 bg-transparent text-center font-bold text-white border-b border-purple-500 focus:outline-none"
                                                    />
                                                    <span className="text-xs text-slate-400">Days</span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                            <div className="space-y-2">
                                                <label className="text-xs text-slate-500">Due-Day Bonus</label>
                                                <div className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2">
                                                    <Coins size={14} className="text-amber-400" />
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        value={completionReward}
                                                        onChange={(e) => setCompletionReward(Math.max(0, parseInt(e.target.value) || 0))}
                                                        className="w-full bg-transparent text-right font-mono text-white focus:outline-none"
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-xs text-slate-500">Daily Passive Income</label>
                                                <div className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2">
                                                    <Coins size={14} className="text-emerald-400" />
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        value={passiveReward}
                                                        onChange={(e) => setPassiveReward(Math.max(0, parseInt(e.target.value) || 0))}
                                                        className="w-full bg-transparent text-right font-mono text-white focus:outline-none"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Horizon Control - Moved here */}
                                        <div className="pt-4 border-t border-white/5 space-y-2">
                                            <div className="flex justify-between items-center">
                                                <label className="text-xs text-slate-500">Event Horizon (Lookahead)</label>
                                                <span className="text-xs font-mono text-purple-400">{lookaheadDays} Days</span>
                                            </div>
                                            <div className="flex items-center gap-2 bg-slate-900 p-2 rounded-lg border border-slate-700">
                                                <Zap size={14} className="text-purple-500" />
                                                <input
                                                    type="range"
                                                    min="1"
                                                    max="30"
                                                    value={lookaheadDays}
                                                    onChange={(e) => setLookaheadDays(parseInt(e.target.value))}
                                                    className="flex-1 accent-purple-500"
                                                />
                                            </div>
                                        </div>
                                    </MotionDiv>
                                )}
                            </div>

                            <button
                                type="submit"
                                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white py-3 rounded-xl font-bold shadow-lg shadow-purple-900/20 flex items-center justify-center gap-2 mt-2"
                            >
                                <Plus size={20} /> Initialize Protocol
                            </button>

                            <div className="flex justify-center mt-2">
                                <span className="text-[10px] text-slate-500 uppercase tracking-widest">Swipe Up to Cancel</span>
                            </div>
                        </form>
                    </MotionDiv>
                </>
            )}
        </AnimatePresence>
    );
};

const HabitTracker = () => {
    const { habits, addHabit, completeHabit, skipHabitCycle, deleteHabit, toggleHabitActivation, updateHabitRewards, settings } = useGame();

    // Modal States
    const [showActiveList, setShowActiveList] = useState(false);
    const [showInactiveList, setShowInactiveList] = useState(false);
    const [isCreationOpen, setIsCreationOpen] = useState(false);

    // Filter Config
    const [storedLookaheadDays, setStoredLookaheadDays] = usePersistentState(
        PROTOCOL_LOOKAHEAD_STORAGE_KEY,
        LOOKAHEAD_DAYS_DEFAULT
    );
    const lookaheadDays = Math.max(1, Number(storedLookaheadDays) || LOOKAHEAD_DAYS_DEFAULT);
    const setLookaheadDays = useCallback((value) => {
        setStoredLookaheadDays(Math.max(1, Number(value) || LOOKAHEAD_DAYS_DEFAULT));
    }, [setStoredLookaheadDays]);

    // Deck Logic
    const [dismissedHabits, setDismissedHabits] = useState([]);
    const [slideDirection, setSlideDirection] = useState(1); // 1 = Right, -1 = Left (Skip)

    // --- DATA ---
    const allHabits = useMemo(() => (Array.isArray(habits) ? habits : []), [habits]);

    // Active & Inactive Split (memoized)
    const activeHabits = useMemo(() =>
        allHabits.filter(h => h.isActive !== false),
        [allHabits]
    );
    const inactiveHabits = useMemo(() =>
        allHabits.filter(h => h.isActive === false),
        [allHabits]
    );
    const dueTodayHabits = useMemo(() =>
        activeHabits.filter(h => getDaysUntilDue(h) <= 0),
        [activeHabits]
    );

    const baseDeckHabits = useMemo(() => {
        return activeHabits.filter(h => {
            if (dismissedHabits.includes(h.id)) return false;

            const daysUntil = getDaysUntilDue(h);
            return daysUntil < lookaheadDays;
        });
    }, [activeHabits, dismissedHabits, lookaheadDays]);
    const deckHabitIds = useMemo(() => baseDeckHabits.map((habit) => habit.id), [baseDeckHabits]);
    const protocolDeckOrder = useDeckOrder(deckHabitIds);
    const deckHabits = useMemo(() => {
        const habitsById = new Map(baseDeckHabits.map((habit) => [habit.id, habit]));
        return protocolDeckOrder.orderedIds.map((id) => habitsById.get(id)).filter(Boolean);
    }, [baseDeckHabits, protocolDeckOrder.orderedIds]);


    // --- HANDLERS ---

    // Defer handleAddHabit to Panel via prop

    const handleComplete = (id) => {
        setSlideDirection(1); // Right
        protocolDeckOrder.complete(id);
        completeHabit(id);
    };

    const handleSkip = (id) => {
        setSlideDirection(-1); // Left
        setDismissedHabits(prev => [...prev, id]);
        skipHabitCycle(id);
    };

    const handleCycleNext = (id) => {
        setSlideDirection(2); // Up (Fly Up)
        protocolDeckOrder.next(id);
    };

    const handleCyclePrev = () => {
        setSlideDirection(-2); // Down (Drop In - Initial variant handles negative direction appropriately if matched)
        protocolDeckOrder.prev();
    };

    const handleDeactivate = (id) => {
        toggleHabitActivation(id, false);
    };

    const handleActivate = (id) => {
        toggleHabitActivation(id, true);
        setDismissedHabits(prev => prev.filter((habitId) => habitId !== id));
    };

    return (
        <MotionDiv
            className="pb-4 md:pb-0 relative flex flex-col w-full flex-1 h-full touch-none"
            onPanEnd={(e, info) => {
                // Global swipe down to open creation
                // Ignore if touching a card (card has data-no-swipe)
                if (e.target.closest('[data-no-swipe="true"]')) return;

                if (info.offset.y > 80 && !isCreationOpen && window.scrollY < 50) {
                    setIsCreationOpen(true);
                }
            }}
        >
            {/* HEADER */}
            <div className="flex justify-between items-center mb-5 px-6">
                <div>
                    <h2 className="text-3xl font-game font-bold text-purple-400 tracking-widest uppercase text-glow">
                        Protocols
                    </h2>
                    <p className="text-sm text-purple-400/60">System routines.</p>
                </div>

                <span className="text-purple-400 px-4 py-1 rounded-full text-xs font-bold">
                    {dueTodayHabits.length} DUE TODAY
                </span>

            </div>

            {/* DECK */}
            <div className="mb-0 z-10 relative">
                <ProtocolDeck
                    habits={deckHabits}
                    onComplete={handleComplete}
                    onSkip={handleSkip}
                    onCycleNext={handleCycleNext}
                    onCyclePrev={handleCyclePrev}
                    onUpdateRewards={updateHabitRewards}
                    slideDirection={slideDirection}
                />
            </div>

            {/* 3. PROTOCOLS & DATABASE - Moved up due to Grid flow */}
            <div className="px-4 grid grid-cols-2 gap-8 mb-24 md:mb-8 mt-4">
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

            <div className="flex-1 w-full" />

            {/* Creation Panel */}
            <ProtocolCreationPanel
                key={`${isCreationOpen}-${settings.protocolReward}`}
                isOpen={isCreationOpen}
                onClose={() => setIsCreationOpen(false)}
                onAdd={addHabit}
                lookaheadDays={lookaheadDays}
                setLookaheadDays={setLookaheadDays}
                defaultCompletionReward={settings.protocolReward}
            />




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
        </MotionDiv>
    );
};

export default HabitTracker;
