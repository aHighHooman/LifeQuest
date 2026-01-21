import React from 'react';
import { LayoutDashboard, Scroll, Zap } from 'lucide-react';
import clsx from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';

const Navigation = ({ currentTab, onTabChange }) => {
    const tabs = [
        { id: 'quests', label: 'Quests', icon: Scroll, color: 'text-blue-400' },
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, color: 'text-game-accent' },
        { id: 'protocols', label: 'Protocols', icon: Zap, color: 'text-game-gold' },
    ];

    const activeIndex = tabs.findIndex(t => t.id === currentTab);
    // If currentTab is not in nav (e.g. 'budget' or 'calories'), default to Dashboard or keep selection clear?
    // Let's assume we want to highlight nothing if off-nav, but keep the wheel centered or reasonably placed.
    // If off-nav, let's just default rotation to 0 (Dashboard center).
    const validNavIndex = activeIndex !== -1 ? activeIndex : 1;

    // Define fixed angles for the 3 items to be symmetrical
    // Quests (-45), Dashboard (0), Protocols (45)
    // To center an item, we rotate the container by -itemAngle.
    const angles = [-45, 0, 45];
    const rotation = -angles[validNavIndex];

    const [dragOffset, setDragOffset] = React.useState(0);

    const onPan = (event, info) => {
        // Map horizontal drag pixels to degrees. 
        // Dragging 1px = 0.5 degrees rotation.
        setDragOffset(info.offset.x * 0.5);
    };

    const onPanEnd = (event, info) => {
        const threshold = 50; // px drag to trigger switch
        if (info.offset.x > threshold) {
            // Dragged Right -> Rotate Clockwise -> Go to Previous (Left) Tab
            if (validNavIndex > 0) {
                onTabChange(tabs[validNavIndex - 1].id);
            }
        } else if (info.offset.x < -threshold) {
            // Dragged Left -> Rotate Counter-Clockwise -> Go to Next (Right) Tab
            if (validNavIndex < tabs.length - 1) {
                onTabChange(tabs[validNavIndex + 1].id);
            }
        }
        setDragOffset(0);
    };

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-center h-40 pointer-events-none overflow-hidden">
            <div className="relative w-80 h-32 flex items-end justify-center">
                {/* Rotating Container (The Arc Wheel) */}
                <motion.nav
                    onPan={onPan}
                    onPanEnd={onPanEnd}
                    animate={{ rotate: rotation + dragOffset }}
                    transition={{ type: "spring", stiffness: 200, damping: 25 }}
                    className="pointer-events-auto bg-slate-950/60 border border-slate-700/50 backdrop-blur-2xl rounded-full w-[400px] h-[400px] absolute -bottom-[320px] flex justify-center pt-8 shadow-[0_-10px_40px_rgba(0,0,0,0.6)] cursor-grab active:cursor-grabbing"
                >
                    {tabs.map((tab, index) => {
                        const Icon = tab.icon;
                        const isActive = currentTab === tab.id;
                        const angle = angles[index];

                        // Positioning items on the wheel edge (Convex Arc)
                        // With a 400px circle (200px radius), top center is (0, -200) relative to center.
                        // But here we are positioned absolutely inside the big circle.
                        // Center of circle is roughly 50% 50%. Top is 50% 0.

                        // Let's use simple trig to place them fixed on the circle, then rotate the circle.
                        // 0 degrees is top.
                        // We need to convert degrees to radians (angle - 90 for standard unit circle if 0 is right, but let's just use CSS rotate).

                        // Actually, easier: Use transform Origin center and just rotate the item wrapper?
                        // No, let's stick to the previous math but simplified.
                        // If we assume the container rotates, the items are fixed relative to container.

                        const radius = 175; // slightly less than 200 to give padding
                        const radian = (angle - 90) * (Math.PI / 180); // -90 so 0 is top

                        const x = radius * Math.cos(radian);
                        const y = radius * Math.sin(radian) + 200; // Shift down so top is at y=25ish? No, y=0 is top of box.
                        // box is 400x400. Center is 200,200.
                        // x = 200 + radius * cos(theta)
                        // y = 200 + radius * sin(theta)

                        const finalX = 200 + radius * Math.cos(radian);
                        const finalY = 200 + radius * Math.sin(radian);

                        return (
                            <button
                                key={tab.id}
                                onClick={() => onTabChange(tab.id)}
                                style={{
                                    left: finalX,
                                    top: finalY,
                                    position: 'absolute',
                                    transform: `translate(-50%, -50%) rotate(${-rotation}deg)`, // Counter-rotate icon so it stays upright
                                    transition: 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)'
                                }}
                                className={clsx(
                                    "flex flex-col items-center justify-center transition-opacity duration-300",
                                    isActive ? tab.color : "text-gray-500 hover:text-gray-300"
                                )}
                            >
                                {/* Active Highlight */}
                                <AnimatePresence>
                                    {isActive && (
                                        <motion.div
                                            layoutId="nav-active-glow"
                                            initial={{ opacity: 0, scale: 0.5 }}
                                            animate={{ opacity: 1, scale: 1.3 }}
                                            exit={{ opacity: 0, scale: 0.5 }}
                                            className="absolute inset-0 bg-current/10 blur-2xl rounded-full"
                                        />
                                    )}
                                </AnimatePresence>

                                <div className={clsx(
                                    "p-3 rounded-full relative z-10 transition-all duration-500",
                                    isActive && "scale-125"
                                )}>
                                    <Icon size={isActive ? 28 : 24} />
                                </div>

                                <div className="h-4 flex items-center justify-center mt-1 absolute top-full">
                                    <AnimatePresence mode="wait">
                                        {isActive && (
                                            <motion.span
                                                initial={{ opacity: 0, y: -5 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: -5 }}
                                                className="text-[9px] font-black uppercase tracking-[0.15em] whitespace-nowrap drop-shadow-lg"
                                            >
                                                {tab.label}
                                            </motion.span>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </button>
                        );
                    })}
                </motion.nav>

                {/* HUD Focus Indicator */}
                <div className="absolute top-4 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-game-accent rounded-full shadow-[0_0_10px_rgba(56,189,248,1)] z-20 pointer-events-none opacity-80" />
            </div>
        </div>
    );
};

export default Navigation;
