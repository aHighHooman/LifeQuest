import React, { memo, startTransition, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useGameCalories } from '../context/GameContext';
import { AnimatePresence, motion as Motion, useDragControls, useReducedMotion } from 'framer-motion';
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
    Trash2,
    Zap
} from 'lucide-react';
import clsx from 'clsx';
import { getTodayISO, toLocalISOString } from '../utils/dateUtils';

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
const normalizeSignedCalories = (value) => Math.round(Number(value) || 0);
const getFoodTimestamp = (food) => Date.parse(food?.updatedAt || food?.createdAt || 0) || 0;
const preventNumberStepperKeys = (event) => {
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        event.preventDefault();
    }
};

let bodyScrollLockCount = 0;
let lockedScrollY = 0;
let previousBodyScrollStyles = null;
let previousDocumentScrollStyles = null;

const useBodyScrollLock = (isLocked = true) => {
    useEffect(() => {
        if (!isLocked || typeof document === 'undefined') return undefined;

        const { body, documentElement } = document;

        if (bodyScrollLockCount === 0) {
            lockedScrollY = window.scrollY;
            previousBodyScrollStyles = {
                overflow: body.style.overflow,
                position: body.style.position,
                top: body.style.top,
                left: body.style.left,
                right: body.style.right,
                width: body.style.width,
                overscrollBehavior: body.style.overscrollBehavior
            };
            previousDocumentScrollStyles = {
                overflow: documentElement.style.overflow,
                overscrollBehavior: documentElement.style.overscrollBehavior
            };

            body.style.overflow = 'hidden';
            body.style.position = 'fixed';
            body.style.top = `-${lockedScrollY}px`;
            body.style.left = '0';
            body.style.right = '0';
            body.style.width = '100%';
            body.style.overscrollBehavior = 'none';
            documentElement.style.overflow = 'hidden';
            documentElement.style.overscrollBehavior = 'none';
        }

        bodyScrollLockCount += 1;

        return () => {
            bodyScrollLockCount = Math.max(0, bodyScrollLockCount - 1);

            if (bodyScrollLockCount === 0) {
                body.style.overflow = previousBodyScrollStyles?.overflow || '';
                body.style.position = previousBodyScrollStyles?.position || '';
                body.style.top = previousBodyScrollStyles?.top || '';
                body.style.left = previousBodyScrollStyles?.left || '';
                body.style.right = previousBodyScrollStyles?.right || '';
                body.style.width = previousBodyScrollStyles?.width || '';
                body.style.overscrollBehavior = previousBodyScrollStyles?.overscrollBehavior || '';
                documentElement.style.overflow = previousDocumentScrollStyles?.overflow || '';
                documentElement.style.overscrollBehavior = previousDocumentScrollStyles?.overscrollBehavior || '';
                window.scrollTo(0, lockedScrollY);
            }
        };
    }, [isLocked]);
};

const useMobileLiteMode = () => {
    const prefersReducedMotion = useReducedMotion();
    const [isCoarsePointer, setIsCoarsePointer] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;

        const pointerQuery = window.matchMedia('(pointer: coarse)');
        const viewportQuery = window.matchMedia('(max-width: 767px)');
        const updateMode = () => {
            setIsCoarsePointer(pointerQuery.matches || viewportQuery.matches);
        };

        updateMode();
        pointerQuery.addEventListener('change', updateMode);
        viewportQuery.addEventListener('change', updateMode);

        return () => {
            pointerQuery.removeEventListener('change', updateMode);
            viewportQuery.removeEventListener('change', updateMode);
        };
    }, []);

    return prefersReducedMotion || isCoarsePointer;
};

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
    if (!history?.length) return EMPTY_LIST;

    const groupsByDate = new Map();

    for (let index = 0; index < history.length; index += 1) {
        const entry = history[index];
        const dateKey = entry.dateKey || getTodayISO();
        let group = groupsByDate.get(dateKey);

        if (!group) {
            group = {
                dateKey,
                entries: [],
                total: 0
            };
            groupsByDate.set(dateKey, group);
        }

        group.entries.push({ entry, index });
        group.total += Number(entry.calories || 0);
    }

    return Array.from(groupsByDate.values())
        .sort((a, b) => b.dateKey.localeCompare(a.dateKey))
        .map((group) => ({
            ...group,
            entries: group.entries
                .sort((a, b) => {
                    const aTime = Date.parse(a.entry.timestamp || '');
                    const bTime = Date.parse(b.entry.timestamp || '');

                    if (Number.isFinite(aTime) && Number.isFinite(bTime) && aTime !== bTime) {
                        return bTime - aTime;
                    }

                    if (Number.isFinite(aTime) !== Number.isFinite(bTime)) {
                        return Number.isFinite(bTime) ? 1 : -1;
                    }

                    return b.index - a.index;
                })
                .map(({ entry }) => entry)
        }));
};

const getTodayEntriesSnapshot = (history, todayKey) => {
    if (!history.length) {
        return {
            todayEntries: EMPTY_LIST,
            lastEntry: null
        };
    }

    const nextTodayEntries = [];
    const latestEntry = history[history.length - 1] || null;

    for (let index = history.length - 1; index >= 0; index -= 1) {
        const entry = history[index];
        if (entry.dateKey === todayKey) {
            nextTodayEntries.push(entry);
        }
    }

    return {
        todayEntries: nextTodayEntries,
        lastEntry: nextTodayEntries[0] || latestEntry
    };
};

const getYesterdayKey = (todayKey) => {
    const [year, month, day] = todayKey.split('-').map(Number);
    const yesterday = new Date(year, month - 1, day);
    yesterday.setDate(yesterday.getDate() - 1);
    return toLocalISOString(yesterday);
};

const isEditableEntryDate = (dateKey, todayKey, yesterdayKey) => (
    dateKey === todayKey || dateKey === yesterdayKey
);

const buildRecentManualItems = (history, limit = 5) => {
    if (!history.length) return EMPTY_LIST;

    const seen = new Set();
    const items = [];

    for (let index = history.length - 1; index >= 0 && items.length < limit; index -= 1) {
        const entry = history[index];

        if (entry.source === 'saved-food') continue;

        const label = `${entry.label || ''}`.trim();
        if (!label || GENERIC_ENTRY_LABELS.has(label) || label.startsWith('Quick Add')) continue;

        const key = `${label.toLowerCase()}-${entry.calories}`;
        if (seen.has(key)) continue;

        seen.add(key);
        items.push({
            key: `recent-manual-${entry.id}`,
            kind: 'manual',
            label: entry.label,
            calories: entry.calories
        });
    }

    return items;
};

