import React from 'react';
import { useGame } from '../context/GameContext';
import { Shield, CheckCircle, Flame, Maximize2 } from 'lucide-react';
import { motion } from 'framer-motion';

const WidgetView = () => {
    const { stats, quests, habits, setWidgetMode, completeQuest, checkHabit } = useGame();

    // Get top priority quest (first uncompleted)
    const topQuest = quests.find(q => !q.completed);
    // Get habits for today
    const todayHabits = habits.slice(0, 3); // successfuly limit to 3 for widget

    const toggleFullMode = () => {
        setWidgetMode(false);
        // Try to resize window back to reasonable size if supported
        if (window.resizeTo) {
            window.resizeTo(1280, 800);
        }
    };

    return (
        <div className="h-screen w-screen bg-slate-900 text-white overflow-hidden flex flex-col p-4 select-none drag-handle">
            {/* Header Stats */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center font-bold text-lg border-2 border-blue-400">
                        {stats.level}
                    </div>
                    <div className="flex flex-col">
                        <span className="text-xs text-slate-400">XP {stats.xp}/{stats.maxXp}</span>
                        <div className="w-20 h-2 bg-slate-700 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-blue-400"
                                style={{ width: `${(stats.xp / stats.maxXp) * 100}%` }}
                            />
                        </div>
                    </div>
                </div>

                <button
                    onClick={toggleFullMode}
                    className="p-2 hover:bg-slate-800 rounded-full text-slate-400 transition-colors"
                    title="Expand to Full App"
                >
                    <Maximize2 size={18} />
                </button>
            </div>

            {/* Main Content */}
            <div className="flex-1 space-y-3 overflow-y-auto no-scrollbar">
                {/* Current Quest */}
                {topQuest ? (
                    <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700/50">
                        <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                                <h3 className="text-sm font-semibold text-slate-200 line-clamp-1">{topQuest.title}</h3>
                                <span className="text-xs text-amber-500 flex items-center gap-1 mt-1">
                                    <Shield size={10} /> +{topQuest.reward.xp} XP
                                </span>
                            </div>
                            <button
                                onClick={() => completeQuest(topQuest.id)}
                                className="p-1.5 bg-green-500/10 text-green-400 hover:bg-green-500/20 rounded-lg transition-colors"
                            >
                                <CheckCircle size={16} />
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="text-center text-xs text-slate-500 py-2">No active quests</div>
                )}

                {/* Quick Habits */}
                <div className="space-y-2">
                    {todayHabits.map(habit => (
                        <div key={habit.id} className="flex items-center justify-between group">
                            <span className="text-xs text-slate-300 truncate max-w-[70%]">{habit.title}</span>
                            <button
                                onClick={() => checkHabit(habit.id)}
                                className="flex items-center gap-1 text-xs text-slate-500 hover:text-orange-400 transition-colors"
                            >
                                <Flame size={12} className={habit.streak > 0 ? "text-orange-500" : ""} />
                                {habit.streak}
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Footer Mini Bar */}
            <div className="mt-2 pt-2 border-t border-slate-800 flex justify-between text-[10px] text-slate-500">
                <span>HP: {stats.hp}/{stats.maxHp}</span>
                <span>Gold: {stats.gold}</span>
            </div>
        </div>
    );
};

export default WidgetView;
