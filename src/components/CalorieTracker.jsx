import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useGame } from '../context/GameContext';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import {
    Activity,
    AlertTriangle,
    BookOpen,
    Clock3,
    Edit3,
    Flame,
    History,
    Plus,
    Save,
    Target,
    Trash2,
    X,
    Zap
} from 'lucide-react';
import clsx from 'clsx';
import { getTodayISO } from '../utils/dateUtils';

const QUICK_PRESETS = [100, 250, 500];
const GENERIC_ENTRY_LABELS = new Set(['Manual Entry']);
const EMPTY_LIST = [];
const WHEEL_SEGMENTS = [
    { id: 'latest', start: 292.5, end: 337.5, center: 315, radius: 37.5, width: 15.5, compact: true },
    { id: 'progress', start: 337.5, end: 382.5, center: 360, radius: 37, width: 16.5, compact: true },
    { id: 'summary', start: 22.5, end: 67.5, center: 45, radius: 37.5, width: 15.5, compact: true },
    { id: 'history', start: 67.5, end: 112.5, center: 90, radius: 36, width: 18 },
    { id: 'foods', start: 112.5, end: 157.5, center: 135, radius: 37, width: 18 },
    { id: 'manual', start: 157.5, end: 202.5, center: 180, radius: 36, width: 19 },
    { id: 'preset-250', start: 202.5, end: 247.5, center: 225, radius: 37, width: 16 },
    { id: 'preset-100', start: 247.5, end: 292.5, center: 270, radius: 36, width: 16 }
];

const createBubbles = () => Array.from({ length: 8 }).map((_, i) => ({
    id: i,
    size: Math.random() * 10 + 5,
    x: Math.random() * 80 + 10,
    duration: Math.random() * 2 + 3,
    delay: Math.random() * 2
}));

const getSafeTarget = (target) => Math.max(1, Number(target) || 1);
const normalizeCalories = (value) => Math.max(0, Math.round(Number(value) || 0));

const formatTime = (value) => {
    if (!value) return '--:--';
    return new Date(value).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
    });
};

const formatDateLabel = (dateKey) => {
    if (!dateKey) return 'Unknown Date';
    const [year, month, day] = dateKey.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
};

const shortenLabel = (value, maxLength = 12) => {
    const cleaned = `${value || ''}`.trim();
    if (!cleaned) return 'No Log';
    return cleaned.length > maxLength ? `${cleaned.slice(0, maxLength - 3)}...` : cleaned;
};

const polarToCartesian = (centerX, centerY, radius, angleInDegrees) => {
    const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180;

    return {
        x: centerX + radius * Math.cos(angleInRadians),
        y: centerY + radius * Math.sin(angleInRadians)
    };
};

