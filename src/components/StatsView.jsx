import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { AnimatePresence, motion as Motion, useDragControls } from 'framer-motion';
import {
    Activity,
    Calendar,
    Coins,
    Target,
    TrendingUp,
} from 'lucide-react';
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis
} from 'recharts';
import { useGame, useGameCalories } from '../context/GameContext';
import { toLocalDateKey } from '../utils/dateUtils';

const TONE_STYLES = {
    blue: {
        card: 'border-sky-400/25 bg-slate-950/78',
        line: 'bg-sky-400/80',
        glow: 'from-sky-500/30 via-sky-400/10 to-transparent',
        icon: 'bg-black/60 text-sky-300 border border-sky-400/30',
        value: 'text-sky-100',
        helper: 'text-sky-200/70'
    },
    emerald: {
        card: 'border-emerald-400/25 bg-slate-950/78',
        line: 'bg-emerald-400/80',
        glow: 'from-emerald-500/28 via-emerald-400/10 to-transparent',
        icon: 'bg-black/60 text-emerald-300 border border-emerald-400/30',
        value: 'text-emerald-100',
        helper: 'text-emerald-200/70'
    },
    amber: {
        card: 'border-amber-400/25 bg-slate-950/78',
        line: 'bg-amber-400/80',
        glow: 'from-amber-500/28 via-amber-400/10 to-transparent',
        icon: 'bg-black/60 text-amber-300 border border-amber-400/30',
        value: 'text-amber-100',
        helper: 'text-amber-200/70'
    },
    rose: {
        card: 'border-rose-400/25 bg-slate-950/78',
        line: 'bg-rose-400/80',
        glow: 'from-rose-500/28 via-rose-400/10 to-transparent',
        icon: 'bg-black/60 text-rose-300 border border-rose-400/30',
        value: 'text-rose-100',
        helper: 'text-rose-200/70'
    },
    violet: {
        card: 'border-violet-400/25 bg-slate-950/78',
        line: 'bg-violet-400/80',
        glow: 'from-violet-500/28 via-violet-400/10 to-transparent',
        icon: 'bg-black/60 text-violet-300 border border-violet-400/30',
        value: 'text-violet-100',
        helper: 'text-violet-200/70'
    }
};

const fromDateKey = (dateKey) => {
    const [year, month, day] = dateKey.split('-').map(Number);
    return new Date(year, month - 1, day);
};

const getLastNDays = (days) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return Array.from({ length: days }, (_, index) => {
        const date = new Date(today);
        date.setDate(today.getDate() - (days - index - 1));
        return toLocalDateKey(date);
    });
};

const formatAxisDate = (dateKey) =>
    new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric'
    }).format(fromDateKey(dateKey));

const truncateLabel = (label, maxLength = 14) =>
    label.length > maxLength ? `${label.slice(0, maxLength - 1)}...` : label;

const EmptyChartState = ({ title, body }) => (
    <div className="flex h-full min-h-[140px] items-center justify-center rounded-[1.25rem] border border-dashed border-slate-700/90 bg-black/35 px-5 text-center shadow-[inset_0_0_0_1px_rgba(148,163,184,0.04)] sm:min-h-[180px]">
        <div>
            <p className="font-game text-sm font-semibold uppercase tracking-[0.28em] text-slate-400">{title}</p>
            <p className="mt-2 text-sm text-slate-500">{body}</p>
        </div>
    </div>
);

const getIndicatorColor = (tone) => {
    switch (tone) {
        case 'emerald':
            return '#34d399';
        case 'amber':
            return '#fbbf24';
        case 'rose':
            return '#fb7185';
        case 'violet':
            return '#818cf8';
        case 'blue':
        default:
            return '#38bdf8';
    }
};

const MiniIndicator = ({ values = [], tone = 'blue', type = 'spark' }) => {
    const color = getIndicatorColor(tone);
    const safeValues = values.length ? values.map((value) => Number(value || 0)) : [0];
    const maxValue = Math.max(...safeValues, 1);
    const minValue = Math.min(...safeValues, 0);
    const range = Math.max(maxValue - minValue, 1);

    if (type === 'bars') {
        return (
            <div className="mt-3 flex h-7 items-end gap-1" aria-hidden="true">
                {safeValues.map((value, index) => (
                    <span
                        key={`${value}-${index}`}
                        className="min-w-0 flex-1 rounded-t-sm opacity-80"
                        style={{
                            height: `${Math.max(((value - minValue) / range) * 100, value > 0 ? 18 : 8)}%`,
                            backgroundColor: color
                        }}
                    />
                ))}
            </div>
        );
    }

    const points = safeValues
        .map((value, index) => {
            const x = safeValues.length === 1 ? 48 : (index / (safeValues.length - 1)) * 96;
            const y = 28 - ((value - minValue) / range) * 24;
            return `${x},${y}`;
        })
        .join(' ');

    return (
        <svg className="mt-3 h-8 w-full overflow-visible" viewBox="0 0 96 32" preserveAspectRatio="none" aria-hidden="true">
            <polyline
                points={points}
                fill="none"
                stroke={color}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.4"
                opacity="0.9"
            />
        </svg>
    );
};

