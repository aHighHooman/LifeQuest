import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { useBudget } from '../context/BudgetContext';
import {
    Plus,
    Trash2,
    CheckCircle2,
    Circle,
    ShoppingCart,
    Settings,
    Coins,
    CreditCard,
    ArrowRightLeft,
    X,
    Database
} from 'lucide-react';
import { useGame } from '../context/GameContext';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { getTodayISO } from '../utils/dateUtils';

// Constants
const TAB_PROVISIONS = 'provisions';
const TAB_LEDGER = 'ledger';
const COIN_HOLD_DURATION_MS = 980;
const COIN_DEPTH_LAYERS = [4, 3, 2, 1, 0, -1, -2, -3, -4];

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const mulberry32 = (seed) => {
    let value = seed >>> 0;

    return () => {
        value += 0x6D2B79F5;
        let t = value;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
};

const isInsideCoin = (point) => {
    const dx = point.x - 50;
    const dy = point.y - 50;
    return Math.hypot(dx, dy) <= 46;
};

const pullToCoinEdge = (point) => {
    const dx = point.x - 50;
    const dy = point.y - 50;
    const angle = Math.atan2(dy, dx);
    const radius = Math.min(46, Math.max(0, Math.hypot(dx, dy)));
    return {
        x: 50 + Math.cos(angle) * radius,
        y: 50 + Math.sin(angle) * radius
    };
};

const buildSmoothPath = (points) => {
    if (points.length < 2) return '';

    let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
    for (let i = 1; i < points.length; i += 1) {
        const prev = points[i - 1];
        const current = points[i];
        const mx = ((prev.x + current.x) / 2).toFixed(2);
        const my = ((prev.y + current.y) / 2).toFixed(2);
        d += ` Q ${prev.x.toFixed(2)} ${prev.y.toFixed(2)} ${mx} ${my}`;
    }

    const last = points[points.length - 1];
    d += ` T ${last.x.toFixed(2)} ${last.y.toFixed(2)}`;
    return d;
};

const continueCrackToEdge = (rand, points, current, direction, depth) => {
    let cursor = { x: current.x, y: current.y };
    let heading = direction;
    let attempts = 0;

    while (isInsideCoin(cursor) && attempts < 18) {
        const step = 4.8 + rand() * 3.8 - depth * 0.25;
        heading += (rand() - 0.5) * (0.18 + depth * 0.08);
        const next = {
            x: cursor.x + Math.cos(heading) * step,
            y: cursor.y + Math.sin(heading) * step
        };

        if (!isInsideCoin(next)) {
            points.push(pullToCoinEdge(next));
            return;
        }

        points.push(next);
        cursor = next;
        attempts += 1;
    }

    if (isInsideCoin(cursor)) {
        points.push(pullToCoinEdge({
            x: cursor.x + Math.cos(heading) * 80,
            y: cursor.y + Math.sin(heading) * 80
        }));
    }
};

const buildCrackTree = (rand, start, angle, depth, cracks, inheritedStart) => {
    const points = [{ x: start.x, y: start.y }];
    let current = { x: start.x, y: start.y };
    let direction = angle;
    const segments = 4 + Math.floor(rand() * 4) - depth;
    const startAt = inheritedStart ?? clamp(0.14 + depth * 0.085 + rand() * 0.045, 0.1, 0.9);
    const duration = clamp(0.028 + rand() * 0.045 - depth * 0.004, 0.02, 0.085);
    const width = clamp(1.45 - depth * 0.18 + rand() * 0.18, 0.72, 1.55);
    const shouldReachEdge = depth === 0 || rand() < 0.6;
    let hitEdge = false;

    for (let i = 0; i < segments; i += 1) {
        const step = 5 + rand() * 5 - depth * 0.45;
        direction += (rand() - 0.5) * (0.5 + depth * 0.16);
        const next = {
            x: current.x + Math.cos(direction) * step,
            y: current.y + Math.sin(direction) * step
        };

        if (!isInsideCoin(next)) {
            points.push(pullToCoinEdge(next));
            hitEdge = true;
            break;
        }

        points.push(next);
        current = next;

        if (depth < 2 && i >= 1 && rand() < (0.28 - depth * 0.08)) {
            const branchAngle = direction + (rand() < 0.5 ? -1 : 1) * (0.45 + rand() * 0.7);
            buildCrackTree(
                rand,
                current,
                branchAngle,
                depth + 1,
                cracks,
                clamp(startAt + 0.022 + rand() * 0.055, 0.12, 0.96)
            );
        }
    }

    if (shouldReachEdge && !hitEdge) {
        continueCrackToEdge(rand, points, current, direction, depth);
    }

    if (points.length > 1) {
        cracks.push({
            d: buildSmoothPath(points),
            startAt,
            endAt: clamp(startAt + duration, startAt + 0.08, 1),
            width,
            depth
        });
    }
};

const createCoinCrackNetwork = (seed) => {
    const rand = mulberry32(seed);
    const cracks = [];
    const roots = 5 + Math.floor(rand() * 2);

    for (let i = 0; i < roots; i += 1) {
        const rootAngle = (Math.PI * 2 * i) / roots + (rand() - 0.5) * 0.65;
        const rootRadius = 4 + rand() * 9;
        const rootStart = clamp(0.18 + (i * 0.105) + ((i % 2) * 0.04) + ((rand() - 0.5) * 0.025), 0.14, 0.9);
        const origin = {
            x: 50 + Math.cos(rootAngle) * rootRadius,
            y: 50 + Math.sin(rootAngle) * rootRadius
        };

        buildCrackTree(rand, origin, rootAngle + (rand() - 0.5) * 0.6, 0, cracks, rootStart);
    }

    return cracks
        .sort((a, b) => a.startAt - b.startAt)
        .map((crack, index) => ({ ...crack, key: `${seed}-${index}` }));
};

const getCrackReveal = (progress, crack) => {
    const local = clamp((progress - crack.startAt) / (crack.endAt - crack.startAt), 0, 1);
    if (local <= 0) return 0;

    let eased = 0;
    if (local < 0.08) {
        eased = 0;
    } else if (local < 0.2) {
        eased = 0.06 + ((local - 0.08) / 0.12) * 0.82;
    } else if (local < 0.4) {
        eased = 0.88 + ((local - 0.2) / 0.2) * 0.08;
    } else {
        eased = 0.96 + ((local - 0.4) / 0.6) * 0.04;
    }

    return clamp(eased, 0, 1);
};

const getCrackEnergy = (cracks, progress) => {
    if (!cracks.length) return 0;

    const total = cracks.reduce((sum, crack) => {
        const reveal = getCrackReveal(progress, crack);
        const weight = crack.depth === 0 ? 1.2 : crack.depth === 1 ? 0.75 : 0.48;
        return sum + reveal * weight;
    }, 0);

    return clamp(total / (cracks.length * 0.38), 0, 1);
};

const CoinCrackSvg = memo(({ cracks, progress, glowFilterId, hotFilterId, warmBack = false }) => (
    <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
        <defs>
            <clipPath id={`${glowFilterId}-clip`}>
                <circle cx="50" cy="50" r="46" />
            </clipPath>
            <filter id={glowFilterId} x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation="1.8" result="blur" />
                <feColorMatrix
                    in="blur"
                    type="matrix"
                    values={warmBack
                        ? '1 0 0 0 0  0 0.8 0 0 0  0 0 0.38 0 0  0 0 0 1 0'
                        : '1 0 0 0 0  0 0.75 0 0 0  0 0 0.32 0 0  0 0 0 1 0'}
                />
            </filter>
            <filter id={hotFilterId} x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation="0.45" />
            </filter>
        </defs>

        <g clipPath={`url(#${glowFilterId}-clip)`}>
            {cracks.map((crack) => {
                const reveal = getCrackReveal(progress, crack);
                const dashOffset = (1 - reveal) * 100;
                const sharedOpacity = reveal === 0 ? 0 : 0.12 + progress * 0.28;

                return (
                    <g key={crack.key}>
                        <path
                            d={crack.d}
                            pathLength={100}
                            stroke="rgba(76, 28, 6, 0.5)"
                            strokeWidth={crack.width + 1.3}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            fill="none"
                            vectorEffect="non-scaling-stroke"
                            strokeDasharray="100"
                            strokeDashoffset={dashOffset}
                            opacity={sharedOpacity * 0.65}
                        />
                        <path
                            d={crack.d}
                            pathLength={100}
                            stroke={warmBack ? 'rgba(255, 188, 88, 0.95)' : 'rgba(255, 173, 56, 0.95)'}
                            strokeWidth={crack.width + 0.95}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            fill="none"
                            vectorEffect="non-scaling-stroke"
                            strokeDasharray="100"
                            strokeDashoffset={dashOffset}
                            opacity={sharedOpacity + reveal * 0.42}
                            filter={`url(#${glowFilterId})`}
                        />
                        <path
                            d={crack.d}
                            pathLength={100}
                            stroke={warmBack ? 'rgba(255, 249, 230, 0.98)' : 'rgba(255, 247, 224, 0.98)'}
                            strokeWidth={Math.max(0.65, crack.width - 0.15)}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            fill="none"
                            vectorEffect="non-scaling-stroke"
                            strokeDasharray="100"
                            strokeDashoffset={dashOffset}
                            opacity={sharedOpacity + reveal * 0.52}
                            filter={`url(#${hotFilterId})`}
                        />
                    </g>
                );
            })}
        </g>
    </svg>
));

const SettingsModal = memo(({
    originRect,
    closeSettings,
    totalMonthlyBudget,
    toCredits,
    fromCredits,
    setTotalMonthlyBudget,
    groceryAllocation,
    setGroceryAllocation,
    groceryPeriod,
    setGroceryPeriod,
    stipendAmount,
    setStipendAmount,
    resetStipendAnchor,
    stipendPeriod,
    setStipendPeriod,
    goldToUsdRatio,
    setGoldToUsdRatio,
    clearGroceryList,
    priceDatabase,
    updatePrice
}) => {
    const originCenterX = originRect ? (originRect.left + (originRect.width / 2)) - (window.innerWidth / 2) : 0;
    const originCenterY = originRect ? (originRect.top + (originRect.height / 2)) - (window.innerHeight / 2) : 0;
    const originScale = originRect
        ? clamp(Math.min(originRect.width / 360, originRect.height / 360), 0.22, 0.42)
        : 0.92;
    const priceEntries = useMemo(() => Object.entries(priceDatabase), [priceDatabase]);

    return ReactDOM.createPortal(
        <>
            <motion.div
                data-no-swipe="true"
                className="fixed inset-0 z-[250] bg-black/90 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                onClick={(e) => {
                    e.stopPropagation();
                    closeSettings();
                }}
                onPointerDown={(e) => e.stopPropagation()}
            />
            <div className="fixed inset-0 z-[251] flex items-center justify-center p-4 pointer-events-none">
                <motion.div
                    data-no-swipe="true"
                    className="bg-slate-900 border border-amber-500/30 rounded-2xl w-full max-w-sm max-h-[80vh] flex flex-col shadow-[0_0_50px_rgba(245,158,11,0.1)] overflow-hidden pointer-events-auto"
                    initial={{
                        opacity: 0,
                        scale: originScale,
                        x: originCenterX,
                        y: originCenterY
                    }}
                    animate={{
                        opacity: 1,
                        scale: 1,
                        x: 0,
                        y: 0
                    }}
                    exit={{
                        opacity: 0,
                        scale: originRect ? Math.max(originScale, 0.84) : 0.96,
                        x: originRect ? originCenterX * 0.12 : 0,
                        y: originRect ? originCenterY * 0.12 : 0
                    }}
                    transition={{
                        duration: originRect ? 0.28 : 0.18,
                        ease: [0.22, 0.9, 0.3, 1]
                    }}
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                >
                    <div className="p-4 border-b border-amber-900/50 flex justify-between items-center bg-slate-950/80">
                        <h3 className="font-game font-bold text-lg text-amber-500 flex items-center gap-2">
                            <Settings size={18} /> VAULT CONFIG
                        </h3>
                        <button onClick={closeSettings} className="text-gray-500 hover:text-white transition-colors"><X size={20} /></button>
                    </div>

                    <div className="p-4 space-y-4 overflow-y-auto custom-scrollbar">
                        <div className="grid grid-cols-1 gap-4">
                            <div>
                                <label className="block text-[10px] font-game text-amber-700 uppercase mb-1">Monthly Budget (Credits)</label>
                                <div className="relative">
                                    <Coins size={14} className="absolute left-3 top-3 text-amber-500/50" />
                                    <input
                                        type="number"
                                        value={toCredits(totalMonthlyBudget)}
                                        onChange={(e) => setTotalMonthlyBudget(fromCredits(e.target.value))}
                                        className="w-full bg-black/50 border border-amber-900/50 rounded pl-9 pr-3 py-2 text-amber-100 font-mono focus:border-amber-500/50 outline-none transition-colors"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-game text-amber-700 uppercase mb-1">Grocery Allocation (Credits)</label>
                                <div className="relative">
                                    <Coins size={14} className="absolute left-3 top-3 text-amber-500/50" />
                                    <input
                                        type="number"
                                        value={toCredits(groceryAllocation)}
                                        onChange={(e) => setGroceryAllocation(fromCredits(e.target.value))}
                                        className="w-full bg-black/50 border border-amber-900/50 rounded pl-9 pr-3 py-2 text-amber-100 font-mono focus:border-amber-500/50 outline-none transition-colors"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-game text-amber-700 uppercase mb-1">Frequency</label>
                                <select
                                    value={groceryPeriod}
                                    onChange={(e) => setGroceryPeriod(e.target.value)}
                                    className="w-full bg-black/50 border border-amber-900/50 rounded px-3 py-2 text-amber-100 font-mono focus:border-amber-500/50 outline-none transition-colors"
                                >
                                    <option value="weekly">Weekly</option>
                                    <option value="bi-weekly">Bi-Weekly</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-game text-amber-700 uppercase mb-1">Stipend Amount (Credits)</label>
                                <div className="relative">
                                    <Coins size={14} className="absolute left-3 top-3 text-amber-500/50" />
                                    <input
                                        type="number"
                                        min="0"
                                        value={stipendAmount}
                                        onChange={(e) => {
                                            setStipendAmount(Math.max(0, parseInt(e.target.value, 10) || 0));
                                            resetStipendAnchor();
                                        }}
                                        className="w-full bg-black/50 border border-amber-900/50 rounded pl-9 pr-3 py-2 text-amber-100 font-mono focus:border-amber-500/50 outline-none transition-colors"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-game text-amber-700 uppercase mb-1">Stipend Period</label>
                                <select
                                    value={stipendPeriod}
                                    onChange={(e) => {
                                        setStipendPeriod(e.target.value);
                                        resetStipendAnchor();
                                    }}
                                    className="w-full bg-black/50 border border-amber-900/50 rounded px-3 py-2 text-amber-100 font-mono focus:border-amber-500/50 outline-none transition-colors"
                                >
                                    <option value="weekly">Weekly</option>
                                    <option value="bi-weekly">Bi-Weekly</option>
                                    <option value="monthly">Monthly</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-game text-amber-700 uppercase mb-1">Exchange Rate (Credits : $1)</label>
                                <input
                                    type="number"
                                    value={goldToUsdRatio}
                                    onChange={(e) => setGoldToUsdRatio(Number(e.target.value))}
                                    className="w-full bg-black/50 border border-amber-900/50 rounded px-3 py-2 text-amber-100 font-mono focus:border-amber-500/50 outline-none transition-colors"
                                />
                            </div>
                        </div>

                        <div className="pt-4 border-t border-amber-900/30">
                            <button
                                onClick={clearGroceryList}
                                className="w-full py-3 bg-red-900/10 hover:bg-red-900/20 text-red-500 text-[10px] font-bold uppercase rounded border border-red-900/30 hover:border-red-500/50 transition-all flex items-center justify-center gap-2"
                            >
                                <Trash2 size={14} /> Purge Provision Manifest
                            </button>
                        </div>

                        <div className="pt-2">
                            <h4 className="text-[10px] font-bold text-amber-500/70 uppercase mb-3 tracking-widest flex items-center gap-2">
                                <Database size={12} /> Master Price Database
                            </h4>
                            <div className="grid grid-cols-1 gap-1 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                                {priceEntries.map(([name, price]) => (
                                    <div key={name} className="flex items-center justify-between p-2 rounded bg-black/40 border border-amber-900/20 hover:border-amber-500/30 transition-colors group">
                                        <span className="text-xs text-amber-100/70 group-hover:text-amber-100">{name}</span>
                                        <div className="flex items-center gap-2">
                                            <div className="flex items-center text-amber-500">
                                                <Coins size={10} className="mr-1" />
                                                <span className="text-xs font-mono">{toCredits(price)}</span>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    const currentCredits = toCredits(price);
                                                    const newCredits = prompt(`Update unit cost for ${name} (Credits):`, currentCredits);
                                                    if (newCredits !== null && !isNaN(newCredits)) {
                                                        updatePrice(name, fromCredits(newCredits));
                                                    }
                                                }}
                                                className="p-1 hover:bg-amber-900/50 rounded text-amber-700 hover:text-amber-400 transition-colors"
                                            >
                                                <Settings size={10} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </>,
        document.body
    );
});

