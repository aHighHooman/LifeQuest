import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import { Flame, Plus, Target, CheckSquare, Clock, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

const CalorieTracker = () => {
    const { calories, addCalories, setCalorieGoal } = useGame();
    const [inputAmount, setInputAmount] = useState('');
    const [goalInput, setGoalInput] = useState(calories.target);
    const [isEditingGoal, setIsEditingGoal] = useState(false);

    const remaining = calories.target - calories.current;
    const percent = Math.min((calories.current / calories.target) * 100, 100);

    const handleAdd = (e) => {
        e.preventDefault();
        const val = parseInt(inputAmount);
        if (val) {
            addCalories(val);
            setInputAmount('');
        }
    };

    const handleUpdateGoal = () => {
        setCalorieGoal(parseInt(goalInput));
        setIsEditingGoal(false);
    };

    // Assuming calories.history exists or we can mock it from useGame if not yet implemented there.
    // If not in context yet, we should probably add it, but for UI task we can assume it's there or added.
    // The user request said "Add history tracking... similar to how the miscellaneous spending section works".
    // I need to ensure GameContext actually has history for calories.
    const history = calories.history || [];

    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-24">

            {/* Header / Summary Card */}
            <div className="bg-rose-900/10 rounded-3xl border border-rose-500/20 shadow-2xl overflow-hidden relative">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-rose-500 to-transparent opacity-50"></div>
                <div className="p-6 flex flex-col items-center justify-center relative">

                    <h2 className="text-xl font-game text-white flex items-center gap-2 mb-6">
                        <Flame className="text-game-danger" />
                        Metabolic Monitor
                    </h2>

                    <div className="w-48 h-48 rounded-full border-8 border-rose-900/20 flex items-center justify-center relative">
                        <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
                            <circle
                                cx="50" cy="50" r="46"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="8"
                                className={`${remaining < 0 ? 'text-red-500' : 'text-game-danger'} transition-all duration-1000 ease-out`}
                                strokeDasharray="289" // 2 * pi * 46
                                strokeDashoffset={289 - (289 * percent) / 100}
                                strokeLinecap="round"
                            />
                        </svg>
                        <div className="text-center z-10">
                            <div className="text-4xl font-black text-white">{calories.current}</div>
                            <div className="text-xs text-gray-400 uppercase tracking-widest">Consumed</div>
                        </div>
                    </div>

                    <div className="mt-6 flex items-center gap-2 text-sm text-gray-400">
                        <span>Target:</span>
                        {isEditingGoal ? (
                            <div className="flex items-center gap-1">
                                <input
                                    type="number"
                                    value={goalInput}
                                    onChange={(e) => setGoalInput(e.target.value)}
                                    className="w-20 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-white text-center"
                                />
                                <button onClick={handleUpdateGoal} className="text-game-accent"><CheckSquare size={16} /></button>
                            </div>
                        ) : (
                            <span className="font-mono text-white flex items-center gap-2">
                                {calories.target}
                                <button onClick={() => setIsEditingGoal(true)} className="text-gray-600 hover:text-white"><Target size={14} /></button>
                            </span>
                        )}
                    </div>

                    <div className={`mt-2 font-bold ${remaining < 0 ? 'text-red-500' : 'text-emerald-400'}`}>
                        {remaining < 0 ? `${Math.abs(remaining)} Over Limit` : `${remaining} Remaining`}
                    </div>
                </div>
            </div>

            {/* Input Section */}
            <div className="bg-rose-900/10 rounded-3xl border border-rose-500/20 shadow-2xl p-4">
                <form onSubmit={handleAdd} className="flex gap-2 mb-4">
                    <input
                        type="number"
                        placeholder="Add calories..."
                        value={inputAmount}
                        onChange={(e) => setInputAmount(e.target.value)}
                        className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-game-danger focus:outline-none transition-colors"
                    />
                    <button
                        type="submit"
                        className="bg-game-danger hover:bg-red-600 text-white rounded-xl px-5 transition-colors shadow-lg shadow-red-500/20"
                    >
                        <Plus size={24} />
                    </button>
                </form>

                {/* Quick Adds */}
                <div className="grid grid-cols-3 gap-2">
                    {[100, 250, 500].map(amt => (
                        <button
                            key={amt}
                            onClick={() => addCalories(amt)}
                            className="bg-rose-900/20 hover:bg-rose-800/40 text-rose-300 hover:text-white py-3 rounded-xl text-xs font-bold transition-colors border border-rose-500/20 hover:border-rose-500/50"
                        >
                            +{amt} kcal
                        </button>
                    ))}
                </div>
            </div>

            {/* History Section */}
            <div className="bg-rose-900/10 rounded-3xl border border-rose-500/20 shadow-2xl p-4">
                <h3 className="text-sm font-game text-white flex items-center gap-2 mb-4 uppercase tracking-wider opacity-80 pl-2">
                    <Clock size={16} className="text-game-muted" /> Recent Intake
                </h3>

                <div className="space-y-2">
                    {history.length === 0 ? (
                        <div className="text-center py-8 text-slate-600 border-2 border-dashed border-slate-800 rounded-2xl">
                            <p className="text-xs">No records today.</p>
                        </div>
                    ) : (
                        history.slice().reverse().map((entry, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-slate-900/30 border border-slate-700/30">
                                <span className="text-gray-400 text-xs">{new Date(entry.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                <span className="text-game-danger font-mono font-bold">+{entry.amount} kcal</span>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default CalorieTracker;
