import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Zap, Coins, Heart, Calendar, CheckSquare, Plus, Check, Target, Crosshair } from 'lucide-react';
const StatsView = React.lazy(() => import('./StatsView'));
import FocusSelectionModal from './FocusSelectionModal';
import clsx from 'clsx';

const USE_HEX_VIEW = true;

const HexNode = ({ node, onClick, index, position }) => {
    const isCompleted = node.completed;

    // Determine Colors based on Type & Rarity
    const getNodeStyles = (n) => {
        if (n.type === 'habit') {
            return {
                border: "border-purple-500",
                text: "text-purple-400",
                stroke: "#a855f7", // purple-500
                glow: "shadow-[0_0_20px_rgba(168,85,247,0.4)]",
                bg: "bg-purple-900/40",
                innerGlow: "after:shadow-[inset_0_0_20px_rgba(168,85,247,0.3)]",
                icon: "text-purple-200"
            };
        }
        // Quests
        switch (n.difficulty) {
            case 'legendary': return {
                border: "border-yellow-400",
                text: "text-yellow-300",
                stroke: "#facc15",
                glow: "shadow-[0_0_25px_rgba(250,204,21,0.5)]",
                bg: "bg-yellow-900/40",
                innerGlow: "after:shadow-[inset_0_0_20px_rgba(250,204,21,0.3)]",
                icon: "text-yellow-100"
            };
            case 'hard': return {
                border: "border-fuchsia-500",
                text: "text-fuchsia-300",
                stroke: "#d946ef",
                glow: "shadow-[0_0_20px_rgba(217,70,239,0.4)]",
                bg: "bg-fuchsia-900/40",
                innerGlow: "after:shadow-[inset_0_0_20px_rgba(217,70,239,0.3)]",
                icon: "text-fuchsia-100"
            };
            case 'medium': return {
                border: "border-cyan-400",
                text: "text-cyan-300",
                stroke: "#22d3ee",
                glow: "shadow-[0_0_20px_rgba(34,211,238,0.4)]",
                bg: "bg-cyan-900/40",
                innerGlow: "after:shadow-[inset_0_0_20px_rgba(34,211,238,0.3)]",
                icon: "text-cyan-100"
            };
            default: return {
                border: "border-slate-400",
                text: "text-slate-300",
                stroke: "#94a3b8",
                glow: "shadow-[0_0_15px_rgba(148,163,184,0.3)]",
                bg: "bg-slate-800/60",
                innerGlow: "after:shadow-[inset_0_0_20px_rgba(148,163,184,0.1)]",
                icon: "text-slate-200"
            };
        }
    };

    const style = getNodeStyles(node);

    return (
        <motion.div
            layout
            initial={{ scale: 0, opacity: 0, x: position.x, y: position.y }}
            animate={{ scale: 1, opacity: 1, x: position.x, y: position.y }}
            transition={{
                delay: index * 0.05,
                type: "spring",
                stiffness: 260,
                damping: 20
            }}
            className="absolute w-28 h-32 flex items-center justify-center hover:z-20 transition-all cursor-pointer group origin-center"
            style={{
                // Positioning handled by motion x/y, but we center the element
                left: '50%',
                top: '50%',
                marginLeft: '-56px', // Half of w-28 (112px)
                marginTop: '-64px'   // Half of h-32 (128px)
            }}
            onClick={() => onClick(node)}
        >
            {/* Hover Glow Effect */}
            <div className={clsx(
                "absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-xl rounded-full z-0",
                style.bg
            )} />

            <div
                className={clsx(
                    "w-[95%] h-[95%] flex items-center justify-center transition-all duration-300 relative clip-hex",
                    isCompleted
                        ? `${style.bg} backdrop-blur-md`
                        : "bg-slate-900/90 hover:bg-slate-800",
                    isCompleted && style.innerGlow,
                    // Tech Pattern Overlay
                    "before:content-[''] before:absolute before:inset-0 before:bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAuMDUiLz4KPC9zdmc+')] before:opacity-30"
                )}
                style={{
                    clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
                }}
            >
                {/* SVG Border for Sharpness */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none z-10 overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                    {/* Outer Glow Stroke */}
                    <polygon
                        points="50,1 99,25 99,75 50,99 1,75 1,25"
                        fill="none"
                        stroke={style.stroke}
                        strokeWidth={isCompleted ? "3" : "1.5"}
                        className={clsx(
                            "transition-all duration-300 opacity-80",
                            isCompleted ? "drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]" : "group-hover:stroke-2 group-hover:drop-shadow-[0_0_5px_rgba(255,255,255,0.3)]"
                        )}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                    {/* Inner Decorative Lines */}
                    {!isCompleted && (
                        <>
                            <line x1="50" y1="5" x2="50" y2="15" stroke={style.stroke} strokeWidth="1" className="opacity-30" />
                            <line x1="50" y1="85" x2="50" y2="95" stroke={style.stroke} strokeWidth="1" className="opacity-30" />
                        </>
                    )}
                </svg>

                {/* Content */}
                <div className="flex flex-col items-center justify-center p-2 text-center z-20 max-w-[85%] relative">

                    {/* Icon Halo */}
                    <div className={clsx(
                        "relative mb-1 p-2 rounded-full transition-all duration-300",
                        isCompleted ? "bg-white/20 scale-110" : "bg-slate-800/50 group-hover:scale-110 group-hover:bg-slate-700"
                    )}>
                        {node.type === 'quest' ? (
                            <Crosshair size={isCompleted ? 18 : 16} className={clsx("transition-colors", isCompleted ? "text-white" : style.icon)} />
                        ) : (
                            <Zap size={isCompleted ? 18 : 16} className={clsx("transition-colors", isCompleted ? "text-white" : style.icon)} />
                        )}
                    </div>

                    <span className={clsx(
                        "text-[10px] font-bold uppercase leading-tight transition-colors duration-300 line-clamp-2 px-1",
                        isCompleted ? "text-white text-shadow-sm" : "text-slate-400 group-hover:text-slate-200"
                    )}>
                        {node.title}
                    </span>

                    {/* Completion Checkmark Overlay */}
                    <AnimatePresence>
                        {isCompleted && (
                            <motion.div
                                initial={{ scale: 0, rotate: -45 }}
                                animate={{ scale: 1, rotate: 0 }}
                                className="absolute -top-1 -right-1 bg-green-500 text-slate-900 rounded-full p-0.5 shadow-lg border border-white"
                            >
                                <Check size={10} strokeWidth={4} />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </motion.div>
    );
};

const HexMatrix = ({ nodes, onToggleNode }) => {
    // Radial Layout Configuration
    // Spacing constants for w-28 (112px) h-32 (128px)
    // Tighter spacing: dx ~58, dy ~100
    const dx = 58;
    const dy = 100;

    const positions = [
        { x: 0, y: 0 },         // 0: Center
        { x: dx, y: -dy },      // 1: Top-Right
        { x: 116, y: 0 },       // 2: Right (112+4 gap)
        { x: dx, y: dy },       // 3: Bottom-Right
        { x: -dx, y: dy },      // 4: Bottom-Left
        { x: -116, y: 0 },      // 5: Left (-112-4 gap)
        { x: -dx, y: -dy }      // 6: Top-Left
    ];

    return (
        <div className="relative w-full h-[320px] flex items-center justify-center overflow-visible">
            {nodes.length === 0 ? (
                <div className="flex flex-col items-center text-gray-500 animate-pulse">
                    <div className="w-16 h-16 border-2 border-dashed border-slate-700 rounded-full flex items-center justify-center mb-2">
                        <Zap size={24} className="opacity-30" />
                    </div>
                    <span className="text-xs font-mono uppercase tracking-widest opacity-50">Grid Offline</span>
                </div>
            ) : (
                <div className="relative w-0 h-0 scale-90 sm:scale-100">
                    {/* w-0 h-0 acts as the center point (0,0) */}
                    <AnimatePresence mode='popLayout'>
                        {nodes.map((node, i) => {
                            if (i >= positions.length) return null; // Cap at 7 visible
                            return (
                                <HexNode
                                    key={node.id}
                                    node={node}
                                    index={i}
                                    position={positions[i]}
                                    onClick={onToggleNode}
                                />
                            );
                        })}
                    </AnimatePresence>
                </div>
            )}
        </div>
    );
};

const Dashboard = ({ onTabChange }) => {
    const { stats, quests, habits, completeQuest, checkHabit } = useGame();
    const [showStats, setShowStats] = useState(false);
    const [showFocusModal, setShowFocusModal] = useState(false);

    const xpPercentage = Math.min((stats.xp / stats.maxXp) * 100, 100);
    const hpPercentage = Math.min((stats.hp / stats.maxHp) * 100, 100);

    // Filter "Today's Focus" items
    const todayQuests = quests.filter(q => q.isToday && !q.completed);
    const todayHabits = habits.filter(h => h.isToday);

    // Check if habit is already completed today
    const isHabitDoneToday = (habit) => {
        const today = new Date().toISOString().split('T')[0];
        return (habit.history[today] || 0) > 0;
    };

    const activeTodayHabits = todayHabits.filter(h => !isHabitDoneToday(h));

    // Combined empty state check
    const isFocusEmpty = todayQuests.length === 0 && activeTodayHabits.length === 0;

    // --- DATA PREPARATION FOR MATRIX VIEW (QUEUE MODE) ---
    // User requested: "Only show first 5 or 6 items", "Completing hides and updates with next".
    // This implies a Queue of PENDING items only.

    const allPendingTodayQuests = quests.filter(q => q.isToday && !q.completed);
    const allPendingTodayHabits = habits.filter(h => h.isToday && !isHabitDoneToday(h));

    const pendingQueue = [
        ...allPendingTodayQuests.map(q => ({ ...q, type: 'quest', completed: false })),
        ...allPendingTodayHabits.map(h => ({ ...h, type: 'habit', completed: false }))
    ].sort((a, b) => {
        // Sort by priority/difficulty? Or just consistent title/id?
        // Let's use ID or creation time to keep order stable as items slide in
        return a.title.localeCompare(b.title);
    });

    // Show only top 7
    const matrixNodes = pendingQueue.slice(0, 7);

    // Override isFocusEmpty for the Matrix view if we want to show specific empty state
    // But existing isActiveTodayHabits logic basically does this for the legacy view.
    // For Matrix, we check if matrixNodes is empty.

    const handleNodeClick = (node) => {
        if (node.type === 'quest') {
            if (!node.completed) completeQuest(node.id);
            // If completed, maybe uncomplete? Not currently supported easily by logic, but for now just prevent action or show details
        } else {
            // Habit toggle
            // If completed, we want to undo? checkHabit handles 'positive', usually just adds. 
            // The prompt says "reversible if i dont like it" referring to the UI, not necessarily the habit action.
            // But usually habits are toggleable. 
            // Current checkHabit implementation usually assumes 'doing' it.
            if (!node.completed) {
                checkHabit(node.id, 'positive');
            }
        }
    };

    return (
        <div className="space-y-5 pb-24">
            <React.Suspense fallback={null}>
                <StatsView isOpen={showStats} onClose={() => setShowStats(false)} />
            </React.Suspense>

            <FocusSelectionModal isOpen={showFocusModal} onClose={() => setShowFocusModal(false)} />

            {/* HUD Stats Area */}
            <div className="bg-game-panel p-3 rounded-2xl border border-slate-700 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-game-accent to-transparent opacity-50"></div>

                <div className="flex flex-col gap-4">
                    {/* Top Row: Level and Credits */}
                    <div className="flex items-center justify-between px-2">
                        <div className="flex items-center gap-3">
                            <motion.div
                                whileTap={{ scale: 0.9 }}
                                onClick={() => setShowStats(true)}
                                className="w-14 h-14 rounded-full bg-slate-900 border-2 border-game-accent flex items-center justify-center text-xl font-bold font-game text-game-accent shadow-neon cursor-pointer hover:bg-game-accent/10 transition-colors"
                            >
                                {stats.level}
                            </motion.div>
                            <div className="text-game-muted text-[10px] font-bold tracking-[0.2em] uppercase">Level</div>
                        </div>

                        <motion.div
                            whileTap={{ scale: 0.95 }}
                            onClick={() => onTabChange('budget')}
                            className="bg-slate-950/50 px-4 py-2 rounded-xl border border-game-gold/30 flex items-center gap-3 cursor-pointer hover:bg-game-gold/5 transition-colors relative group"
                        >
                            <div className="absolute inset-0 bg-game-gold/0 group-hover:bg-game-gold/5 rounded-xl transition-colors" />
                            <Coins size={20} className="text-game-gold group-hover:drop-shadow-[0_0_5px_rgba(255,215,0,0.5)]" />
                            <div className="flex flex-col items-end relative z-10">
                                <span className="text-lg font-black text-white leading-none group-hover:text-game-gold transition-colors">{stats.gold}</span>
                                <span className="text-[8px] text-game-gold uppercase tracking-tighter">Credits</span>
                            </div>
                        </motion.div>
                    </div>

                    {/* Bottom Row: Stats Bars */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 px-1">
                        {/* HP */}
                        <div
                            onClick={() => onTabChange('calories')}
                            className="cursor-pointer group"
                        >
                            <div className="flex justify-between text-[10px] font-bold text-gray-400 mb-1 px-1 group-hover:text-white transition-colors">
                                <span className="flex items-center gap-1 uppercase"><Heart size={10} className="text-game-danger fill-game-danger/20" /> Health</span>
                                <span className="font-mono text-gray-500 group-hover:text-white">{stats.hp}/{stats.maxHp}</span>
                            </div>
                            <div className="h-3 bg-slate-900 rounded-full overflow-hidden border border-slate-800 relative group-hover:border-game-danger/50 transition-colors">
                                <motion.div
                                    className="h-full bg-game-danger shadow-[0_0_10px_rgba(244,63,94,0.4)]"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${hpPercentage}%` }}
                                    transition={{ type: "spring", bounce: 0, duration: 1 }}
                                />
                            </div>
                        </div>

                        {/* XP */}
                        <div>
                            <div className="flex justify-between text-[10px] font-bold text-gray-400 mb-1 px-1">
                                <span className="flex items-center gap-1 uppercase"><Zap size={10} className="text-game-accent fill-game-accent/20" /> Experience</span>
                                <span className="font-mono text-gray-500">{stats.xp}/{stats.maxXp}</span>
                            </div>
                            <div className="h-3 bg-slate-900 rounded-full overflow-hidden border border-slate-800 relative">
                                <motion.div
                                    className="h-full bg-game-accent shadow-[0_0_10px_rgba(56,189,248,0.4)]"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${xpPercentage}%` }}
                                    transition={{ type: "spring", bounce: 0, duration: 1 }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Today's Focus Section */}
            <div>
                <div className="flex items-center justify-between mb-3 px-1">
                    <h2 className="text-lg font-game font-bold text-white tracking-wide shadow-black drop-shadow-md flex items-center gap-2">
                        <Crosshair className="text-game-accent" size={20} />
                        Today's Focus
                    </h2>
                    <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setShowFocusModal(true)}
                        className="bg-slate-800 hover:bg-slate-700 text-game-accent text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-700 flex items-center gap-2 transition-colors"
                    >
                        <Plus size={14} /> Manage
                    </motion.button>
                </div>

                <div className="space-y-3 min-h-[100px]">
                    <AnimatePresence mode="popLayout">
                        {USE_HEX_VIEW ? (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                            >
                                <HexMatrix nodes={matrixNodes} onToggleNode={handleNodeClick} />
                            </motion.div>
                        ) : (
                            // Legacy List View
                            <>
                                {isFocusEmpty ? (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="bg-slate-900/30 border border-dashed border-slate-800 rounded-xl p-8 flex flex-col items-center justify-center text-center gap-3"
                                    >
                                        <div className="w-12 h-12 rounded-full bg-slate-900 flex items-center justify-center text-slate-700">
                                            <Target size={24} />
                                        </div>
                                        <div>
                                            <p className="text-gray-400 font-bold text-sm">No Active Missions</p>
                                            <p className="text-gray-600 text-xs mt-1">Select items to focus on today</p>
                                        </div>
                                        <button
                                            onClick={() => setShowFocusModal(true)}
                                            className="mt-2 text-game-accent text-xs font-bold hover:underline"
                                        >
                                            Select Missions
                                        </button>
                                    </motion.div>
                                ) : (
                                    <>
                                        {/* Quests */}
                                        {todayQuests.map(q => (
                                            <motion.div
                                                key={q.id}
                                                layout
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, scale: 0.95 }}
                                                className="bg-slate-900/80 p-3 rounded-xl border border-slate-700/50 shadow-sm flex items-center gap-3 group relative overflow-hidden"
                                            >
                                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-game-accent"></div>

                                                <div className="flex-1 min-w-0">
                                                    <h4 className="text-gray-200 font-bold text-sm truncate">{q.title}</h4>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="text-[10px] bg-slate-800 text-gray-400 px-1.5 py-0.5 rounded capitalize">{q.difficulty}</span>
                                                        <span className="text-[10px] text-game-gold flex items-center gap-1">
                                                            <Coins size={10} /> +{q.reward.gold}
                                                        </span>
                                                    </div>
                                                </div>

                                                <motion.button
                                                    whileTap={{ scale: 0.9 }}
                                                    onClick={() => completeQuest(q.id)}
                                                    className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-gray-500 hover:text-game-accent hover:border-game-accent hover:bg-game-accent/10 transition-all"
                                                >
                                                    <CheckSquare size={20} />
                                                </motion.button>
                                            </motion.div>
                                        ))}

                                        {/* Protocols */}
                                        {activeTodayHabits.map(h => (
                                            <motion.div
                                                key={h.id}
                                                layout
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, scale: 0.95 }}
                                                className="bg-slate-900/80 p-3 rounded-xl border border-slate-700/50 shadow-sm flex items-center gap-3 group relative overflow-hidden"
                                            >
                                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-game-gold"></div>

                                                <div className="flex-1 min-w-0">
                                                    <h4 className="text-gray-200 font-bold text-sm truncate">{h.title}</h4>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="text-[10px] bg-slate-800 text-gray-400 px-1.5 py-0.5 rounded capitalize">{h.frequency}</span>
                                                        <span className="text-[10px] text-game-gold flex items-center gap-1">
                                                            <Coins size={10} /> +{stats.settings?.protocolReward || 1}
                                                        </span>
                                                    </div>
                                                </div>

                                                <motion.button
                                                    whileTap={{ scale: 0.9 }}
                                                    onClick={() => checkHabit(h.id, 'positive')}
                                                    className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-gray-500 hover:text-game-gold hover:border-game-gold hover:bg-game-gold/10 transition-all"
                                                >
                                                    <Check size={20} />
                                                </motion.button>
                                            </motion.div>
                                        ))}
                                    </>
                                )}
                            </>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