const describeDonutSlice = (centerX, centerY, innerRadius, outerRadius, startAngle, endAngle) => {
    const outerStart = polarToCartesian(centerX, centerY, outerRadius, startAngle);
    const outerEnd = polarToCartesian(centerX, centerY, outerRadius, endAngle);
    const innerEnd = polarToCartesian(centerX, centerY, innerRadius, endAngle);
    const innerStart = polarToCartesian(centerX, centerY, innerRadius, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? 0 : 1;

    return [
        `M ${outerStart.x} ${outerStart.y}`,
        `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${outerEnd.x} ${outerEnd.y}`,
        `L ${innerEnd.x} ${innerEnd.y}`,
        `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${innerStart.x} ${innerStart.y}`,
        'Z'
    ].join(' ');
};

const describeOpenArc = (centerX, centerY, radius, startAngle, endAngle, sweepFlag = 1) => {
    let resolvedEnd = endAngle;

    if (sweepFlag === 1 && resolvedEnd < startAngle) {
        resolvedEnd += 360;
    }

    if (sweepFlag === 0 && resolvedEnd > startAngle) {
        resolvedEnd -= 360;
    }

    const start = polarToCartesian(centerX, centerY, radius, startAngle);
    const end = polarToCartesian(centerX, centerY, radius, resolvedEnd);
    const largeArcFlag = Math.abs(resolvedEnd - startAngle) > 180 ? 1 : 0;

    return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} ${sweepFlag} ${end.x} ${end.y}`;
};

const getWheelPosition = (angle, radius) => {
    const { x, y } = polarToCartesian(50, 50, radius, angle);

    return {
        left: `${x}%`,
        top: `${y}%`
    };
};

const groupEntriesByDay = (history) => {
    const groups = new Map();

    [...(history || [])]
        .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0))
        .forEach((entry) => {
            const dateKey = entry.dateKey || getTodayISO();
            if (!groups.has(dateKey)) {
                groups.set(dateKey, []);
            }
            groups.get(dateKey).push(entry);
        });

    return Array.from(groups.entries()).map(([dateKey, entries]) => ({
        dateKey,
        entries,
        total: entries.reduce((sum, entry) => sum + Number(entry.calories || 0), 0)
    }));
};

const ReactorCore = ({ current, target }) => {
    const safeTarget = getSafeTarget(target);
    const percentage = Math.min((Number(current || 0) / safeTarget) * 100, 100);
    const isOverload = Number(current || 0) > safeTarget;
    const [bubbles] = useState(createBubbles);

    return (
        <div className="relative w-full h-full flex items-center justify-center p-6 sm:p-8">
            <div className="relative w-[240px] h-[240px] sm:w-[300px] sm:h-[300px] lg:w-[340px] lg:h-[340px]">
                <div className="absolute inset-0 rounded-full border-[8px] border-slate-800 shadow-[0_0_50px_rgba(0,0,0,0.55)] bg-black/60 backdrop-blur-sm z-10 flex items-center justify-center">
                    <svg className="absolute inset-0 w-full h-full animate-spin-slow opacity-30 pointer-events-none" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="48" fill="none" stroke="#be123c" strokeWidth="0.5" strokeDasharray="4 2" />
                        <circle cx="50" cy="50" r="40" fill="none" stroke="#be123c" strokeWidth="0.2" strokeDasharray="10 10" />
                    </svg>
                </div>

                <div className="absolute inset-4 rounded-full overflow-hidden z-0 bg-slate-900 border border-rose-900/30">
                    <div className="absolute inset-0 opacity-20 bg-[linear-gradient(rgba(244,63,94,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(244,63,94,0.1)_1px,transparent_1px)] bg-[size:20px_20px]" />

                    <Motion.div
                        className={clsx(
                            'absolute bottom-0 left-0 right-0 w-full transition-colors duration-700',
                            isOverload
                                ? 'bg-gradient-to-t from-red-950 via-red-600 to-orange-400'
                                : 'bg-gradient-to-t from-rose-950 via-rose-600 to-rose-300'
                        )}
                        initial={{ height: '0%' }}
                        animate={{ height: `${percentage}%` }}
                        transition={{ type: 'spring', stiffness: 55, damping: 22 }}
                    >
                        <div className="absolute top-0 left-0 right-0 h-4 bg-white/20 blur-sm -translate-y-1/2" />

                        {bubbles.map((bubble) => (
                            <Motion.div
                                key={bubble.id}
                                className="absolute bg-rose-200/20 rounded-full blur-[1px]"
                                style={{ width: bubble.size, height: bubble.size, left: `${bubble.x}%` }}
                                animate={{ y: [-20, -300], opacity: [0, 1, 0] }}
                                transition={{
                                    repeat: Infinity,
                                    duration: bubble.duration,
                                    delay: bubble.delay,
                                    ease: 'linear'
                                }}
                            />
                        ))}
                    </Motion.div>
                </div>

                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center pointer-events-none">
                    <div className="text-center drop-shadow-md">
                        <Motion.div
                            key={current}
                            initial={{ scale: 1.15, opacity: 0.55 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="text-4xl sm:text-5xl lg:text-6xl font-black font-mono text-white tracking-tighter"
                        >
                            {current}
                        </Motion.div>
                        <div className="text-[10px] sm:text-xs font-bold text-rose-200 uppercase tracking-[0.3em] opacity-80 mt-1">
                            kCal Today
                        </div>
                    </div>

                    <div
                        className={clsx(
                            'mt-4 px-3 py-1 rounded-full border backdrop-blur-md flex items-center gap-2 transition-colors',
                            isOverload
                                ? 'bg-red-950/80 border-red-500/50 text-red-400'
                                : 'bg-black/40 border-rose-500/30 text-rose-300'
                        )}
                    >
                        {isOverload ? <AlertTriangle size={12} /> : <Activity size={12} />}
                        <span className="text-[10px] font-mono font-bold uppercase">
                            {isOverload ? 'Over Target' : 'Stable Intake'}
                        </span>
                    </div>
                </div>

                <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-white/10 to-transparent pointer-events-none z-30" />
            </div>
        </div>
    );
};

const ArcCard = ({ className, eyebrow, title, value, accent = 'rose', compact = false, children }) => {
    const accentStyles = {
        rose: 'border-rose-500/25 text-rose-100',
        amber: 'border-amber-400/25 text-amber-100',
        slate: 'border-slate-500/25 text-slate-100'
    };

    return (
        <div
            className={clsx(
                'rounded-2xl border bg-black/45 backdrop-blur-md shadow-[0_0_30px_rgba(0,0,0,0.25)]',
                compact ? 'px-3 py-2.5' : 'px-4 py-3',
                accentStyles[accent],
                className
            )}
        >
            <div className={clsx('uppercase tracking-[0.3em] text-rose-400/65', compact ? 'text-[8px]' : 'text-[9px]')}>{eyebrow}</div>
            <div className={clsx('mt-2 font-game font-semibold uppercase tracking-[0.08em]', compact ? 'text-xs sm:text-sm' : 'text-sm sm:text-base')}>{title}</div>
            <div className={clsx('mt-1 font-mono font-bold', compact ? 'text-base sm:text-lg' : 'text-lg sm:text-xl')}>{value}</div>
            {children && <div className={clsx('mt-2 text-slate-300/80', compact ? 'text-[11px]' : 'text-xs')}>{children}</div>}
        </div>
    );
};

const FoodChip = ({ label, calories, onClick, icon, accent = 'rose' }) => {
    const accentStyles = {
        rose: 'border-rose-500/30 bg-rose-950/30 text-rose-100 hover:border-rose-400 hover:bg-rose-900/35',
        amber: 'border-amber-400/30 bg-amber-950/20 text-amber-50 hover:border-amber-300 hover:bg-amber-900/30',
        slate: 'border-slate-600/40 bg-slate-900/60 text-slate-100 hover:border-slate-400 hover:bg-slate-800'
    };

    return (
                    <Motion.button
            whileTap={{ scale: 0.97 }}
            onClick={onClick}
            className={clsx(
                'shrink-0 min-w-[132px] rounded-2xl border px-4 py-3 text-left transition-colors',
                accentStyles[accent]
            )}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="truncate text-xs uppercase tracking-[0.25em] text-rose-300/55">Quick Add</div>
                    <div className="mt-1 truncate font-game text-sm font-semibold uppercase tracking-[0.08em]">
                        {label}
                    </div>
                </div>
                <div className="shrink-0 text-rose-300/70">{icon}</div>
            </div>
            <div className="mt-3 font-mono text-lg font-bold">{calories}</div>
        </Motion.button>
    );
};

const ActionOrb = ({ icon, label, onClick, accent = 'rose', className }) => {
    const accentStyles = {
        rose: 'border-rose-500/35 bg-rose-950/30 text-rose-100 hover:border-rose-400 hover:bg-rose-900/35',
        slate: 'border-slate-700/60 bg-slate-900/80 text-slate-100 hover:border-slate-500 hover:bg-slate-800',
        amber: 'border-amber-400/35 bg-amber-950/20 text-amber-50 hover:border-amber-300 hover:bg-amber-900/30'
    };

    return (
        <Motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onClick}
            className={clsx(
                'flex h-16 w-16 sm:h-20 sm:w-20 flex-col items-center justify-center rounded-full border backdrop-blur-md shadow-[0_0_20px_rgba(0,0,0,0.2)] transition-colors',
                accentStyles[accent],
                className
            )}
        >
            {icon}
            <span className="mt-1 text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.22em]">{label}</span>
        </Motion.button>
    );
};

const ManualEntryPanel = ({ onSubmit, onClose }) => {
    const [calories, setCalories] = useState('');
    const [label, setLabel] = useState('');
    const [bubbles] = useState(() => createBubbles().slice(0, 5));
    const [labelFocused, setLabelFocused] = useState(false);
    const labelInputRef = useRef(null);
    const manualArcId = useId();
    const labelArcId = useId();
    const injectArcId = useId();

    const canSubmit = normalizeCalories(calories) > 0;
    const orbGeometry = {
        outerInner: 39.2,
        outerOuter: 46.4,
        outerText: 42.9,
        innerInner: 26,
        innerOuter: 39.2,
        topStart: 330,
        topEnd: 390,
        bottomStart: 150,
        bottomEnd: 210
    };
    const labelDisplay = `${label}`.trim() ? shortenLabel(label, 16).toUpperCase() : 'LABEL';
    const labelActive = labelFocused || Boolean(`${label}`.trim());

    const handleSubmit = (event) => {
        event.preventDefault();
        if (!canSubmit) return;

        onSubmit({
            calories: normalizeCalories(calories),
            label: `${label}`.trim()
        });

        setCalories('');
        setLabel('');
        onClose();
    };

    return (
        <Motion.form
            initial={{ opacity: 0, scale: 0.88, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 18 }}
            transition={{ type: 'spring', stiffness: 240, damping: 24 }}
            onSubmit={handleSubmit}
            onClick={(event) => event.stopPropagation()}
            className="relative aspect-square w-[min(92vw,34rem)] max-w-[34rem] overflow-hidden rounded-full bg-[radial-gradient(circle_at_center,rgba(15,23,42,0.98)_0%,rgba(2,6,23,0.99)_56%,rgba(0,0,0,1)_100%)] shadow-[0_28px_80px_rgba(0,0,0,0.52)] backdrop-blur-xl"
        >
            <div className="absolute inset-0 rounded-full" />
            <div className="absolute inset-[4.5%] rounded-full" />
            <div className="absolute inset-[11%] rounded-full shadow-[inset_0_0_40px_rgba(15,23,42,0.8)]" />
            <div className="absolute inset-[8%] rounded-full opacity-[0.14] bg-[linear-gradient(rgba(244,63,94,0.16)_1px,transparent_1px),linear-gradient(90deg,rgba(244,63,94,0.16)_1px,transparent_1px)] bg-[size:18px_18px]" />
            <Motion.div
                className="absolute inset-[16%] rounded-full bg-white/[0.02]"
                animate={{ scale: [1, 1.025, 1], opacity: [0.28, 0.42, 0.28] }}
                transition={{ duration: 4.8, repeat: Infinity, ease: 'easeInOut' }}
            />
            <Motion.div
                className="absolute inset-[23%] rounded-full bg-white/[0.015]"
                animate={{ scale: [1.02, 0.985, 1.02], opacity: [0.16, 0.28, 0.16] }}
                transition={{ duration: 5.6, repeat: Infinity, ease: 'easeInOut' }}
            />

            <svg viewBox="0 0 100 100" className="pointer-events-none absolute inset-0 z-10 h-full w-full overflow-visible">
                <defs>
                    <path id={manualArcId} d={describeOpenArc(50, 50, 43.7, orbGeometry.topStart, orbGeometry.topEnd, 1)} />
                    <path id={labelArcId} d={describeOpenArc(50, 50, 33.1, orbGeometry.topStart, orbGeometry.topEnd, 1)} />
                    <path id={injectArcId} d={describeOpenArc(50, 50, 33.4, orbGeometry.bottomEnd, orbGeometry.bottomStart, 0)} />
                </defs>

                <path
                    d={describeDonutSlice(50, 50, orbGeometry.innerInner, orbGeometry.innerOuter, orbGeometry.topStart, orbGeometry.topEnd)}
                    fill={labelFocused ? 'rgba(29, 16, 29, 0.94)' : label ? 'rgba(13, 17, 31, 0.95)' : 'rgba(7, 12, 24, 0.9)'}
                />
                <path
                    d={describeDonutSlice(50, 50, orbGeometry.innerInner, orbGeometry.innerOuter, orbGeometry.bottomStart, orbGeometry.bottomEnd)}
                    fill={canSubmit ? 'rgba(74, 12, 34, 0.92)' : 'rgba(9, 16, 30, 0.94)'}
                    stroke={canSubmit ? 'rgba(251,113,133,0.18)' : 'rgba(255,255,255,0.06)'}
                    strokeWidth="0.28"
                />
                <text fill="rgba(251,113,133,0.82)" fontSize="3" letterSpacing="0.24em" fontWeight="700">
                    <textPath href={`#${manualArcId}`} startOffset="50%" textAnchor="middle">
                        MANUAL INJECTOR
                    </textPath>
                </text>
                <text
                    fill={labelActive ? 'rgba(241,245,249,0.92)' : 'rgba(148,163,184,0.72)'}
                    fontSize="2.95"
                    fontWeight="700"
                    letterSpacing="0.12em"
                >
                    <textPath href={`#${labelArcId}`} startOffset="50%" textAnchor="middle">
                        {labelDisplay}
                    </textPath>
                </text>
                <text
                    fill={canSubmit ? 'rgba(10,10,10,0.95)' : 'rgba(251,113,133,0.54)'}
                    fontSize="2.95"
                    fontWeight="800"
                    letterSpacing="0.14em"
                    dy="0"
                >
                    <textPath href={`#${injectArcId}`} startOffset="50%" textAnchor="middle">
                        INJECT ENTRY
                    </textPath>
                </text>
            </svg>

            <label className="absolute inset-x-[14%] top-[10%] z-20 block h-[30%] cursor-text">
                <span className="sr-only">Label</span>
                <input
                    ref={labelInputRef}
                    type="text"
                    value={label}
                    onChange={(event) => setLabel(event.target.value)}
                    onFocus={() => setLabelFocused(true)}
                    onBlur={() => setLabelFocused(false)}
                    className="h-full w-full cursor-text rounded-[999px] bg-transparent opacity-0 outline-none"
                    placeholder="LABEL"
                    aria-label="Label"
                    maxLength={32}
                />
            </label>

            <div className="absolute left-1/2 top-1/2 z-20 aspect-square w-[52%] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full bg-[radial-gradient(circle_at_center,rgba(17,24,39,0.98)_0%,rgba(8,12,24,0.98)_62%,rgba(2,6,23,1)_100%)] shadow-[inset_0_0_34px_rgba(0,0,0,0.65)]">
                <div className="absolute inset-[10%] rounded-full bg-white/[0.03]" />
                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:22px_22px] opacity-[0.08]" />

                {bubbles.map((bubble) => (
                    <Motion.div
                        key={bubble.id}
                        className="absolute bottom-6 rounded-full bg-rose-200/15 blur-[1px]"
                        style={{
                            width: bubble.size,
                            height: bubble.size,
                            left: `${bubble.x}%`
                        }}
                        animate={{ y: [0, -80], opacity: [0, 0.75, 0] }}
                        transition={{
                            repeat: Infinity,
                            duration: bubble.duration + 0.8,
                            delay: bubble.delay,
                            ease: 'linear'
                        }}
                    />
                ))}

                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center px-5 text-center">
                    <span className="text-[9px] font-bold uppercase tracking-[0.3em] text-rose-300/60">Calories</span>
                    <input
                        autoFocus
                        type="number"
                        min="1"
                        inputMode="numeric"
                        value={calories}
                        onChange={(event) => setCalories(event.target.value)}
                        className="mt-2 w-full bg-transparent text-center font-mono text-[clamp(2.8rem,8vw,4.3rem)] font-black tracking-[-0.08em] text-rose-50 outline-none placeholder:text-rose-200/20"
                        placeholder="240"
                        aria-label="Calories"
                    />
                    <div className="mt-1 text-[9px] uppercase tracking-[0.24em] text-slate-500">Inject into today</div>
                </div>
            </div>

            <button
                type="submit"
                disabled={!canSubmit}
                className={clsx(
                    'absolute inset-x-[16%] bottom-[14%] z-20 h-[26%] focus:outline-none disabled:cursor-not-allowed',
                    canSubmit ? 'cursor-pointer' : 'cursor-not-allowed'
                )}
                aria-label="Inject entry"
            >
                <span className="sr-only">Inject entry</span>
            </button>
        </Motion.form>
    );
};

