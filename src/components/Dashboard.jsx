import React from 'react';
import { useGame } from '../context/GameContext';
import { motion } from 'framer-motion';
import { Shield, Zap, Coins, Heart, Calendar, CheckSquare } from 'lucide-react';

const Dashboard = () => {
    const { stats, quests, habits } = useGame();

    const xpPercentage = Math.min((stats.xp / stats.maxXp) * 100, 100);
    const hpPercentage = Math.min((stats.hp / stats.maxHp) * 100, 100);

    // Filter for "Today's Agenda"
    const activeQuests = quests.filter(q => !q.completed).slice(0, 3); // Top 3

    // Logic for habits due today (Simplified for now - show all active protocols)
    const activeHabits = habits.slice(0, 3);

    return (
        <div className="space-y-5 pb-20 md:pb-0">
            {/* HUD Stats Area */}
            <div className="bg-game-panel p-4 rounded-2xl border border-slate-700 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-game-accent to-transparent opacity-50"></div>

                <div className="flex flex-col md:flex-row gap-6 items-center">
                    {/* Avatar / Level */}
                    <div className="flex flex-col items-center">
                        <div className="w-20 h-20 rounded-full bg-slate-900 border-4 border-game-accent flex items-center justify-center text-3xl font-bold font-game text-game-accent shadow-neon box-content">
                            {stats.level}
                        </div>
                        <div className="mt-2 text-game-muted text-xs font-bold tracking-[0.2em]">LEVEL</div>
                    </div>

                    {/* Stats Bars */}
                    <div className="flex-1 w-full space-y-5">
                        {/* HP */}
                        <div>
                            <div className="flex justify-between text-xs font-bold text-gray-400 mb-1">
                                <span className="flex items-center gap-1"><Heart size={12} className="text-game-danger" /> HEALTH</span>
                                <span>{stats.hp} / {stats.maxHp}</span>
                            </div>
                            <div className="h-5 bg-slate-900 rounded-sm overflow-hidden border border-slate-700 relative skewed-box">
                                <motion.div
                                    className="h-full bg-game-danger shadow-[0_0_15px_rgba(244,63,94,0.6)]"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${hpPercentage}%` }}
                                    transition={{ type: "spring", bounce: 0, duration: 1 }}
                                />
                            </div>
                        </div>

                        {/* XP */}
                        <div>
                            <div className="flex justify-between text-xs font-bold text-gray-400 mb-1">
                                <span className="flex items-center gap-1"><Zap size={12} className="text-game-accent" /> EXPERIENCE</span>
                                <span>{stats.xp} / {stats.maxXp}</span>
                            </div>
                            <div className="h-5 bg-slate-900 rounded-sm overflow-hidden border border-slate-700 relative">
                                <motion.div
                                    className="h-full bg-game-accent shadow-[0_0_15px_rgba(56,189,248,0.6)]"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${xpPercentage}%` }}
                                    transition={{ type: "spring", bounce: 0, duration: 1 }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Currency */}
                    <div className="bg-slate-900/50 p-3 rounded-xl border border-game-gold/30 flex flex-col items-center min-w-[100px]">
                        <Coins size={28} className="text-game-gold mb-1 drop-shadow-md" />
                        <span className="text-xl font-bold text-white">{stats.gold}</span>
                        <span className="text-[9px] text-game-gold uppercase tracking-widest">Credits</span>
                    </div>
                </div>
            </div>

            {/* Today's Overview Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Quick Quests */}
                <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                    <h3 className="text-lg font-game font-bold text-white mb-3 flex items-center gap-2">
                        <CheckSquare className="text-game-accent" size={18} />
                        Current Objectives
                    </h3>
                    <div className="space-y-2">
                        {activeQuests.length === 0 ? (
                            <p className="text-gray-500 italic text-xs">No active objectives.</p>
                        ) : (
                            activeQuests.map(q => (
                                <div key={q.id} className="bg-slate-800 p-2.5 rounded border border-slate-700 flex justify-between items-center">
                                    <span className="font-bold text-sm text-gray-200 truncate pr-2">{q.title}</span>
                                    <span className="text-[10px] bg-slate-700 px-2 py-0.5 rounded text-game-accent capitalize">{q.difficulty}</span>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Due Protocols */}
                <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                    <h3 className="text-lg font-game font-bold text-white mb-3 flex items-center gap-2">
                        <Calendar className="text-game-gold" size={18} />
                        Pending Protocols
                    </h3>
                    <div className="space-y-2">
                        {activeHabits.length === 0 ? (
                            <p className="text-gray-500 italic text-xs">All protocols secure.</p>
                        ) : (
                            activeHabits.map(h => (
                                <div key={h.id} className="bg-slate-800 p-2.5 rounded border border-slate-700 flex justify-between items-center">
                                    <span className="font-bold text-sm text-gray-200 truncate pr-2">{h.title}</span>
                                    <span className="text-[10px] text-gray-500 capitalize">{h.frequency}</span>
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
