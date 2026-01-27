import React, { useState, useEffect } from 'react';
import clsx from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';

const DayTimer = ({ className }) => {
    const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0, totalMinutes: 0 });

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

            setTimeLeft({ hours, minutes, seconds, totalMinutes });
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, []);

    // Color Logic: Gradient Text (bg-clip-text)
    // Matches Dashboard SVG Gradients roughly
    const getTheme = (minutes) => {
        if (minutes > 720) { // > 12h: Blue/Sky (XP Theme)
            return {
                gradient: "bg-gradient-to-b from-sky-300 to-sky-600",
                text: "text-transparent bg-clip-text",
            };
        } else if (minutes < 180) { // < 3h: Red/Rose (HP Theme)
            return {
                gradient: "bg-gradient-to-b from-rose-300 to-rose-600",
                text: "text-transparent bg-clip-text",
            };
        } else {
            // Transition: Purple
            return {
                gradient: "bg-gradient-to-b from-purple-300 to-purple-600",
                text: "text-transparent bg-clip-text",
            };
        }
    };

    const theme = getTheme(timeLeft.totalMinutes);
    const isCrisis = timeLeft.totalMinutes < 180;

    return (
        <div className={clsx("flex flex-col items-center justify-center pointer-events-none select-none transition-all duration-1000", className)}>
            <div className="relative flex items-baseline justify-center">
                {/* Main Time (Hours:Minutes) - Centered */}
                <div className={clsx("flex items-baseline gap-0 z-10", theme.text, theme.gradient)}>
                    <span className="text-4xl font-game font-bold tracking-tight tabular-nums leading-none">
                        {String(timeLeft.hours).padStart(2, '0')}
                    </span>

                    <span className={clsx("text-2xl font-bold mx-0.5 opacity-80 relative -top-0.5", isCrisis ? "animate-pulse" : "")}>:</span>

                    <span className="text-4xl font-game font-bold tracking-tight tabular-nums leading-none">
                        {String(timeLeft.minutes).padStart(2, '0')}
                    </span>
                </div>

                {/* Seconds (Hanging to the right) */}
                <div className={clsx("absolute left-full bottom-0 mb-1 ml-2 font-mono font-bold text-lg tabular-nums opacity-80", theme.text, theme.gradient)}>
                    {String(timeLeft.seconds).padStart(2, '0')}
                </div>
            </div>

            {/* Minimal Label */}
            {isCrisis && (
                <div className="text-[10px] text-rose-500 font-bold tracking-[0.3em] mt-2 uppercase opacity-80 animate-pulse">
                    Critical Cycle
                </div>
            )}
        </div>
    );
};

export default DayTimer;
