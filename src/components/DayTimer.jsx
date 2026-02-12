import React, { useState, useEffect } from 'react';
import clsx from 'clsx';

const DayTimer = ({ className }) => {
    const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0, totalMinutes: 0, remaining: 1 });

    useEffect(() => {
        const updateTimer = () => {
            const now = new Date();
            const tomorrow = new Date(now);
            tomorrow.setDate(now.getDate() + 1);
            tomorrow.setHours(0, 0, 0, 0);

            const diff = tomorrow - now;
            const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
            const minutes = Math.floor((diff / (1000 * 60)) % 60);
            const seconds = Math.floor((diff / 1000) % 60);
            const totalMinutes = Math.floor(diff / (1000 * 60));
            const totalDayMs = 24 * 60 * 60 * 1000;
            const remaining = Math.min(diff / totalDayMs, 1);

            setTimeLeft({ hours, minutes, seconds, totalMinutes, remaining });
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, []);

    // Color theme based on time remaining
    const getTheme = (minutes) => {
        if (minutes > 720) { // > 12h
            return { from: '#7dd3fc', to: '#0284c7', label: 'text-sky-600', value: 'text-sky-300' };
        } else if (minutes < 180) { // < 3h
            return { from: '#fda4af', to: '#e11d48', label: 'text-rose-700', value: 'text-rose-300' };
        } else {
            return { from: '#c084fc', to: '#7c3aed', label: 'text-purple-700', value: 'text-purple-300' };
        }
    };

    const theme = getTheme(timeLeft.totalMinutes);
    const isCrisis = timeLeft.totalMinutes < 180;

    return (
        <div className={clsx("flex flex-col items-center justify-center pointer-events-none select-none", className)}>
            {/* Progress Bar */}
            <div className="w-44 h-[5px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
                <div
                    className="h-full rounded-full"
                    style={{
                        width: `${timeLeft.remaining * 100}%`,
                        background: `linear-gradient(90deg, ${theme.from}, ${theme.to})`,
                        boxShadow: `0 0 8px ${theme.to}40`,
                        transition: 'width 1s linear',
                    }}
                />
            </div>

            {/* HRS / MIN / SEC Labels */}
            <div className="flex items-baseline justify-between w-44 mt-2.5">
                <div className="flex items-baseline gap-1.5">
                    <span className={clsx("text-[9px] font-mono font-semibold tracking-[0.15em] uppercase", theme.label)}>hrs</span>
                    <span className={clsx("text-xs font-mono font-bold tabular-nums", theme.value)}>{timeLeft.hours}</span>
                </div>
                <div className="flex items-baseline gap-1.5">
                    <span className={clsx("text-[9px] font-mono font-semibold tracking-[0.15em] uppercase", theme.label)}>min</span>
                    <span className={clsx("text-xs font-mono font-bold tabular-nums", theme.value)}>{timeLeft.minutes}</span>
                </div>
                <div className="flex items-baseline gap-1.5">
                    <span className={clsx("text-[9px] font-mono font-semibold tracking-[0.15em] uppercase", theme.label)}>sec</span>
                    <span className={clsx("text-xs font-mono font-bold tabular-nums", theme.value)}>{timeLeft.seconds}</span>
                </div>
            </div>

            {/* Crisis Warning */}
            {isCrisis && (
                <div className="text-[9px] text-rose-500 font-bold tracking-[0.3em] mt-2 uppercase opacity-80 animate-pulse">
                    Critical Cycle
                </div>
            )}
        </div>
    );
};

export default DayTimer;
