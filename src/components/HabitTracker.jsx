import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, Flame, Plus, Trash2, Clock } from 'lucide-react';

const HabitItem = ({ habit, onCheck, onDelete }) => {
    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="bg-game-panel p-4 rounded-lg border border-slate-700 mb-3 flex flex-col md:flex-row items-start md:items-center justify-between group hover:border-slate-500 transition-colors gap-4"
        >
            <div className="flex-1">
                <div className="flex items-center gap-3">
                    <h3 className="font-game font-bold text-lg text-slate-100">{habit.title}</h3>
                    <span className="text-[10px] uppercase bg-slate-800 text-gray-400 px-2 py-0.5 rounded border border-slate-700 font-bold">
                        {habit.frequency === 'interval' ? `Every ${habit.frequencyParam} Days` : habit.frequency}
                    </span>
                </div>

                <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
                    <Flame size={14} className={habit.streak > 0 ? "text-orange-500" : "text-gray-600"} />
                    <span className={habit.streak > 0 ? "text-orange-400 font-bold" : ""}>
                        {habit.streak} Streak
                    </span>
                </div>
            </div>

            <div className="flex items-center gap-2 self-end md:self-auto">
                <button
                    onClick={() => onCheck(habit.id, 'positive')}
                    className="w-10 h-10 rounded-lg bg-slate-800 hover:bg-green-500/20 text-green-500 flex items-center justify-center border border-slate-700 hover:border-green-500 transition-all active:scale-95 shadow-lg"
                    title="Complete Protocol"
                >
                    <Check size={20} />
                </button>
                <button
                    onClick={() => onCheck(habit.id, 'negative')}
                    className="w-10 h-10 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-rose-500 flex items-center justify-center border border-slate-700 hover:border-rose-500 transition-all active:scale-95 shadow-lg"
                    title="Failed Protocol"
                >
                    <X size={20} />
                </button>
                <button
                    onClick={() => onDelete(habit.id)}
                    className="p-2 text-gray-600 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all ml-2"
                >
                    <Trash2 size={16} />
                </button>
            </div>
        </motion.div>
    );
};

const HabitTracker = () => {
    const { habits, addHabit, checkHabit, deleteHabit } = useGame();
    const [title, setTitle] = useState('');
    const [frequency, setFrequency] = useState('daily');
    const [intervalParam, setIntervalParam] = useState(2);

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

            {/* Creation Form */}
            <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700 mb-8">
                <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-4 items-end">
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

                    <div className="w-full md:w-48">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Frequency</label>
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
                        <div className="w-24">
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Days</label>
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

                    <button
                        type="submit"
                        className="w-full md:w-auto bg-game-gold hover:bg-yellow-300 text-slate-900 px-6 py-2 rounded-lg transition-colors flex items-center justify-center font-bold gap-2"
                    >
                        <Plus size={20} /> <span className="md:hidden">Add Protocol</span>
                    </button>
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