const ManualEntryPanel = ({ onSubmit, onClose, liteMode = false }) => {
    const [calories, setCalories] = useState('');
    const [label, setLabel] = useState('');
    const [coinCost, setCoinCost] = useState('');
    const [bubbles] = useState(() => createBubbles().slice(0, 5));
    const [labelFocused, setLabelFocused] = useState(false);
    const [coinFocused, setCoinFocused] = useState(false);
    const labelInputRef = useRef(null);
    const manualArcId = useId();
    const labelArcId = useId();
    const costArcId = useId();
    const injectArcId = useId();

    const signedCalories = normalizeSignedCalories(calories);
    const canSubmit = signedCalories !== 0;
    const isExtracting = signedCalories < 0;
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
    const coinDisplay = normalizeCalories(coinCost) > 0 ? `${normalizeCalories(coinCost)} COINS` : 'COINS';
    const coinActive = coinFocused || normalizeCalories(coinCost) > 0;

    const handleSubmit = (event) => {
        event.preventDefault();
        if (!canSubmit) return;

        onSubmit({
            calories: signedCalories,
            label: `${label}`.trim(),
            coinCost: normalizeCalories(coinCost)
        });

        setCalories('');
        setLabel('');
        setCoinCost('');
        onClose();
    };

    return (
        <Motion.form
            initial={liteMode ? { opacity: 0, y: 10 } : { opacity: 0, scale: 0.88, y: 18 }}
            animate={liteMode ? { opacity: 1, y: 0 } : { opacity: 1, scale: 1, y: 0 }}
            exit={liteMode ? { opacity: 0, y: 10 } : { opacity: 0, scale: 0.92, y: 18 }}
            transition={liteMode ? { duration: 0.18, ease: 'easeOut' } : { type: 'spring', stiffness: 240, damping: 24 }}
            onSubmit={handleSubmit}
            onClick={(event) => event.stopPropagation()}
            className={clsx(
                'relative aspect-square w-[min(92vw,34rem)] max-w-[34rem] overflow-hidden rounded-full bg-[radial-gradient(circle_at_center,rgba(15,23,42,0.98)_0%,rgba(2,6,23,0.99)_56%,rgba(0,0,0,1)_100%)] shadow-[0_28px_80px_rgba(0,0,0,0.52)]',
                liteMode ? '' : 'backdrop-blur-xl'
            )}
        >
            <div className="absolute inset-0 rounded-full" />
            <div className="absolute inset-[4.5%] rounded-full" />
            <div className="absolute inset-[11%] rounded-full shadow-[inset_0_0_40px_rgba(15,23,42,0.8)]" />
            <div className="absolute inset-[8%] rounded-full opacity-[0.14] bg-[linear-gradient(rgba(244,63,94,0.16)_1px,transparent_1px),linear-gradient(90deg,rgba(244,63,94,0.16)_1px,transparent_1px)] bg-[size:18px_18px]" />
            {!liteMode && (
                <>
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
                </>
            )}

            <svg viewBox="0 0 100 100" className="pointer-events-none absolute inset-0 z-10 h-full w-full overflow-visible">
                <defs>
                    <path id={manualArcId} d={describeOpenArc(50, 50, 43.7, orbGeometry.topStart, orbGeometry.topEnd, 1)} />
                    <path id={labelArcId} d={describeOpenArc(50, 50, 33.1, orbGeometry.topStart, orbGeometry.topEnd, 1)} />
                    <path id={costArcId} d={describeOpenArc(50, 50, 33.1, 240, 300, 1)} />
                    <path id={injectArcId} d={describeOpenArc(50, 50, 33.4, orbGeometry.bottomEnd, orbGeometry.bottomStart, 0)} />
                </defs>

                <path
                    d={describeDonutSlice(50, 50, orbGeometry.innerInner, orbGeometry.innerOuter, orbGeometry.topStart, orbGeometry.topEnd)}
                    fill={labelFocused ? 'rgba(29, 16, 29, 0.94)' : label ? 'rgba(13, 17, 31, 0.95)' : 'rgba(7, 12, 24, 0.9)'}
                />
                <path
                    d={describeDonutSlice(50, 50, orbGeometry.innerInner, orbGeometry.innerOuter, 240, 300)}
                    fill={coinActive ? 'rgba(46, 30, 12, 0.94)' : 'rgba(10, 15, 26, 0.92)'}
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
                    fill={coinActive ? 'rgba(253,230,138,0.95)' : 'rgba(148,163,184,0.68)'}
                    fontSize="2.6"
                    fontWeight="700"
                    letterSpacing="0.1em"
                >
                    <textPath href={`#${costArcId}`} startOffset="50%" textAnchor="middle">
                        {coinDisplay}
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
                        {isExtracting ? 'EXTRACT ENTRY' : 'INJECT ENTRY'}
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

            <label className="absolute left-[8%] top-1/2 z-20 block h-[20%] w-[24%] -translate-y-1/2 cursor-text">
                <span className="sr-only">Coin cost</span>
                <input
                    type="number"
                    min="0"
                    step="1"
                    value={coinCost}
                    onChange={(event) => setCoinCost(event.target.value)}
                    onFocus={() => setCoinFocused(true)}
                    onBlur={() => setCoinFocused(false)}
                    onKeyDown={preventNumberStepperKeys}
                    className="h-full w-full cursor-text rounded-[999px] bg-transparent opacity-0 outline-none"
                    placeholder="0"
                    aria-label="Coin cost"
                />
            </label>

            <div className="absolute left-1/2 top-1/2 z-20 aspect-square w-[52%] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full bg-[radial-gradient(circle_at_center,rgba(17,24,39,0.98)_0%,rgba(8,12,24,0.98)_62%,rgba(2,6,23,1)_100%)] shadow-[inset_0_0_34px_rgba(0,0,0,0.65)]">
                <div className="absolute inset-[10%] rounded-full bg-white/[0.03]" />
                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:22px_22px] opacity-[0.08]" />

                {!liteMode && bubbles.map((bubble) => (
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
                        step="1"
                        value={calories}
                        onChange={(event) => setCalories(event.target.value)}
                        onKeyDown={preventNumberStepperKeys}
                        className="no-number-spinner mt-2 w-full bg-transparent text-center font-mono text-[clamp(2.8rem,8vw,4.3rem)] font-black tracking-[-0.08em] text-rose-50 outline-none placeholder:text-rose-200/20"
                        placeholder="240"
                        aria-label="Calories"
                    />
                    <div className="mt-1 text-[9px] uppercase tracking-[0.24em] text-slate-500">
                        {isExtracting ? 'Extract from today' : 'Inject into today'}
                    </div>
                </div>
            </div>

            <button
                type="submit"
                disabled={!canSubmit}
                className={clsx(
                    'absolute inset-x-[16%] bottom-[14%] z-20 h-[26%] focus:outline-none disabled:cursor-not-allowed',
                    canSubmit ? 'cursor-pointer' : 'cursor-not-allowed'
                )}
                aria-label={isExtracting ? 'Extract entry' : 'Inject entry'}
            >
                <span className="sr-only">{isExtracting ? 'Extract entry' : 'Inject entry'}</span>
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
                    step="1"
                    value={calories}
                    onChange={(event) => setCalories(event.target.value)}
                    onKeyDown={preventNumberStepperKeys}
                    className="no-number-spinner rounded-xl border border-slate-700/60 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none transition-colors focus:border-rose-400"
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
                    onClick={() => onSave({ label, calories: normalizeSignedCalories(calories) })}
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
    const [coinCost, setCoinCost] = useState(food?.coinCost || '');

    const canSave = `${name}`.trim().length > 0 && normalizeCalories(calories) > 0;

    return (
        <div className="rounded-2xl border border-rose-500/20 bg-black/40 p-3">
            <div className="grid gap-3 sm:grid-cols-[1.4fr_0.8fr_0.8fr]">
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
                    onKeyDown={preventNumberStepperKeys}
                    className="no-number-spinner rounded-xl border border-slate-700/60 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none transition-colors focus:border-rose-400"
                />
                <input
                    type="number"
                    min="0"
                    value={coinCost}
                    onChange={(event) => setCoinCost(event.target.value)}
                    placeholder="Coins"
                    onKeyDown={preventNumberStepperKeys}
                    className="no-number-spinner rounded-xl border border-amber-500/20 bg-slate-950/70 px-3 py-2 text-sm text-amber-100 outline-none transition-colors focus:border-amber-300"
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
                    onClick={() => onSave({ name, calories: normalizeCalories(calories), coinCost: normalizeCalories(coinCost) })}
                    className="flex-1 rounded-xl bg-rose-500 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-black disabled:cursor-not-allowed disabled:bg-rose-900/60 disabled:text-rose-200/50"
                >
                    Save
                </button>
            </div>
        </div>
    );
};

const HistoryVaultModal = memo(({
    entriesByDay,
    todayKey,
    yesterdayKey,
    savedFoods,
    mode = 'entries',
    selectionMode = null,
    onClose,
    onUpdateEntry,
    onDeleteEntry,
    onQuickAddFood,
    onSelectFood,
    onCreateFood,
    onUpdateFood,
    onDeleteFood,
    liteMode = false
}) => {
    const [editingEntryId, setEditingEntryId] = useState(null);
    const [editingFoodId, setEditingFoodId] = useState(null);
    const [newFoodName, setNewFoodName] = useState('');
    const [newFoodCalories, setNewFoodCalories] = useState('');
    const [newFoodCoinCost, setNewFoodCoinCost] = useState('');
    const dragControls = useDragControls();
    const scrollRef = useRef(null);
    const isFoodSelectionMode = mode === 'foods' && selectionMode?.startsWith('assign-');

    useBodyScrollLock(true);

    const canCreateFood = `${newFoodName}`.trim().length > 0 && normalizeCalories(newFoodCalories) > 0;

    const handleCreateFood = () => {
        if (!canCreateFood) return;
        onCreateFood({
            name: newFoodName,
            calories: normalizeCalories(newFoodCalories),
            coinCost: normalizeCalories(newFoodCoinCost)
        });
        setNewFoodName('');
        setNewFoodCalories('');
        setNewFoodCoinCost('');
    };

    if (typeof document === 'undefined') return null;

    return createPortal(
        <div
            className={clsx('fixed inset-0 z-[260] flex items-end justify-center bg-black/50', liteMode ? '' : 'backdrop-blur-[3px]')}
            onClick={onClose}
            data-no-swipe="true"
        >
            <Motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={liteMode ? { duration: 0.2, ease: 'easeOut' } : { type: 'spring', stiffness: 240, damping: 28 }}
                drag="y"
                dragListener={false}
                dragControls={dragControls}
                dragSnapToOrigin
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={{ top: 0, bottom: 0.18 }}
                onDragEnd={(_, info) => {
                    const isAtTop = (scrollRef.current?.scrollTop || 0) <= 0;
                    if (info.offset.y > 90 && isAtTop) {
                        onClose();
                    }
                }}
                className={clsx(
                    'flex h-[min(76svh,42rem)] w-full max-w-3xl flex-col overflow-hidden rounded-t-[28px] border border-rose-500/20 bg-black/82 shadow-[0_0_40px_rgba(0,0,0,0.35)] md:mb-6 md:h-[min(80vh,44rem)] md:rounded-[28px]',
                    liteMode ? '' : 'backdrop-blur-xl'
                )}
                onClick={(event) => event.stopPropagation()}
                data-no-swipe="true"
            >
                <div
                    className="flex cursor-grab justify-center border-b border-rose-500/12 px-4 pb-3 pt-3 active:cursor-grabbing"
                    onPointerDown={(event) => dragControls.start(event)}
                >
                    <div className="h-1.5 w-24 rounded-full bg-rose-400/30" />
                </div>

                <div className="border-b border-rose-500/15 bg-black/28 px-4 pb-4 pt-3 sm:px-5">
                    <div>
                        <div className="text-[10px] uppercase tracking-[0.3em] text-rose-400/65">Archive Console</div>
                        <div className="mt-1 font-game text-xl font-semibold uppercase tracking-[0.08em] text-rose-50">
                            {mode === 'foods' ? 'Food Vault' : 'Calorie Vault'}
                        </div>
                        <div className="mt-2 text-[10px] uppercase tracking-[0.24em] text-slate-500">
                            Drag the handle down to close
                        </div>
                    </div>
                </div>

                <div
                    ref={scrollRef}
                    className="custom-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 space-y-4 sm:px-5"
                    data-no-swipe="true"
                >
                    {mode === 'entries' && (
                        <div className="space-y-4">
                            {entriesByDay.length === 0 && (
                                <div className="rounded-3xl border border-dashed border-slate-700/60 bg-slate-900/40 px-6 py-12 text-center text-slate-400">
                                    No intake records yet.
                                </div>
                            )}

                            {entriesByDay.map((group) => {
                                const isToday = group.dateKey === todayKey;
                                const isEditable = isEditableEntryDate(group.dateKey, todayKey, yesterdayKey);

                                return (
                                    <div
                                        key={group.dateKey}
                                        className="rounded-[28px] border border-rose-500/15 bg-black/35 p-4"
                                        style={{ contentVisibility: 'auto', containIntrinsicSize: '420px' }}
                                    >
                                        <div className="flex items-center justify-between gap-4">
                                            <div>
                                                <div className="text-[10px] uppercase tracking-[0.28em] text-rose-400/65">
                                                    {isEditable ? (isToday ? 'Editable Today' : 'Editable Yesterday') : 'Read Only'}
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
                                                <div key={entry.id} className="rounded-2xl border border-slate-700/60 bg-slate-950/45 p-3">
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
                                                            {isEditable && (
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

                                                    {isEditable && editingEntryId === entry.id && (
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

                    {mode === 'foods' && (
                        <div className="space-y-4">
                            <div className="rounded-[28px] border border-rose-500/15 bg-black/35 p-4">
                                <div className="text-[10px] uppercase tracking-[0.28em] text-rose-400/65">Food Library</div>
                                <div className="mt-1 font-game text-lg font-semibold uppercase tracking-[0.08em] text-rose-50">
                                    Add Remembered Foods
                                </div>
                                {isFoodSelectionMode && (
                                    <div className="mt-2 text-[10px] uppercase tracking-[0.22em] text-slate-400">
                                        Tap any saved food below to bind it to the quick slot.
                                    </div>
                                )}

                                <div className="mt-4 grid gap-3 sm:grid-cols-[1.4fr_0.8fr_0.8fr_auto]">
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
                                    <input
                                        type="number"
                                        min="0"
                                        value={newFoodCoinCost}
                                        onChange={(event) => setNewFoodCoinCost(event.target.value)}
                                        placeholder="Coins"
                                        onKeyDown={preventNumberStepperKeys}
                                        className="rounded-2xl border border-amber-500/20 bg-slate-950/70 px-4 py-3 text-sm text-amber-100 outline-none transition-colors focus:border-amber-300"
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
                                <div
                                    key={food.id}
                                    className="rounded-[28px] border border-rose-500/15 bg-black/35 p-4"
                                    style={{ contentVisibility: 'auto', containIntrinsicSize: '120px' }}
                                >
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
                                            <button
                                                type="button"
                                                onClick={isFoodSelectionMode ? () => onSelectFood?.(food) : undefined}
                                                className={clsx(
                                                    'min-w-0 flex-1 text-left',
                                                    isFoodSelectionMode && 'transition-opacity hover:opacity-90'
                                                )}
                                            >
                                                <div className="text-[10px] uppercase tracking-[0.24em] text-rose-400/55">Remembered Food</div>
                                                <div className="mt-1 truncate font-game text-base font-semibold uppercase tracking-[0.08em] text-slate-100">
                                                    {food.name}
                                                </div>
                                                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                                                    <span>{food.calories} kcal</span>
                                                    {normalizeCalories(food.coinCost) > 0 && (
                                                        <span className="rounded-full border border-amber-500/20 bg-amber-950/25 px-2 py-0.5 text-[10px] font-mono uppercase tracking-[0.12em] text-amber-200">
                                                            {food.coinCost} coins
                                                        </span>
                                                    )}
                                                </div>
                                            </button>

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
        </div>,
        document.body
    );
});

const RadialHub = memo(({
    current,
    target,
    onClick,
    isEditing = false,
    editValue = '',
    onEditValueChange,
    onEditSubmit,
    liteMode = false
}) => {
    const safeTarget = getSafeTarget(target);
    const percentage = Math.min((Number(current || 0) / safeTarget) * 100, 100);
    const isOverload = Number(current || 0) > safeTarget;
    const inputRef = useRef(null);

    useEffect(() => {
        if (!isEditing) return;
        inputRef.current?.focus();
        inputRef.current?.select();
    }, [isEditing]);

    return (
        <Motion.div
            whileTap={liteMode ? undefined : { scale: 0.985 }}
            onClick={() => onClick?.()}
            onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onClick?.();
                }
            }}
            className="group relative h-full w-full rounded-full"
            role="button"
            tabIndex={0}
            aria-label={isEditing ? 'Editing calorie goal' : 'Edit calorie goal'}
        >
            <div className="absolute inset-0 rounded-full border-[2px] border-slate-800/80 bg-black/50 shadow-[0_0_40px_rgba(0,0,0,0.42)]" />

            <div className="absolute inset-[5px] overflow-hidden rounded-full border border-rose-900/30 bg-slate-900">
                <div className="absolute inset-0 opacity-20 bg-[linear-gradient(rgba(244,63,94,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(244,63,94,0.1)_1px,transparent_1px)] bg-[size:20px_20px]" />

                <Motion.div
                    className={clsx(
                        'absolute bottom-0 left-0 right-0 w-full transition-colors duration-700 opacity-90',
                        isOverload
                            ? 'bg-gradient-to-t from-[#180003] via-[#5a0812] to-[#c1273d]'
                            : 'bg-gradient-to-t from-[#120002] via-[#4f0915] to-[#b91c32]'
                    )}
                    initial={liteMode ? false : { height: '0%' }}
                    animate={{ height: `${percentage}%` }}
                    transition={liteMode ? { duration: 0.14, ease: 'easeOut' } : { type: 'spring', stiffness: 50, damping: 20 }}
                >
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(255,82,82,0.26)_0%,rgba(255,82,82,0.08)_28%,transparent_62%)] mix-blend-screen" />
                    {!liteMode && <div className="absolute top-0 left-0 right-0 h-4 -translate-y-1/2 bg-red-200/30 blur-sm" />}
                </Motion.div>
            </div>

            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center px-4 text-center">
                {isEditing ? (
                    <div
                        className="flex w-full max-w-[10rem] flex-col items-center"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <input
                            ref={inputRef}
                            type="number"
                            min="1"
                            value={editValue}
                            onChange={(event) => onEditValueChange?.(event.target.value)}
                            onKeyDown={(event) => {
                                preventNumberStepperKeys(event);

                                if (event.key === 'Enter') {
                                    event.preventDefault();
                                    onEditSubmit?.();
                                }

                                if (event.key === 'Escape') {
                                    event.preventDefault();
                                    inputRef.current?.blur();
                                }
                            }}
                            className="no-number-spinner w-full bg-transparent px-0 py-0 text-center font-mono text-5xl font-black tracking-tighter text-white outline-none"
                        />
                        <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.3em] text-rose-200/80">
                            Target kCal
                        </div>
                    </div>
                ) : (
                    <>
                        {liteMode ? (
                            <div className="font-mono text-5xl font-black tracking-tighter text-white">
                                {current}
                            </div>
                        ) : (
                            <Motion.div
                                key={current}
                                initial={{ scale: 1.2, opacity: 0.5 }}
                                animate={{ scale: 1, opacity: 1 }}
                                className="font-mono text-5xl font-black tracking-tighter text-white"
                            >
                                {current}
                            </Motion.div>
                        )}
                        <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.3em] text-rose-200/80">
                            kCal Today
                        </div>

                        <div
                            className={clsx(
                                'mt-4 inline-flex items-center gap-2 px-1 py-1 transition-colors drop-shadow-[0_0_14px_rgba(2,6,23,0.95)]',
                                isOverload
                                    ? 'text-red-300'
                                    : 'text-rose-200'
                            )}
                        >
                            {isOverload ? <AlertTriangle size={12} /> : <Activity size={12} />}
                            <span className="text-[10px] font-mono font-bold uppercase">
                                {isOverload ? 'CRITICAL LOAD' : 'SYSTEM STABLE'}
                            </span>
                        </div>
                    </>
                )}
            </div>

            <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-white/10 to-transparent pointer-events-none" />
        </Motion.div>
    );
});

const MemoryTile = memo(({ label, calories, subtitle, icon, tone = 'rose', onClick }) => {
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
});

const FoodsTray = memo(({
    savedFoods,
    recentItems,
    onClose,
    onQuickAddFood,
    onSelectRecent,
    onOpenManager,
    selectionMode = null,
    onSelectFood,
    liteMode = false
}) => {
    const dragControls = useDragControls();
    const scrollRef = useRef(null);
    const isFoodSelectionMode = selectionMode?.startsWith('assign-');

    useBodyScrollLock(true);

    return (
        <Motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={liteMode ? { duration: 0.2, ease: 'easeOut' } : { type: 'spring', stiffness: 240, damping: 28 }}
            drag="y"
            dragListener={false}
            dragControls={dragControls}
            dragSnapToOrigin
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.18 }}
            onDragEnd={(_, info) => {
                const isAtTop = (scrollRef.current?.scrollTop || 0) <= 0;
                if (info.offset.y > 85 && isAtTop) {
                    onClose();
                }
            }}
            className={clsx(
                'flex h-[min(76svh,42rem)] w-full max-w-3xl flex-col overflow-hidden rounded-t-[28px] border border-rose-500/20 bg-black/82 shadow-[0_0_40px_rgba(0,0,0,0.35)] md:mb-6 md:h-[min(80vh,44rem)] md:rounded-[28px]',
                liteMode ? '' : 'backdrop-blur-xl'
            )}
            data-no-swipe="true"
        >
            <div
                className="flex cursor-grab justify-center border-b border-rose-500/12 px-4 pb-3 pt-3 active:cursor-grabbing"
                onPointerDown={(event) => dragControls.start(event)}
            >
                <div className="h-1.5 w-24 rounded-full bg-rose-400/30" />
            </div>

            <div className="flex items-start justify-between gap-3 px-4 pb-4 pt-3 sm:px-5">
                <div>
                    <div className="text-[10px] uppercase tracking-[0.28em] text-rose-400/65">
                        {isFoodSelectionMode ? 'Quick Slot Link' : 'Foods Sector'}
                    </div>
                    <div className="mt-1 font-game text-lg font-semibold uppercase tracking-[0.08em] text-rose-50">
                        {isFoodSelectionMode ? 'Bind a Saved Meal' : 'Quick Add by Memory'}
                    </div>
                    {isFoodSelectionMode && (
                        <div className="mt-2 text-[10px] uppercase tracking-[0.22em] text-slate-400">
                            Pick a saved food for this quick slot.
                        </div>
                    )}
                </div>

                <button
                    type="button"
                    onClick={onOpenManager}
                    className="rounded-full border border-slate-700/60 bg-slate-900/70 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-200 transition-colors hover:text-white"
                >
                    Manage
                </button>
            </div>

            <div
                ref={scrollRef}
                className="custom-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-1 sm:px-5"
                data-no-swipe="true"
            >
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
                                    onClick={() => {
                                        if (isFoodSelectionMode) {
                                            onSelectFood?.(food);
                                            return;
                                        }

                                        onQuickAddFood(food);
                                    }}
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
});

const WheelSectorContent = memo(({ segment, hidden = false }) => (
    <div
        className={clsx(
            'pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-1/2 text-center transition-opacity duration-200',
            hidden ? 'opacity-0' : 'opacity-100'
        )}
        aria-hidden={hidden}
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
                        : segment.kind === 'food-slot'
                            ? 'font-game text-[10px] font-semibold uppercase tracking-[0.06em] sm:text-[11px]'
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
));

const SegmentedWheel = memo(({
    current,
    target,
    lastEntry,
    savedFoodsCount,
    preset100Food = null,
    preset250Food = null,
    preset400Food = null,
    preset550Food = null,
    activeSector,
    onGoal,
    isHeroEditing = false,
    heroEditValue = '',
    onHeroEditValueChange,
    onHeroEditSubmit,
    onPreset100,
    onPreset250,
    onPreset400,
    onPreset550,
    onManual,
    onFoodsMenu,
    onHistoryMenu,
    liteMode = false
}) => {
    const latestTime = lastEntry ? formatTime(lastEntry.timestamp) : '--:--';
    const latestLabel = lastEntry ? shortenLabel(lastEntry.label, 8) : 'Idle';

    const segments = useMemo(() => ([
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
            interactive: true,
            tone: 'slate',
            icon: <BookOpen size={15} />,
            primary: 'Foods',
            secondary: `${savedFoodsCount} saved`,
            onClick: onFoodsMenu
        },
        {
            ...WHEEL_SEGMENTS[2],
            interactive: true,
            tone: 'slate',
            icon: <History size={15} />,
            primary: 'History',
            secondary: 'Archive',
            onClick: onHistoryMenu
        },
        {
            ...WHEEL_SEGMENTS[3],
            interactive: true,
            tone: 'rose',
            kind: preset400Food ? 'food-slot' : 'preset',
            icon: <Flame size={15} />,
            primary: preset400Food ? shortenLabel(preset400Food.name, 9) : '400',
            secondary: 'Inject',
            editInteractive: true,
            onClick: onPreset400
        },
        {
            ...WHEEL_SEGMENTS[4],
            interactive: true,
            tone: 'rose',
            kind: preset550Food ? 'food-slot' : 'preset',
            icon: <Plus size={15} />,
            primary: preset550Food ? shortenLabel(preset550Food.name, 9) : '550',
            secondary: 'Inject',
            editInteractive: true,
            onClick: onPreset550
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
            kind: preset250Food ? 'food-slot' : 'preset',
            icon: <Flame size={15} />,
            primary: preset250Food ? shortenLabel(preset250Food.name, 9) : '250',
            secondary: 'Inject',
            editInteractive: true,
            onClick: onPreset250
        },
        {
            ...WHEEL_SEGMENTS[7],
            interactive: true,
            tone: 'rose',
            kind: preset100Food ? 'food-slot' : 'preset',
            icon: <Plus size={15} />,
            primary: preset100Food ? shortenLabel(preset100Food.name, 9) : '100',
            secondary: 'Inject',
            editInteractive: true,
            onClick: onPreset100
        }
    ]), [
        latestLabel,
        latestTime,
        onManual,
        onPreset100,
        onPreset250,
        onPreset400,
        onPreset550,
        onFoodsMenu,
        onHistoryMenu,
        preset100Food,
        preset250Food,
        preset400Food,
        preset550Food,
        savedFoodsCount
    ]);

    const getSegmentColors = (segment) => {
        const isActive = activeSector === segment.id;

        const keepQuickSlotTone = segment.editInteractive;

        if (!segment.interactive || (isHeroEditing && !keepQuickSlotTone)) {
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
            initial={liteMode ? false : { opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={liteMode ? { duration: 0.12 } : undefined}
            className="relative aspect-square w-full max-w-[34rem] sm:max-w-[38rem]"
        >
            {!liteMode && <div className="absolute -inset-[18%] rounded-full bg-[radial-gradient(circle_at_center,rgba(190,24,93,0.18)_0%,rgba(127,29,29,0.12)_16%,rgba(30,15,23,0.07)_32%,transparent_58%)] blur-[72px]" />}
            {!liteMode && <div className="absolute -inset-[8%] rounded-full bg-[radial-gradient(circle_at_center,rgba(127,29,29,0.24)_0%,rgba(136,19,55,0.12)_18%,rgba(30,15,23,0.08)_32%,rgba(2,6,23,0.02)_52%,transparent_72%)] blur-3xl" />}

            <svg viewBox="0 0 100 100" className={clsx('absolute inset-0 h-full w-full', liteMode ? '' : 'drop-shadow-[0_30px_80px_rgba(0,0,0,0.45)]')}>
                <circle cx="50" cy="50" r="49.2" fill="rgba(2,6,23,0.97)" stroke="rgba(15,23,42,0.92)" strokeWidth="1.4" />

                {segments.map((segment) => {
                    const { fill, stroke } = getSegmentColors(segment);

                    return (
                        <path
                            key={segment.id}
                            d={describeDonutSlice(50, 50, 27.8, 47.6, segment.start, segment.end)}
                            fill={fill}
                            stroke={stroke}
                            strokeWidth={segment.interactive && activeSector === segment.id ? 1.2 : 0.7}
                            className={clsx(
                                segment.interactive && (!isHeroEditing || segment.editInteractive) && 'cursor-pointer transition-[fill,stroke,filter] focus:outline-none focus-visible:outline-none focus-visible:stroke-rose-300 focus-visible:[filter:drop-shadow(0_0_6px_rgba(251,113,133,0.45))]'
                            )}
                            onClick={segment.interactive && (!isHeroEditing || segment.editInteractive) ? segment.onClick : undefined}
                            onMouseDown={segment.interactive && (!isHeroEditing || segment.editInteractive) ? (event) => event.preventDefault() : undefined}
                            onKeyDown={segment.interactive && (!isHeroEditing || segment.editInteractive) ? (event) => handleSectorKeyDown(event, segment.onClick) : undefined}
                            role={segment.interactive && (!isHeroEditing || segment.editInteractive) ? 'button' : undefined}
                            tabIndex={segment.interactive && (!isHeroEditing || segment.editInteractive) ? 0 : undefined}
                            aria-label={segment.interactive && (!isHeroEditing || segment.editInteractive) ? segment.primary : undefined}
                        />
                    );
                })}

                <circle cx="50" cy="50" r="47.8" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="0.45" />
                <circle cx="50" cy="50" r="28.2" fill="rgba(2,6,23,0.62)" stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />
            </svg>

            {segments.map((segment) => (
                <WheelSectorContent key={`${segment.id}-content`} segment={segment} hidden={isHeroEditing} />
            ))}

            <div className="absolute inset-[23.9%] z-20 sm:inset-[24.4%]">
                <RadialHub
                    current={current}
                    target={target}
                    onClick={onGoal}
                    isEditing={isHeroEditing}
                    editValue={heroEditValue}
                    onEditValueChange={onHeroEditValueChange}
                    onEditSubmit={onHeroEditSubmit}
                    liteMode={liteMode}
                />
            </div>
        </Motion.div>
    );
});

const CalorieTracker = () => {
    const {
        calories,
        logCalories,
        updateCalorieEntry,
        deleteCalorieEntry,
        createSavedFood,
        updateSavedFood,
        deleteSavedFood,
        setCalorieGoal,
        assignQuickSlotFood,
        spendCoins
    } = useGameCalories();

    const todayKey = getTodayISO();
    const yesterdayKey = useMemo(() => getYesterdayKey(todayKey), [todayKey]);
    const safeTarget = getSafeTarget(calories?.target);
    const currentCalories = Number(calories?.current || 0);
    const history = Array.isArray(calories?.history) ? calories.history : EMPTY_LIST;
    const rawSavedFoods = Array.isArray(calories?.savedFoods) ? calories.savedFoods : EMPTY_LIST;
    const recentFoodIds = Array.isArray(calories?.recentFoodIds) ? calories.recentFoodIds : EMPTY_LIST;
    const savedFoodsCount = rawSavedFoods.length;
    const isOverload = currentCalories > safeTarget;
    const remaining = Math.max(safeTarget - currentCalories, 0);
    const overBy = Math.max(currentCalories - safeTarget, 0);

    const [showVault, setShowVault] = useState(false);
    const [vaultTab, setVaultTab] = useState('entries');
    const [activeSheet, setActiveSheet] = useState(null);
    const [isHeroEditing, setIsHeroEditing] = useState(false);
    const [heroEditValue, setHeroEditValue] = useState(() => `${safeTarget}`);
    const [foodPickerTarget, setFoodPickerTarget] = useState(null);
    const liteMode = useMobileLiteMode();

    const isFoodsTrayOpen = activeSheet === 'foods';
    const shouldPrepareSavedFoods = showVault || isFoodsTrayOpen;

    const { lastEntry } = useMemo(() => getTodayEntriesSnapshot(history, todayKey), [history, todayKey]);

    const savedFoods = useMemo(() => {
        if (!shouldPrepareSavedFoods) return EMPTY_LIST;
        return [...rawSavedFoods].sort((a, b) => getFoodTimestamp(b) - getFoodTimestamp(a));
    }, [rawSavedFoods, shouldPrepareSavedFoods]);

    const entriesByDay = useMemo(() => {
        if (!showVault) return EMPTY_LIST;
        return groupEntriesByDay(history);
    }, [history, showVault]);

    const savedFoodsById = useMemo(() => new Map(rawSavedFoods.map((food) => [food.id, food])), [rawSavedFoods]);
    const quickSlots = calories?.quickSlots || {};
    const preset100Food = quickSlots.preset100 ? savedFoodsById.get(quickSlots.preset100) || null : null;
    const preset250Food = quickSlots.preset250 ? savedFoodsById.get(quickSlots.preset250) || null : null;
    const preset400Food = quickSlots.preset400 ? savedFoodsById.get(quickSlots.preset400) || null : null;
    const preset550Food = quickSlots.preset550 ? savedFoodsById.get(quickSlots.preset550) || null : null;
    const recentManualItems = useMemo(() => buildRecentManualItems(history), [history]);

    const recentItems = useMemo(() => {
        if (!isFoodsTrayOpen) return EMPTY_LIST;

        const recentSavedFoods = recentFoodIds
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

        return [...recentSavedFoods, ...recentManualItems].slice(0, 8);
    }, [isFoodsTrayOpen, recentFoodIds, recentManualItems, savedFoodsById]);

    const handleQuickPreset = useCallback((amount) => {
        setActiveSheet(null);
        logCalories({
            calories: amount,
            label: `Quick Add ${amount}`,
            source: 'preset'
        });
    }, [logCalories]);

    const handleQuickFood = useCallback((food) => {
        setActiveSheet(null);
        if (normalizeCalories(food?.coinCost) > 0) {
            spendCoins(normalizeCalories(food.coinCost), `Food inject: ${food.name}`);
        }
        logCalories({
            calories: food.calories,
            label: food.name,
            source: 'saved-food',
            foodId: food.id,
            coinCost: normalizeCalories(food.coinCost)
        });
    }, [logCalories, spendCoins]);

    const handleQuickSlotFoodSelect = useCallback((food) => {
        if (foodPickerTarget) {
            assignQuickSlotFood(foodPickerTarget, food.id);
        }

        setActiveSheet(null);
        setShowVault(false);
        setFoodPickerTarget(null);
    }, [assignQuickSlotFood, foodPickerTarget]);

    const handleRecentSelection = useCallback((item) => {
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
    }, [handleQuickFood, logCalories]);

    const handleManualSubmit = useCallback(({ calories: amount, label, coinCost = 0 }) => {
        if (`${label}`.trim() && amount > 0) {
            const food = createSavedFood({
                name: label,
                calories: amount,
                coinCost
            });

            if (normalizeCalories(food.coinCost) > 0) {
                spendCoins(normalizeCalories(food.coinCost), `Food inject: ${food.name}`);
            }
            logCalories({
                calories: food.calories,
                label: food.name,
                source: 'saved-food',
                foodId: food.id,
                coinCost: normalizeCalories(food.coinCost)
            });
            return;
        }

        if (normalizeCalories(coinCost) > 0 && amount > 0) {
            spendCoins(normalizeCalories(coinCost), `Manual inject: ${label || 'Unnamed item'}`);
        }
        logCalories({
            calories: amount,
            label: label || (amount < 0 ? 'Exercise Burn' : 'Manual Entry'),
            source: 'manual',
            coinCost: amount > 0 ? normalizeCalories(coinCost) : 0
        });
    }, [createSavedFood, logCalories, spendCoins]);

    const toggleSheet = useCallback((sheetId) => {
        startTransition(() => {
            setActiveSheet((current) => current === sheetId ? null : sheetId);
        });
    }, []);

    const openHistory = useCallback(() => {
        setActiveSheet(null);
        setFoodPickerTarget(null);
        setVaultTab('entries');
        startTransition(() => {
            setShowVault(true);
        });
    }, []);

    const handleQuickPreset400 = useCallback(() => {
        if (isHeroEditing) {
            setFoodPickerTarget('preset400');
            setActiveSheet('foods');
            return;
        }

        if (preset400Food) {
            handleQuickFood(preset400Food);
            return;
        }

        handleQuickPreset(400);
    }, [handleQuickFood, handleQuickPreset, isHeroEditing, preset400Food]);

    const openFoodManager = useCallback(() => {
        if (isHeroEditing && !foodPickerTarget) return;
        setActiveSheet(null);
        setVaultTab('foods');
        startTransition(() => {
            setShowVault(true);
        });
    }, [foodPickerTarget, isHeroEditing]);

    const handleHeroPress = useCallback(() => {
        if (isHeroEditing) {
            const nextGoal = Math.max(1, normalizeCalories(heroEditValue));
            setCalorieGoal(nextGoal);
            setHeroEditValue(`${nextGoal}`);
            setActiveSheet(null);
            setShowVault(false);
            setFoodPickerTarget(null);
            setIsHeroEditing(false);
            return;
        }

        setActiveSheet(null);
        setShowVault(false);
        setFoodPickerTarget(null);
        setHeroEditValue(`${safeTarget}`);
        startTransition(() => {
            setIsHeroEditing(true);
        });
    }, [heroEditValue, isHeroEditing, safeTarget, setCalorieGoal]);

    const submitHeroEdit = useCallback(() => {
        const nextGoal = Math.max(1, normalizeCalories(heroEditValue));
        setCalorieGoal(nextGoal);
        setHeroEditValue(`${nextGoal}`);
        setFoodPickerTarget(null);
        setIsHeroEditing(false);
    }, [heroEditValue, setCalorieGoal]);

    const handleQuickPreset100 = useCallback(() => {
        if (isHeroEditing) {
            setFoodPickerTarget('preset100');
            setActiveSheet('foods');
            return;
        }

        if (preset100Food) {
            handleQuickFood(preset100Food);
            return;
        }

        handleQuickPreset(100);
    }, [handleQuickFood, handleQuickPreset, isHeroEditing, preset100Food]);

    const handleQuickPreset250 = useCallback(() => {
        if (isHeroEditing) {
            setFoodPickerTarget('preset250');
            setActiveSheet('foods');
            return;
        }

        if (preset250Food) {
            handleQuickFood(preset250Food);
            return;
        }

        handleQuickPreset(250);
    }, [handleQuickFood, handleQuickPreset, isHeroEditing, preset250Food]);

    const openManualSheet = useCallback(() => {
        if (isHeroEditing) return;
        toggleSheet('manual');
    }, [isHeroEditing, toggleSheet]);

    const openFoodsSheet = useCallback(() => {
        setFoodPickerTarget(null);
        toggleSheet('foods');
    }, [toggleSheet]);

    const handleQuickPreset550 = useCallback(() => {
        if (isHeroEditing) {
            setFoodPickerTarget('preset550');
            setActiveSheet('foods');
            return;
        }

        if (preset550Food) {
            handleQuickFood(preset550Food);
            return;
        }

        handleQuickPreset(550);
    }, [handleQuickFood, handleQuickPreset, isHeroEditing, preset550Food]);

    const sheetPortal = typeof document !== 'undefined'
        ? createPortal(
            <AnimatePresence>
                {activeSheet === 'manual' && (
                    <div
                        className={clsx('fixed inset-0 z-[220] flex items-center justify-center bg-black/55 px-3 py-4 sm:px-4', liteMode ? '' : 'backdrop-blur-[3px]')}
                        onClick={() => setActiveSheet(null)}
                        data-no-swipe="true"
                    >
                        <ManualEntryPanel
                            liteMode={liteMode}
                            onClose={() => setActiveSheet(null)}
                            onSubmit={handleManualSubmit}
                        />
                    </div>
                )}

                {activeSheet === 'foods' && (
                    <div
                        className={clsx('fixed inset-0 z-[240] flex items-end justify-center bg-black/45 px-0 sm:px-4', liteMode ? '' : 'backdrop-blur-[3px]')}
                        onClick={() => setActiveSheet(null)}
                        data-no-swipe="true"
                    >
                        <div className="w-full" onClick={(event) => event.stopPropagation()}>
                            <FoodsTray
                                liteMode={liteMode}
                                savedFoods={savedFoods}
                                recentItems={recentItems}
                                onClose={() => setActiveSheet(null)}
                                onQuickAddFood={handleQuickFood}
                                onSelectRecent={handleRecentSelection}
                                onOpenManager={openFoodManager}
                                selectionMode={foodPickerTarget ? `assign-${foodPickerTarget}` : null}
                                onSelectFood={handleQuickSlotFoodSelect}
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
                {!liteMode && <div className="absolute inset-[-12%] bg-[radial-gradient(circle_at_center,rgba(190,24,93,0.18)_0%,rgba(136,19,55,0.12)_14%,rgba(88,28,45,0.07)_24%,transparent_46%)] blur-[90px]" />}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(88,28,45,0.2)_0%,rgba(30,15,23,0.12)_16%,rgba(2,6,23,0.3)_30%,rgba(2,6,23,0.74)_50%,#000_76%)]" />
                <div className="absolute inset-0 opacity-[0.08] bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:50px_50px]" />
            </div>

            <div className="relative z-10 flex flex-1 items-center justify-center px-3 py-5 sm:px-5 sm:py-7">
                <div className="relative flex w-full max-w-5xl flex-1 items-center justify-center pb-20 sm:pb-24">
                    <SegmentedWheel
                        liteMode={liteMode}
                        current={currentCalories}
                        target={safeTarget}
                        lastEntry={lastEntry}
                        savedFoodsCount={savedFoodsCount}
                        preset100Food={preset100Food}
                        preset250Food={preset250Food}
                        preset400Food={preset400Food}
                        preset550Food={preset550Food}
                        remaining={remaining}
                        overBy={overBy}
                        isOverload={isOverload}
                        activeSector={
                            isHeroEditing
                                ? (
                                    foodPickerTarget === 'preset100'
                                        ? 'preset-100'
                                        : foodPickerTarget === 'preset250'
                                            ? 'preset-250'
                                            : foodPickerTarget === 'preset400'
                                                ? 'history'
                                                : foodPickerTarget === 'preset550'
                                                    ? 'foods'
                                            : null
                                )
                                : (
                                    showVault
                                        ? (vaultTab === 'foods' ? 'progress' : 'summary')
                                        : activeSheet === 'foods'
                                            ? 'progress'
                                            : activeSheet
                                )
                        }
                        onGoal={handleHeroPress}
                        isHeroEditing={isHeroEditing}
                        heroEditValue={heroEditValue}
                        onHeroEditValueChange={setHeroEditValue}
                        onHeroEditSubmit={submitHeroEdit}
                        onPreset100={handleQuickPreset100}
                        onPreset250={handleQuickPreset250}
                        onPreset400={handleQuickPreset400}
                        onPreset550={handleQuickPreset550}
                        onManual={openManualSheet}
                        onFoodsMenu={openFoodsSheet}
                        onHistoryMenu={openHistory}
                    />
                </div>
            </div>

            <AnimatePresence>
                {showVault && (
                    <HistoryVaultModal
                        liteMode={liteMode}
                        entriesByDay={entriesByDay}
                        todayKey={todayKey}
                        yesterdayKey={yesterdayKey}
                        savedFoods={savedFoods}
                        mode={vaultTab}
                        onClose={() => setShowVault(false)}
                        selectionMode={foodPickerTarget ? `assign-${foodPickerTarget}` : null}
                        onUpdateEntry={updateCalorieEntry}
                        onDeleteEntry={deleteCalorieEntry}
                        onQuickAddFood={handleQuickFood}
                        onSelectFood={handleQuickSlotFoodSelect}
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
