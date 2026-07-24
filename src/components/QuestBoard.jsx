import React, { useState, useMemo, useRef } from 'react';
import { useGame } from '../context/GameContext';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { CheckCircle, Trash2, Plus, Sword, Settings, Calendar, X, RotateCcw } from 'lucide-react';
import clsx from 'clsx';
import { SPRING_CONFIG } from '../constants/animations';
import { isWithinDays, getTodayISO, toLocalISOString } from '../utils/dateUtils';
import { useDeckOrder } from '../hooks/useDeckOrder';
import questTabletopBase from '../assets/quests/quest-tabletop-base-blender.webp';
import easyActiveRender from '../assets/quests/quest-card-active-easy-blender.webp';
import easyMiddleRender from '../assets/quests/quest-card-middle-easy-blender.webp';
import easyRearRender from '../assets/quests/quest-card-rear-easy-blender.webp';
import mediumActiveRender from '../assets/quests/quest-card-active-medium-blender.webp';
import mediumMiddleRender from '../assets/quests/quest-card-middle-medium-blender.webp';
import mediumRearRender from '../assets/quests/quest-card-rear-medium-blender.webp';
import hardActiveRender from '../assets/quests/quest-card-active-hard-blender.webp';
import hardMiddleRender from '../assets/quests/quest-card-middle-hard-blender.webp';
import hardRearRender from '../assets/quests/quest-card-rear-hard-blender.webp';
import legendaryActiveRender from '../assets/quests/quest-card-active-legendary-blender.webp';
import legendaryMiddleRender from '../assets/quests/quest-card-middle-legendary-blender.webp';
import legendaryRearRender from '../assets/quests/quest-card-rear-legendary-blender.webp';
import './QuestBoard.css';

const CARD_RENDER_SLOTS = {
    easy: [easyActiveRender, easyMiddleRender, easyRearRender],
    medium: [mediumActiveRender, mediumMiddleRender, mediumRearRender],
    hard: [hardActiveRender, hardMiddleRender, hardRearRender],
    legendary: [legendaryActiveRender, legendaryMiddleRender, legendaryRearRender]
};