const CoinSwitch = memo(({ onClick, onHoldComplete, resetSignal }) => {
    const [spinCount, setSpinCount] = useState(1);
    const [shadowScale, setShadowScale] = useState(1);
    const [holdProgress, setHoldProgress] = useState(0);
    const [shakeOffset, setShakeOffset] = useState({ x: 0, y: 0 });
    const [burstPulse, setBurstPulse] = useState(0);
    const buttonRef = useRef(null);
    const rotating = useRef(false);
    const targetSpinCountRef = useRef(1);
    const holdFrameRef = useRef(null);
    const holdTimeoutRef = useRef(null);
    const burstTimeoutRef = useRef(null);
    const shakeIntervalRef = useRef(null);
    const holdStartRef = useRef(0);
    const holdingRef = useRef(false);
    const holdTriggeredRef = useRef(false);
    const suppressClickRef = useRef(false);
    const suppressClickTimeoutRef = useRef(null);
    const holdProgressRef = useRef(0);
    const fractureBrightnessRef = useRef(0);
    const frontCracks = useMemo(() => createCoinCrackNetwork(90210), []);
    const backCracks = useMemo(() => createCoinCrackNetwork(90387), []);
    const fractureBrightness = Math.max(
        getCrackEnergy(frontCracks, holdProgress),
        getCrackEnergy(backCracks, holdProgress)
    );
    const synchronizedGlow = clamp(
        (holdProgress * 0.74) + (fractureBrightness * (0.08 + (holdProgress * 0.18))),
        0,
        1
    );
    const auraOpacity = synchronizedGlow <= 0.001 ? 0 : synchronizedGlow * 0.92;
    const chargeRingOpacity = synchronizedGlow <= 0.001 ? 0 : synchronizedGlow * 0.58;
    const faceLightOpacity = synchronizedGlow <= 0.001 ? 0 : synchronizedGlow * 1.18;
    const liveShadowScale = Math.min(shadowScale, 1 - (fractureBrightness * 0.16));

    useEffect(() => {
        holdProgressRef.current = holdProgress;
        fractureBrightnessRef.current = fractureBrightness;
    }, [fractureBrightness, holdProgress]);

    const clearInteractionTimers = useCallback(() => {
        if (holdFrameRef.current) {
            cancelAnimationFrame(holdFrameRef.current);
            holdFrameRef.current = null;
        }
        if (holdTimeoutRef.current) {
            clearTimeout(holdTimeoutRef.current);
            holdTimeoutRef.current = null;
        }
        if (burstTimeoutRef.current) {
            clearTimeout(burstTimeoutRef.current);
            burstTimeoutRef.current = null;
        }
        if (suppressClickTimeoutRef.current) {
            clearTimeout(suppressClickTimeoutRef.current);
            suppressClickTimeoutRef.current = null;
        }
        if (shakeIntervalRef.current) {
            clearInterval(shakeIntervalRef.current);
            shakeIntervalRef.current = null;
        }
    }, []);

    useEffect(() => () => {
        clearInteractionTimers();
    }, [clearInteractionTimers]);

    const resetCoinState = useCallback(() => {
        clearInteractionTimers();
        holdingRef.current = false;
        holdTriggeredRef.current = false;
        suppressClickRef.current = false;
        rotating.current = false;
        targetSpinCountRef.current = spinCount;
        holdProgressRef.current = 0;
        fractureBrightnessRef.current = 0;
        setHoldProgress(0);
        setShakeOffset({ x: 0, y: 0 });
        setBurstPulse(0);
    }, [clearInteractionTimers, spinCount]);

    useEffect(() => {
        if (resetSignal === undefined) return;

        const frame = requestAnimationFrame(() => {
            resetCoinState();
        });

        return () => {
            cancelAnimationFrame(frame);
        };
    }, [resetSignal, resetCoinState]);

    const scheduleFlipSettle = () => {
        if (holdTimeoutRef.current) {
            clearTimeout(holdTimeoutRef.current);
        }

        holdTimeoutRef.current = setTimeout(() => {
            setSpinCount((current) => {
                if (current < targetSpinCountRef.current) {
                    scheduleFlipSettle();
                    return targetSpinCountRef.current;
                }

                rotating.current = false;
                setShadowScale(1);
                return current;
            });
        }, 900);
    };

    const triggerFlip = (e) => {
        if (e) e.stopPropagation();
        targetSpinCountRef.current += 1;
        rotating.current = true;
        setShadowScale(0.8);
        setSpinCount(prev => {
            const next = prev + 1;
            return rotating.current && prev === next - 1 ? next : next;
        });
        if (onClick) onClick(e);
        scheduleFlipSettle();
    };

    const handleClick = (e) => {
        if (suppressClickRef.current) {
            suppressClickRef.current = false;
            if (e) e.stopPropagation();
            return;
        }
        triggerFlip(e);
    };

    const stopShake = () => {
        if (shakeIntervalRef.current) {
            clearInterval(shakeIntervalRef.current);
            shakeIntervalRef.current = null;
        }
        setShakeOffset({ x: 0, y: 0 });
    };

    const completeHold = (e) => {
        holdTriggeredRef.current = true;
        holdingRef.current = false;
        suppressClickRef.current = true;
        if (suppressClickTimeoutRef.current) {
            clearTimeout(suppressClickTimeoutRef.current);
        }
        suppressClickTimeoutRef.current = setTimeout(() => {
            suppressClickRef.current = false;
            suppressClickTimeoutRef.current = null;
        }, 80);
        setHoldProgress(1);
        stopShake();
        setBurstPulse(prev => prev + 1);
        burstTimeoutRef.current = setTimeout(() => {
            setHoldProgress(0);
            setBurstPulse(0);
        }, 260);
        if (onHoldComplete) {
            onHoldComplete({
                event: e,
                rect: buttonRef.current?.getBoundingClientRect?.() ?? null
            });
        }
    };

    const animateHold = (e, now) => {
        const elapsed = now - holdStartRef.current;
        const progress = Math.min(elapsed / COIN_HOLD_DURATION_MS, 1);
        setHoldProgress(progress);

        if (progress >= 1) {
            completeHold(e);
            return;
        }

        holdFrameRef.current = requestAnimationFrame((nextNow) => animateHold(e, nextNow));
    };

    const startHold = (e) => {
        if (rotating.current || holdingRef.current) return;

        holdingRef.current = true;
        holdTriggeredRef.current = false;
        holdStartRef.current = e?.timeStamp ?? performance.now();
        setHoldProgress(0);

        shakeIntervalRef.current = setInterval(() => {
            const intensity = 0.08 + (holdProgressRef.current * 0.4) + (fractureBrightnessRef.current * 0.5);
            setShakeOffset({
                x: (Math.random() * 2 - 1) * intensity,
                y: (Math.random() * 2 - 1) * intensity * 0.45
            });
        }, 42);

        holdFrameRef.current = requestAnimationFrame((now) => animateHold(e, now));
    };

    const endHold = (_e, { resetCharge = false } = {}) => {
        if (!holdingRef.current && !holdTriggeredRef.current) return;

        holdingRef.current = false;
        if (holdFrameRef.current) {
            cancelAnimationFrame(holdFrameRef.current);
            holdFrameRef.current = null;
        }
        stopShake();

        if (!holdTriggeredRef.current) {
            setHoldProgress(0);
        } else if (resetCharge) {
            setHoldProgress(0);
        }
    };

    return (
        <div className="relative z-50 overflow-visible">
            <button
                ref={buttonRef}
                type="button"
                onClick={handleClick}
                onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture?.(e.pointerId);
                    startHold(e);
                }}
                onPointerUp={(e) => {
                    e.currentTarget.releasePointerCapture?.(e.pointerId);
                    endHold(e);
                }}
                onPointerLeave={() => endHold(null, { resetCharge: true })}
                onPointerCancel={() => endHold(null, { resetCharge: true })}
                onContextMenu={(e) => e.preventDefault()}
                style={{
                    pointerEvents: 'auto',
                    perspective: '1000px',
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                    WebkitTouchCallout: 'none',
                    WebkitTapHighlightColor: 'transparent'
                }}
                className="relative w-28 h-28 group select-none"
            >
                <div
                    className="absolute inset-[-28px] rounded-full pointer-events-none"
                    style={{
                        opacity: auraOpacity,
                        filter: `blur(${12 + (synchronizedGlow * 22)}px)`,
                        transform: `translate(${synchronizedGlow * 4}px, ${synchronizedGlow * -2}px) scale(${0.88 + (synchronizedGlow * 0.28)})`,
                        background: 'radial-gradient(circle at 42% 36%, rgba(255,242,196,0.9), transparent 24%), radial-gradient(circle at 62% 58%, rgba(255,177,67,0.7), transparent 32%), radial-gradient(circle at 28% 70%, rgba(255,154,55,0.45), transparent 22%)'
                    }}
                />
                <div
                    className="absolute inset-[-18px] rounded-[44%_56%_52%_48%] pointer-events-none"
                    style={{
                        opacity: chargeRingOpacity,
                        filter: `blur(${12 + (synchronizedGlow * 18)}px)`,
                        transform: `rotate(${6 + (synchronizedGlow * 10)}deg) scale(${0.78 + (synchronizedGlow * 0.18)})`,
                        background: 'radial-gradient(circle at 32% 38%, rgba(255,236,177,0.8), transparent 24%), radial-gradient(circle at 68% 56%, rgba(255,173,69,0.72), transparent 28%), radial-gradient(circle at 52% 52%, rgba(255,140,45,0.5), transparent 44%)'
                    }}
                />
                {burstPulse > 0 && (
                    <div
                        key={burstPulse}
                        className="absolute inset-[-90px] rounded-full pointer-events-none"
                        style={{
                            background: 'radial-gradient(circle, rgba(255,236,184,0.52), rgba(255,184,72,0.18) 32%, transparent 68%)',
                            animation: 'coinBurst 650ms cubic-bezier(0.16, 1, 0.3, 1)'
                        }}
                    />
                )}
                <div
                    className="w-full h-full relative"
                    style={{
                        transform: `translate(${shakeOffset.x}px, ${shakeOffset.y}px) scale(${1 + (holdProgress * 0.004) + (fractureBrightness * 0.024)})`,
                        transformStyle: 'preserve-3d'
                    }}
                >
                    <motion.div
                        className="w-full h-full relative preserve-3d"
                        initial={false}
                        animate={{ rotateY: spinCount * 180 }}
                        transition={{ duration: 0.9, ease: [0.22, 0.9, 0.3, 1] }}
                        style={{
                            transformStyle: 'preserve-3d'
                        }}
                    >
                    {/* THICKNESS / EDGE LAYERS (The "meat" of the coin) */}
                    {/* We stack discs between Front (Z=6) and Back (Z=-6) */}
                    {COIN_DEPTH_LAYERS.map((z) => (
                        <div
                            key={z}
                            className="absolute inset-0 rounded-full bg-amber-800 border-2 border-amber-900/50"
                            style={{ transform: `translateZ(${z}px)` }}
                        />
                    ))}

                    {/* FRONT FACE (Provisions) */}
                    <div
                        className="absolute inset-0 rounded-full bg-gradient-to-br from-amber-300 via-amber-500 to-amber-700 border-4 border-amber-400/50 flex flex-col items-center justify-center backface-hidden"
                        style={{
                            backfaceVisibility: 'hidden',
                            transform: 'translateZ(6px)' // Moved forward
                        }}
                    >
                        <div
                            className="absolute inset-0 rounded-full pointer-events-none"
                            style={{
                                opacity: faceLightOpacity,
                                transform: `scale(${1 + (synchronizedGlow * 0.068)})`,
                                filter: `blur(${1 + (synchronizedGlow * 10)}px) saturate(${1 + (synchronizedGlow * 0.62)})`,
                                background: 'radial-gradient(circle at 46% 44%, rgba(255,247,216,0.92), transparent 22%), radial-gradient(circle at 58% 58%, rgba(255,197,87,0.88), transparent 30%), radial-gradient(circle at 36% 62%, rgba(255,143,43,0.52), transparent 18%), conic-gradient(from 210deg at 50% 50%, rgba(255,255,255,0) 0deg, rgba(255,223,132,0.7) 55deg, rgba(255,255,255,0) 110deg, rgba(255,157,49,0.76) 190deg, rgba(255,255,255,0) 250deg, rgba(255,245,204,0.5) 315deg, rgba(255,255,255,0) 360deg)'
                            }}
                        />
                        <div className="absolute inset-0 rounded-full pointer-events-none mix-blend-screen opacity-[0.18]">
                            <CoinCrackSvg
                                cracks={frontCracks}
                                progress={holdProgress}
                                glowFilterId="coin-front-glow"
                                hotFilterId="coin-front-hot"
                            />
                        </div>
                        <div className="absolute inset-1 rounded-full border border-amber-900/20" />
                        <div className="absolute inset-[6px] rounded-full border border-amber-100/30" />

                        {/* SVG Rim (Restored) */}
                        <div className="absolute inset-0 pointer-events-none opacity-50">
                            <svg width="100%" height="100%" viewBox="0 0 100 100" className="rounded-full">
                                <circle cx="50" cy="50" r="46" fill="none" stroke="#78350f" strokeWidth="2" />
                            </svg>
                        </div>

                        <ShoppingCart size={32} className="text-amber-900 drop-shadow-sm mb-1" />
                        <span className="text-[10px] font-black text-amber-900 uppercase tracking-widest drop-shadow-sm">Provisions</span>

                        {/* Shine Effect */}
                        <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-transparent via-white/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>

                    {/* BACK FACE (Ledger) */}
                    <div
                        className="absolute inset-0 rounded-full bg-gradient-to-br from-amber-400 via-amber-600 to-amber-800 border-4 border-amber-400/50 flex flex-col items-center justify-center backface-hidden"
                        style={{
                            backfaceVisibility: 'hidden',
                            transform: 'rotateY(180deg) translateZ(6px)' // Rotated and moved "forward" (which is backward relative to scene)
                        }}
                    >
                        <div
                            className="absolute inset-0 rounded-full pointer-events-none"
                            style={{
                                opacity: faceLightOpacity,
                                transform: `scale(${1 + (synchronizedGlow * 0.068)})`,
                                filter: `blur(${1 + (synchronizedGlow * 10)}px) saturate(${1 + (synchronizedGlow * 0.62)})`,
                                background: 'radial-gradient(circle at 46% 44%, rgba(255,247,216,0.92), transparent 22%), radial-gradient(circle at 58% 58%, rgba(255,197,87,0.88), transparent 30%), radial-gradient(circle at 36% 62%, rgba(255,143,43,0.52), transparent 18%), conic-gradient(from 210deg at 50% 50%, rgba(255,255,255,0) 0deg, rgba(255,223,132,0.7) 55deg, rgba(255,255,255,0) 110deg, rgba(255,157,49,0.76) 190deg, rgba(255,255,255,0) 250deg, rgba(255,245,204,0.5) 315deg, rgba(255,255,255,0) 360deg)'
                            }}
                        />
                        <div className="absolute inset-0 rounded-full pointer-events-none mix-blend-screen opacity-[0.18]">
                            <CoinCrackSvg
                                cracks={backCracks}
                                progress={holdProgress}
                                glowFilterId="coin-back-glow"
                                hotFilterId="coin-back-hot"
                                warmBack
                            />
                        </div>
                        <div className="absolute inset-1 rounded-full border border-amber-900/20" />
                        <div className="absolute inset-[6px] rounded-full border border-amber-100/30" />

                        {/* SVG Rim (Restored) */}
                        <div className="absolute inset-0 pointer-events-none opacity-50">
                            <svg width="100%" height="100%" viewBox="0 0 100 100" className="rounded-full">
                                <circle cx="50" cy="50" r="46" fill="none" stroke="#78350f" strokeWidth="2" />
                            </svg>
                        </div>

                        <CreditCard size={32} className="text-amber-100 drop-shadow-sm mb-1" />
                        <span className="text-[10px] font-black text-amber-100 uppercase tracking-widest drop-shadow-sm">Ledger</span>

                        {/* Shine Effect */}
                        <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-transparent via-white/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    </motion.div>
                </div>

                {/* Shadow underneath */}
                <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-20 h-5 bg-black/60 blur-xl rounded-[100%] pointer-events-none transition-transform duration-1000"
                    style={{ transform: `translateX(-50%) scale(${liveShadowScale})` }}
                />
            </button>
            <style>{`
                @keyframes coinBurst {
                    0% {
                        opacity: 0.85;
                        transform: scale(0.18);
                    }
                    100% {
                        opacity: 0;
                        transform: scale(1.08);
                    }
                }
            `}</style>
        </div>
    );
});

