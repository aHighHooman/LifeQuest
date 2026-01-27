import React, { useState, useMemo } from 'react';
import { useGame } from '../context/GameContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Zap, Coins, Heart, Plus, Check, Crosshair } from 'lucide-react';
const StatsView = React.lazy(() => import('./StatsView'));
import FocusSelectionModal from './FocusSelectionModal';
import DayTimer from './DayTimer';
import clsx from 'clsx';
import { getTodayISO } from '../utils/dateUtils';

const HexNode = ({ node, onClick, index, position }) => {
    const isCompleted = node.completed;

    // Determine Colors based on Type & Rarity
    // THEME UPDATE: 3D Radial Gradient (Darker Base, Solid Center)
    const getNodeStyles = (n) => {
        if (n.type === 'habit') {
            // Protocol: Purple
            return {
                gradient: "radial-gradient(circle at center, rgba(88,28,135,0.25) 0%, rgba(59,7,100,0.6) 100%)",
                stroke: "#a855f7",
                text: "text-purple-200",
                icon: "text-purple-400",
                glowColor: "rgba(168,85,247,0.3)"
            };
        }
        if (n.type === 'level') {
            // Level: Sky Blue (Darker Base)
            return {
                gradient: "radial-gradient(circle at center, rgba(7,89,133,0.25) 0%, rgba(8,47,73,0.6) 100%)",
                stroke: "#38bdf8",
                text: "text-sky-200",
                icon: "text-sky-400",
                glowColor: "rgba(56,189,248,0.3)"
            };
        }
        if (n.type === 'gold') {
            // Gold: Yellow (Darker Base)
            return {
                gradient: "radial-gradient(circle at center, rgba(133,77,14,0.25) 0%, rgba(66,32,6,0.6) 100%)",
                stroke: "#eab308",
                text: "text-yellow-200",
                icon: "text-yellow-400",
                glowColor: "rgba(234,179,8,0.3)"
            };
        }
        // Quests
        switch (n.difficulty) {
            case 'legendary': return {
                // Yellow
                gradient: "radial-gradient(circle at center, rgba(113,63,18,0.25) 0%, rgba(66,32,6,0.6) 100%)",
                stroke: "#eab308",
                text: "text-yellow-200",
                icon: "text-yellow-400",
                glowColor: "rgba(234,179,8,0.3)"
            };
            case 'hard': return {
                // Purple
                gradient: "radial-gradient(circle at center, rgba(88,28,135,0.25) 0%, rgba(59,7,100,0.6) 100%)",
                stroke: "#a855f7",
                text: "text-purple-200",
                icon: "text-purple-400",
                glowColor: "rgba(168,85,247,0.3)"
            };
            case 'medium': return {
                // Blue
                gradient: "radial-gradient(circle at center, rgba(30,58,138,0.25) 0%, rgba(23,37,84,0.6) 100%)",
                stroke: "#3b82f6",
                text: "text-blue-200",
                icon: "text-blue-400",
                glowColor: "rgba(59,130,246,0.3)"
            };
            default: return { // Easy = Green
                // Emerald
                gradient: "radial-gradient(circle at center, rgba(6,78,59,0.25) 0%, rgba(2,44,34,0.6) 100%)",
                stroke: "#10b981",
                text: "text-emerald-200",
                icon: "text-emerald-400",
                glowColor: "rgba(16,185,129,0.3)"
            };
        }
    };

    const style = getNodeStyles(node);

    // SCALED UP SIZE: w-36 h-40
    return (
        <motion.div
            layout
            initial={{ scale: 0, opacity: 0, x: position.x, y: position.y }}
            animate={{ scale: 1, opacity: 1, x: position.x, y: position.y }}
            transition={{
                delay: (index || 0) * 0.05,
                type: "spring",
                stiffness: 260,
                damping: 20
            }}
            className="absolute w-36 h-40 flex items-center justify-center hover:z-20 transition-all cursor-pointer group origin-center"
            style={{
                left: '50%',
                top: '50%',
                marginLeft: '-72px',
                marginTop: '-80px'
            }}
            onClick={() => onClick(node)}
        >
            {/* Hover Glow Effect */}
            <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-xl rounded-full z-0"
                style={{ backgroundColor: style.glowColor }}
            />

            <div
                className={clsx(
                    "w-[98%] h-[98%] flex items-center justify-center transition-all duration-300 relative clip-hex",
                    isCompleted
                        ? "bg-slate-200/90 backdrop-blur-md opacity-50 grayscale"
                        : "hover:brightness-125 shadow-sm"
                )}
                style={{
                    clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
                    background: isCompleted ? undefined : style.gradient
                }}
            >
                {/* SVG Border - Restored */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none z-10 overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <polygon
                        points="50,1 99,25 99,75 50,99 1,75 1,25"
                        fill="none"
                        stroke={style.stroke}
                        strokeWidth={isCompleted ? "4" : "2"}
                        className={clsx(
                            "transition-all duration-300 opacity-80",
                            isCompleted ? "stroke-gray-400" : ""
                        )}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </svg>

                {/* Tech Pattern */}
                {!isCompleted && (
                    <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPgo8cmVjdCB3aWR0aD0iMSIgaGVpZ2h0PSIxIiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAuMDUiLz4KPC9zdmc+')] opacity-50 pointer-events-none" />
                )}

                {/* Content */}
                <div className="flex flex-col items-center justify-center p-2 text-center z-20 max-w-[85%] relative">

                    {/* Icon Halo */}
                    <div className={clsx(
                        "relative mb-2 p-2.5 rounded-full transition-all duration-300",
                        isCompleted
                            ? "bg-gray-300 scale-90"
                            : "bg-black shadow-[inset_0_2px_6px_rgba(0,0,0,0.6)] group-hover:scale-110"
                    )}>
                        {node.type === 'quest' ? (
                            <Crosshair size={20} className={clsx("transition-colors", isCompleted ? "text-gray-500" : style.icon)} />
                        ) : node.type === 'habit' ? (
                            <Zap size={20} className={clsx("transition-colors", isCompleted ? "text-gray-500" : style.icon)} />
                        ) : node.type === 'level' ? (
                            <Shield size={20} className={style.icon} />
                        ) : node.type === 'gold' ? (
                            <Coins size={20} className={style.icon} />
                        ) : (
                            <Zap size={20} className={style.icon} />
                        )}
                    </div>

                    <span className={clsx(
                        "text-[11px] font-bold uppercase leading-tight transition-colors duration-300 line-clamp-2 px-1 tracking-tight drop-shadow-md",
                        isCompleted ? "text-gray-500 line-through decoration-2" : style.text
                    )}>
                        {node.title}
                    </span>

                    {/* Completion Checkmark Overlay */}
                    <AnimatePresence>
                        {isCompleted && (
                            <motion.div
                                initial={{ scale: 0, rotate: -45 }}
                                animate={{ scale: 1, rotate: 0 }}
                                className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-[1px]"
                            >
                                <div className="bg-green-500 text-white rounded-full p-2 shadow-lg scale-125">
                                    <Check size={24} strokeWidth={4} />
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </motion.div>
    );
};



const HexMatrix = ({ nodes, onToggleNode, onEmptyClick }) => {
    // SCALED UP LAYOUT
    // Base size w=144 (w-36), h=160 (h-40)
    // Horizontal Spacing (dx): ~ half width + margin. 72 + ~4 = 76
    // Vertical Spacing (dy): ~ 3/4 height. 120 + ~4 = 124

    // Tweak to tighter fit if needed
    const dx = 76;
    const dy = 128; // slightly more vertical space

    const positions = [
        { x: 0, y: 0 },         // 0: Center
        { x: dx, y: -dy },      // 1: Top-Right
        { x: dx * 2, y: 0 },    // 2: Right (Wide) - 152
        { x: dx, y: dy },       // 3: Bottom-Right
        { x: -dx, y: dy },      // 4: Bottom-Left
        { x: -dx * 2, y: 0 },   // 5: Left (Wide) - -152
        { x: -dx, y: -dy }      // 6: Top-Left
    ];

    return (
        <div className="relative w-full h-[320px] flex items-center justify-center overflow-visible">
            {nodes.length === 0 ? (
                <div
                    onClick={onEmptyClick}
                    className="flex flex-col items-center text-gray-500 animate-pulse cursor-pointer"
                >
                    <div className="w-20 h-20 border-2 border-dashed border-slate-700 rounded-full flex items-center justify-center mb-2">
                        <Zap size={32} className="opacity-30" />
                    </div>
                    <span className="text-xs font-mono uppercase tracking-widest opacity-50">Grid Offline</span>
                </div>
            ) : (
                <div className="relative w-0 h-0 scale-75 sm:scale-100">
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

const Dashboard = ({ onTabChange, onOpenSettings }) => {
    const { stats, quests, habits, completeQuest, checkHabit } = useGame();
    const [showStats, setShowStats] = useState(false);
    const [showFocusModal, setShowFocusModal] = useState(false);

    const xpPercentage = Math.min((stats.xp / stats.maxXp) * 100, 100);
    const hpPercentage = Math.min((stats.hp / stats.maxHp) * 100, 100);

    // Filter "Today's Focus" items
    const todayQuests = useMemo(() =>
        quests.filter(q => q.isToday && !q.completed),
        [quests]
    );
    const todayHabits = useMemo(() =>
        habits.filter(h => h.isToday),
        [habits]
    );

    // Get today's date for habit completion check
    const today = useMemo(() => getTodayISO(), []);

    // Check if habit is already completed today (inline helper)
    const isHabitDoneToday = (habit) => (habit.history?.[today] || 0) > 0;

    // Memoized pending queue for the hex matrix
    const matrixNodes = useMemo(() => {
        const allPendingTodayQuests = quests.filter(q => q.isToday && !q.completed);
        const allPendingTodayHabits = habits.filter(h => {
            if (!h.isToday) return false;
            return (h.history?.[today] || 0) <= 0;
        });

        const pendingQueue = [
            ...allPendingTodayQuests.map(q => ({ ...q, type: 'quest', completed: false })),
            ...allPendingTodayHabits.map(h => ({ ...h, type: 'habit', completed: false }))
        ].sort((a, b) => a.title.localeCompare(b.title));

        return pendingQueue.slice(0, 7);
    }, [quests, habits, today]);

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

    // SVG Arc Helper
    const polarToCartesian = (centerX, centerY, radius, angleInDegrees) => {
        var angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
        return {
            x: centerX + (radius * Math.cos(angleInRadians)),
            y: centerY + (radius * Math.sin(angleInRadians))
        };
    };

    const describeArc = (x, y, radius, startAngle, endAngle) => {
        var start = polarToCartesian(x, y, radius, endAngle);
        var end = polarToCartesian(x, y, radius, startAngle);
        var largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
        var d = [
            "M", start.x, start.y,
            "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y
        ].join(" ");
        return d;
    };
    const xpBarStart = 160 - ((xpPercentage / 100) * 140);

    return (
        <div className="flex flex-col h-full min-h-[600px] relative">
            <React.Suspense fallback={null}>
                <StatsView isOpen={showStats} onClose={() => setShowStats(false)} />
            </React.Suspense>

            <FocusSelectionModal isOpen={showFocusModal} onClose={() => setShowFocusModal(false)} />

            {/* Top Manage Button */}
            <div className="absolute top-0 left-0 right-0 flex justify-center z-30 pt-4">
                <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowFocusModal(true)}
                    className="text-game-accent text-sm font-bold px-4 py-2 rounded-full flex items-center gap-2 transition-colors hover:bg-slate-800/30"
                >
                    <Plus size={16} /> Manage
                </motion.button>
            </div>

            {/* Day Timer - Positioned below Manage Button */}
            <DayTimer className="absolute top-16 left-0 right-0 z-20" />

            {/* Central Hub Container */}
            <div className="flex-1 flex items-center justify-center relative">

                {/* ADJUST THIS VALUE to raise/lower the entire HUD (positive = down, negative = up) */}
                <div
                    className="relative w-[380px] h-[380px] flex items-center justify-center"
                    style={{ transform: 'translateY(100px)' }}
                >

                    {/* SVG Layer for Arcs */}
                    <svg className="absolute inset-0 w-full h-full pointer-events-none z-0 overflow-visible" viewBox="0 0 400 400">
                        {/* Define Gradients */}
                        <defs>
                            {/* Health (Left Side): Darker at Left(0%) Edge, Lighter at Center(100%) */}
                            <linearGradient id="gradHP" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor="#881337" />
                                <stop offset="100%" stopColor="#f43f5e" />
                            </linearGradient>
                            {/* XP (Right Side): Lighter at Center(0%), Darker at Right(100%) Edge */}
                            <linearGradient id="gradXP" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor="#38bdf8" />
                                <stop offset="100%" stopColor="#0c4a6e" />
                            </linearGradient>
                        </defs>

                        {/* Health Arc Background (Dark) */}
                        <path d={describeArc(200, 200, 190, 200, 340)} fill="none" stroke="#334155" strokeWidth="6" strokeLinecap="round" opacity="0.3" />

                        {/* Health Arc (Fill) */}
                        <motion.path
                            initial={{ pathLength: 0 }}
                            animate={{ pathLength: hpPercentage / 100 }}
                            d={describeArc(200, 200, 190, 200, 340)}
                            fill="none"
                            stroke="url(#gradHP)"
                            strokeWidth="6"
                            strokeLinecap="round"
                            className="drop-shadow-[0_0_8px_rgba(244,63,94,0.5)]"
                        />

                        {/* XP Arc Background (Dark) */}
                        <path d={describeArc(200, 200, 190, 20, 160)} fill="none" stroke="#334155" strokeWidth="6" strokeLinecap="round" opacity="0.3" />

                        {/* XP Arc (Fill) */}
                        <motion.path
                            initial={{ pathLength: 0 }}
                            animate={{ pathLength: xpPercentage / 100 }}
                            d={describeArc(200, 200, 190, 20, 160)}
                            fill="none"
                            stroke="url(#gradXP)"
                            strokeWidth="6"
                            strokeLinecap="round"
                            className="drop-shadow-[0_0_8px_rgba(56,189,248,0.5)]"
                        />
                    </svg>

                    {/* Fixed Stat Hexes - Positioned seamlessly in grid */}
                    <div className="z-20 scale-90 sm:scale-100 absolute inset-0 pointer-events-none flex items-center justify-center">
                        <div className="relative w-0 h-0 scale-75 sm:scale-100">
                            <div className="pointer-events-auto">
                                <HexNode
                                    node={{ id: 'stat-lvl', type: 'level', title: 'LVL ' + stats.level, completed: false }}
                                    position={{ x: 0, y: -256 }}
                                    onClick={() => setShowStats(true)}
                                />
                            </div>
                            <div className="pointer-events-auto">
                                <HexNode
                                    node={{ id: 'stat-gold', type: 'gold', title: stats.gold + '', completed: false }}
                                    position={{ x: 0, y: 256 }}
                                    onClick={() => onTabChange('budget')}
                                />
                            </div>

                            {/* System Online Text - Positioned Relative to Grid Center (Hugging Gold Hex) */}
                            {/* Gold Hex is at y: 256. Height ~160 (half 80). Bottom ~336. We put text at 360 to be safe. */}
                            <div
                                onClick={onOpenSettings}
                                className="absolute left-0 top-0 flex flex-col items-center justify-center z-10 cursor-pointer pointer-events-auto w-40"
                                style={{ transform: 'translate(-50%, 360px)' }}
                            >
                                <p className="text-game-muted font-game uppercase tracking-[0.2em] text-xs opacity-70 w-full text-center">
                                    System Online
                                </p>
                                <p className="text-[10px] text-slate-600 font-mono mt-0.5">
                                    {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase()}
                                </p>
                            </div>

                        </div>

                    </div>

                    {/* Actual Hex Grid */}
                    <div className="z-10 scale-90 sm:scale-100">
                        <HexMatrix nodes={matrixNodes} onToggleNode={handleNodeClick} onEmptyClick={() => setShowFocusModal(true)} />
                    </div>



                </div>
            </div>

        </div>
    );
};

export default Dashboard;
