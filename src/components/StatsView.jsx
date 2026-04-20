import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { motion as Motion, useDragControls } from 'framer-motion';
import {
    Activity,
    Calendar,
    Coins,
    Flame,
    Heart,
    Target,
    TrendingUp,
    WalletCards,
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

const TAB_CONFIG = {
    overview: {
        label: 'Overview',
        icon: Activity,
        range: 'Last 7 days',
        accent: 'text-sky-300'
    },
    finance: {
        label: 'Finance',
        icon: WalletCards,
        range: 'Last 14 days',
        accent: 'text-yellow-300'
    },
    health: {
        label: 'Health',
        icon: Heart,
        range: 'Last 7 days',
        accent: 'text-rose-300'
    }
};

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

const formatSignedValue = (value) => `${value > 0 ? '+' : ''}${value}`;

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

const SummaryCard = ({ icon, label, value, helper, tone = 'blue', className = '' }) => {
    const IconComponent = icon;
    const toneStyles = TONE_STYLES[tone] || TONE_STYLES.blue;

    return (
        <div className={`relative overflow-hidden rounded-[1.35rem] border px-3.5 py-3 text-left shadow-[0_18px_40px_rgba(0,0,0,0.34)] sm:px-4 sm:py-4 ${toneStyles.card} ${className}`}>
            <div className={`pointer-events-none absolute inset-x-4 top-0 h-px ${toneStyles.line}`} />
            <div className={`pointer-events-none absolute -right-8 top-0 h-24 w-24 bg-gradient-to-bl blur-2xl ${toneStyles.glow}`} />
            <div className="flex items-start justify-between gap-2.5">
                <div className="min-w-0 flex-1">
                    <p className="font-game text-[9px] font-semibold uppercase tracking-[0.24em] text-slate-500 sm:text-[10px] sm:tracking-[0.28em]">{label}</p>
                    <p className={`mt-1 font-game text-[1.45rem] font-semibold uppercase tracking-[0.04em] sm:mt-2 sm:text-[1.7rem] sm:tracking-[0.06em] ${toneStyles.value}`}>{value}</p>
                    <p className={`mt-1.5 text-[11px] leading-4 sm:mt-3 sm:text-xs sm:leading-relaxed ${toneStyles.helper}`}>{helper}</p>
                </div>
                <div className={`shrink-0 rounded-full p-2 shadow-[inset_0_2px_6px_rgba(0,0,0,0.65)] sm:p-2.5 ${toneStyles.icon}`}>
                    <IconComponent size={16} strokeWidth={2.2} className="sm:h-[18px] sm:w-[18px]" />
                </div>
            </div>
        </div>
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
    const [activeTab, setActiveTab] = useState('overview');
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
        const daysOnTarget = calorieData.filter(
            (item) => item.calories > 0 && Math.abs(item.calories - item.target) <= 150
        ).length;

        if (activeTab === 'finance') {
            return [
                {
                    icon: Coins,
                    label: 'Current Balance',
                    value: `${currentBalance}`,
                    helper: `${coinHistory.length} ledger event${coinHistory.length === 1 ? '' : 's'} recorded`,
                    tone: 'amber'
                },
                {
                    icon: TrendingUp,
                    label: 'Earned 14D',
                    value: `+${earned14}`,
                    helper: spent14 ? `${spent14} spent in the same window` : 'No spend in the same window',
                    tone: 'emerald'
                },
                {
                    icon: WalletCards,
                    label: 'Net 14D',
                    value: formatSignedValue(earned14 - spent14),
                    helper: 'A tighter read than the large chart alone',
                    tone: earned14 - spent14 >= 0 ? 'blue' : 'rose'
                }
            ];
        }

        if (activeTab === 'health') {
            return [
                {
                    icon: Flame,
                    label: 'Today',
                    value: `${calories.current || 0}`,
                    helper: `Target ${calories.target || 0} calories`,
                    tone: 'rose'
                },
                {
                    icon: Target,
                    label: 'Weekly Average',
                    value: `${avgCalories}`,
                    helper: 'Average intake across the last 7 days',
                    tone: 'blue'
                },
                {
                    icon: Heart,
                    label: 'On Target',
                    value: `${daysOnTarget}/7`,
                    helper: 'Days landing within 150 calories of goal',
                    tone: 'emerald'
                }
            ];
        }

        return [
            {
                icon: Calendar,
                label: 'Quests Cleared',
                value: `${completedThisWeek}`,
                helper: 'Total completions across the last 7 days',
                tone: 'emerald'
            },
            {
                icon: Activity,
                label: 'Protocol Hits',
                value: `${protocolHitsLast7}`,
                helper: `${activeHabitCount} active protocol${activeHabitCount === 1 ? '' : 's'}`,
                tone: 'violet'
            },
            {
                icon: Coins,
                label: 'Current Gold',
                value: `${currentBalance}`,
                helper: `${stats.level || 1} level system with ${coinHistory.length} logged transactions`,
                tone: 'amber'
            }
        ];
    }, [
        activeTab,
        calorieData,
        calories,
        coinData,
        coinHistory.length,
        habits,
        last7Days,
        questData,
        stats.gold,
        stats.level
    ]);

    useEffect(() => {
        if (!isOpen) return;
        scrollRef.current?.scrollTo({ top: 0, behavior: 'auto' });
    }, [activeTab, isOpen]);

    if (!isOpen) return null;

    const handleDragEnd = (_, info) => {
        if (info.offset.y < -80 || info.velocity.y < -500) {
            onClose();
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
            onClose();
        }
    };

    const renderOverview = () => (
        <div className="space-y-3 sm:space-y-4">
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3">
                {summaryCards.map((card, index) => (
                    <SummaryCard
                        key={card.label}
                        {...card}
                        className={index === summaryCards.length - 1 && summaryCards.length % 2 !== 0
                            ? 'col-span-2 sm:col-span-1'
                            : ''}
                    />
                ))}
            </div>

            <SectionCard title="Quest Completion Velocity" eyebrow="Mission Pulse" icon={Calendar}>
                {questData.some((item) => item.count > 0) ? (
                    <div className="h-44 w-full sm:h-52">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={questData} barGap={8}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                <XAxis
                                    dataKey="date"
                                    stroke="#64748b"
                                    tick={{ fontSize: 10 }}
                                    axisLine={false}
                                    tickLine={false}
                                    tickFormatter={formatAxisDate}
                                />
                                <YAxis
                                    stroke="#64748b"
                                    tick={{ fontSize: 10 }}
                                    axisLine={false}
                                    tickLine={false}
                                    allowDecimals={false}
                                />
                                <Tooltip content={<ChartTooltip formatLabel={formatAxisDate} />} cursor={{ fill: 'rgba(59,130,246,0.08)' }} />
                                <Bar dataKey="count" name="Completed" fill="#34d399" radius={[8, 8, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <EmptyChartState
                        title="No quest history yet"
                        body="Once completed quests start landing, this block becomes your quick weekly momentum read."
                    />
                )}
            </SectionCard>

            <SectionCard title="Protocol Consistency" eyebrow="Behavior Scan" icon={Activity}>
                {protocolData.some((item) => item.hits > 0) ? (
                    <div className="h-48 w-full sm:h-56">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={protocolData} layout="vertical" margin={{ left: 8, right: 8 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                                <XAxis
                                    type="number"
                                    stroke="#64748b"
                                    tick={{ fontSize: 10 }}
                                    axisLine={false}
                                    tickLine={false}
                                    allowDecimals={false}
                                />
                                <YAxis
                                    dataKey="name"
                                    type="category"
                                    width={72}
                                    stroke="#94a3b8"
                                    tick={{ fontSize: 10 }}
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
                        body="Track a few protocol completions and this section will surface your most consistent systems."
                    />
                )}
            </SectionCard>
        </div>
    );

    const renderFinance = () => (
        <div className="space-y-3 sm:space-y-4">
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3">
                {summaryCards.map((card, index) => (
                    <SummaryCard
                        key={card.label}
                        {...card}
                        className={index === summaryCards.length - 1 && summaryCards.length % 2 !== 0
                            ? 'col-span-2 sm:col-span-1'
                            : ''}
                    />
                ))}
            </div>

            <SectionCard title="Coin Balance Trend" eyebrow="Economy Feed" icon={Coins}>
                {coinData.some((item) => item.balance !== 0 || item.change !== 0) ? (
                    <div className="h-48 w-full sm:h-56">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={coinData} margin={{ left: 0, right: 8 }}>
                                <defs>
                                    <linearGradient id="coinGlow" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#fbbf24" stopOpacity={0.38} />
                                        <stop offset="95%" stopColor="#fbbf24" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                <XAxis
                                    dataKey="date"
                                    stroke="#64748b"
                                    tick={{ fontSize: 10 }}
                                    axisLine={false}
                                    tickLine={false}
                                    tickFormatter={formatAxisDate}
                                />
                                <YAxis
                                    stroke="#64748b"
                                    tick={{ fontSize: 10 }}
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
                )}
            </SectionCard>

            <SectionCard title="Recent Ledger Activity" eyebrow="Latest Movement" icon={WalletCards}>
                {coinHistory.length > 0 ? (
                    <div className="space-y-2">
                        {coinHistory
                            .slice()
                            .reverse()
                            .slice(0, 5)
                            .map((entry) => (
                                <div
                                    key={entry.id}
                                    className="flex items-center justify-between gap-3 rounded-[1.2rem] border border-slate-800/90 bg-black/35 px-4 py-3 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.04)]"
                                >
                                    <div className="min-w-0 text-left">
                                        <p className="truncate text-sm font-medium text-slate-100">
                                            {entry.description || 'Ledger update'}
                                        </p>
                                        <p className="mt-1 text-xs text-slate-500">
                                            {new Date(entry.date).toLocaleDateString('en-US', {
                                                month: 'short',
                                                day: 'numeric',
                                                year: 'numeric'
                                            })}
                                        </p>
                                    </div>
                                    <span
                                        className={`shrink-0 rounded-full border px-2.5 py-1 font-game text-xs font-semibold uppercase tracking-[0.12em] ${
                                            entry.type === 'earned'
                                                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                                                : 'border-rose-500/30 bg-rose-500/10 text-rose-300'
                                        }`}
                                    >
                                        {entry.type === 'earned' ? '+' : '-'}
                                        {entry.amount}
                                    </span>
                                </div>
                            ))}
                    </div>
                ) : (
                    <EmptyChartState
                        title="No ledger entries yet"
                        body="This list becomes more useful than a chart on mobile once purchases and rewards start stacking up."
                    />
                )}
            </SectionCard>
        </div>
    );

    const renderHealth = () => (
        <div className="space-y-3 sm:space-y-4">
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3">
                {summaryCards.map((card, index) => (
                    <SummaryCard
                        key={card.label}
                        {...card}
                        className={index === summaryCards.length - 1 && summaryCards.length % 2 !== 0
                            ? 'col-span-2 sm:col-span-1'
                            : ''}
                    />
                ))}
            </div>

            <SectionCard title="Calorie Intake vs Target" eyebrow="Body Systems" icon={Heart}>
                {(calorieData.some((item) => item.calories > 0) || Number(calories.current || 0) > 0) ? (
                    <div className="h-48 w-full sm:h-56">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={calorieData} margin={{ left: 0, right: 8 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                <XAxis
                                    dataKey="date"
                                    stroke="#64748b"
                                    tick={{ fontSize: 10 }}
                                    axisLine={false}
                                    tickLine={false}
                                    tickFormatter={formatAxisDate}
                                />
                                <YAxis
                                    stroke="#64748b"
                                    tick={{ fontSize: 10 }}
                                    axisLine={false}
                                    tickLine={false}
                                    allowDecimals={false}
                                />
                                <Tooltip content={<ChartTooltip formatLabel={formatAxisDate} />} cursor={{ stroke: '#f87171', strokeOpacity: 0.15 }} />
                                <Line
                                    type="monotone"
                                    dataKey="calories"
                                    name="Calories"
                                    stroke="#f87171"
                                    strokeWidth={2.5}
                                    dot={{ r: 3, fill: '#f87171' }}
                                    activeDot={{ r: 5 }}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="target"
                                    name="Target"
                                    stroke="#94a3b8"
                                    strokeDasharray="5 5"
                                    dot={false}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <EmptyChartState
                        title="Health stream is quiet"
                        body="Log a few entries and this view turns into a much clearer week-over-week intake snapshot."
                    />
                )}
            </SectionCard>

            <SectionCard title="Today at a Glance" eyebrow="Immediate Read" icon={Flame}>
                <div className="rounded-[1.25rem] border border-slate-800/90 bg-black/35 p-3.5 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.04)] sm:rounded-[1.4rem] sm:p-4">
                    <div className="flex items-end justify-between gap-4">
                        <div className="text-left">
                            <p className="font-game text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-500">
                                Current Progress
                            </p>
                            <p className="mt-2 font-game text-[1.7rem] font-semibold uppercase tracking-[0.08em] text-rose-100 sm:text-3xl">
                                {calories.current || 0}
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="font-game text-[10px] uppercase tracking-[0.26em] text-slate-500">Target</p>
                            <p className="font-game text-lg font-semibold uppercase tracking-[0.08em] text-slate-100">{calories.target || 0}</p>
                        </div>
                    </div>
                    <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-800">
                        <div
                            className="h-full rounded-full bg-gradient-to-r from-rose-400 via-amber-300 to-emerald-300 transition-all"
                            style={{
                                width: `${Math.min(((Number(calories.current || 0) / Math.max(Number(calories.target || 1), 1)) * 100), 100)}%`
                            }}
                        />
                    </div>
                    <p className="mt-3 text-left text-xs text-slate-400">
                        {Number(calories.target || 0) - Number(calories.current || 0) > 0
                            ? `${Number(calories.target || 0) - Number(calories.current || 0)} calories remaining today`
                            : `${Math.abs(Number(calories.target || 0) - Number(calories.current || 0))} calories over target`}
                    </p>
                </div>
            </SectionCard>
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
                    className="relative z-10 shrink-0 border-b border-slate-800/90 bg-slate-950/55 px-4 pb-4"
                    style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.5rem)' }}
                >
                    <div className="text-left">
                        <p className="font-game text-[10px] font-semibold uppercase tracking-[0.34em] text-slate-500">System Intel</p>
                        <h2 className="mt-1 font-game text-2xl font-semibold uppercase tracking-[0.08em] text-slate-50">Data Center</h2>
                        <p className="mt-1 text-sm text-slate-400">Live telemetry for your current dashboard state.</p>
                        <p className="mt-2 font-game text-[10px] uppercase tracking-[0.26em] text-slate-500">
                            Swipe up to close when the feed is at the top
                        </p>
                    </div>

                    <div className="mt-4 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                        {Object.entries(TAB_CONFIG).map(([tabKey, tab]) => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tabKey;

                            return (
                                <button
                                    key={tabKey}
                                    onClick={() => setActiveTab(tabKey)}
                                    className={`flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-sm transition-all ${
                                        isActive
                                            ? 'border-slate-600 bg-slate-900/90 text-slate-100 shadow-[0_0_18px_rgba(0,0,0,0.22)]'
                                            : 'border-slate-800/80 bg-black/35 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                                    }`}
                                >
                                    <Icon size={15} className={isActive ? tab.accent : 'text-slate-500'} />
                                    <span className="font-game text-[13px] font-semibold uppercase tracking-[0.14em]">{tab.label}</span>
                                    <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
                                        {tab.range}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div ref={scrollRef} className="relative z-10 min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-4 no-scrollbar">
                    {activeTab === 'overview' && renderOverview()}
                    {activeTab === 'finance' && renderFinance()}
                    {activeTab === 'health' && renderHealth()}
                </div>

                <div
                    className="relative z-10 shrink-0 border-t border-slate-800/90 bg-slate-950/55 px-4 pt-4"
                    style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.25rem)' }}
                >
                    <div
                        className="mx-auto flex h-8 w-20 cursor-grab items-center justify-center active:cursor-grabbing"
                        onPointerDown={(event) => dragControls.start(event)}
                    >
                        <div className="h-1 w-10 rounded-full bg-slate-300/35 shadow-[0_0_14px_rgba(148,163,184,0.18)]" />
                    </div>
                </div>
            </Motion.div>
        </div>,
        document.body
    );
};

export default StatsView;