const VaultHeader = memo(({ totalMonthlyBudget, stipendAmount, formatCredits, liquidAssets }) => (
    <div className="shrink-0 grid grid-cols-3 gap-2 p-2 pt-12 bg-black/40 border-b border-amber-900/50 backdrop-blur-md z-20" style={{ touchAction: 'none' }}>
        <div className="bg-amber-950/30 border border-amber-500/20 rounded p-2 flex flex-col justify-center items-center relative overflow-hidden group">
            <div className="absolute inset-0 bg-amber-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            <span className="text-[9px] font-bold text-amber-500/60 uppercase tracking-widest mb-0.5">Budget</span>
            <div className="flex items-center gap-1">
                <Coins size={14} className="text-amber-500" />
                <span className="text-lg font-black font-game text-amber-100 leading-none shadow-amber-glow">{formatCredits(totalMonthlyBudget)}</span>
            </div>
        </div>
        <div className="bg-amber-950/30 border border-amber-500/20 rounded p-2 flex flex-col justify-center items-center relative overflow-hidden group">
            <div className="absolute inset-0 bg-amber-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            <span className="text-[9px] font-bold text-amber-500/60 uppercase tracking-widest mb-0.5">Stipend</span>
            <div className="flex items-center gap-1">
                <Coins size={14} className="text-amber-500" />
                <span className="text-lg font-black font-game text-amber-100 leading-none shadow-amber-glow">{Number(stipendAmount || 0).toLocaleString()}</span>
            </div>
        </div>
        <div className="bg-amber-950/30 border border-amber-500/20 rounded p-2 flex flex-col justify-center items-center relative overflow-hidden group">
            <div className="absolute inset-0 bg-amber-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            <span className="text-[9px] font-bold text-amber-400/80 uppercase tracking-widest mb-0.5">Liquid Assets</span>
            <div className="flex items-center gap-1">
                <Coins size={14} className="text-amber-400" />
                <span className="text-lg font-black font-game text-amber-400 leading-none drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]">{liquidAssets.toLocaleString()}</span>
            </div>
        </div>
    </div>
));