const EntryEditor = ({ entry, onSave, onCancel }) => {
    const [label, setLabel] = useState(entry.label || '');
    const [calories, setCalories] = useState(entry.calories || '');

    return (
        <div className="mt-3 rounded-2xl border border-rose-500/20 bg-black/40 p-3">
            <div className="grid gap-3 sm:grid-cols-[1.4fr_0.8fr]">
                <input
                    type="text"
                    value={label}
                    onChange={(event) => setLabel(event.target.value)}
                    className="rounded-xl border border-slate-700/60 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none transition-colors focus:border-rose-400"
                />
                <input
                    type="number"
                    min="1"
                    value={calories}
                    onChange={(event) => setCalories(event.target.value)}
                    className="rounded-xl border border-slate-700/60 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none transition-colors focus:border-rose-400"
                />
            </div>
            <div className="mt-3 flex gap-2">
                <button
                    type="button"
                    onClick={onCancel}
                    className="flex-1 rounded-xl border border-slate-700/60 bg-slate-900/70 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-300"
                >
                    Cancel
                </button>
                <button
                    type="button"
                    onClick={() => onSave({ label, calories: normalizeCalories(calories) })}
                    className="flex-1 rounded-xl bg-rose-500 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-black"
                >
                    Save
                </button>
            </div>
        </div>
    );
};