const SummaryCard = ({ icon, label, value, helper, tone = 'blue', className = '', onClick, isExpanded, indicator, variant = 'card', showIcon = true, chromeless = false }) => {
    const IconComponent = icon;
    const toneStyles = TONE_STYLES[tone] || TONE_STYLES.blue;
    const Component = onClick ? 'button' : 'div';
    const interactiveClasses = onClick ? 'cursor-pointer transition-transform hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70' : '';

    if (variant === 'strip') {
        return (
            <Component
                type={onClick ? 'button' : undefined}
                onClick={onClick}
                aria-expanded={onClick ? isExpanded : undefined}
                className={`relative overflow-hidden rounded-[1.1rem] px-3.5 py-3 text-left ${chromeless ? '' : `border shadow-[0_14px_30px_rgba(0,0,0,0.26)] ${toneStyles.card}`} ${interactiveClasses} ${className}`}
            >
                {!chromeless && <div className={`pointer-events-none absolute inset-y-3 left-0 w-px ${toneStyles.line}`} />}
                <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                        <p className="font-game text-[9px] font-semibold uppercase tracking-[0.24em] text-slate-500">{label}</p>
                        <p className={`mt-1 text-[11px] leading-4 ${toneStyles.helper}`}>{helper}</p>
                    </div>
                    <p className={`shrink-0 font-game text-xl font-semibold uppercase tracking-[0.05em] ${toneStyles.value}`}>{value}</p>
                </div>
                {indicator && <MiniIndicator {...indicator} tone={tone} />}
            </Component>
        );
    }

    return (
        <Component
            type={onClick ? 'button' : undefined}
            onClick={onClick}
            aria-expanded={onClick ? isExpanded : undefined}
            className={`relative overflow-hidden rounded-[1.35rem] px-3.5 py-3 text-left sm:px-4 sm:py-4 ${chromeless ? '' : `border shadow-[0_18px_40px_rgba(0,0,0,0.34)] ${toneStyles.card}`} ${interactiveClasses} ${className}`}
        >
            {!chromeless && <div className={`pointer-events-none absolute inset-x-4 top-0 h-px ${toneStyles.line}`} />}
            {!chromeless && <div className={`pointer-events-none absolute -right-8 top-0 h-24 w-24 bg-gradient-to-bl blur-2xl ${toneStyles.glow}`} />}
            <div className="flex items-start justify-between gap-2.5">
                <div className="min-w-0 flex-1">
                    <p className="font-game text-[9px] font-semibold uppercase tracking-[0.24em] text-slate-500 sm:text-[10px] sm:tracking-[0.28em]">{label}</p>
                    <p className={`mt-1 font-game text-[1.45rem] font-semibold uppercase tracking-[0.04em] sm:mt-2 sm:text-[1.7rem] sm:tracking-[0.06em] ${toneStyles.value}`}>{value}</p>
                    {helper && (
                        <p className={`mt-1.5 text-[11px] leading-4 sm:mt-3 sm:text-xs sm:leading-relaxed ${toneStyles.helper}`}>{helper}</p>
                    )}
                </div>
                {showIcon && (
                    <div className={`shrink-0 rounded-full p-2 shadow-[inset_0_2px_6px_rgba(0,0,0,0.65)] sm:p-2.5 ${toneStyles.icon}`}>
                        <IconComponent size={16} strokeWidth={2.2} className="sm:h-[18px] sm:w-[18px]" />
                    </div>
                )}
            </div>
            {indicator && <MiniIndicator {...indicator} tone={tone} />}
        </Component>
    );
};