const ProvisionsView = memo(({
    groceryList,
    totalGroceryEstimated,
    groceryPeriod,
    priceDatabase,
    addGroceryItem,
    markGroceryItemCompleted,
    unmarkGroceryItemCompleted,
    removeGroceryItem,
    spendCoins,
    addGold,
    toCreditValue,
    toCredits,
    fromCredits,
    formatCredits,
    updatePrice
}) => {
    const [itemName, setItemName] = useState('');
    const [itemQuantity, setItemQuantity] = useState('1');
    const [itemPriceCredits, setItemPriceCredits] = useState('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const totalUnits = useMemo(
        () => groceryList.reduce((sum, item) => sum + Number(item.quantity || 1), 0),
        [groceryList]
    );
    const filteredDbItems = useMemo(() => {
        if (!itemName) return [];

        const normalizedItemName = itemName.toLowerCase();
        return Object.keys(priceDatabase).filter((item) =>
            item.toLowerCase().includes(normalizedItemName)
        );
    }, [priceDatabase, itemName]);
    const todayKey = getTodayISO();

    const handleAdd = useCallback((e) => {
        e.preventDefault();
        if (!itemName) return;

        const quantity = Math.max(1, parseInt(itemQuantity, 10) || 1);
        if (itemPriceCredits) {
            updatePrice(itemName, fromCredits(itemPriceCredits));
        }

        addGroceryItem(itemName, quantity);
        setItemName('');
        setItemQuantity('1');
        setItemPriceCredits('');
        setIsDropdownOpen(false);
    }, [addGroceryItem, fromCredits, itemName, itemPriceCredits, itemQuantity, updatePrice]);

    const selectFromDb = useCallback((name) => {
        setItemName(name);
        setItemPriceCredits(priceDatabase[name] ? toCredits(priceDatabase[name]) : '');
        setIsDropdownOpen(false);
    }, [priceDatabase, toCredits]);

    const handleTogglePurchased = useCallback((item) => {
        const quantity = Number(item.quantity || 1);
        const totalCoinCost = toCreditValue(item.price * quantity);

        if (!item.completed) {
            markGroceryItemCompleted(item.id, todayKey);
            if (totalCoinCost > 0) {
                spendCoins(totalCoinCost, `Groceries: ${item.name} x${quantity}`);
            }
            return;
        }

        if (item.completedDateKey !== todayKey) {
            return;
        }

        unmarkGroceryItemCompleted(item.id);
        if (totalCoinCost > 0) {
            addGold(totalCoinCost, 'Grocery Refund', {
                description: `Grocery refund: ${item.name} x${quantity}`
            });
        }
    }, [addGold, markGroceryItemCompleted, spendCoins, toCreditValue, todayKey, unmarkGroceryItemCompleted]);

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden relative">
            <div className="shrink-0 p-3 bg-black/90 border-b border-amber-900/50 backdrop-blur-xl z-30 shadow-[0_10px_40px_rgba(0,0,0,0.8)]">
                <form onSubmit={handleAdd} className="flex gap-2 items-center">
                    <div className="w-16 relative">
                        <input
                            type="number"
                            min="1"
                            placeholder="1"
                            value={itemQuantity}
                            onChange={(e) => setItemQuantity(e.target.value)}
                            className="w-full bg-slate-900/80 border border-amber-900/50 rounded px-2 py-3 text-sm text-amber-400 placeholder-amber-900/30 focus:border-amber-500/50 outline-none text-center font-mono"
                        />
                    </div>
                    <div className="flex-1 relative">
                        <input
                            type="text"
                            placeholder="PROVISION"
                            value={itemName}
                            onChange={(e) => {
                                setItemName(e.target.value);
                                setIsDropdownOpen(true);
                            }}
                            className="w-full bg-slate-900/80 border border-amber-900/50 rounded px-3 py-3 text-sm text-amber-100 placeholder-amber-900/30 focus:border-amber-500/50 outline-none uppercase font-mono tracking-wide"
                        />
                        {isDropdownOpen && filteredDbItems.length > 0 && itemName && (
                            <div className="absolute top-full left-0 right-0 mt-2 bg-black border border-amber-900 rounded-lg shadow-2xl overflow-hidden max-h-32 overflow-y-auto z-50">
                                {filteredDbItems.map((item) => (
                                    <button
                                        key={item}
                                        type="button"
                                        onClick={() => selectFromDb(item)}
                                        className="w-full text-left px-3 py-2 hover:bg-amber-900/30 text-xs text-amber-100/80 flex justify-between items-center border-b border-amber-900/20 last:border-0"
                                    >
                                        <span>{item}</span>
                                        <span className="font-mono text-amber-500 flex items-center gap-1">
                                            <Coins size={10} />
                                            {toCredits(priceDatabase[item])}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="w-24 relative">
                        <input
                            type="number"
                            placeholder="0"
                            value={itemPriceCredits}
                            onChange={(e) => setItemPriceCredits(e.target.value)}
                            className="w-full bg-slate-900/80 border border-amber-900/50 rounded px-2 py-3 text-sm text-amber-400 placeholder-amber-900/30 focus:border-amber-500/50 outline-none text-right font-mono"
                        />
                        <Coins size={12} className="absolute left-2 top-4 text-amber-600/50" />
                    </div>
                    <button
                        type="submit"
                        className="bg-amber-600 hover:bg-amber-500 text-black py-3 px-4 rounded transition-colors shadow-[0_0_10px_rgba(245,158,11,0.2)] font-bold"
                    >
                        <Plus size={20} />
                    </button>
                </form>
            </div>

            <div className="shrink-0 px-4 py-2 flex items-center justify-between text-[10px] font-game text-amber-500/60 uppercase tracking-widest border-b border-white/5 bg-black/20">
                <div className="flex gap-4">
                    <span>Cycle: {groceryPeriod}</span>
                    <span>Entries: {groceryList.length}</span>
                    <span>Items: {totalUnits}</span>
                </div>
                <div className="text-amber-400 flex items-center gap-1 font-bold">
                    <Coins size={10} />
                    <span>Total: {formatCredits(totalGroceryEstimated)}</span>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1 pb-48 touch-pan-y overscroll-none">
                {groceryList.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 text-amber-900/40 border-2 border-dashed border-amber-900/20 rounded-xl m-4">
                        <ShoppingCart size={32} className="mb-2 opacity-50" />
                        <span className="font-game text-xs tracking-widest uppercase">Manifest Empty</span>
                    </div>
                ) : (
                    <AnimatePresence>
                        {groceryList.map((item) => {
                            const isPurchasedToday = item.completedDateKey === todayKey;

                            return (
                                <motion.div
                                    key={item.id}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className={clsx(
                                        "group flex items-center justify-between p-3 rounded border transition-all relative overflow-hidden",
                                        item.completed
                                            ? "bg-slate-900/30 border-slate-800 text-slate-600"
                                            : "bg-amber-950/20 border-amber-500/20 text-amber-100 hover:bg-amber-900/20"
                                    )}
                                >
                                    <div className="flex items-center gap-3 relative z-10">
                                        <button
                                            onClick={() => handleTogglePurchased(item)}
                                            className={clsx(
                                                "transition-all duration-300",
                                                item.completed ? "text-amber-900" : "text-amber-500 hover:text-amber-300"
                                            )}
                                        >
                                            {item.completed ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                                        </button>
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-2">
                                                <span className={clsx("text-sm font-bold leading-none", item.completed && "line-through opacity-50")}>{item.name}</span>
                                                <span className={clsx(
                                                    "rounded border px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider",
                                                    item.completed
                                                        ? "border-slate-800 text-slate-700"
                                                        : "border-amber-500/20 text-amber-400/80"
                                                )}>
                                                    x{item.quantity || 1}
                                                </span>
                                            </div>
                                            {!item.completed && <span className="text-[9px] font-mono text-amber-500/50 mt-1 uppercase tracking-wider">est. {toCredits(item.price)} C each</span>}
                                            {item.completed && <span className="text-[9px] font-mono text-slate-700 mt-1 uppercase tracking-wider">purchased {isPurchasedToday ? 'today' : item.completedDateKey}</span>}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 relative z-10">
                                        <div className={clsx("font-mono text-sm flex items-center gap-1", item.completed ? "text-xs text-slate-700" : "text-amber-400 font-bold")}>
                                            <Coins size={12} />
                                            {toCredits(item.price * (item.quantity || 1))}
                                        </div>
                                        <button
                                            onClick={() => removeGroceryItem(item.id)}
                                            className="text-amber-900 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>

                                    {!item.completed && (
                                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-500/5 to-transparent skew-x-12 translate-x-[-150%] group-hover:animate-holoscan pointer-events-none" />
                                    )}
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                )}
            </div>
        </div>
    );
});

const LedgerView = memo(({ spendCoins, coinHistory }) => {
    const [desc, setDesc] = useState('');
    const [amount, setAmount] = useState('');
    const recentTransactions = useMemo(() => (
        [...coinHistory]
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .map((tx) => {
                const timestamp = new Date(tx.date);
                return {
                    ...tx,
                    dateLabel: timestamp.toLocaleDateString(),
                    timeLabel: timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                };
            })
    ), [coinHistory]);

    const handleSpend = useCallback((e) => {
        e.preventDefault();
        if (!desc || !amount) return;

        spendCoins(parseInt(amount, 10), desc);
        setDesc('');
        setAmount('');
    }, [amount, desc, spendCoins]);

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden min-h-0">
            <div className="shrink-0 p-4 border-b border-amber-900/30 bg-black/20">
                <div className="mb-3 flex items-center gap-2 text-amber-500/70">
                    <ArrowRightLeft size={14} />
                    <span className="text-[10px] font-game uppercase tracking-widest">Execute Transaction</span>
                </div>

                <form onSubmit={handleSpend} className="flex flex-col gap-3">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            placeholder="PAYMENT REFERENCE..."
                            value={desc}
                            onChange={(e) => setDesc(e.target.value)}
                            className="flex-1 bg-slate-900/50 border border-amber-900/50 rounded px-3 py-3 text-amber-100 placeholder-amber-900/50 focus:border-amber-500/50 outline-none font-mono text-sm uppercase"
                        />
                        <div className="w-32 relative">
                            <input
                                type="number"
                                placeholder="0"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                className="w-full bg-slate-900/50 border border-amber-900/50 rounded px-3 py-3 text-amber-400 placeholder-amber-900/50 focus:border-amber-500/50 outline-none font-mono text-right text-sm"
                            />
                            <span className="absolute left-2 top-3.5 text-[10px] text-amber-600 font-bold uppercase flex items-center gap-1">
                                <Coins size={10} /> CREDITS
                            </span>
                        </div>
                    </div>
                    <button
                        disabled={!amount}
                        type="submit"
                        className="w-full py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded uppercase font-bold text-xs tracking-widest transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Authorize Transfer <ArrowRightLeft size={14} />
                    </button>
                </form>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 pb-48 touch-pan-y overscroll-none">
                <div className="px-2 py-2 text-[10px] font-mono text-amber-500/40 uppercase border-b border-white/5 mb-1">Recent Activity Log</div>
                <div className="space-y-1">
                    {recentTransactions.length === 0 ? (
                        <div className="text-center py-8 text-amber-900/30 italic text-xs">No transactions recorded.</div>
                    ) : (
                        recentTransactions.map((tx) => (
                            <div key={tx.id} className="flex items-center justify-between p-2 rounded hover:bg-white/5 border border-transparent hover:border-white/5 transition-colors group">
                                <div className="flex flex-col">
                                    <span className="text-xs font-bold text-amber-100/80">{tx.description}</span>
                                    <span className="text-[9px] font-mono text-gray-600">{tx.dateLabel} • {tx.timeLabel}</span>
                                </div>
                                <div className={clsx(
                                    "font-mono text-xs font-bold px-2 py-1 rounded border flex items-center gap-1",
                                    tx.type === 'earned'
                                        ? "text-emerald-300 bg-emerald-900/10 border-emerald-900/20 group-hover:border-emerald-500/30"
                                        : "text-red-400 bg-red-900/10 border-red-900/20 group-hover:border-red-500/30"
                                )}>
                                    <Coins size={10} /> {tx.type === 'earned' ? '+' : '-'}{tx.amount}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
});

const BudgetView = () => {
    const {
        totalMonthlyBudget, setTotalMonthlyBudget,
        groceryAllocation, setGroceryAllocation,
        groceryList,
        priceDatabase, updatePrice,
        groceryPeriod, setGroceryPeriod,
        stipendAmount, setStipendAmount,
        stipendPeriod, setStipendPeriod, setStipendPaidThrough,
        addGroceryItem, markGroceryItemCompleted, unmarkGroceryItemCompleted, removeGroceryItem,
        clearGroceryList,
        totalGroceryEstimated,
        goldToUsdRatio, setGoldToUsdRatio
    } = useBudget();
    const { stats, spendCoins, addGold, coinHistory } = useGame();

    const [activeTab, setActiveTab] = useState(TAB_LEDGER);
    const [showSettings, setShowSettings] = useState(false);
    const [settingsOriginRect, setSettingsOriginRect] = useState(null);
    const [coinResetSignal, setCoinResetSignal] = useState(0);

    // --- CURRENCY HELPERS ---
    // The backend (Context) stores values in USD (standard unit).
    // The UI (BudgetView) displays values in "Credits" (Gold), based on the exchange rate.

    // Display: USD -> Credits
    const toCreditValue = useCallback((usdAmount) => {
        return Number((Number(usdAmount || 0) * goldToUsdRatio).toFixed(0));
    }, [goldToUsdRatio]);

    const toCredits = useCallback((usdAmount) => {
        return toCreditValue(usdAmount).toString();
    }, [toCreditValue]);

    // Input: Credits -> USD
    const fromCredits = useCallback((creditAmount) => {
        if (!creditAmount) return 0;
        return Number(creditAmount) / goldToUsdRatio;
    }, [goldToUsdRatio]);

    const formatCredits = useCallback((usdAmount) => {
        return toCreditValue(usdAmount).toLocaleString();
    }, [toCreditValue]);

    const resetStipendAnchor = useCallback(() => {
        setStipendPaidThrough(getTodayISO());
    }, [setStipendPaidThrough]);



    // --- SUB-COMPONENTS ---



    const closeSettings = useCallback(() => {
        setShowSettings(false);
        setSettingsOriginRect(null);
        setCoinResetSignal(prev => prev + 1);
    }, []);

    const openSettingsFromCoin = useCallback(({ event, rect }) => {
        if (event) event.stopPropagation();
        setSettingsOriginRect(rect);
        setShowSettings(true);
    }, []);

    const toggleActiveTab = useCallback((e) => {
        if (e) e.stopPropagation();
        setActiveTab(prev => prev === TAB_PROVISIONS ? TAB_LEDGER : TAB_PROVISIONS);
    }, []);

    const LegacyProvisionsView = ({ groceryList, totalGroceryEstimated }) => {
        const [itemName, setItemName] = useState('');
        const [itemQuantity, setItemQuantity] = useState('1');
        const [itemPriceCredits, setItemPriceCredits] = useState(''); // Store input as credits string
        const [isDropdownOpen, setIsDropdownOpen] = useState(false);
        const totalUnits = groceryList.reduce((sum, item) => sum + Number(item.quantity || 1), 0);

        const filteredDbItems = Object.keys(priceDatabase).filter(item =>
            item.toLowerCase().includes(itemName.toLowerCase())
        );

        const handleAdd = (e) => {
            e.preventDefault();
            if (!itemName) return;
            const quantity = Math.max(1, parseInt(itemQuantity, 10) || 1);

            // Logic: Use input price (Credits) OR DB price (USD -> convert to Credits for display? No wait.)
            // updatePrice takes USD.
            // addGroceryItem takes name. It internally looks up price from DB.

            // If user entered a price manually, update DB first.
            if (itemPriceCredits) {
                const usdPrice = fromCredits(itemPriceCredits);
                updatePrice(itemName, usdPrice);
            }

            // Note: If item exists in DB but no price input, addGroceryItem uses DB price.
            // If item is new and no price input, DB defaults 0.

            addGroceryItem(itemName, quantity);
            setItemName('');
            setItemQuantity('1');
            setItemPriceCredits('');
            setIsDropdownOpen(false);
        };

        const selectFromDb = (name) => {
            setItemName(name);
            // Pre-fill price input with Credits equivalent
            if (priceDatabase[name]) {
                setItemPriceCredits(toCredits(priceDatabase[name]));
            } else {
                setItemPriceCredits('');
            }
            setIsDropdownOpen(false);
        };

        const handleTogglePurchased = (item) => {
            const todayKey = getTodayISO();
            const quantity = Number(item.quantity || 1);
            const totalCoinCost = toCreditValue(item.price * quantity);

            if (!item.completed) {
                markGroceryItemCompleted(item.id, todayKey);
                if (totalCoinCost > 0) {
                    spendCoins(totalCoinCost, `Groceries: ${item.name} x${quantity}`);
                }
                return;
            }

            if (item.completedDateKey !== todayKey) {
                return;
            }

            unmarkGroceryItemCompleted(item.id);
            if (totalCoinCost > 0) {
                addGold(totalCoinCost, 'Grocery Refund', {
                    description: `Grocery refund: ${item.name} x${quantity}`
                });
            }
        };


        return (
            <div className="flex-1 flex flex-col h-full overflow-hidden relative">
                {/* INPUT BAR (Moved to Top) */}
                <div className="shrink-0 p-3 bg-black/90 border-b border-amber-900/50 backdrop-blur-xl z-30 shadow-[0_10px_40px_rgba(0,0,0,0.8)]">
                    <form onSubmit={handleAdd} className="flex gap-2 items-center">
                        <div className="w-16 relative">
                            <input
                                type="number"
                                min="1"
                                placeholder="1"
                                value={itemQuantity}
                                onChange={(e) => setItemQuantity(e.target.value)}
                                className="w-full bg-slate-900/80 border border-amber-900/50 rounded px-2 py-3 text-sm text-amber-400 placeholder-amber-900/30 focus:border-amber-500/50 outline-none text-center font-mono"
                            />
                        </div>
                        <div className="flex-1 relative">
                            <input
                                type="text"
                                placeholder="PROVISION"
                                value={itemName}
                                onChange={(e) => {
                                    setItemName(e.target.value);
                                    setIsDropdownOpen(true);
                                }}
                                className="w-full bg-slate-900/80 border border-amber-900/50 rounded px-3 py-3 text-sm text-amber-100 placeholder-amber-900/30 focus:border-amber-500/50 outline-none uppercase font-mono tracking-wide"
                            />
                            {/* Autocomplete Dropdown */}
                            {isDropdownOpen && filteredDbItems.length > 0 && itemName && (
                                <div className="absolute top-full left-0 right-0 mt-2 bg-black border border-amber-900 rounded-lg shadow-2xl overflow-hidden max-h-32 overflow-y-auto z-50">
                                    {filteredDbItems.map(item => (
                                        <button
                                            key={item}
                                            type="button"
                                            onClick={() => selectFromDb(item)}
                                            className="w-full text-left px-3 py-2 hover:bg-amber-900/30 text-xs text-amber-100/80 flex justify-between items-center border-b border-amber-900/20 last:border-0"
                                        >
                                            <span>{item}</span>
                                            <span className="font-mono text-amber-500 flex items-center gap-1">
                                                <Coins size={10} />
                                                {toCredits(priceDatabase[item])}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="w-24 relative">
                            <input
                                type="number"
                                placeholder="0"
                                value={itemPriceCredits}
                                onChange={(e) => setItemPriceCredits(e.target.value)}
                                className="w-full bg-slate-900/80 border border-amber-900/50 rounded px-2 py-3 text-sm text-amber-400 placeholder-amber-900/30 focus:border-amber-500/50 outline-none text-right font-mono"
                            />
                            <Coins size={12} className="absolute left-2 top-4 text-amber-600/50" />
                        </div>
                        <button
                            type="submit"
                            className="bg-amber-600 hover:bg-amber-500 text-black py-3 px-4 rounded transition-colors shadow-[0_0_10px_rgba(245,158,11,0.2)] font-bold"
                        >
                            <Plus size={20} />
                        </button>
                    </form>
                </div>

                {/* STATUS BAR */}
                <div className="shrink-0 px-4 py-2 flex items-center justify-between text-[10px] font-game text-amber-500/60 uppercase tracking-widest border-b border-white/5 bg-black/20">
                    <div className="flex gap-4">
                        <span>Cycle: {groceryPeriod}</span>
                        <span>Entries: {groceryList.length}</span>
                        <span>Items: {totalUnits}</span>
                    </div>
                    <div className="text-amber-400 flex items-center gap-1 font-bold">
                        <Coins size={10} />
                        <span>Total: {formatCredits(totalGroceryEstimated)}</span>
                    </div>
                </div>

                {/* SCROLLABLE LIST AREA */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1 pb-48 touch-pan-y overscroll-none">
                    {groceryList.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-48 text-amber-900/40 border-2 border-dashed border-amber-900/20 rounded-xl m-4">
                            <ShoppingCart size={32} className="mb-2 opacity-50" />
                            <span className="font-game text-xs tracking-widest uppercase">Manifest Empty</span>
                        </div>
                    ) : (
                        <AnimatePresence>
                            {groceryList.map(item => (
                                <motion.div
                                    key={item.id}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className={clsx(
                                        "group flex items-center justify-between p-3 rounded border transition-all relative overflow-hidden",
                                        item.completed
                                            ? "bg-slate-900/30 border-slate-800 text-slate-600"
                                            : "bg-amber-950/20 border-amber-500/20 text-amber-100 hover:bg-amber-900/20"
                                    )}
                                >
                                    <div className="flex items-center gap-3 relative z-10">
                                        <button
                                            onClick={() => handleTogglePurchased(item)}
                                            className={clsx(
                                                "transition-all duration-300",
                                                item.completed ? "text-amber-900" : "text-amber-500 hover:text-amber-300"
                                            )}
                                        >
                                            {item.completed ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                                        </button>
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-2">
                                                <span className={clsx("text-sm font-bold leading-none", item.completed && "line-through opacity-50")}>{item.name}</span>
                                                <span className={clsx(
                                                    "rounded border px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider",
                                                    item.completed
                                                        ? "border-slate-800 text-slate-700"
                                                        : "border-amber-500/20 text-amber-400/80"
                                                )}>
                                                    x{item.quantity || 1}
                                                </span>
                                            </div>
                                            {!item.completed && <span className="text-[9px] font-mono text-amber-500/50 mt-1 uppercase tracking-wider">est. {toCredits(item.price)} C each</span>}
                                            {item.completed && <span className="text-[9px] font-mono text-slate-700 mt-1 uppercase tracking-wider">purchased {item.completedDateKey === getTodayISO() ? 'today' : item.completedDateKey}</span>}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 relative z-10">
                                        <div className={clsx("font-mono text-sm flex items-center gap-1", item.completed ? "text-xs text-slate-700" : "text-amber-400 font-bold")}>
                                            <Coins size={12} />
                                            {toCredits(item.price * (item.quantity || 1))}
                                        </div>
                                        <button
                                            onClick={() => removeGroceryItem(item.id)}
                                            className="text-amber-900 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>

                                    {/* Holographic Scanline Effect */}
                                    {!item.completed && (
                                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-500/5 to-transparent skew-x-12 translate-x-[-150%] group-hover:animate-holoscan pointer-events-none" />
                                    )}
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    )}
                </div>
            </div>
        );
    };

    const LegacyLedgerView = () => {
        const { spendCoins, coinHistory } = useGame();
        const [desc, setDesc] = useState('');
        const [amount, setAmount] = useState('');

        const handleSpend = (e) => {
            e.preventDefault();
            if (!desc || !amount) return;
            // Amount is in CREDITS (Coins). spendCoins takes amount and deducts from stats.gold.
            // stats.gold is already in Credits/Gold units.
            // So NO conversion needed here. 
            spendCoins(parseInt(amount), desc);
            setDesc('');
            setAmount('');
        };

        const recentTransactions = [...coinHistory]
            .sort((a, b) => new Date(b.date) - new Date(a.date));

        return (
            <div className="flex-1 flex flex-col h-full overflow-hidden min-h-0">
                {/* TRANSFER TERMINAL (Top) */}
                <div className="shrink-0 p-4 border-b border-amber-900/30 bg-black/20">
                    <div className="mb-3 flex items-center gap-2 text-amber-500/70">
                        <ArrowRightLeft size={14} />
                        <span className="text-[10px] font-game uppercase tracking-widest">Execute Transaction</span>
                    </div>

                    <form onSubmit={handleSpend} className="flex flex-col gap-3">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                placeholder="PAYMENT REFERENCE..."
                                value={desc}
                                onChange={(e) => setDesc(e.target.value)}
                                className="flex-1 bg-slate-900/50 border border-amber-900/50 rounded px-3 py-3 text-amber-100 placeholder-amber-900/50 focus:border-amber-500/50 outline-none font-mono text-sm uppercase"
                            />
                            <div className="w-32 relative">
                                <input
                                    type="number"
                                    placeholder="0"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    className="w-full bg-slate-900/50 border border-amber-900/50 rounded px-3 py-3 text-amber-400 placeholder-amber-900/50 focus:border-amber-500/50 outline-none font-mono text-right text-sm"
                                />
                                <span className="absolute left-2 top-3.5 text-[10px] text-amber-600 font-bold uppercase flex items-center gap-1">
                                    <Coins size={10} /> CREDITS
                                </span>
                            </div>
                        </div>
                        <button
                            disabled={!amount} // Allow negative balance
                            type="submit"
                            className="w-full py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded uppercase font-bold text-xs tracking-widest transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Authorize Transfer <ArrowRightLeft size={14} />
                        </button>
                    </form>
                </div>

                {/* TRANSACTION LOG (Bottom) */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-2 pb-48 touch-pan-y overscroll-none">
                    <div className="px-2 py-2 text-[10px] font-mono text-amber-500/40 uppercase border-b border-white/5 mb-1">Recent Activity Log</div>
                    <div className="space-y-1">
                        {recentTransactions.length === 0 ? (
                            <div className="text-center py-8 text-amber-900/30 italic text-xs">No transactions recorded.</div>
                        ) : (
                            recentTransactions.map(tx => (
                                <div key={tx.id} className="flex items-center justify-between p-2 rounded hover:bg-white/5 border border-transparent hover:border-white/5 transition-colors group">
                                    <div className="flex flex-col">
                                        <span className="text-xs font-bold text-amber-100/80">{tx.description}</span>
                                        <span className="text-[9px] font-mono text-gray-600">{new Date(tx.date).toLocaleDateString()} • {new Date(tx.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                    <div className={clsx(
                                        "font-mono text-xs font-bold px-2 py-1 rounded border flex items-center gap-1",
                                        tx.type === 'earned'
                                            ? "text-emerald-300 bg-emerald-900/10 border-emerald-900/20 group-hover:border-emerald-500/30"
                                            : "text-red-400 bg-red-900/10 border-red-900/20 group-hover:border-red-500/30"
                                    )}>
                                        <Coins size={10} /> {tx.type === 'earned' ? '+' : '-'}{tx.amount}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        );
    };

    void LegacyProvisionsView;
    void LegacyLedgerView;

    // --- MAIN RENDER ---

    return (
        <div className="fixed inset-0 w-full h-full overflow-hidden bg-slate-950 flex flex-col">
            {/* Ambient Background & Grid */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-amber-900/10 via-transparent to-transparent z-0" />
                <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent z-0" />
            </div>

            {/* 1. VAULT HEADER (Fixed) */}
            <VaultHeader
                totalMonthlyBudget={totalMonthlyBudget}
                stipendAmount={stipendAmount}
                formatCredits={formatCredits}
                liquidAssets={stats.gold}
            />

            {/* 4. MAIN VIEWPORT (Swappable) */}
            <div className="flex-1 overflow-hidden relative">
                <AnimatePresence mode="wait" initial={false}>
                    {activeTab === TAB_PROVISIONS ? (
                        <motion.div
                            key="provisions"
                            className="w-full h-full"
                            initial={{ opacity: 0, x: -50, rotateY: -10 }}
                            animate={{ opacity: 1, x: 0, rotateY: 0 }}
                            exit={{ opacity: 0, x: 50, rotateY: 10 }}
                            transition={{ duration: 0.4, ease: "backOut" }}
                            style={{ perspective: 1000 }}
                        >
                            <ProvisionsView
                                groceryList={groceryList}
                                totalGroceryEstimated={totalGroceryEstimated}
                                groceryPeriod={groceryPeriod}
                                priceDatabase={priceDatabase}
                                addGroceryItem={addGroceryItem}
                                markGroceryItemCompleted={markGroceryItemCompleted}
                                unmarkGroceryItemCompleted={unmarkGroceryItemCompleted}
                                removeGroceryItem={removeGroceryItem}
                                spendCoins={spendCoins}
                                addGold={addGold}
                                toCreditValue={toCreditValue}
                                toCredits={toCredits}
                                fromCredits={fromCredits}
                                formatCredits={formatCredits}
                                updatePrice={updatePrice}
                            />
                        </motion.div>
                    ) : (
                        <motion.div
                            key="ledger"
                            className="w-full h-full"
                            initial={{ opacity: 0, x: 50, rotateY: 10 }}
                            animate={{ opacity: 1, x: 0, rotateY: 0 }}
                            exit={{ opacity: 0, x: -50, rotateY: -10 }}
                            transition={{ duration: 0.4, ease: "backOut" }}
                            style={{ perspective: 1000 }}
                        >
                            <LedgerView spendCoins={spendCoins} coinHistory={coinHistory} />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* 6. BOTTOM DOCK (Background Anchor) */}
            <div className="shrink-0 z-50 relative flex justify-center pb-32 pt-12 bg-gradient-to-t from-black via-slate-950/90 to-transparent -mt-10 pointer-events-none" />

            {/* 7. COIN SWITCH (Decoupled & Fixed) */}
            <div className="fixed bottom-52 left-1/2 -translate-x-1/2 z-[100] pointer-events-auto filter drop-shadow-2xl">
                <CoinSwitch
                    onClick={toggleActiveTab}
                    onHoldComplete={openSettingsFromCoin}
                    resetSignal={coinResetSignal}
                />
            </div>

            {/* Modals */}
            <AnimatePresence>
                {showSettings && (
                    <SettingsModal
                        originRect={settingsOriginRect}
                        closeSettings={closeSettings}
                        totalMonthlyBudget={totalMonthlyBudget}
                        toCredits={toCredits}
                        fromCredits={fromCredits}
                        setTotalMonthlyBudget={setTotalMonthlyBudget}
                        groceryAllocation={groceryAllocation}
                        setGroceryAllocation={setGroceryAllocation}
                        groceryPeriod={groceryPeriod}
                        setGroceryPeriod={setGroceryPeriod}
                        stipendAmount={stipendAmount}
                        setStipendAmount={setStipendAmount}
                        resetStipendAnchor={resetStipendAnchor}
                        stipendPeriod={stipendPeriod}
                        setStipendPeriod={setStipendPeriod}
                        goldToUsdRatio={goldToUsdRatio}
                        setGoldToUsdRatio={setGoldToUsdRatio}
                        clearGroceryList={clearGroceryList}
                        priceDatabase={priceDatabase}
                        updatePrice={updatePrice}
                    />
                )}
            </AnimatePresence>
        </div>
    );
};

export default BudgetView;