const SavedFoodEditor = ({ food, onSave, onCancel }) => {
    const [name, setName] = useState(food?.name || '');
    const [calories, setCalories] = useState(food?.calories || '');

    const canSave = `${name}`.trim().length > 0 && normalizeCalories(calories) > 0;

    return (
        <div className="rounded-2xl border border-rose-500/20 bg-black/40 p-3">
            <div className="grid gap-3 sm:grid-cols-[1.4fr_0.8fr]">
                <input
                    type="text"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Food name"
                    className="rounded-xl border border-slate-700/60 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none transition-colors focus:border-rose-400"
                />
                <input
                    type="number"
                    min="1"
                    value={calories}
                    onChange={(event) => setCalories(event.target.value)}
                    placeholder="Calories"
                    className="rounded-xl border border-slate-700/60 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none transition-colors focus:border-rose-400"
                />
            </div>
            <div className="mt-3 flex gap-2">
                <button
                    type="button"
                    onClick={onCancel}
                    className="flex-1 rounded-xl border border-slate-700/60 bg-slate-900/70 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-300"
                >
                    Cancel
                </button>
                <button
                    type="button"
                    disabled={!canSave}
                    onClick={() => onSave({ name, calories: normalizeCalories(calories) })}
                    className="flex-1 rounded-xl bg-rose-500 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-black disabled:cursor-not-allowed disabled:bg-rose-900/60 disabled:text-rose-200/50"
                >
                    Save
                </button>
            </div>
        </div>
    );
};

