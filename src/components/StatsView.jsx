import React, { useMemo, useState } from 'react';
import { useGame } from '../context/GameContext';
import { X, TrendingUp, Activity, Coins, Calendar, PieChart } from 'lucide-react';
import {
    LineChart, Line, AreaChart, Area, BarChart, Bar,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart as RePieChart, Pie, Cell
} from 'recharts';

const StatsView = ({ isOpen, onClose }) => {
    const { quests, habits, coinHistory, calories } = useGame();
    const [activeTab, setActiveTab] = useState('overview');

    // --- DATA PROCESSING ---

    // 1. Quests Completed Over Time
    const questData = useMemo(() => {
        const completed = quests.filter(q => q.completed && q.completedAt);
        const grouped = {};
        completed.forEach(q => {
            const date = q.completedAt.split('T')[0];
            grouped[date] = (grouped[date] || 0) + 1;
        });

        // Sort and map
        return Object.keys(grouped).sort().map(date => ({
            date,
            count: grouped[date]
        })).slice(-7); // Last 7 active days
    }, [quests]);

    // 2. Coin Balance History
    const coinData = useMemo(() => {
        // We need to reconstruct balance history. 
        // This is tricky without initial balance reference, but we can show "Changepoints"
        // Let's just show net change per day for now, or cumulative if we assume start at 0 (inaccurate but okay for visual)
        let runningTotal = 0;
        const sortedHistory = [...coinHistory].sort((a, b) => new Date(a.date) - new Date(b.date));

        // Aggregate by day
        const byDay = {};
        sortedHistory.forEach(tx => {
            const date = tx.date.split('T')[0];
            const change = tx.type === 'earned' ? tx.amount : -tx.amount;
            byDay[date] = (byDay[date] || 0) + change;
        });

        // Cumulative
        const result = [];
        let cumulative = 0;
        Object.keys(byDay).sort().forEach(date => {
            cumulative += byDay[date];
            result.push({ date, balance: cumulative, change: byDay[date] });
        });

        return result.slice(-14);
    }, [coinHistory]);

    // 3. Calorie History
    const calorieData = useMemo(() => {
        // Group by day
        const grouped = {};
        calories.history.forEach(entry => {
            const date = entry.date.split('T')[0];
            grouped[date] = (grouped[date] || 0) + entry.amount;
        });

        return Object.keys(grouped).sort().map(date => ({
            date,
            calories: grouped[date],
            target: calories.target
        })).slice(-7);
    }, [calories]);

    // 4. Spending Categories (Misc vs Rewards?)
    // currently we only have misc spending descriptions.
    const spendingData = useMemo(() => {
        const spent = coinHistory.filter(tx => tx.type === 'spent');
        const grouped = {};
        spent.forEach(tx => {
            // Group by description roughly? Or just show time series.
            // Let's do a Pie chart of "Sources" vs "Sinks"
            // For now, let's just count total spent.
        });
        return spent;
    }, [coinHistory]);

    // 5. Protocol Hit Rate
    const protocolData = useMemo(() => {
        // Calculate completion rate per habit
        return habits.map(h => {
            const checkCount = Object.values(h.history).reduce((a, b) => a + b, 0);
            // Rough estimate of "days active" since creation? 
            // Simplification: Just show raw hits for now as a Bar Chart
            return {
                name: h.title,
                hits: checkCount
            };
        });
    }, [habits]);


    // --- RENDER HELPERS ---
    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-slate-900 border border-slate-700 p-2 rounded shadow-xl text-xs">
                    <p className="text-gray-400 mb-1">{label}</p>
                    {payload.map((entry, index) => (
                        <p key={index} style={{ color: entry.color }}>
                            {entry.name}: {entry.value}
                        </p>
                    ))}
                </div>
            );
        }
        return null;
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
            <div className="bg-slate-950 border border-slate-800 w-full max-w-5xl h-[100dvh] md:h-[90vh] md:rounded-3xl overflow-hidden flex flex-col shadow-2xl">

                {/* Header */}
                <div className="p-4 md:p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 shrink-0">
                    <h2 className="text-lg md:text-2xl font-game text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 flex items-center gap-2 md:gap-3">
                        <Activity className="text-blue-400" size={20} />
                        Data Center
                    </h2>
                    <div className="flex gap-1 md:gap-2">
                        {['overview', 'finance', 'health'].map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-2 md:px-4 py-1.5 rounded-lg text-[10px] md:text-sm font-bold uppercase tracking-wider transition-colors ${activeTab === tab
                                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50'
                                    : 'text-gray-500 hover:text-gray-300'
                                    }`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-gray-500 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar pb-32">

                    {activeTab === 'overview' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Quest Progress */}
                            <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
                                <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                                    <Calendar size={18} className="text-emerald-400" /> Quest Completion Velocity
                                </h3>
                                <div className="h-64 w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={questData}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                                            <XAxis dataKey="date" stroke="#64748b" tick={{ fontSize: 10 }} />
                                            <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
                                            <Tooltip content={<CustomTooltip />} />
                                            <Bar dataKey="count" name="Completed" fill="#34d399" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Protocol Performance */}
                            <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
                                <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                                    <Activity size={18} className="text-indigo-400" /> Protocol Consistency
                                </h3>
                                <div className="h-64 w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart layout="vertical" data={protocolData}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                                            <XAxis type="number" stroke="#64748b" tick={{ fontSize: 10 }} />
                                            <YAxis dataKey="name" type="category" width={100} stroke="#94a3b8" tick={{ fontSize: 10 }} />
                                            <Tooltip content={<CustomTooltip />} />
                                            <Bar dataKey="hits" name="Successes" fill="#818cf8" radius={[0, 4, 4, 0]} barSize={20} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'finance' && (
                        <div className="space-y-6">
                            <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
                                <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                                    <Coins size={18} className="text-yellow-400" /> Net Worth History
                                </h3>
                                <div className="h-80 w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={coinData}>
                                            <defs>
                                                <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#fbbf24" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="#fbbf24" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                                            <XAxis dataKey="date" stroke="#64748b" tick={{ fontSize: 10 }} />
                                            <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
                                            <Tooltip content={<CustomTooltip />} />
                                            <Area type="monotone" dataKey="balance" stroke="#fbbf24" fillOpacity={1} fill="url(#colorBalance)" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Recent Transactions List */}
                            <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
                                <h3 className="text-lg font-bold text-white mb-4">Recent Ledger Activity</h3>
                                <div className="space-y-2">
                                    {coinHistory.slice().reverse().slice(0, 5).map(tx => (
                                        <div key={tx.id} className="flex justify-between items-center bg-slate-800/40 p-3 rounded-lg">
                                            <div>
                                                <p className="text-sm text-gray-200 font-bold">{tx.description || 'Transaction'}</p>
                                                <p className="text-xs text-gray-500">{new Date(tx.date).toLocaleDateString()}</p>
                                            </div>
                                            <span className={`font-mono font-bold ${tx.type === 'earned' ? 'text-green-400' : 'text-red-400'}`}>
                                                {tx.type === 'earned' ? '+' : '-'}{tx.amount}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'health' && (
                        <div className="space-y-6">
                            <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
                                <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                                    <Activity size={18} className="text-red-400" /> Calorie Intake vs Target
                                </h3>
                                <div className="h-80 w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={calorieData}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                                            <XAxis dataKey="date" stroke="#64748b" tick={{ fontSize: 10 }} />
                                            <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
                                            <Tooltip content={<CustomTooltip />} />
                                            <Legend />
                                            <Line type="monotone" dataKey="calories" stroke="#f87171" strokeWidth={2} dot={{ r: 4 }} />
                                            <Line type="monotone" dataKey="target" stroke="#94a3b8" strokeDasharray="5 5" />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default StatsView;
