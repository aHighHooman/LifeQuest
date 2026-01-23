import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { Check, X, Flame, Plus, Trash2, Clock, Settings, Calendar } from 'lucide-react';
import clsx from 'clsx';

const HabitItem = ({ habit, onCheck, onDelete }) => {
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    // Swipe Logic
    const x = useMotionValue(0);
    const backgroundOpacity = useTransform(x, [-100, 0, 100], [1, 0, 1]);
    const checkOpacity = useTransform(x, [50, 100], [0, 1]);
    const crossOpacity = useTransform(x, [-100, -50], [1, 0]);
    const bgRight = useTransform(x, [0, 100], ["rgba(0,0,0,0)", "rgba(34, 197, 94, 0.2)"]);
    const bgLeft = useTransform(x, [-100, 0], ["rgba(244, 63, 94, 0.2)", "rgba(0,0,0,0)"]);

    const iconScaleRight = useTransform(x, [50, 150], [1, 1.5]);
    const iconScaleLeft = useTransform(x, [-150, -50], [1.5, 1]);

    const handleDragEnd = (event, info) => {
        if (info.offset.x > 80) {
            if (navigator.vibrate) navigator.vibrate(50); // Haptic feedback
            onCheck(habit.id, 'positive');
        } else if (info.offset.x < -80) {
            if (navigator.vibrate) navigator.vibrate(50); // Haptic feedback
            onCheck(habit.id, 'negative');
        }
    };

    const getFlameTier = (streak) => {
        if (streak >= 100) return { color: "text-purple-400", glow: "shadow-[0_0_20px_rgba(168,85,247,0.8)] filter drop-shadow(0 0 8px rgba(168,85,247,0.6))", size: 24, label: "Ethereal", bg: "bg-purple-500/10", border: "border-purple-500/50" };
        if (streak >= 50) return { color: "text-fuchsia-400", glow: "shadow-[0_0_15px_rgba(232,121,249,0.5)]", size: 20, label: "Mystic", bg: "bg-fuchsia-500/10", border: "border-fuchsia-500/30" };
        if (streak >= 25) return { color: "text-violet-400", glow: "shadow-[0_0_12px_rgba(139,92,246,0.4)]", size: 18, label: "Arcane", bg: "bg-violet-500/10", border: "border-violet-500/30" };
        if (streak >= 5) return { color: "text-indigo-400", glow: "shadow-[0_0_10px_rgba(129,140,248,0.3)]", size: 16, label: "Active", bg: "bg-indigo-500/10", border: "border-indigo-500/30" };
        return { color: "text-slate-600", glow: "shadow-none", size: 14, label: "Dormant", bg: "bg-slate-800/30", border: "border-slate-700" };
    };

    const tier = getFlameTier(habit.streak);

    return (
        <motion.div
            layout
            // Ensure proper layout animation even with dragging
            style={{ x, touchAction: "none" }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.5}
            // ISOLATION
            dragPropagation={false}
            data-no-swipe="true"
            onDragEnd={handleDragEnd}

            initial={{ opacity: 0, y: 10 }} // Changed to y for standard list fade-in
            animate={{ opacity: 1, y: 0, x: 0 }} // Reset x on animate to snap back
            exit={{ opacity: 0, scale: 0.95 }}
            whileHover={{ scale: 1.01 }}
            className={clsx(
                "relative rounded-xl border backdrop-blur-md mb-3 group transition-all duration-300 shadow-xl overflow-hidden cursor-grab active:cursor-grabbing",
                tier.bg,
                tier.border,
                "hover:shadow-[0_0_30px_rgba(0,0,0,0.3)]"
            )}
            whileDrag={{ scale: 1.02 }} // Tactile response on hold
        >
            {/* Swipe Feedback Backgrounds */}
            <motion.div style={{ backgroundColor: bgRight, opacity: backgroundOpacity }} className="absolute inset-0 z-0 flex items-center justify-start pl-6 pointer-events-none">
                <motion.div style={{ opacity: checkOpacity, scale: iconScaleRight }}>
                    <Check size={32} className="text-green-500 drop-shadow-[0_0_10px_rgba(34,197,94,0.8)]" />
                </motion.div>
            </motion.div>
            <motion.div style={{ backgroundColor: bgLeft, opacity: backgroundOpacity }} className="absolute inset-0 z-0 flex items-center justify-end pr-6 pointer-events-none">
                <motion.div style={{ opacity: crossOpacity, scale: iconScaleLeft }}>
                    <X size={32} className="text-rose-500 drop-shadow-[0_0_10px_rgba(244,63,94,0.8)]" />
                </motion.div>
            </motion.div>

            <div className="absolute top-0 left-0 w-1 h-full bg-current opacity-30 group-hover:opacity-100 transition-opacity z-10" />

            <div className="flex items-center justify-between gap-4 relative z-10 p-4 bg-slate-900/40">
                {/* Added bg-slate-900/40 to content to ensure readability over swipe backgrounds */}

                <div className="flex-1 min-w-0 pointer-events-none"> {/* Disable pointer events on text to ensure easy dragging */}
                    <div className="flex items-center gap-3">
                        <h3 className="font-game font-bold text-lg text-slate-100 truncate">{habit.title}</h3>
                        <div className={clsx("flex items-center gap-1 font-black transition-all duration-500 pointer-events-auto", tier.color)}>
                            <motion.div
                                animate={habit.streak > 0 ? {
                                    scale: [1, 1.2, 1],
                                    rotate: [0, 5, -5, 0]
                                } : {}}
                                transition={{ repeat: Infinity, duration: 2 }}
                            >
                                <Flame size={tier.size} className={clsx("drop-shadow-lg", tier.glow)} />
                            </motion.div>
                            <span className="text-xs">{habit.streak}</span>
                        </div>
                    </div>
                    <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mt-1">
                        {habit.frequency === 'interval' ? `Every ${habit.frequencyParam} Days` : habit.frequency}
                    </div>
                </div>

                <div className="flex items-center gap-1 md:gap-2 shrink-0 pointer-events-auto"
                    onPointerDown={(e) => e.stopPropagation()} // Stop drag when clicking buttons
                >

                    <button
                        onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                        className="p-2 rounded-full hover:bg-slate-700 text-gray-500 transition-colors"
                    >
                        <Settings size={16} />
                    </button>
                    <button
                        onClick={() => onDelete(habit.id)}
                        className="p-2 text-gray-600 hover:text-rose-500 md:opacity-0 group-hover:opacity-100 transition-all"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            </div>

            <AnimatePresence>
                {isSettingsOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="px-4 pb-4 pt-0 border-t border-slate-700 overflow-hidden bg-slate-900/40 relative z-20"
                    >
                        <div className="grid grid-cols-2 gap-4 mt-4">
                            <div>
                                <p className="text-[10px] text-gray-500 uppercase font-bold">Parameters</p>
                                <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
                                    <Clock size={12} /> Frequency: {habit.frequency}
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] text-gray-500 uppercase font-bold">Created</p>
                                <p className="text-[10px] text-gray-400">{new Date(habit.createdAt).toLocaleDateString()}</p>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

const HabitTracker = () => {
    const { habits, addHabit, checkHabit, deleteHabit } = useGame();
    const [title, setTitle] = useState('');
    const [frequency, setFrequency] = useState('daily');
    const [intervalParam, setIntervalParam] = useState(2);
    const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!title.trim()) return;

        let param = 1;
        if (frequency === 'interval') param = intervalParam;

        addHabit(title, frequency, param);
        setTitle('');
        setFrequency('daily');
    };

    const safeHabits = Array.isArray(habits) ? habits : [];

    return (
        <div className="pb-24 md:pb-0">
            <div className="flex justify-between items-center mb-6">
                <div className="relative">
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: '100%' }}
                        className="absolute -bottom-2 left-0 h-1 bg-gradient-to-r from-purple-500 to-transparent"
                    />
                    <h2 className="text-4xl font-game font-black text-white tracking-[0.2em] uppercase bg-clip-text text-transparent bg-gradient-to-br from-purple-200 via-purple-400 to-purple-600">
                        Protocol Database
                    </h2>
                    <p className="text-[10px] text-purple-400/80 font-black uppercase tracking-[0.3em] mt-2 flex items-center gap-2">
                        <span className="w-8 h-px bg-purple-500/50" /> Active System Protocols
                    </p>
                </div>
            </div>

            <div className="bg-purple-900/10 p-4 rounded-xl border border-purple-500/20 mb-6 overflow-hidden">
                <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                    <div className="flex flex-col md:flex-row gap-3 items-end">
                        <div className="flex-1 w-full relative">
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Protocol Name</label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="e.g. Morning Workout"
                                    className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-game-gold transition-all"
                                />
                                <button
                                    type="button"
                                    onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
                                    className={clsx(
                                        "p-2 rounded-lg border transition-all shrink-0",
                                        isAdvancedOpen ? "bg-game-gold/20 border-game-gold text-game-gold" : "bg-slate-800 border-slate-700 text-gray-400 hover:text-white"
                                    )}
                                    title="Advanced Settings"
                                >
                                    <Settings size={20} />
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            className="w-full md:w-auto bg-purple-500 hover:bg-purple-400 text-white px-6 py-2 rounded-lg transition-colors flex items-center justify-center font-bold gap-2 shadow-neon-purple h-[42px]"
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
                                className="pt-2 border-t border-slate-800 mt-2 overflow-hidden"
                            >
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Frequency</label>
                                        <select
                                            value={frequency}
                                            onChange={(e) => setFrequency(e.target.value)}
                                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-game-gold"
                                        >
                                            <option value="daily">Daily</option>
                                            <option value="weekly">Weekly</option>
                                            <option value="monthly">Monthly</option>
                                            <option value="interval">Custom Interval</option>
                                        </select>
                                    </div>

                                    {frequency === 'interval' && (
                                        <div className="w-full">
                                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Days</label>
                                            <input
                                                type="number"
                                                min="2"
                                                max="365"
                                                value={intervalParam}
                                                onChange={(e) => setIntervalParam(parseInt(e.target.value))}
                                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-game-gold"
                                            />
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </form>
            </div>

            {/* List */}
            <div className="space-y-3">
                <AnimatePresence mode='popLayout'>
                    {safeHabits.length === 0 && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-center text-gray-500 py-10 italic border-2 border-dashed border-slate-800 rounded-xl"
                        >
                            No protocols established. Initialize new routines above.
                        </motion.div>
                    )}
                    {safeHabits.map(habit => (
                        <HabitItem
                            key={habit.id}
                            habit={habit}
                            onCheck={checkHabit}
                            onDelete={deleteHabit}
                        />
                    ))}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default HabitTracker;