const HistoryVaultModal = ({
    entriesByDay,
    todayKey,
    savedFoods,
    initialTab = 'entries',
    onClose,
    onUpdateEntry,
    onDeleteEntry,
    onQuickAddFood,
    onCreateFood,
    onUpdateFood,
    onDeleteFood
}) => {
    const [tab, setTab] = useState(initialTab);
    const [editingEntryId, setEditingEntryId] = useState(null);
    const [editingFoodId, setEditingFoodId] = useState(null);
    const [newFoodName, setNewFoodName] = useState('');
    const [newFoodCalories, setNewFoodCalories] = useState('');

    useEffect(() => {
        setTab(initialTab);
    }, [initialTab]);

    const canCreateFood = `${newFoodName}`.trim().length > 0 && normalizeCalories(newFoodCalories) > 0;

    const handleCreateFood = () => {
        if (!canCreateFood) return;
        onCreateFood({ name: newFoodName, calories: normalizeCalories(newFoodCalories) });
        setNewFoodName('');
        setNewFoodCalories('');
    };

    return (
        <div className="fixed inset-0 z-[180] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
            <Motion.div
                initial={{ opacity: 0, scale: 0.96, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 16 }}
                className="w-full max-w-3xl max-h-[85vh] overflow-hidden rounded-[30px] border border-rose-500/20 bg-slate-950 shadow-[0_0_60px_rgba(0,0,0,0.45)]"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="flex items-center justify-between gap-4 border-b border-rose-500/15 bg-black/40 px-5 py-4">
                    <div>
                        <div className="text-[10px] uppercase tracking-[0.3em] text-rose-400/65">Archive Console</div>
                        <div className="mt-1 font-game text-xl font-semibold uppercase tracking-[0.08em] text-rose-50">
                            Calorie Vault
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-full border border-slate-700/60 bg-slate-900/80 p-2 text-slate-400 transition-colors hover:text-white"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="flex gap-2 border-b border-rose-500/15 px-5 py-3">
                    {[
                        { id: 'entries', label: 'Entries', icon: <History size={14} /> },
                        { id: 'foods', label: 'Foods', icon: <BookOpen size={14} /> }
                    ].map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            onClick={() => setTab(item.id)}
                            className={clsx(
                                'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] transition-colors',
                                tab === item.id
                                    ? 'border-rose-400/50 bg-rose-500/10 text-rose-100'
                                    : 'border-slate-700/60 bg-slate-900/60 text-slate-400 hover:text-white'
                            )}
                        >
                            {item.icon}
                            {item.label}
                        </button>
                    ))}
                </div>

                <div className="max-h-[calc(85vh-9rem)] overflow-y-auto px-5 py-5 custom-scrollbar space-y-4">
                    {tab === 'entries' && (
                        <div className="space-y-4">
                            {entriesByDay.length === 0 && (
                                <div className="rounded-3xl border border-dashed border-slate-700/60 bg-slate-900/40 px-6 py-12 text-center text-slate-400">
                                    No intake records yet.
                                </div>
                            )}

                            {entriesByDay.map((group) => {
                                const isToday = group.dateKey === todayKey;

                                return (
                                    <div key={group.dateKey} className="rounded-[28px] border border-rose-500/15 bg-black/35 p-4">
                                        <div className="flex items-center justify-between gap-4">
                                            <div>
                                                <div className="text-[10px] uppercase tracking-[0.28em] text-rose-400/65">
                                                    {isToday ? 'Editable Window' : 'Read Only'}
                                                </div>
                                                <div className="mt-1 font-game text-lg font-semibold uppercase tracking-[0.08em] text-rose-50">
                                                    {formatDateLabel(group.dateKey)}
                                                </div>
                                            </div>
                                            <div className="rounded-full border border-rose-500/20 bg-rose-950/25 px-3 py-1 text-xs font-mono text-rose-100">
                                                {group.total} kcal
                                            </div>
                                        </div>

                                        <div className="mt-4 space-y-3">
                                            {group.entries.map((entry) => (
                                                <div key={entry.id} className="rounded-2xl border border-slate-800 bg-slate-950/55 p-3">
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="min-w-0">
                                                            <div className="text-[10px] uppercase tracking-[0.24em] text-rose-400/55">
                                                                {entry.source.replace('-', ' ')}
                                                            </div>
                                                            <div className="mt-1 truncate font-game text-sm font-semibold uppercase tracking-[0.08em] text-slate-100">
                                                                {entry.label}
                                                            </div>
                                                            <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
                                                                <Clock3 size={12} />
                                                                {formatTime(entry.timestamp)}
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center gap-2">
                                                            <div className="rounded-full border border-rose-500/20 bg-rose-500/10 px-3 py-1 text-xs font-mono text-rose-100">
                                                                {entry.calories}
                                                            </div>
                                                            {isToday && (
                                                                <>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setEditingEntryId((current) => current === entry.id ? null : entry.id)}
                                                                        className="rounded-full border border-slate-700/60 bg-slate-900/70 p-2 text-slate-400 transition-colors hover:text-white"
                                                                    >
                                                                        <Edit3 size={13} />
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => onDeleteEntry(entry.id)}
                                                                        className="rounded-full border border-red-900/60 bg-red-950/30 p-2 text-red-400 transition-colors hover:text-red-200"
                                                                    >
                                                                        <Trash2 size={13} />
                                                                    </button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {isToday && editingEntryId === entry.id && (
                                                        <EntryEditor
                                                            entry={entry}
                                                            onCancel={() => setEditingEntryId(null)}
                                                            onSave={(updates) => {
                                                                onUpdateEntry(entry.id, updates);
                                                                setEditingEntryId(null);
                                                            }}
                                                        />
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {tab === 'foods' && (
                        <div className="space-y-4">
                            <div className="rounded-[28px] border border-rose-500/15 bg-black/35 p-4">
                                <div className="text-[10px] uppercase tracking-[0.28em] text-rose-400/65">Food Library</div>
                                <div className="mt-1 font-game text-lg font-semibold uppercase tracking-[0.08em] text-rose-50">
                                    Add Remembered Foods
                                </div>

                                <div className="mt-4 grid gap-3 sm:grid-cols-[1.4fr_0.8fr_auto]">
                                    <input
                                        type="text"
                                        value={newFoodName}
                                        onChange={(event) => setNewFoodName(event.target.value)}
                                        placeholder="Chicken wrap"
                                        className="rounded-2xl border border-slate-700/60 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition-colors focus:border-rose-400"
                                    />
                                    <input
                                        type="number"
                                        min="1"
                                        value={newFoodCalories}
                                        onChange={(event) => setNewFoodCalories(event.target.value)}
                                        placeholder="420"
                                        className="rounded-2xl border border-slate-700/60 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition-colors focus:border-rose-400"
                                    />
                                    <button
                                        type="button"
                                        disabled={!canCreateFood}
                                        onClick={handleCreateFood}
                                        className="rounded-2xl bg-rose-500 px-4 py-3 text-xs font-bold uppercase tracking-[0.18em] text-black disabled:cursor-not-allowed disabled:bg-rose-900/60 disabled:text-rose-200/50"
                                    >
                                        Save
                                    </button>
                                </div>
                            </div>

                            {savedFoods.length === 0 && (
                                <div className="rounded-3xl border border-dashed border-slate-700/60 bg-slate-900/40 px-6 py-12 text-center text-slate-400">
                                    Your food library is empty. Save a few regular meals here and the foods sector becomes much faster.
                                </div>
                            )}

                            {savedFoods.map((food) => (
                                <div key={food.id} className="rounded-[28px] border border-rose-500/15 bg-black/35 p-4">
                                    {editingFoodId === food.id ? (
                                        <SavedFoodEditor
                                            food={food}
                                            onCancel={() => setEditingFoodId(null)}
                                            onSave={(updates) => {
                                                onUpdateFood(food.id, updates);
                                                setEditingFoodId(null);
                                            }}
                                        />
                                    ) : (
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="text-[10px] uppercase tracking-[0.24em] text-rose-400/55">Remembered Food</div>
                                                <div className="mt-1 truncate font-game text-base font-semibold uppercase tracking-[0.08em] text-slate-100">
                                                    {food.name}
                                                </div>
                                                <div className="mt-2 text-xs text-slate-400">{food.calories} kcal</div>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => onQuickAddFood(food)}
                                                    className="rounded-full border border-rose-500/20 bg-rose-500/10 p-2 text-rose-100 transition-colors hover:bg-rose-500/20"
                                                >
                                                    <Plus size={14} />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setEditingFoodId(food.id)}
                                                    className="rounded-full border border-slate-700/60 bg-slate-900/70 p-2 text-slate-400 transition-colors hover:text-white"
                                                >
                                                    <Edit3 size={14} />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => onDeleteFood(food.id)}
                                                    className="rounded-full border border-red-900/60 bg-red-950/30 p-2 text-red-400 transition-colors hover:text-red-200"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </Motion.div>
        </div>
    );
};

const GoalSettingModal = ({ current, onConfirm, onClose }) => {
    const [value, setValue] = useState(current);

    return (
        <div className="fixed inset-0 z-[170] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
            <Motion.div
                initial={{ opacity: 0, scale: 0.95, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 12 }}
                onClick={(event) => event.stopPropagation()}
                className="w-full max-w-sm rounded-[28px] border border-rose-500/25 bg-slate-950 p-6 shadow-[0_0_50px_rgba(0,0,0,0.45)]"
            >
                <div className="text-[10px] uppercase tracking-[0.3em] text-rose-400/65">Target Configuration</div>
                <div className="mt-1 font-game text-xl font-semibold uppercase tracking-[0.08em] text-rose-50">
                    Daily Calorie Goal
                </div>

                <input
                    autoFocus
                    type="number"
                    min="1"
                    value={value}
                    onChange={(event) => setValue(event.target.value)}
                    className="mt-5 w-full rounded-2xl border border-rose-500/25 bg-black px-4 py-3 text-xl font-mono text-rose-50 outline-none transition-colors focus:border-rose-400"
                />

                <div className="mt-4 flex gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 rounded-2xl border border-slate-700/70 bg-slate-900/75 px-4 py-3 text-xs font-bold uppercase tracking-[0.2em] text-slate-300 transition-colors hover:text-white"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={() => onConfirm(Math.max(1, normalizeCalories(value)))}
                        className="flex-1 rounded-2xl bg-rose-500 px-4 py-3 text-xs font-bold uppercase tracking-[0.2em] text-black transition-colors hover:bg-rose-400"
                    >
                        Confirm
                    </button>
                </div>
            </Motion.div>
        </div>
    );
};

const RadialHub = ({ current, target, onClick }) => {
    const safeTarget = getSafeTarget(target);
    const percentage = Math.min((Number(current || 0) / safeTarget) * 100, 100);
    const isOverload = Number(current || 0) > safeTarget;
    const [bubbles] = useState(createBubbles);

    return (
        <Motion.button
            type="button"
            whileTap={{ scale: 0.985 }}
            onClick={onClick}
            className="group relative h-full w-full rounded-full"
            aria-label="Edit calorie goal"
        >
            <div className="absolute inset-0 rounded-full border-[8px] border-slate-800 bg-black/60 shadow-[0_0_50px_rgba(0,0,0,0.5)]" />

            <svg
                className="absolute inset-0 h-full w-full animate-spin-slow opacity-30 pointer-events-none"
                viewBox="0 0 100 100"
            >
                <circle cx="50" cy="50" r="48" fill="none" stroke="#be123c" strokeWidth="0.5" strokeDasharray="4 2" />
                <circle cx="50" cy="50" r="40" fill="none" stroke="#be123c" strokeWidth="0.2" strokeDasharray="10 10" />
            </svg>

            <div className="absolute inset-4 overflow-hidden rounded-full border border-rose-900/30 bg-slate-900">
                <div className="absolute inset-0 opacity-20 bg-[linear-gradient(rgba(244,63,94,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(244,63,94,0.1)_1px,transparent_1px)] bg-[size:20px_20px]" />

                <Motion.div
                    className={clsx(
                        'absolute bottom-0 left-0 right-0 w-full transition-colors duration-700 opacity-90',
                        isOverload
                            ? 'bg-gradient-to-t from-red-950 via-red-700 to-orange-500'
                            : 'bg-gradient-to-t from-rose-950 via-rose-700 to-rose-500'
                    )}
                    initial={{ height: '0%' }}
                    animate={{ height: `${percentage}%` }}
                    transition={{ type: 'spring', stiffness: 50, damping: 20 }}
                >
                    <div className="absolute top-0 left-0 right-0 h-4 -translate-y-1/2 bg-white/20 blur-sm" />

                    {bubbles.map((bubble) => (
                        <Motion.div
                            key={bubble.id}
                            className="absolute rounded-full bg-rose-200/20 blur-[1px]"
                            style={{ width: bubble.size, height: bubble.size, left: `${bubble.x}%` }}
                            animate={{ y: [-20, -300], opacity: [0, 1, 0] }}
                            transition={{
                                repeat: Infinity,
                                duration: bubble.duration,
                                delay: bubble.delay,
                                ease: 'linear'
                            }}
                        />
                    ))}
                </Motion.div>
            </div>

            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center px-4 text-center">
                <Motion.div
                    key={current}
                    initial={{ scale: 1.2, opacity: 0.5 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="font-mono text-5xl font-black tracking-tighter text-white"
                >
                    {current}
                </Motion.div>
                <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.3em] text-rose-200/80">
                    kCal Today
                </div>

                <div
                    className={clsx(
                        'mt-4 inline-flex items-center gap-2 rounded-full border px-3 py-1 backdrop-blur-md transition-colors',
                        isOverload
                            ? 'border-red-500/50 bg-red-950/80 text-red-500'
                            : 'border-rose-500/30 bg-black/40 text-rose-400'
                    )}
                >
                    {isOverload ? <AlertTriangle size={12} /> : <Activity size={12} />}
                    <span className="text-[10px] font-mono font-bold uppercase">
                        {isOverload ? 'CRITICAL LOAD' : 'SYSTEM STABLE'}
                    </span>
                </div>
            </div>

            <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-white/10 to-transparent pointer-events-none" />
        </Motion.button>
    );
};

const MemoryTile = ({ label, calories, subtitle, icon, tone = 'rose', onClick }) => {
    const toneStyles = {
        rose: 'border-rose-500/30 bg-rose-950/25 text-rose-100 hover:border-rose-400 hover:bg-rose-900/35',
        amber: 'border-amber-400/30 bg-amber-950/20 text-amber-50 hover:border-amber-300 hover:bg-amber-900/30',
        slate: 'border-slate-600/50 bg-slate-900/70 text-slate-100 hover:border-slate-400 hover:bg-slate-800'
    };

    return (
        <button
            type="button"
            onClick={onClick}
            className={clsx(
                'rounded-2xl border px-4 py-3 text-left transition-colors',
                toneStyles[tone]
            )}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-[0.24em] text-rose-300/55">{subtitle}</div>
                    <div className="mt-1 truncate font-game text-sm font-semibold uppercase tracking-[0.08em]">
                        {label}
                    </div>
                </div>
                <div className="shrink-0 text-current/70">{icon}</div>
            </div>
            <div className="mt-3 font-mono text-lg font-bold">{calories}</div>
        </button>
    );
};

const FoodsTray = ({
    savedFoods,
    recentItems,
    onClose,
    onQuickAddFood,
    onSelectRecent,
    onOpenManager
}) => (
    <Motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="w-full max-w-3xl rounded-[28px] border border-rose-500/20 bg-black/78 shadow-[0_0_40px_rgba(0,0,0,0.35)] backdrop-blur-xl"
    >
        <div className="mx-auto mt-2 h-1.5 w-20 rounded-full bg-rose-500/25" />

        <div className="flex items-center justify-between gap-3 px-4 pt-4 sm:px-5">
            <div>
                <div className="text-[10px] uppercase tracking-[0.28em] text-rose-400/65">Foods Sector</div>
                <div className="mt-1 font-game text-lg font-semibold uppercase tracking-[0.08em] text-rose-50">
                    Quick Add by Memory
                </div>
            </div>

            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={onOpenManager}
                    className="rounded-full border border-slate-700/60 bg-slate-900/70 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-200 transition-colors hover:text-white"
                >
                    Manage
                </button>
                <button
                    type="button"
                    onClick={onClose}
                    className="rounded-full border border-slate-700/60 bg-slate-900/80 p-2 text-slate-400 transition-colors hover:text-white"
                >
                    <X size={16} />
                </button>
            </div>
        </div>

        <div className="custom-scrollbar max-h-[60vh] overflow-y-auto px-4 pb-5 pt-4 sm:px-5">
            <div>
                <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="text-[10px] uppercase tracking-[0.24em] text-rose-300/55">Saved Foods</div>
                    <div className="text-[10px] uppercase tracking-[0.24em] text-slate-500">{savedFoods.length} stored</div>
                </div>

                {savedFoods.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-700/70 bg-slate-900/50 px-4 py-5 text-sm text-slate-400">
                        Save recurring foods from the manual injector or the food vault and they will land here.
                    </div>
                ) : (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {savedFoods.map((food) => (
                            <MemoryTile
                                key={food.id}
                                label={food.name}
                                calories={food.calories}
                                subtitle="Remembered Food"
                                icon={<BookOpen size={15} />}
                                tone="rose"
                                onClick={() => onQuickAddFood(food)}
                            />
                        ))}
                    </div>
                )}
            </div>

            <div className="mt-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="text-[10px] uppercase tracking-[0.24em] text-rose-300/55">Recents</div>
                    <div className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Fast repeat logging</div>
                </div>

                {recentItems.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-700/70 bg-slate-900/50 px-4 py-5 text-sm text-slate-400">
                        Named manual entries and recently used foods will collect here automatically.
                    </div>
                ) : (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {recentItems.map((item) => (
                            <MemoryTile
                                key={item.key}
                                label={item.label}
                                calories={item.calories}
                                subtitle={item.food ? 'Recent Food' : 'Recent Manual'}
                                icon={item.food ? <BookOpen size={15} /> : <Clock3 size={15} />}
                                tone={item.food ? 'slate' : 'amber'}
                                onClick={() => onSelectRecent(item)}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    </Motion.div>
);

const WheelSectorContent = ({ segment }) => (
    <div
        className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-1/2 text-center"
        style={{ ...getWheelPosition(segment.center, segment.radius), width: `${segment.width}%` }}
    >
        <div className={clsx('flex flex-col items-center', segment.compact ? 'gap-0.5' : 'gap-1', segment.interactive ? 'text-slate-100' : 'text-slate-200')}>
            <div className={clsx(
                'flex items-center justify-center',
                segment.tone === 'rose'
                    ? 'text-rose-300/70'
                    : segment.tone === 'amber'
                        ? 'text-amber-300/70'
                        : 'text-slate-500'
            )}>
                {segment.icon}
            </div>
            <div
                className={clsx(
                    'leading-none max-w-full truncate',
                    segment.kind === 'preset'
                        ? 'font-mono text-base font-black sm:text-lg'
                        : 'font-game text-[11px] font-semibold uppercase tracking-[0.08em] sm:text-xs'
                )}
            >
                {segment.primary}
            </div>
            {segment.secondary && (
                <div
                    className={clsx(
                        'max-w-full truncate text-[7px] font-bold uppercase sm:text-[8px] tracking-[0.16em]',
                        segment.interactive ? 'text-slate-500' : 'text-slate-600'
                    )}
                >
                    {segment.secondary}
                </div>
            )}
        </div>
    </div>
);

const SegmentedWheel = ({
    current,
    target,
    lastEntry,
    todayEntryCount,
    savedFoodsCount,
    remaining,
    overBy,
    isOverload,
    activeSector,
    onGoal,
    onPreset100,
    onPreset250,
    onManual,
    onFoods,
    onHistory
}) => {
    const percentToGoal = Math.min(Math.round((current / getSafeTarget(target)) * 100), 999);
    const latestTime = lastEntry ? formatTime(lastEntry.timestamp) : '--:--';
    const latestLabel = lastEntry ? shortenLabel(lastEntry.label, 8) : 'Idle';
    const summaryStatus = isOverload ? `+${overBy}` : `-${remaining}`;

    const segments = [
        {
            ...WHEEL_SEGMENTS[0],
            interactive: false,
            tone: 'slate',
            icon: <Clock3 size={12} />,
            primary: latestLabel,
            secondary: latestTime
        },
        {
            ...WHEEL_SEGMENTS[1],
            interactive: false,
            tone: 'slate',
            icon: isOverload ? <AlertTriangle size={12} /> : <Activity size={12} />,
            primary: `${percentToGoal}%`,
            secondary: 'Target'
        },
        {
            ...WHEEL_SEGMENTS[2],
            interactive: false,
            tone: 'slate',
            icon: <Flame size={12} />,
            primary: `${todayEntryCount} Log`,
            secondary: summaryStatus
        },
        {
            ...WHEEL_SEGMENTS[3],
            interactive: true,
            tone: 'slate',
            icon: <History size={15} />,
            primary: 'History',
            secondary: 'Archive',
            onClick: onHistory
        },
        {
            ...WHEEL_SEGMENTS[4],
            interactive: true,
            tone: 'slate',
            icon: <BookOpen size={15} />,
            primary: 'Foods',
            secondary: `${savedFoodsCount} saved`,
            onClick: onFoods
        },
        {
            ...WHEEL_SEGMENTS[5],
            interactive: true,
            tone: 'slate',
            icon: <Zap size={15} />,
            primary: 'Manual',
            secondary: 'Custom log',
            onClick: onManual
        },
        {
            ...WHEEL_SEGMENTS[6],
            interactive: true,
            tone: 'rose',
            kind: 'preset',
            icon: <Flame size={15} />,
            primary: '250',
            secondary: 'Inject',
            onClick: onPreset250
        },
        {
            ...WHEEL_SEGMENTS[7],
            interactive: true,
            tone: 'rose',
            kind: 'preset',
            icon: <Plus size={15} />,
            primary: '100',
            secondary: 'Inject',
            onClick: onPreset100
        }
    ];

    const getSegmentColors = (segment) => {
        const isActive = activeSector === segment.id;

        if (!segment.interactive) {
            return {
                fill: 'rgba(8, 13, 22, 0.94)',
                stroke: 'rgba(51, 65, 85, 0.22)'
            };
        }

        if (isActive) {
            if (segment.tone === 'rose') {
                return {
                    fill: 'rgba(44, 14, 24, 0.94)',
                    stroke: 'rgba(190, 24, 93, 0.4)'
                };
            }

            if (segment.tone === 'amber') {
                return {
                    fill: 'rgba(36, 24, 14, 0.94)',
                    stroke: 'rgba(180, 83, 9, 0.34)'
                };
            }

            return {
                fill: 'rgba(14, 20, 32, 0.96)',
                stroke: 'rgba(100, 116, 139, 0.28)'
            };
        }

        if (segment.tone === 'rose') {
            return {
                fill: 'rgba(24, 12, 18, 0.94)',
                stroke: 'rgba(136, 19, 55, 0.24)'
            };
        }

        if (segment.tone === 'amber') {
            return {
                fill: 'rgba(24, 18, 12, 0.94)',
                stroke: 'rgba(120, 53, 15, 0.22)'
            };
        }

        return {
            fill: 'rgba(10, 16, 26, 0.95)',
            stroke: 'rgba(71, 85, 105, 0.22)'
        };
    };

    const handleSectorKeyDown = (event, onClick) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onClick();
        }
    };

    return (
        <Motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative aspect-square w-full max-w-[34rem] sm:max-w-[38rem]"
        >
            <div className="absolute -inset-[18%] rounded-full bg-[radial-gradient(circle_at_center,rgba(190,24,93,0.18)_0%,rgba(127,29,29,0.12)_16%,rgba(30,15,23,0.07)_32%,transparent_58%)] blur-[72px]" />
            <div className="absolute -inset-[8%] rounded-full bg-[radial-gradient(circle_at_center,rgba(127,29,29,0.24)_0%,rgba(136,19,55,0.12)_18%,rgba(30,15,23,0.08)_32%,rgba(2,6,23,0.02)_52%,transparent_72%)] blur-3xl" />

            <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full drop-shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
                <circle cx="50" cy="50" r="49.2" fill="rgba(2,6,23,0.97)" stroke="rgba(15,23,42,0.92)" strokeWidth="1.4" />

                {segments.map((segment) => {
                    const visualStart = segment.start + 1.2;
                    const visualEnd = segment.end - 1.2;
                    const { fill, stroke } = getSegmentColors(segment);

                    return (
                        <path
                            key={segment.id}
                            d={describeDonutSlice(50, 50, 27.8, 47.6, visualStart, visualEnd)}
                            fill={fill}
                            stroke={stroke}
                            strokeWidth={segment.interactive && activeSector === segment.id ? 1.2 : 0.7}
                            className={clsx(
                                segment.interactive && 'cursor-pointer transition-[fill,stroke,filter] focus:outline-none focus-visible:outline-none focus-visible:stroke-rose-300 focus-visible:[filter:drop-shadow(0_0_6px_rgba(251,113,133,0.45))]'
                            )}
                            onClick={segment.interactive ? segment.onClick : undefined}
                            onMouseDown={segment.interactive ? (event) => event.preventDefault() : undefined}
                            onKeyDown={segment.interactive ? (event) => handleSectorKeyDown(event, segment.onClick) : undefined}
                            role={segment.interactive ? 'button' : undefined}
                            tabIndex={segment.interactive ? 0 : undefined}
                            aria-label={segment.interactive ? segment.primary : undefined}
                        />
                    );
                })}

                <circle cx="50" cy="50" r="47.8" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="0.45" />
                <circle cx="50" cy="50" r="28.2" fill="rgba(2,6,23,0.62)" stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />
            </svg>

            {segments.map((segment) => (
                <WheelSectorContent key={`${segment.id}-content`} segment={segment} />
            ))}

            <div className="absolute inset-[27%] z-20">
                <RadialHub current={current} target={target} onClick={onGoal} />
            </div>
        </Motion.div>
    );
};

const CalorieTracker = () => {
    const {
        calories,
        logCalories,
        updateCalorieEntry,
        deleteCalorieEntry,
        createSavedFood,
        updateSavedFood,
        deleteSavedFood,
        setCalorieGoal
    } = useGame();

    const todayKey = getTodayISO();
    const safeTarget = getSafeTarget(calories?.target);
    const currentCalories = Number(calories?.current || 0);
    const history = Array.isArray(calories?.history) ? calories.history : EMPTY_LIST;
    const rawSavedFoods = Array.isArray(calories?.savedFoods) ? calories.savedFoods : EMPTY_LIST;
    const recentFoodIds = Array.isArray(calories?.recentFoodIds) ? calories.recentFoodIds : EMPTY_LIST;
    const savedFoods = useMemo(
        () => [...rawSavedFoods].sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0)),
        [rawSavedFoods]
    );
    const isOverload = currentCalories > safeTarget;
    const remaining = Math.max(safeTarget - currentCalories, 0);
    const overBy = Math.max(currentCalories - safeTarget, 0);
    const todayEntries = useMemo(
        () => history.filter((entry) => entry.dateKey === todayKey).sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0)),
        [history, todayKey]
    );
    const entriesByDay = useMemo(() => groupEntriesByDay(history), [history]);
    const lastEntry = todayEntries[0] || history[history.length - 1] || null;

    const savedFoodsById = useMemo(() => {
        return new Map(savedFoods.map((food) => [food.id, food]));
    }, [savedFoods]);

    const recentManualItems = useMemo(() => {
        const seen = new Set();

        return [...history]
            .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0))
            .filter((entry) => entry.source !== 'saved-food')
            .filter((entry) => {
                const label = `${entry.label || ''}`.trim();
                if (!label || GENERIC_ENTRY_LABELS.has(label) || label.startsWith('Quick Add')) return false;
                const key = `${label.toLowerCase()}-${entry.calories}`;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            })
            .slice(0, 5)
            .map((entry) => ({
                key: `recent-manual-${entry.id}`,
                kind: 'manual',
                label: entry.label,
                calories: entry.calories
            }));
    }, [history]);

    const recentSavedFoods = useMemo(() => {
        return recentFoodIds
            .map((foodId) => savedFoodsById.get(foodId))
            .filter(Boolean)
            .slice(0, 5)
            .map((food) => ({
                key: `recent-food-${food.id}`,
                kind: 'food',
                label: food.name,
                calories: food.calories,
                food
            }));
    }, [recentFoodIds, savedFoodsById]);

    const recentItems = [...recentSavedFoods, ...recentManualItems].slice(0, 8);

    const [showGoalModal, setShowGoalModal] = useState(false);
    const [showVault, setShowVault] = useState(false);
    const [vaultTab, setVaultTab] = useState('entries');
    const [activeSheet, setActiveSheet] = useState(null);

    const handleQuickPreset = (amount) => {
        setActiveSheet(null);
        logCalories({
            calories: amount,
            label: `Quick Add ${amount}`,
            source: 'preset'
        });
    };

    const handleQuickFood = (food) => {
        setActiveSheet(null);
        logCalories({
            calories: food.calories,
            label: food.name,
            source: 'saved-food',
            foodId: food.id
        });
    };

    const handleRecentSelection = (item) => {
        if (item.food) {
            handleQuickFood(item.food);
            return;
        }

        setActiveSheet(null);
        logCalories({
            calories: item.calories,
            label: item.label,
            source: 'manual'
        });
    };

    const handleManualSubmit = ({ calories: amount, label }) => {
        if (`${label}`.trim()) {
            const food = createSavedFood({
                name: label,
                calories: amount
            });

            logCalories({
                calories: food.calories,
                label: food.name,
                source: 'saved-food',
                foodId: food.id
            });
            return;
        }

        logCalories({
            calories: amount,
            label: label || 'Manual Entry',
            source: 'manual'
        });
    };

    const toggleSheet = (sheetId) => {
        setActiveSheet((current) => current === sheetId ? null : sheetId);
    };

    const openHistory = () => {
        setActiveSheet(null);
        setVaultTab('entries');
        setShowVault(true);
    };

    const openFoodManager = () => {
        setActiveSheet(null);
        setVaultTab('foods');
        setShowVault(true);
    };

    const sheetPortal = typeof document !== 'undefined'
        ? createPortal(
            <AnimatePresence>
                {activeSheet === 'manual' && (
                    <div
                        className="fixed inset-0 z-[220] flex items-center justify-center bg-black/55 px-3 py-4 backdrop-blur-[3px] sm:px-4"
                        onClick={() => setActiveSheet(null)}
                        data-no-swipe="true"
                    >
                        <ManualEntryPanel
                            onClose={() => setActiveSheet(null)}
                            onSubmit={handleManualSubmit}
                        />
                    </div>
                )}

                {activeSheet === 'foods' && (
                    <div
                        className="pointer-events-none fixed inset-x-0 bottom-24 z-[220] flex justify-center px-3 sm:bottom-28 sm:px-4"
                        data-no-swipe="true"
                    >
                        <div className="pointer-events-auto w-full max-w-3xl">
                            <FoodsTray
                                savedFoods={savedFoods}
                                recentItems={recentItems}
                                onClose={() => setActiveSheet(null)}
                                onQuickAddFood={handleQuickFood}
                                onSelectRecent={handleRecentSelection}
                                onOpenManager={openFoodManager}
                            />
                        </div>
                    </div>
                )}
            </AnimatePresence>,
            document.body
        )
        : null;

    return (
        <>
            <div className="relative flex min-h-full flex-1 flex-col overflow-hidden bg-black text-rose-50">
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-0 bg-black" />
                <div className="absolute inset-[-12%] bg-[radial-gradient(circle_at_center,rgba(190,24,93,0.18)_0%,rgba(136,19,55,0.12)_14%,rgba(88,28,45,0.07)_24%,transparent_46%)] blur-[90px]" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(88,28,45,0.2)_0%,rgba(30,15,23,0.12)_16%,rgba(2,6,23,0.3)_30%,rgba(2,6,23,0.74)_50%,#000_76%)]" />
                <div className="absolute inset-0 opacity-[0.08] bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:50px_50px]" />
            </div>

            <div className="relative z-10 flex flex-1 items-center justify-center px-3 py-5 sm:px-5 sm:py-7">
                <div className="relative flex w-full max-w-5xl flex-1 items-center justify-center pb-20 sm:pb-24">
                    <SegmentedWheel
                        current={currentCalories}
                        target={safeTarget}
                        lastEntry={lastEntry}
                        todayEntryCount={todayEntries.length}
                        savedFoodsCount={savedFoods.length}
                        remaining={remaining}
                        overBy={overBy}
                        isOverload={isOverload}
                        activeSector={showVault ? 'history' : activeSheet}
                        onGoal={() => {
                            setActiveSheet(null);
                            setShowGoalModal(true);
                        }}
                        onPreset100={() => handleQuickPreset(100)}
                        onPreset250={() => handleQuickPreset(250)}
                        onManual={() => toggleSheet('manual')}
                        onFoods={() => toggleSheet('foods')}
                        onHistory={openHistory}
                    />
                </div>
            </div>

            <AnimatePresence>
                {showGoalModal && (
                    <GoalSettingModal
                        current={safeTarget}
                        onClose={() => setShowGoalModal(false)}
                        onConfirm={(value) => {
                            setCalorieGoal(value);
                            setShowGoalModal(false);
                        }}
                    />
                )}

                {showVault && (
                    <HistoryVaultModal
                        entriesByDay={entriesByDay}
                        todayKey={todayKey}
                        savedFoods={savedFoods}
                        initialTab={vaultTab}
                        onClose={() => setShowVault(false)}
                        onUpdateEntry={updateCalorieEntry}
                        onDeleteEntry={deleteCalorieEntry}
                        onQuickAddFood={handleQuickFood}
                        onCreateFood={createSavedFood}
                        onUpdateFood={updateSavedFood}
                        onDeleteFood={deleteSavedFood}
                    />
                )}
            </AnimatePresence>
            </div>
            {sheetPortal}
        </>
    );
};

export default CalorieTracker;
