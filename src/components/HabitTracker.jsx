import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, Flame, Plus, Trash2, Clock, Settings, Calendar } from 'lucide-react';

const HabitItem = ({ habit, onCheck, onDelete }) => {
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="bg-game-panel p-4 rounded-lg border border-slate-700 mb-3 group hover:border-slate-500 transition-colors"
        >
            <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                        <h3 className="font-game font-bold text-lg text-slate-100 truncate">{habit.title}</h3>
                        <div className="flex items-center gap-1 text-[10px] text-orange-400 font-bold">
                            <Flame size={12} /> {habit.streak}
                        </div>
                    </div>
                    <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mt-1">
                        {habit.frequency === 'interval' ? `Every ${habit.frequencyParam} Days` : habit.frequency}
                    </div>
                </div>

                <div className="flex items-center gap-1 md:gap-2 shrink-0">
                    <button
                        onClick={() => onCheck(habit.id, 'positive')}
                        className="w-9 h-9 rounded-lg bg-slate-800 hover:bg-green-500/20 text-green-500 flex items-center justify-center border border-slate-700 hover:border-green-500 transition-all active:scale-95 shadow-lg"
                    >
                        <Check size={18} />
                    </button>
                    <button
                        onClick={() => onCheck(habit.id, 'negative')}
                        className="w-9 h-9 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-rose-500 flex items-center justify-center border border-slate-700 hover:border-rose-500 transition-all active:scale-95 shadow-lg"
                    >
                        <X size={18} />
                    </button>
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
                        className="mt-4 pt-4 border-t border-slate-700 overflow-hidden"
                    >
                        <div className="grid grid-cols-2 gap-4">
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

    return (
        <div className="pb-24 md:pb-0">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-3xl font-game font-bold text-white tracking-widest uppercase text-glow">
                        Protocol Database
                    </h2>
                    <p className="text-sm text-gray-500">Manage recurring operational requirements.</p>
                </div>
            </div>

            <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700 mb-8 overflow-hidden">
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <div className="flex flex-col md:flex-row gap-4 items-end">
                        <div className="flex-1 w-full">
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Protocol Name</label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="e.g. Morning Workout"
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-game-gold transition-all"
                            />
                        </div>

                        <button
                            type="button"
                            onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
                            className={clsx(
                                "p-2 rounded-lg border transition-all",
                                isAdvancedOpen ? "bg-game-gold/20 border-game-gold text-game-gold" : "bg-slate-800 border-slate-700 text-gray-400 hover:text-white"
                            )}
                            title="Advanced Settings"
                        >
                            <Settings size={20} />
                        </button>

                        <button
                            type="submit"
                            className="w-full md:w-auto bg-game-gold hover:bg-yellow-300 text-slate-900 px-6 py-2 rounded-lg transition-colors flex items-center justify-center font-bold gap-2 shadow-neon-gold"
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
            <div className="space-y-4">
                <AnimatePresence mode='popLayout'>
                    {habits.length === 0 && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-center text-gray-500 py-10 italic border-2 border-dashed border-slate-800 rounded-xl"
                        >
                            No protocols established. Initialize new routines above.
                        </motion.div>
                    )}
                    {habits.map(habit => (
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
