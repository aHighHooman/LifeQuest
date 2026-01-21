import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import { motion } from 'framer-motion';
import { Shield, Zap, Coins, Heart, Calendar, CheckSquare } from 'lucide-react';
import StatsView from './StatsView';

const Dashboard = ({ onTabChange }) => {
    const { stats, quests, habits } = useGame();
    const [showStats, setShowStats] = useState(false);

    const xpPercentage = Math.min((stats.xp / stats.maxXp) * 100, 100);
    const hpPercentage = Math.min((stats.hp / stats.maxHp) * 100, 100);

    // Filter for "Today's Agenda"
    const activeQuests = quests.filter(q => !q.completed).slice(0, 3); // Top 3

    // Logic for habits due today (Simplified for now - show all active protocols)
    const activeHabits = habits.slice(0, 3);

    return (
        <div className="space-y-5 pb-32">
            <StatsView isOpen={showStats} onClose={() => setShowStats(false)} />

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

            {/* Today's Overview Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Quick Quests */}
                <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-800">
                    <h3 className="text-base font-game font-bold text-white mb-2 flex items-center gap-2">
                        <CheckSquare className="text-game-accent" size={16} />
                        Objectives
                    </h3>
                    <div className="space-y-1.5">
                        {activeQuests.length === 0 ? (
                            <p className="text-gray-500 italic text-[10px] py-2">No active objectives.</p>
                        ) : (
                            activeQuests.map(q => (
                                <div key={q.id} className="bg-slate-800/60 p-2 rounded border border-slate-700/50 flex justify-between items-center">
                                    <span className="font-bold text-xs text-gray-200 truncate pr-2">{q.title}</span>
                                    <span className="text-[9px] bg-slate-700 px-1.5 py-0.5 rounded text-game-accent capitalize">{q.difficulty}</span>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Due Protocols */}
                <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-800">
                    <h3 className="text-base font-game font-bold text-white mb-2 flex items-center gap-2">
                        <Calendar className="text-game-gold" size={16} />
                        Protocols
                    </h3>
                    <div className="space-y-1.5">
                        {activeHabits.length === 0 ? (
                            <p className="text-gray-500 italic text-[10px] py-2">All protocols secure.</p>
                        ) : (
                            activeHabits.map(h => (
                                <div key={h.id} className="bg-slate-800/60 p-2 rounded border border-slate-700/50 flex justify-between items-center">
                                    <span className="font-bold text-xs text-gray-200 truncate pr-2">{h.title}</span>
                                    <span className="text-[9px] text-gray-500 capitalize">{h.frequency}</span>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};


export default Dashboard;
