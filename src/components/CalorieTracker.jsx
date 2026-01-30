import React, { useState, useRef, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, Zap, Plus, X, Activity, Droplets, AlertTriangle, ChevronUp, History } from 'lucide-react';
import clsx from 'clsx';
import { SPRING_CONFIG } from '../constants/animations';

const ReactorCore = ({ current, target }) => {
    const percentage = Math.min((current / target) * 100, 100);
    const isOverload = current > target;
    const remaining = target - current;

    // Bubbles for the liquid effect
    const bubbles = Array.from({ length: 8 }).map((_, i) => ({
        id: i,
        size: Math.random() * 10 + 5,
        x: Math.random() * 80 + 10,
        duration: Math.random() * 2 + 3,
        delay: Math.random() * 2
    }));

    return (
        <div className="relative w-full h-full flex items-center justify-center p-8">
            {/* Main Reactor Chamber */}
            <div className="relative w-[280px] h-[280px] sm:w-[320px] sm:h-[320px]">

                {/* Outer Ring / Containment Field */}
                <div className="absolute inset-0 rounded-full border-[8px] border-slate-800 shadow-[0_0_50px_rgba(0,0,0,0.5)] bg-black/60 backdrop-blur-sm z-10 flex items-center justify-center">
                    {/* Tech Markings */}
                    <svg className="absolute inset-0 w-full h-full animate-spin-slow opacity-30 pointer-events-none" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="48" fill="none" stroke="#be123c" strokeWidth="0.5" strokeDasharray="4 2" />
                        <circle cx="50" cy="50" r="40" fill="none" stroke="#be123c" strokeWidth="0.2" strokeDasharray="10 10" />
                    </svg>
                </div>

                {/* Liquid Container (Masked) */}
                <div className="absolute inset-4 rounded-full overflow-hidden z-0 bg-slate-900 border border-rose-900/30">

                    {/* Background Grid */}
                    <div className="absolute inset-0 opacity-20 bg-[linear-gradient(rgba(244,63,94,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(244,63,94,0.1)_1px,transparent_1px)] bg-[size:20px_20px]" />

                    {/* The Liquid */}
                    <motion.div
                        className={clsx(
                            "absolute bottom-0 left-0 right-0 w-full transition-colors duration-700",
                            isOverload ? "bg-gradient-to-t from-red-900 via-red-600 to-orange-500" : "bg-gradient-to-t from-rose-900 via-rose-600 to-rose-400"
                        )}
                        initial={{ height: '0%' }}
                        animate={{ height: `${percentage}%` }}
                        transition={{ type: "spring", stiffness: 50, damping: 20 }}
                        style={{ filter: 'url(#goo)' }} // Optional goo effect if we had the filter defs, straightforward for now
                    >
                        {/* Interactive Surface Wave */}
                        <div className="absolute top-0 left-0 right-0 h-4 bg-white/20 blur-sm transform -translate-y-1/2" />

                        {/* Rising Bubbles */}
                        {bubbles.map(b => (
                            <motion.div
                                key={b.id}
                                className="absolute bg-rose-200/20 rounded-full blur-[1px]"
                                style={{ width: b.size, height: b.size, left: `${b.x}%` }}
                                animate={{ y: [-20, -300], opacity: [0, 1, 0] }}
                                transition={{
                                    repeat: Infinity,
                                    duration: b.duration,
                                    delay: b.delay,
                                    ease: "linear"
                                }}
                            />
                        ))}
                    </motion.div>
                </div>

                {/* Central HUD Overlay */}
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center pointer-events-none">
                    <div className="text-center drop-shadow-md">
                        <motion.div
                            key={current}
                            initial={{ scale: 1.2, opacity: 0.5 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="text-5xl font-black font-mono text-white tracking-tighter"
                        >
                            {current}
                        </motion.div>
                        <div className="text-[10px] font-bold text-rose-200 uppercase tracking-[0.3em] opacity-80 mt-1">
                            kCal Input
                        </div>
                    </div>

                    {/* Status Indicator */}
                    <div className={clsx(
                        "mt-4 px-3 py-1 rounded-full border backdrop-blur-md flex items-center gap-2 transition-colors",
                        isOverload ? "bg-red-950/80 border-red-500/50 text-red-500" : "bg-black/40 border-rose-500/30 text-rose-400"
                    )}>
                        {isOverload ? <AlertTriangle size={12} /> : <Activity size={12} />}
                        <span className="text-[10px] font-mono font-bold uppercase">
                            {isOverload ? "CRITICAL LOAD" : "SYSTEM STABLE"}
                        </span>
                    </div>
                </div>

                {/* Glass Glare */}
                <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-white/10 to-transparent pointer-events-none z-30" />
            </div>
        </div>
    );
};

const SystemLog = ({ history }) => {
    const scrollRef = useRef(null);

    // Auto-scroll to bottom on new entry
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [history]);

    return (
        <div className="flex-1 min-h-0 bg-black/40 border-t border-b border-rose-900/30 backdrop-blur-sm relative flex flex-col">
            <div className="px-4 py-2 bg-rose-950/20 text-[9px] font-game text-rose-500/60 uppercase tracking-widest flex items-center justify-between shrink-0">
                <span className="flex items-center gap-2"><History size={10} /> Reaction Logs</span>
                <span>{new Date().toISOString().split('T')[0]}</span>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar p-0 scroll-smooth overscroll-none" data-no-swipe="true">
                {history.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-rose-900/40 opacity-50 space-y-2">
                        <Activity size={24} />
                        <span className="text-[10px] font-mono uppercase">Core Idle</span>
                    </div>
                ) : (
                    <div className="flex flex-col-reverse p-4 gap-2"> {/* Reverse layout for log feel (newest bottom if we scroll? actually console logs usually append) */}
                        {[...history].reverse().map((entry, idx) => (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="flex items-center justify-between text-xs font-mono border-l-2 border-slate-800 pl-3 py-1 hover:border-rose-500 transition-colors group"
                            >
                                <span className="text-slate-500 group-hover:text-slate-400 transition-colors">
                                    {new Date(entry.date).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit' })}
                                </span>
                                <div className="flex items-center gap-2">
                                    <span className="text-rose-500 group-hover:text-rose-400 font-bold transition-colors">
                                        Fuel Inject
                                    </span>
                                    <span className="bg-rose-900/30 text-rose-300 px-1.5 rounded">
                                        +{entry.amount}
                                    </span>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>

            {/* Overlay Gradient for fade out */}
            <div className="absolute top-0 inset-x-0 h-4 bg-gradient-to-b from-black/20 to-transparent pointer-events-none" />
        </div>
    );
};

const ControlDeck = ({ onAdd, onSetGoal, currentGoal, isOverload }) => {
    const [inputValue, setInputValue] = useState('');
    const [isManual, setIsManual] = useState(false);

    const handleSubmit = (e) => {
        e.preventDefault();
        const val = parseInt(inputValue);
        if (val > 0) {
            onAdd(val);
            setInputValue('');
            setIsManual(false);
        }
    };

    return (
        <div className="shrink-0 bg-black/80 backdrop-blur-xl border-t border-rose-900/50 pb-64 p-4 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] z-[100] relative">

            {/* Manual Input Drawer */}
            <AnimatePresence>
                {isManual && (
                    <motion.div
                        initial={{ height: 0, opacity: 0, marginBottom: 0 }}
                        animate={{ height: 'auto', opacity: 1, marginBottom: 16 }}
                        exit={{ height: 0, opacity: 0, marginBottom: 0 }}
                        className="overflow-hidden"
                    >
                        <form onSubmit={handleSubmit} className="flex gap-2">
                            <input
                                autoFocus
                                type="number"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                placeholder="ENTER QUANTITY"
                                className="flex-1 min-w-0 bg-black border border-rose-900/50 rounded-lg px-4 py-3 text-rose-100 font-mono text-lg placeholder-rose-900/30 outline-none focus:border-rose-500 transition-colors"
                            />
                            <button
                                type="submit"
                                className="bg-rose-600 hover:bg-rose-500 text-black px-6 rounded-lg font-bold font-game uppercase tracking-wide transition-colors"
                            >
                                Inject
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsManual(false)}
                                className="bg-slate-900 border border-slate-700 text-slate-400 px-4 rounded-lg hover:text-white transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </form>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Main Controls */}
            {!isManual && (
                <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between text-[10px] text-rose-500/60 font-mono uppercase px-1">
                        <span>Injector Status: READY</span>
                        <div className="flex items-center gap-2">
                            <span>Target: {currentGoal}</span>
                            <button onClick={onSetGoal} className="hover:text-rose-400 underline decoration-dashed underline-offset-2">
                                EDIT
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-4 gap-3 h-16">
                        {[100, 250, 500].map(amt => (
                            <motion.button
                                key={amt}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => onAdd(amt)}
                                className="relative overflow-hidden bg-rose-950/40 border border-rose-500/30 rounded-lg flex flex-col items-center justify-center hover:bg-rose-900/60 hover:border-rose-500 transition-all group active:shadow-[0_0_20px_rgba(244,63,94,0.4)]"
                            >
                                <div className="absolute inset-0 bg-gradient-to-t from-rose-900/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                <span className="font-black font-mono text-lg text-rose-100 group-hover:text-white relative z-10 flex items-center">
                                    <Plus size={12} className="mr-0.5" />{amt}
                                </span>
                                <span className="text-[8px] font-bold text-rose-500 uppercase tracking-widest relative z-10">
                                    Cell
                                </span>
                            </motion.button>
                        ))}

                        <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setIsManual(true)}
                            className="bg-slate-900 border border-slate-700/50 rounded-lg flex flex-col items-center justify-center text-slate-400 hover:text-rose-400 hover:border-rose-500/30 transition-colors"
                        >
                            <Zap size={20} />
                            <span className="text-[8px] font-bold mt-1 uppercase">Manual</span>
                        </motion.button>
                    </div>
                </div>
            )}
        </div>
    );
};

const CalorieTracker = () => {
    const { calories, addCalories, setCalorieGoal } = useGame();

    // Safety check for history existence (context update handle)
    const history = calories.history || [];

    const [showGoalModal, setShowGoalModal] = useState(false);

    const handleSetGoal = () => {
        setShowGoalModal(true);
    };

    const confirmGoal = (val) => {
        setCalorieGoal(val);
        setShowGoalModal(false);
    };

    return (
        <div className="fixed inset-0 w-full h-full overflow-hidden bg-black text-rose-50 flex flex-col">
            {/* Ambient Background & Grid */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-rose-900/20 via-slate-950/80 to-black z-0" />
                <div className="absolute inset-0 opacity-10 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:50px_50px] z-0" />
            </div>

            {/* 1. TOP: Reactor Core Visualizer */}
            <div className="flex-1 min-h-[40%] flex items-center justify-center z-10 relative" style={{ touchAction: 'none' }}>
                <ReactorCore current={calories.current} target={calories.target} />
            </div>

            {/* 2. MIDDLE: System Log (Flexible Height) */}
            <SystemLog history={history} />

            {/* 3. BOTTOM: Control Dock (Fixed) */}
            <ControlDeck
                onAdd={addCalories}
                onSetGoal={handleSetGoal}
                currentGoal={calories.target}
                isOverload={calories.current > calories.target}
            />

            {showGoalModal && (
                <GoalSettingModal
                    current={calories.target}
                    onConfirm={confirmGoal}
                    onClose={() => setShowGoalModal(false)}
                />
            )}
        </div>
    );
};

const GoalSettingModal = ({ current, onConfirm, onClose }) => {
    const [val, setVal] = useState(current);
    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={onClose}>
            <div className="bg-slate-900 border border-rose-500/30 rounded-2xl w-full max-w-sm p-6 shadow-[0_0_50px_rgba(244,63,94,0.2)]" onClick={e => e.stopPropagation()}>
                <h3 className="font-game font-bold text-lg text-rose-500 mb-4 uppercase tracking-wider">Target Configuration</h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-[10px] font-mono text-rose-300/70 uppercase mb-2">Daily Calorie Limit</label>
                        <input
                            autoFocus
                            type="number"
                            value={val}
                            onChange={e => setVal(parseInt(e.target.value) || '')}
                            className="w-full bg-black border border-rose-900/50 rounded-lg px-4 py-3 text-rose-100 font-mono text-xl outline-none focus:border-rose-500 transition-colors"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <button onClick={onClose} className="py-3 rounded-lg border border-rose-900/30 text-rose-400 hover:bg-rose-900/20 font-bold uppercase text-xs">
                            Cancel
                        </button>
                        <button onClick={() => onConfirm(val)} className="py-3 rounded-lg bg-rose-600 hover:bg-rose-500 text-black font-bold uppercase text-xs shadow-lg shadow-rose-900/20">
                            Confirm
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CalorieTracker;