const SectionCard = ({ title, eyebrow, icon: Icon, children }) => (
    <section className="relative overflow-hidden rounded-[1.55rem] border border-slate-700/90 bg-slate-950/78 p-3.5 shadow-[0_24px_50px_rgba(0,0,0,0.32)] backdrop-blur-xl sm:rounded-[1.7rem] sm:p-4">
        <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-sky-400/70 to-transparent" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.05] [background-image:linear-gradient(rgba(148,163,184,0.9)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.9)_1px,transparent_1px)] [background-size:24px_24px]" />
        <div className="mb-3 flex items-start justify-between gap-3 sm:mb-4">
            <div>
                {eyebrow && (
                    <p className="font-game text-[10px] font-semibold uppercase tracking-[0.32em] text-slate-500">{eyebrow}</p>
                )}
                <h3 className="mt-1 flex items-center gap-2 font-game text-base font-semibold uppercase tracking-[0.08em] text-slate-100">
                    {Icon && <Icon size={17} className="text-sky-300 drop-shadow-[0_0_8px_rgba(56,189,248,0.35)]" />}
                    {title}
                </h3>
            </div>
        </div>
        <div className="relative z-10">{children}</div>
    </section>
);

const ChartTooltip = ({ active, payload, label, formatLabel = (value) => value }) => {
    if (!active || !payload?.length) return null;

    return (
        <div className="rounded-xl border border-slate-700/90 bg-slate-950/95 px-3 py-2 shadow-2xl backdrop-blur">
            <p className="text-xs font-medium text-slate-300">{formatLabel(label)}</p>
            <div className="mt-2 space-y-1">
                {payload.map((entry) => (
                    <div key={entry.name} className="flex items-center justify-between gap-4 text-xs">
                        <span style={{ color: entry.color }}>{entry.name}</span>
                        <span className="font-semibold text-slate-100">{entry.value}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

const StatsView = ({ isOpen, onClose }) => {
    const { stats, quests, habits, coinHistory } = useGame();
    const { calories } = useGameCalories();
    const [showQuestVelocity, setShowQuestVelocity] = useState(false);
    const [showProtocolConsistency, setShowProtocolConsistency] = useState(false);
    const [showCoinBalanceTrend, setShowCoinBalanceTrend] = useState(false);
    const [showCalorieTrend, setShowCalorieTrend] = useState(false);
    const dragControls = useDragControls();
    const scrollRef = useRef(null);
    const swipeStateRef = useRef({ startY: 0, startX: 0, startAtTop: false });

    const last7Days = useMemo(() => getLastNDays(7), []);
    const last14Days = useMemo(() => getLastNDays(14), []);

    const questData = useMemo(() => {
        const grouped = {};

        quests
            .filter((quest) => quest.completed && quest.completedAt)
            .forEach((quest) => {
                const dateKey = toLocalDateKey(quest.completedAt);
                grouped[dateKey] = (grouped[dateKey] || 0) + 1;
            });

        return last7Days.map((date) => ({
            date,
            count: grouped[date] || 0
        }));
    }, [last7Days, quests]);

    const coinData = useMemo(() => {
        const grouped = {};

        coinHistory.forEach((entry) => {
            const dateKey = toLocalDateKey(entry.date);
            const delta = entry.type === 'earned' ? entry.amount : -entry.amount;
            grouped[dateKey] = (grouped[dateKey] || 0) + delta;
        });

        const firstVisibleDate = last14Days[0];
        const historicalBalance = Object.keys(grouped)
            .filter((date) => date < firstVisibleDate)
            .sort()
            .reduce((total, date) => total + grouped[date], 0);

        return last14Days.map((date, index) => {
            const change = grouped[date] || 0;
            const balance = historicalBalance + last14Days
                .slice(0, index + 1)
                .reduce((sum, day) => sum + (grouped[day] || 0), 0);
            return {
                date,
                balance,
                change
            };
        });
    }, [coinHistory, last14Days]);

    const calorieData = useMemo(() => {
        const grouped = {};

        (calories.history || []).forEach((entry) => {
            const dateKey = entry.dateKey || toLocalDateKey(entry.timestamp || entry.date);
            grouped[dateKey] = (grouped[dateKey] || 0) + Number(entry.calories ?? entry.amount ?? 0);
        });

        return last7Days.map((date) => ({
            date,
            calories: grouped[date] || 0,
            target: calories.target || 0
        }));
    }, [calories, last7Days]);

    const protocolData = useMemo(() => {
        return habits
            .map((habit) => ({
                name: truncateLabel(habit.title || 'Protocol'),
                hits: Object.values(habit.history || {}).reduce((sum, count) => sum + Number(count || 0), 0)
            }))
            .sort((a, b) => b.hits - a.hits)
            .slice(0, 5);
    }, [habits]);

    const summaryCards = useMemo(() => {
        const completedThisWeek = questData.reduce((sum, item) => sum + item.count, 0);
        const activeHabitCount = habits.filter((habit) => habit.isActive).length;
        const protocolHitsLast7 = habits.reduce(
            (sum, habit) =>
                sum + last7Days.reduce((dayTotal, day) => dayTotal + Number(habit.history?.[day] || 0), 0),
            0
        );
        const currentBalance = Number(stats.gold || 0);
        const earned14 = coinData.reduce((sum, item) => sum + Math.max(item.change, 0), 0);
        const spent14 = coinData.reduce((sum, item) => sum + Math.abs(Math.min(item.change, 0)), 0);
        const avgCalories = calorieData.length
            ? Math.round(calorieData.reduce((sum, item) => sum + item.calories, 0) / calorieData.length)
            : 0;
        return [
            {
                icon: Calendar,
                label: 'Quests Cleared',
                value: `${completedThisWeek}`,
                helper: '',
                tone: 'emerald',
                className: 'border-0 bg-transparent shadow-none',
                showIcon: false,
                chromeless: true,
                indicator: { type: 'bars', values: questData.map((item) => item.count) }
            },
            {
                icon: Activity,
                label: 'Protocol Hits',
                value: `${protocolHitsLast7}`,
                helper: '',
                detail: `${activeHabitCount} active protocol${activeHabitCount === 1 ? '' : 's'}`,
                tone: 'violet',
                className: 'border-0 bg-transparent shadow-none',
                showIcon: false,
                chromeless: true,
                indicator: { type: 'bars', values: protocolData.map((item) => item.hits) }
            },
            {
                icon: Coins,
                label: 'Current Balance',
                value: `${currentBalance}`,
                helper: '',
                tone: 'amber',
                className: 'border-0 bg-transparent shadow-none',
                showIcon: false,
                chromeless: true,
                indicator: { type: 'spark', values: coinData.map((item) => item.balance) }
            },
            {
                icon: Target,
                label: 'Weekly Average',
                value: `${avgCalories}`,
                helper: '',
                tone: 'rose',
                className: 'border-0 bg-transparent shadow-none',
                showIcon: false,
                chromeless: true,
                indicator: { type: 'spark', values: calorieData.map((item) => item.calories) }
            },
            {
                icon: TrendingUp,
                label: 'Earned 14D',
                value: `+${earned14}`,
                helper: spent14 ? `${spent14} spent in the same window` : 'No spend in the same window',
                tone: 'emerald',
                variant: 'strip',
                className: 'border-0 bg-transparent shadow-none',
                chromeless: true,
                indicator: { type: 'bars', values: coinData.map((item) => Math.max(item.change, 0)) }
            }
        ];
    }, [
        calorieData,
        coinData,
        habits,
        last7Days,
        protocolData,
        questData,
        stats.gold,
    ]);

    useEffect(() => {
        if (!isOpen) return;
        scrollRef.current?.scrollTo({ top: 0, behavior: 'auto' });
    }, [isOpen]);

    if (!isOpen) return null;

    const handleClose = () => {
        setShowQuestVelocity(false);
        setShowProtocolConsistency(false);
        setShowCoinBalanceTrend(false);
        setShowCalorieTrend(false);
        onClose();
    };

    const handleDragEnd = (_, info) => {
        if (info.offset.y < -80 || info.velocity.y < -500) {
            handleClose();
        }
    };

    const handleSheetTouchStart = (event) => {
        const touch = event.touches?.[0];
        if (!touch) return;

        swipeStateRef.current = {
            startY: touch.clientY,
            startX: touch.clientX,
            startAtTop: (scrollRef.current?.scrollTop || 0) <= 0
        };
    };

    const handleSheetTouchEnd = (event) => {
        const touch = event.changedTouches?.[0];
        if (!touch) return;

        const { startY, startX, startAtTop } = swipeStateRef.current;
        const deltaY = touch.clientY - startY;
        const deltaX = touch.clientX - startX;
        const isAtTopNow = (scrollRef.current?.scrollTop || 0) <= 0;

        if (startAtTop && isAtTopNow && deltaY < -85 && Math.abs(deltaX) < 70) {
            handleClose();
        }
    };

    const renderCoinBalanceChart = ({ hologram = false } = {}) => (
        coinData.some((item) => item.balance !== 0 || item.change !== 0) ? (
            <div className="h-52 w-full sm:h-64">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={coinData} margin={{ left: 0, right: 8 }}>
                        <defs>
                            <linearGradient id="coinGlow" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#fbbf24" stopOpacity={0.38} />
                                <stop offset="95%" stopColor="#fbbf24" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        {!hologram && <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />}
                        <XAxis
                            dataKey="date"
                            stroke={hologram ? '#facc15' : '#64748b'}
                            tick={{ fontSize: 10, fill: hologram ? '#fde68a' : '#64748b' }}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={formatAxisDate}
                        />
                        <YAxis
                            stroke={hologram ? '#facc15' : '#64748b'}
                            tick={{ fontSize: 10, fill: hologram ? '#fde68a' : '#64748b' }}
                            axisLine={false}
                            tickLine={false}
                            allowDecimals={false}
                        />
                        <Tooltip content={<ChartTooltip formatLabel={formatAxisDate} />} cursor={{ stroke: '#fbbf24', strokeOpacity: 0.15 }} />
                        <Area
                            type="monotone"
                            dataKey="balance"
                            name="Balance"
                            stroke="#fbbf24"
                            strokeWidth={2.5}
                            fill="url(#coinGlow)"
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        ) : (
            <EmptyChartState
                title="Economy data will appear here"
                body="Earn or spend a few coins and this turns into a cleaner pulse of balance changes over time."
            />
        )
    );

    const renderQuestVelocityChart = ({ hologram = false } = {}) => (
        questData.some((item) => item.count > 0) ? (
            <div className="h-52 w-full sm:h-64">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={questData} barGap={8}>
                        {!hologram && <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />}
                        <XAxis
                            dataKey="date"
                            stroke={hologram ? '#34d399' : '#64748b'}
                            tick={{ fontSize: 10, fill: hologram ? '#bbf7d0' : '#64748b' }}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={formatAxisDate}
                        />
                        <YAxis
                            stroke={hologram ? '#34d399' : '#64748b'}
                            tick={{ fontSize: 10, fill: hologram ? '#bbf7d0' : '#64748b' }}
                            axisLine={false}
                            tickLine={false}
                            allowDecimals={false}
                        />
                        <Tooltip content={<ChartTooltip formatLabel={formatAxisDate} />} cursor={{ fill: 'rgba(52,211,153,0.08)' }} />
                        <Bar dataKey="count" name="Completed" fill="#34d399" radius={[8, 8, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        ) : (
            <EmptyChartState
                title="No quest history yet"
                body="Once completed quests start landing, this becomes your quick weekly momentum read."
            />
        )
    );

    const renderProtocolConsistencyChart = ({ hologram = false } = {}) => (
        protocolData.some((item) => item.hits > 0) ? (
            <div className="h-52 w-full sm:h-64">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={protocolData} layout="vertical" margin={{ left: 8, right: 8 }}>
                        {!hologram && <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />}
                        <XAxis
                            type="number"
                            stroke={hologram ? '#a78bfa' : '#64748b'}
                            tick={{ fontSize: 10, fill: hologram ? '#ddd6fe' : '#64748b' }}
                            axisLine={false}
                            tickLine={false}
                            allowDecimals={false}
                        />
                        <YAxis
                            dataKey="name"
                            type="category"
                            width={72}
                            stroke={hologram ? '#a78bfa' : '#94a3b8'}
                            tick={{ fontSize: 10, fill: hologram ? '#ddd6fe' : '#94a3b8' }}
                            axisLine={false}
                            tickLine={false}
                        />
                        <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(129,140,248,0.08)' }} />
                        <Bar dataKey="hits" name="Hits" fill="#818cf8" radius={[0, 8, 8, 0]} barSize={18} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        ) : (
            <EmptyChartState
                title="Protocols are warming up"
                body="Track a few completions and this will surface your most consistent systems."
            />
        )
    );

    const renderCalorieTrendChart = ({ hologram = false } = {}) => (
        (calorieData.some((item) => item.calories > 0) || Number(calories.current || 0) > 0) ? (
            <div className="h-52 w-full sm:h-64">
                <ResponsiveContainer width="100%" height="100%">
                    {hologram ? (
                        <AreaChart data={calorieData} margin={{ left: 0, right: 8 }}>
                            <defs>
                                <linearGradient id="calorieGlow" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#fb7185" stopOpacity={0.32} />
                                    <stop offset="95%" stopColor="#fb7185" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <XAxis
                                dataKey="date"
                                stroke="#fb7185"
                                tick={{ fontSize: 10, fill: '#fecdd3' }}
                                axisLine={false}
                                tickLine={false}
                                tickFormatter={formatAxisDate}
                            />
                            <YAxis
                                stroke="#fb7185"
                                tick={{ fontSize: 10, fill: '#fecdd3' }}
                                axisLine={false}
                                tickLine={false}
                                allowDecimals={false}
                            />
                            <Tooltip content={<ChartTooltip formatLabel={formatAxisDate} />} cursor={{ stroke: '#fb7185', strokeOpacity: 0.15 }} />
                            <Area
                                type="monotone"
                                dataKey="calories"
                                name="Calories"
                                stroke="#fb7185"
                                strokeWidth={2.5}
                                fill="url(#calorieGlow)"
                            />
                        </AreaChart>
                    ) : (
                    <LineChart data={calorieData} margin={{ left: 0, right: 8 }}>
                        {!hologram && <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />}
                        <XAxis
                            dataKey="date"
                            stroke={hologram ? '#fb7185' : '#64748b'}
                            tick={{ fontSize: 10, fill: hologram ? '#fecdd3' : '#64748b' }}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={formatAxisDate}
                        />
                        <YAxis
                            stroke={hologram ? '#fb7185' : '#64748b'}
                            tick={{ fontSize: 10, fill: hologram ? '#fecdd3' : '#64748b' }}
                            axisLine={false}
                            tickLine={false}
                            allowDecimals={false}
                        />
                        <Tooltip content={<ChartTooltip formatLabel={formatAxisDate} />} cursor={{ stroke: '#fb7185', strokeOpacity: 0.15 }} />
                        <Line
                            type="monotone"
                            dataKey="calories"
                            name="Calories"
                            stroke="#fb7185"
                            strokeWidth={2.5}
                            dot={hologram ? false : { r: 3, fill: '#f87171' }}
                            activeDot={{ r: 5 }}
                        />
                        {!hologram && (
                            <Line
                                type="monotone"
                                dataKey="target"
                                name="Target"
                                stroke="#94a3b8"
                                strokeDasharray="5 5"
                                dot={false}
                            />
                        )}
                    </LineChart>
                    )}
                </ResponsiveContainer>
            </div>
        ) : (
            <EmptyChartState
                title="Health stream is quiet"
                body="Log a few entries and this view turns into a much clearer week-over-week intake snapshot."
            />
        )
    );

    const renderOverview = () => (
        <div className="space-y-3 sm:space-y-4">
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-6 sm:gap-3">
                {summaryCards.map((card, index) => (
                    <SummaryCard
                        key={card.label}
                        {...card}
                        onClick={card.label === 'Quests Cleared'
                            ? () => {
                                setShowProtocolConsistency(false);
                                setShowCoinBalanceTrend(false);
                                setShowCalorieTrend(false);
                                setShowQuestVelocity((isShown) => !isShown);
                            }
                            : card.label === 'Protocol Hits'
                                ? () => {
                                    setShowQuestVelocity(false);
                                    setShowCoinBalanceTrend(false);
                                    setShowCalorieTrend(false);
                                    setShowProtocolConsistency((isShown) => !isShown);
                                }
                                : card.label === 'Current Balance'
                                    ? () => {
                                        setShowQuestVelocity(false);
                                        setShowProtocolConsistency(false);
                                        setShowCalorieTrend(false);
                                        setShowCoinBalanceTrend((isShown) => !isShown);
                                    }
                                    : card.label === 'Weekly Average'
                                        ? () => {
                                            setShowQuestVelocity(false);
                                            setShowProtocolConsistency(false);
                                            setShowCoinBalanceTrend(false);
                                            setShowCalorieTrend((isShown) => !isShown);
                                        }
                                        : undefined}
                        isExpanded={card.label === 'Quests Cleared'
                            ? showQuestVelocity
                            : card.label === 'Protocol Hits'
                                ? showProtocolConsistency
                                : card.label === 'Current Balance'
                                    ? showCoinBalanceTrend
                                    : card.label === 'Weekly Average'
                                        ? showCalorieTrend
                                        : undefined}
                        className={card.variant === 'strip'
                            ? 'col-span-2 sm:col-span-3'
                            : index === summaryCards.length - 1 && summaryCards.length % 2 !== 0
                                ? 'col-span-2 sm:col-span-2'
                                : 'sm:col-span-2'}
                    />
                ))}
            </div>

        </div>
    );

    return ReactDOM.createPortal(
        <div
            className="fixed inset-0 z-[100] flex items-start justify-center bg-black/82 backdrop-blur-md"
            data-no-swipe="true"
        >
            <Motion.div
                initial={{ y: '-100%' }}
                animate={{ y: 0 }}
                exit={{ y: '-100%' }}
                transition={{ type: 'spring', damping: 30, stiffness: 210 }}
                drag="y"
                dragListener={false}
                dragControls={dragControls}
                dragSnapToOrigin
                dragConstraints={{ top: -220, bottom: 0 }}
                dragElastic={{ top: 0.22, bottom: 0 }}
                onDragEnd={handleDragEnd}
                onTouchStartCapture={handleSheetTouchStart}
                onTouchEndCapture={handleSheetTouchEnd}
                className="relative flex h-screen min-h-screen w-full max-w-3xl flex-col overflow-hidden border-b border-slate-700/90 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.16),_rgba(15,23,42,0.96)_30%,_rgba(2,6,23,1)_68%)] shadow-2xl md:h-[92vh] md:min-h-0 md:rounded-b-[2rem]"
            >
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.14),transparent_36%),radial-gradient(circle_at_bottom,rgba(251,191,36,0.1),transparent_30%)]" />
                <div className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(rgba(148,163,184,0.45)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.45)_1px,transparent_1px)] [background-size:24px_24px]" />
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-400/80 to-transparent" />

                <div
                    className="relative z-10 shrink-0 border-b border-slate-900/70 bg-slate-950/25 px-4 pb-2.5"
                    style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.25rem)' }}
                >
                    <div className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(rgba(148,163,184,0.45)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.45)_1px,transparent_1px)] [background-size:24px_24px]" />
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-b from-transparent to-slate-950/20" />
                    <div className="text-left">
                        <p className="font-game text-[10px] font-semibold uppercase tracking-[0.34em] text-slate-500">System Intel</p>
                        <h2 className="mt-1 font-game text-2xl font-semibold uppercase tracking-[0.08em] text-slate-50">Data Center</h2>
                    </div>
                </div>

                <div ref={scrollRef} className="relative z-10 min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-4 no-scrollbar">
                    {renderOverview()}
                </div>

                <AnimatePresence>
                    {showQuestVelocity && (
                        <Motion.div
                            key="quest-velocity-projection"
                            className="absolute inset-0 z-30 flex items-center justify-center bg-[#03110d]/88 px-4 pb-12 backdrop-blur-[2px]"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.18, ease: 'easeOut' }}
                            onClick={() => setShowQuestVelocity(false)}
                        >
                            <Motion.div
                                role="dialog"
                                aria-label="Quest completion trend detail"
                                className="relative w-full max-w-2xl overflow-visible text-left"
                                initial={{ opacity: 0, y: -12, scale: 0.94 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -12, scale: 0.94 }}
                                transition={{ duration: 0.2, ease: 'easeOut' }}
                            >
                                <div className="relative z-10">
                                    <div className="mb-2 flex items-start justify-between gap-4">
                                        <h3 className="font-game text-base font-semibold uppercase tracking-[0.08em] text-emerald-200 drop-shadow-[0_0_14px_rgba(52,211,153,0.34)]">Quests Cleared</h3>
                                        <p className="font-game text-2xl font-semibold uppercase tracking-[0.05em] text-emerald-200 drop-shadow-[0_0_14px_rgba(52,211,153,0.48)]">
                                            {summaryCards.find((card) => card.label === 'Quests Cleared')?.value || 0}
                                        </p>
                                    </div>
                                    <div className="relative bg-transparent">
                                        <div className="relative z-10">{renderQuestVelocityChart({ hologram: true })}</div>
                                    </div>
                                </div>
                            </Motion.div>
                        </Motion.div>
                    )}

                    {showProtocolConsistency && (
                        <Motion.div
                            key="protocol-consistency-projection"
                            className="absolute inset-0 z-30 flex items-center justify-center bg-[#08071a]/88 px-4 pb-12 backdrop-blur-[2px]"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.18, ease: 'easeOut' }}
                            onClick={() => setShowProtocolConsistency(false)}
                        >
                            <Motion.div
                                role="dialog"
                                aria-label="Protocol consistency detail"
                                className="relative w-full max-w-2xl overflow-visible text-left"
                                initial={{ opacity: 0, y: -12, scale: 0.94 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -12, scale: 0.94 }}
                                transition={{ duration: 0.2, ease: 'easeOut' }}
                            >
                                <div className="relative z-10">
                                    <div className="mb-2 flex items-start justify-between gap-4">
                                        <div>
                                            <h3 className="font-game text-base font-semibold uppercase tracking-[0.08em] text-violet-200 drop-shadow-[0_0_14px_rgba(167,139,250,0.34)]">Protocol Hits</h3>
                                            <p className="mt-1 text-xs font-medium text-violet-100/80">
                                                {summaryCards.find((card) => card.label === 'Protocol Hits')?.detail}
                                            </p>
                                        </div>
                                        <p className="font-game text-2xl font-semibold uppercase tracking-[0.05em] text-violet-200 drop-shadow-[0_0_14px_rgba(167,139,250,0.48)]">
                                            {summaryCards.find((card) => card.label === 'Protocol Hits')?.value || 0}
                                        </p>
                                    </div>
                                    <div className="relative bg-transparent">
                                        <div className="relative z-10">{renderProtocolConsistencyChart({ hologram: true })}</div>
                                    </div>
                                </div>
                            </Motion.div>
                        </Motion.div>
                    )}

                    {showCoinBalanceTrend && (
                        <Motion.div
                            key="coin-balance-projection"
                            className="absolute inset-0 z-30 flex items-center justify-center bg-[#020817]/88 px-4 pb-12 backdrop-blur-[2px]"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.18, ease: 'easeOut' }}
                            onClick={() => setShowCoinBalanceTrend(false)}
                        >
                            <Motion.div
                                role="dialog"
                                aria-label="Coin balance trend detail"
                                className="relative w-full max-w-2xl overflow-visible text-left"
                                initial={{ opacity: 0, y: -12, scale: 0.94 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -12, scale: 0.94 }}
                                transition={{ duration: 0.2, ease: 'easeOut' }}
                            >
                                <div className="relative z-10">
                                    <div className="mb-2 flex items-start justify-between gap-4">
                                        <h3 className="font-game text-base font-semibold uppercase tracking-[0.08em] text-yellow-200 drop-shadow-[0_0_14px_rgba(250,204,21,0.34)]">Current Balance</h3>
                                        <p className="font-game text-2xl font-semibold uppercase tracking-[0.05em] text-yellow-200 drop-shadow-[0_0_14px_rgba(250,204,21,0.48)]">{stats.gold || 0}</p>
                                    </div>
                                    <div className="relative bg-transparent">
                                        <div className="relative z-10">{renderCoinBalanceChart({ hologram: true })}</div>
                                    </div>
                                </div>
                            </Motion.div>
                        </Motion.div>
                    )}

                    {showCalorieTrend && (
                        <Motion.div
                            key="weekly-average-projection"
                            className="absolute inset-0 z-30 flex items-center justify-center bg-[#08040b]/88 px-4 pb-12 backdrop-blur-[2px]"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.18, ease: 'easeOut' }}
                            onClick={() => setShowCalorieTrend(false)}
                        >
                            <Motion.div
                                role="dialog"
                                aria-label="Weekly average calorie trend detail"
                                className="relative w-full max-w-2xl overflow-visible text-left"
                                initial={{ opacity: 0, y: -12, scale: 0.94 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -12, scale: 0.94 }}
                                transition={{ duration: 0.2, ease: 'easeOut' }}
                            >
                                <div className="relative z-10">
                                    <div className="mb-2 flex items-start justify-between gap-4">
                                        <h3 className="font-game text-base font-semibold uppercase tracking-[0.08em] text-rose-200 drop-shadow-[0_0_14px_rgba(251,113,133,0.34)]">Weekly Average</h3>
                                        <p className="font-game text-2xl font-semibold uppercase tracking-[0.05em] text-rose-200 drop-shadow-[0_0_14px_rgba(251,113,133,0.48)]">
                                            {summaryCards.find((card) => card.label === 'Weekly Average')?.value || 0}
                                        </p>
                                    </div>
                                    <div className="relative bg-transparent">
                                        <div className="relative z-10">{renderCalorieTrendChart({ hologram: true })}</div>
                                    </div>
                                </div>
                            </Motion.div>
                        </Motion.div>
                    )}
                </AnimatePresence>

                <div
                    className="relative z-10 shrink-0 border-t border-slate-800/90 bg-slate-950/55 px-4 py-1.5"
                    style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.375rem)' }}
                >
                    <button
                        type="button"
                        aria-label="Drag to close dashboard"
                        className="mx-auto flex h-9 w-28 cursor-grab items-center justify-center rounded-full bg-transparent active:cursor-grabbing"
                        onPointerDown={(event) => dragControls.start(event)}
                    >
                        <span className="h-0.5 w-8 rounded-full bg-slate-300/35 shadow-[0_0_10px_rgba(148,163,184,0.14)]" />
                    </button>
                </div>
            </Motion.div>
        </div>,
        document.body
    );
};

export default StatsView;