const QuestDeckCard = ({
    quest,
    index,
    onComplete,
    onDismiss,
    onSkip,
    isTop,
    onUpdate,
    onPrevious,
    onDeckGestureStart,
    onDeckGestureEnd,
    isCycleDestination = false,
    custom
}) => {
    const x = useMotionValue(0);
    const y = useMotionValue(0);
    const rotate = useTransform(x, [-220, 220], [-18, 18]);
    const highlightX = useTransform(x, [-180, 180], ['15%', '85%']);
    const completeOpacity = useTransform(x, [35, 125], [0, 1]);
    const dismissOpacity = useTransform(x, [-125, -35], [1, 0]);

    // Background colors for swipe feedback
    const [showDetails, setShowDetails] = useState(false);
    const [isEditingBrief, setIsEditingBrief] = useState(false);
    const [localBrief, setLocalBrief] = useState(quest.missionBrief || '');

    const handleDragEnd = (event, info) => {
        const distanceThreshold = 88;
        const velocityThreshold = 620;
        const horizontal = Math.abs(info.offset.x) >= Math.abs(info.offset.y);
        if (horizontal && (info.offset.x > distanceThreshold || info.velocity.x > velocityThreshold)) {
            onComplete(quest.id);
        } else if (horizontal && (info.offset.x < -distanceThreshold || info.velocity.x < -velocityThreshold)) {
            onDismiss(quest.id);
        } else if (!horizontal && (info.offset.y < -distanceThreshold || info.velocity.y < -velocityThreshold)) {
            onSkip(quest.id, {
                offsetX: info.offset.x,
                velocityX: info.velocity.x
            });
        } else if (!horizontal && (info.offset.y > distanceThreshold || info.velocity.y > velocityThreshold)) {
            if (onPrevious) onPrevious();
        }
        onDeckGestureEnd?.();
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

    const materials = {
        easy: { label: 'Common', material: 'Field Issue', code: 'FE–01' },
        medium: { label: 'Rare', material: 'Tempered Alloy', code: 'TI–02' },
        hard: { label: 'Epic', material: 'Forged Composite', code: 'CR–03' },
        legendary: { label: 'Legendary', material: 'Blackened Metal', code: 'AU–01' }
    };
    const material = materials[quest.difficulty] || materials.easy;

    const rarity = CARD_RENDER_SLOTS[quest.difficulty] ? quest.difficulty : 'easy';
    const rarityRenders = CARD_RENDER_SLOTS[rarity];
    const cardRender = rarityRenders[index] || rarityRenders[rarityRenders.length - 1];
    const transitionAction = typeof custom === 'string' ? custom : custom?.action;
    const promotionPose = !isTop
        ? (!isCycleDestination && index === 1 ? { x: '-4.73%', y: '2.34%', rotate: 7 } : false)
        : (transitionAction === 'previous'
            ? { y: -180, scale: 1.02, opacity: 1 }
            : { x: '-3.90%', y: '2.35%', rotate: -3.3, opacity: 1 });

    return (
        <motion.div
            className="quest-card-cycle-layer"
            custom={custom}
            variants={{
                initial: { opacity: 1, zIndex: 30 - index },
                animate: {
                    x: 0,
                    y: 0,
                    scale: 1,
                    opacity: 1,
                    zIndex: 30 - index,
                    transition: { type: 'spring', stiffness: 260, damping: 30 }
                },
                exit: (context) => {
                    const action = typeof context === 'string' ? context : context?.action;
                    const deckSize = typeof context === 'object' ? context.deckSize : 4;
                    const upwardArcX = typeof context === 'object' ? context.cycleArcX : 8;
                    const upwardArcPosition = `${upwardArcX}%`;
                    if (action === 'complete') return { x: 430, rotate: 17, opacity: 0, transition: { duration: 0.24 } };
                    if (action === 'dismiss') return { x: -430, rotate: -17, opacity: 0, transition: { duration: 0.24 } };
                    if (action === 'previous') {
                        if (deckSize <= 1) {
                            return {
                                x: 0,
                                y: 0,
                                rotate: 0,
                                scale: 1,
                                opacity: 1,
                                zIndex: 30,
                                transition: { type: 'spring', stiffness: 260, damping: 30 }
                            };
                        }
                        return {
                            x: ['0%', '-8%', '-3.90%'],
                            y: ['0%', '4%', '2.35%'],
                            rotate: [0, -8, -3.3],
                            scale: [1, 0.97, 1],
                            zIndex: [30, 30, 27],
                            opacity: 1,
                            transition: { duration: 0.52, times: [0, 0.42, 1], ease: [0.22, 1, 0.36, 1] }
                        };
                    }
                    if (deckSize <= 1) {
                        return {
                            x: 0,
                            y: 0,
                            rotate: 0,
                            scale: 1,
                            opacity: 1,
                            zIndex: 30,
                            transition: { type: 'spring', stiffness: 260, damping: 30 }
                        };
                    }
                    if (deckSize === 2) {
                        return {
                            x: ['0%', upwardArcPosition, '-3.90%'],
                            y: ['0%', '-3%', '2.35%'],
                            rotate: [0, upwardArcX, -3.3],
                            scale: [1, 0.97, 1],
                            zIndex: [30, 30, 27],
                            opacity: 1,
                            transition: { duration: 0.52, times: [0, 0.42, 1], ease: [0.22, 1, 0.36, 1] }
                        };
                    }
                    if (deckSize === 3) {
                        return {
                            x: ['0%', upwardArcPosition, '-9.24%'],
                            y: ['0%', '-3%', '4.46%'],
                            rotate: [0, upwardArcX, 3.7],
                            scale: [1, 0.97, 1],
                            zIndex: [30, 30, 27],
                            opacity: 1,
                            transition: { duration: 0.56, times: [0, 0.4, 1], ease: [0.22, 1, 0.36, 1] }
                        };
                    }
                    return {
                        x: ['0%', upwardArcPosition, '-9.24%'],
                        y: ['0%', '-3%', '4.46%'],
                        rotate: [0, upwardArcX, 3.7],
                        scale: [1, 0.97, 1],
                        zIndex: [30, 30, 26],
                        opacity: 1,
                        transition: { duration: 0.58, times: [0, 0.4, 1], ease: [0.22, 1, 0.36, 1] }
                    };
                }
            }}
            transition={SPRING_CONFIG}
            initial="initial"
            animate="animate"
            exit="exit"
        >
            <motion.div
                className="quest-card-render-layer"
                style={{
                    x,
                    y,
                    rotate: isTop ? rotate : 0,
                    '--light-x': highlightX
                }}
                drag={isTop && !isEditingBrief ? true : false}
                dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
                dragElastic={0.6}
                dragPropagation={false}
                data-no-swipe="true"
                onDragStart={onDeckGestureStart}
                onDragEnd={handleDragEnd}
                onTap={isTop ? toggleDetails : undefined}
                onPanStart={(e) => e.stopPropagation()}
                onPan={(e) => e.stopPropagation()}
                onPanEnd={(e) => e.stopPropagation()}
                onPointerDown={(e) => {
                    onDeckGestureStart?.();
                    e.stopPropagation();
                }}
                onPointerUp={onDeckGestureEnd}
                onPointerCancel={onDeckGestureEnd}
            >
                <motion.div
                    className="quest-card-pose-layer"
                    initial={promotionPose}
                    animate={{ x: 0, y: 0, scale: 1, rotate: 0, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 30 }}
                >
                    <img className="quest-card-body-render" src={cardRender} alt="" draggable="false" />

                    {isTop && (
                        <div className={clsx(
                            'quest-deck-card',
                            'is-render-hit-stage',
                            quest.difficulty || 'easy',
                            showDetails && 'is-details-open',
                            isEditingBrief && 'is-editing'
                        )}>
                        <motion.div style={{ opacity: completeOpacity }} className="quest-swipe-plate quest-complete-plate">
                            <span><CheckCircle size={22} /> COMPLETE</span>
                        </motion.div>
                        <motion.div style={{ opacity: dismissOpacity }} className="quest-swipe-plate quest-dismiss-plate">
                            <span><Trash2 size={22} /> DISMISS</span>
                        </motion.div>
                        <div className="quest-card-face select-none">
                            <div className="quest-rarity-insignia" aria-label={`${material.label} rarity`}>
                                <span className="quest-rarity-glyph" aria-hidden="true">
                                    <i /><i /><i />
                                </span>
                                <span>{material.label}</span>
                                <small>{material.code}</small>
                            </div>
                            <h3 className="quest-card-title">{quest.title}</h3>
                            <div className="quest-card-content">
                                {showDetails && (
                                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="quest-card-details">
                                        <div className="quest-material-note">
                                            <span>{material.label} · {material.material}</span>
                                            <small>{material.code}</small>
                                        </div>
                                        <div className="quest-due-date">
                                            <Calendar size={14} />
                                            <span>DUE</span>
                                            <strong>{quest.dueDate ? new Date(quest.dueDate).toLocaleDateString() : 'NO LIMIT'}</strong>
                                        </div>
                                        <div className="quest-brief-heading">
                                            <span>MISSION BRIEF</span>
                                            {!isEditingBrief && <small>Long press to edit</small>}
                                        </div>
                                        {isEditingBrief ? (
                                            <div className="quest-brief-editor">
                                                <textarea
                                                    value={localBrief}
                                                    onChange={(e) => setLocalBrief(e.target.value)}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="quest-brief-textarea"
                                                    placeholder="Enter mission details..."
                                                    autoFocus
                                                />
                                                <button onClick={saveBrief} className="quest-brief-save">
                                                    <CheckCircle size={12} /> Save
                                                </button>
                                            </div>
                                        ) : (
                                            <motion.div
                                                onPointerDown={(e) => {
                                                    const timer = setTimeout(handleBriefLongPress, 800);
                                                    e.target.dataset.longPressTimer = timer;
                                                }}
                                                onPointerUp={(e) => clearTimeout(e.target.dataset.longPressTimer)}
                                                onPointerLeave={(e) => clearTimeout(e.target.dataset.longPressTimer)}
                                                className="quest-brief-copy custom-scrollbar"
                                            >
                                                {quest.missionBrief || "Complete this objective to earn rewards."}
                                            </motion.div>
                                        )}
                                    </motion.div>
                                )}
                            </div>
                        </div>
                        </div>
                    )}
                </motion.div>
            </motion.div>
        </motion.div>
    );
};

const QuestDeck = ({
    quests,
    onComplete,
    onDelete,
    onSkip,
    onUpdate,
    onPrevious,
    onDeckGestureStart,
    onDeckGestureEnd,
    cyclingQuestId,
    onCycleComplete,
    cycleArcX,
    slideDirection = 'next'
}) => {
    const visibleQuests = quests.slice(0, 3);
    const activeQuest = visibleQuests[0];
    const stackedQuests = visibleQuests.slice(1);
    const transitionContext = { action: slideDirection, deckSize: quests.length, cycleArcX };

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
        <div className="quest-deck-scene">
            {stackedQuests.map((quest, stackIndex) => {
                const index = stackIndex + 1;
                return (
                    <QuestDeckCard
                        key={`stack-${quest.id}-${index}`}
                        quest={quest}
                        index={index}
                        isTop={false}
                        onComplete={onComplete}
                        onDismiss={onDelete}
                        onSkip={onSkip}
                        onUpdate={onUpdate}
                        onPrevious={onPrevious}
                        onDeckGestureStart={onDeckGestureStart}
                        onDeckGestureEnd={onDeckGestureEnd}
                        isCycleDestination={quest.id === cyclingQuestId}
                        custom={transitionContext}
                    />
                );
            })}

            <AnimatePresence custom={transitionContext} initial={false} onExitComplete={onCycleComplete}>
                {activeQuest && (
                    <QuestDeckCard
                        key={`active-${activeQuest.id}`}
                        quest={activeQuest}
                        index={0}
                        isTop
                        onComplete={onComplete}
                        onDismiss={onDelete}
                        onSkip={onSkip}
                        onUpdate={onUpdate}
                        onPrevious={onPrevious}
                        onDeckGestureStart={onDeckGestureStart}
                        onDeckGestureEnd={onDeckGestureEnd}
                        custom={transitionContext}
                    />
                )}
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
    const [isCreationOpen, setIsCreationOpen] = useState(false);

    // Animation State
    const [slideDirection, setSlideDirection] = useState('next');
    const [cyclingQuestId, setCyclingQuestId] = useState(null);
    const [cycleArcX, setCycleArcX] = useState(0);
    const deckGestureActive = useRef(false);

    const startDeckGesture = () => {
        deckGestureActive.current = true;
    };

    const endDeckGesture = () => {
        window.setTimeout(() => {
            deckGestureActive.current = false;
        }, 0);
    };

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
        setIsCreationOpen(false);
    };

    const baseActiveQuests = useMemo(() =>
        quests.filter(q => !q.completed && !q.discarded),
        [quests]
    );
    const activeQuestIds = useMemo(() => baseActiveQuests.map((quest) => quest.id), [baseActiveQuests]);
    const questDeckOrder = useDeckOrder(activeQuestIds);

    const handleSkip = (id, gesture = {}) => {
        setSlideDirection('next');
        const projectedX = (gesture.offsetX || 0) + (gesture.velocityX || 0) * 0.025;
        const viewportWidth = Math.max(window.innerWidth, 1);
        const responsiveArcX = Math.max(-8, Math.min(8, (projectedX / viewportWidth) * 100));
        setCycleArcX(Math.abs(responsiveArcX) < 0.75 ? 0 : responsiveArcX);
        if (baseActiveQuests.length > 1) {
            setCyclingQuestId(id);
        }
        questDeckOrder.next(id);
    };

    const handlePrevious = () => {
        setSlideDirection('previous');
        const currentTopId = questDeckOrder.orderedIds[0];
        if (baseActiveQuests.length > 1 && currentTopId) {
            setCyclingQuestId(currentTopId);
        }
        questDeckOrder.prev();
    };

    const handleComplete = (id) => {
        setSlideDirection('complete');
        completeQuest(id);
    };

    const handleDelete = (id) => {
        setSlideDirection('dismiss');
        deleteQuest(id);
    };

    // Filter Logic (memoized)
    const activeQuests = useMemo(() => {
        const questsById = new Map(baseActiveQuests.map((quest) => [quest.id, quest]));
        return questDeckOrder.orderedIds.map((id) => questsById.get(id)).filter(Boolean);
    }, [baseActiveQuests, questDeckOrder.orderedIds]);

    const completedQuests = useMemo(() =>
        quests.filter(q => q.completed),
        [quests]
    );

    // Victory Log: Last 3 Days (using shared utility)
    const recentVictories = useMemo(() =>
        completedQuests.filter(q => isWithinDays(q.completedAt, 3)),
        [completedQuests]
    );

    const discardedQuests = useMemo(() =>
        quests.filter(q => q.discarded && isWithinDays(q.discardedAt, 7)),
        [quests]
    );

    return (
        <motion.div
            className="quest-board-tabletop-surface pb-4 md:pb-0 relative flex flex-col w-full touch-none"
            onPanEnd={(event, info) => {
                if (deckGestureActive.current) return;
                if (event.target instanceof Element && event.target.closest('[data-no-swipe="true"]')) return;
                if (info.offset.y > 80 && !isCreationOpen && window.scrollY < 50) {
                    setIsCreationOpen(true);
                }
            }}
        >
            <div className="quest-board-tabletop-scene" aria-hidden="true">
                <img src={questTabletopBase} alt="" draggable="false" />
            </div>
            <div className="flex justify-between items-center mb-5 px-6" style={{ touchAction: 'none' }}>
                <div>
                    <h2 className="quest-board-title text-3xl font-game font-bold tracking-widest uppercase">Active Quests</h2>
                    <p className="text-sm text-emerald-400/60">Current objectives.</p>
                </div>
                <span className="quest-active-count">
                    {activeQuests.length} ACTIVE
                </span>
            </div>

            {/* 1. THE CARDS (Moved to Top) */}
            <div className="quest-deck-layout mb-0 z-10 relative">
                <QuestDeck
                    quests={activeQuests}
                    onComplete={handleComplete}
                    onDelete={handleDelete}
                    onSkip={handleSkip}
                    onUpdate={updateQuest}
                    onPrevious={handlePrevious}
                    onDeckGestureStart={startDeckGesture}
                    onDeckGestureEnd={endDeckGesture}
                    cyclingQuestId={cyclingQuestId}
                    onCycleComplete={() => setCyclingQuestId(null)}
                    cycleArcX={cycleArcX}
                    slideDirection={slideDirection}
                />
            </div>

            <AnimatePresence>
                {isCreationOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="quest-creation-backdrop"
                            onClick={() => setIsCreationOpen(false)}
                        />
                        <motion.div
                            initial={{ y: '-100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '-100%' }}
                            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                            className="quest-creation-drawer"
                            drag="y"
                            dragConstraints={{ top: 0, bottom: 0 }}
                            onDragEnd={(event, { offset, velocity }) => {
                                if (offset.y < -50 || velocity.y < -500) setIsCreationOpen(false);
                            }}
                        >
                            <div className="quest-creation-header">
                                <h2><Plus size={20} /> New Quest</h2>
                                <button type="button" onClick={() => setIsCreationOpen(false)} aria-label="Close quest creation"><X size={20} /></button>
                            </div>
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
                                    className="quest-creation-title flex-1 rounded-lg px-4 py-2 transition-colors"
                                    autoFocus
                                />
                                <button
                                    type="button"
                                    onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
                                    className={clsx(
                                        "p-2 rounded-lg border transition-all shrink-0",
                                        isAdvancedOpen ? "bg-emerald-950 border-emerald-700 text-emerald-300" : "bg-slate-800 border-slate-700 text-gray-400 hover:text-white"
                                    )}
                                    title="Advanced Settings"
                                >
                                    <Settings size={20} />
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            className="quest-add-button w-full md:w-auto"
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
                                            {
                                                id: 'easy',
                                                label: 'Cmn',
                                                fullLabel: 'Common',
                                                activeClassName: 'border-emerald-600 bg-emerald-950/70', overlayClassName: 'bg-emerald-800/10', textClassName: 'text-emerald-300'
                                            },
                                            {
                                                id: 'medium',
                                                label: 'Rare',
                                                fullLabel: 'Rare',
                                                activeClassName: 'border-blue-600 bg-blue-950/50', overlayClassName: 'bg-blue-800/10', textClassName: 'text-blue-300'
                                            },
                                            {
                                                id: 'hard',
                                                label: 'Epic',
                                                fullLabel: 'Epic',
                                                activeClassName: 'border-purple-600 bg-purple-950/50', overlayClassName: 'bg-purple-800/10', textClassName: 'text-purple-300'
                                            },
                                            {
                                                id: 'legendary',
                                                label: 'Leg',
                                                fullLabel: 'Legendary',
                                                activeClassName: 'border-yellow-700 bg-yellow-950/40', overlayClassName: 'bg-yellow-800/10', textClassName: 'text-yellow-300'
                                            }
                                        ].map((level) => {
                                            const isActive = difficulty === level.id;
                                            return (
                                                <button
                                                    key={level.id}
                                                    type="button"
                                                    onClick={() => setDifficulty(level.id)}
                                                    className={clsx(
                                                        "flex flex-col items-center justify-center py-2 rounded-lg border transition-all relative overflow-hidden",
                                                        isActive ? level.activeClassName : "bg-slate-900/50 border-slate-700 opacity-60 hover:opacity-100 hover:border-slate-500"
                                                    )}
                                                    title={level.fullLabel}
                                                >
                                                    {isActive && <div className={clsx("absolute inset-0 z-0", level.overlayClassName)} />}
                                                    <span className={clsx("relative z-10 text-[10px] font-black uppercase tracking-widest", isActive ? level.textClassName : "text-gray-500")}>
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
                                                    onClick={() => setDueDate(getTodayISO())}
                                                    className="text-[10px] uppercase font-bold text-emerald-600 hover:text-emerald-400 transition-colors"
                                                >
                                                    Today
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const d = new Date();
                                                        d.setDate(d.getDate() + 1);
                                                        setDueDate(toLocalISOString(d));
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
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* 3. LOGS & HISTORY (Moved from Radial) */}
            <div className="px-4 grid grid-cols-2 gap-8 mt-2 mb-24 md:mb-8">
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
                                className={`w-8 h-8 rounded-full border border-slate-950 bg-slate-900 flex items-center justify-center shadow-lg relative -ml-3 first:ml-0 transition-all group-hover:scale-110 hover:!scale-125 z-10 hover:z-20 ${['text-emerald-900', 'text-emerald-800', 'text-emerald-600', 'text-emerald-500', 'text-emerald-400'][i] || 'text-emerald-400'}`}
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
                                className={`w-8 h-8 rounded-full border border-slate-950 bg-slate-900 flex items-center justify-center shadow-lg relative -mr-3 first:mr-0 transition-all group-hover:scale-110 hover:!scale-125 z-10 hover:z-20 ${['text-red-950', 'text-red-900', 'text-red-700', 'text-red-500', 'text-red-400'][i] || 'text-red-400'}`}
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
        </motion.div>
    );
};

export default QuestBoard;
