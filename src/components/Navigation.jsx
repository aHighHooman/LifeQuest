import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Scroll, Zap, Coins, ChevronUp, Heart } from 'lucide-react';
import clsx from 'clsx';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';

const Navigation = ({ currentTab, onTabChange }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    // OPTIMIZATION: Use MotionValues instead of State for drag to prevent re-renders
    const dragOffset = useMotionValue(0);

    const outerTabs = [
        { id: 'quests', label: 'Quests', icon: Scroll, color: 'text-blue-400' },
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, color: 'text-game-accent' },
        { id: 'protocols', label: 'Protocols', icon: Zap, color: 'text-purple-400' },
    ];

    const innerTabs = [
        { id: 'budget', label: 'Budget', icon: Coins, color: 'text-game-gold' },
        { id: 'calories', label: 'Health', icon: Heart, color: 'text-red-400' },
    ];

    // Determine active indices
    const outerIndex = outerTabs.findIndex(t => t.id === currentTab);
    const innerIndex = innerTabs.findIndex(t => t.id === currentTab);

    // Auto-expand if on inner tab
    useEffect(() => {
        if (innerIndex !== -1) {
            setIsExpanded(true);
        }
    }, [currentTab, innerIndex]);


    // -- Rotation Logic --
    // We compute the BASE rotation. The drag offset will be ADDED to this via transform.

    const outerAngles = [-45, 0, 45];
    const validOuterIndex = outerIndex !== -1 ? outerIndex : 1;
    const baseOuterRotation = -outerAngles[validOuterIndex];

    const innerAngles = [-25, 25]; // Tighter for inner arc
    const validInnerIndex = innerIndex !== -1 ? innerIndex : 0;
    const baseInnerRotation = -innerAngles[validInnerIndex];

    // Create transformed motion values for actual rotation
    // If NOT expanded, outer rotates with drag. If expanded, inner rotates with drag.
    // We can conditionally apply the drag offset in the animate prop or via a derived motion value.
    // Simpler approach: Pass the raw MotionValue to the animate logic or styling.

    // However, since we are doing conditional logic (isExpanded determines WHICH disk gets the drag),
    // we might need to reset dragOffset to 0 on panEnd, which we do.

    // Computed rotations for the disks
    // We can't put `isExpanded ? dragOffset : 0` directly into `animate` easily without causing re-renders if we were mixing state.
    // BUT `useMotionValue` allows us to feed it directly.

    // -- Global Gestures --

    const onPanEnd = (event, info) => {
        const threshold = 30;
        const { x, y } = info.offset;
        const absX = Math.abs(x);
        const absY = Math.abs(y);

        if (absY > absX && absY > 30) {
            // Vertical Swipe
            if (y < 0 && !isExpanded) {
                // Swipe Up -> Expand & Default to 'budget' (or first inner tab)
                setIsExpanded(true);
                if (innerIndex === -1) onTabChange(innerTabs[0].id);
            }
            if (y > 0 && isExpanded) {
                // Swipe Down -> Collapse & specific back to 'dashboard'
                setIsExpanded(false);
                onTabChange('dashboard');
            }
        } else if (absX > threshold) {
            // Horizontal Swipe
            // We read the current X drag to decide direction
            if (isExpanded) {
                if (x > 0 && validInnerIndex > 0) {
                    onTabChange(innerTabs[validInnerIndex - 1].id);
                } else if (x < 0 && validInnerIndex < innerTabs.length - 1) {
                    onTabChange(innerTabs[validInnerIndex + 1].id);
                }
            } else {
                if (x > 0 && validOuterIndex > 0) {
                    onTabChange(outerTabs[validOuterIndex - 1].id);
                } else if (x < 0 && validOuterIndex < outerTabs.length - 1) {
                    onTabChange(outerTabs[validOuterIndex + 1].id);
                }
            }
        }

        // Reset the motion value cleanly
        dragOffset.set(0);
    };

    const onPan = (event, info) => {
        // Direct update to motion value - NO RE-RENDER
        if (Math.abs(info.offset.x) > Math.abs(info.offset.y)) {
            dragOffset.set(info.offset.x * 0.5);
        }
    };

    return (
        <>
            {/* Gesture Capture Layer */}
            <motion.div
                className="fixed bottom-0 left-0 right-0 h-[50vh] z-10"
                onPan={onPan}
                onPanEnd={onPanEnd}
                style={{ touchAction: 'none' }}
            />

            <div className="fixed bottom-0 left-0 right-0 z-20 flex justify-center h-0 pointer-events-none overflow-visible">

                <div className="relative flex items-end justify-center pointer-events-auto mb-[-50px]">

                    {/* Inner Disk (Budget/Health) */}
                    <motion.div
                        animate={{
                            y: isExpanded ? -70 : 0,
                            scale: isExpanded ? 1 : 0.9,
                            opacity: isExpanded ? 1 : 0,
                            rotate: baseInnerRotation
                            // We handle the DRAG rotation separately or add it here? 
                            // If we add `+ dragOffset.get()` here, it reads the value ONCE at render/animate start.
                            // We need it to be dynamic. 
                            // `style={{ rotate: transformedInnerRotation }}` is better.
                        }}
                        style={{
                            // We combine base rotation (state) + drag (motion value)
                            // Since baseRotation is a number, checking `isExpanded`
                            rotate: isExpanded ? useTransform(dragOffset, (v) => baseInnerRotation + v) : baseInnerRotation
                        }}
                        transition={{ type: "spring", stiffness: 160, damping: 20 }}
                        onPan={onPan}
                        onPanEnd={onPanEnd}
                        className="absolute bottom-[-180px] w-[300px] h-[300px] rounded-full flex justify-center items-start pt-6 z-40 pointer-events-auto bg-slate-900/90 backdrop-blur-md"
                    >
                        {/* Visual Arc for Inner */}

                        {innerTabs.map((tab, index) => {
                            const Icon = tab.icon;
                            const radius = 120;
                            const angle = innerAngles[index];
                            const radian = (angle - 90) * (Math.PI / 180);
                            const isActive = currentTab === tab.id;

                            const left = 150 + radius * Math.cos(radian);
                            const top = 150 + radius * Math.sin(radian);

                            return (
                                <button
                                    key={tab.id}
                                    className="absolute pointer-events-auto hover:scale-110 transition-transform p-3 rounded-full"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onTabChange(tab.id);
                                    }}
                                    style={{
                                        left,
                                        top,
                                        // Counter-rotate icons so they stay upright relative to the screen? 
                                        // Or just relative to the disk? Currently relative to disk.
                                        transform: `translate(-50%, -50%) rotate(${-baseInnerRotation}deg)`
                                    }}
                                >
                                    <Icon
                                        size={28}
                                        className={clsx(
                                            "transition-colors duration-300",
                                            isActive ? tab.color : "text-slate-600"
                                        )}
                                    />
                                </button>
                            );
                        })}
                    </motion.div>


                    {/* Outer Disk (Quests/Dash/Proto) */}
                    <motion.div
                        animate={{
                            y: isExpanded ? -80 : 0,
                            // rotate: baseOuterRotation // Moved to style for performance
                        }}
                        style={{
                            rotate: !isExpanded ? useTransform(dragOffset, (v) => baseOuterRotation + v) : baseOuterRotation
                        }}
                        transition={{ type: "spring", stiffness: 160, damping: 20 }}
                        onPan={onPan}
                        onPanEnd={onPanEnd}
                        className="absolute bottom-[-330px] w-[500px] h-[500px] rounded-full bg-slate-950 shadow-2xl z-30 flex justify-center items-start pt-10 pointer-events-auto"
                    >
                        <div className="absolute top-4 w-[480px] h-[480px] rounded-full pointer-events-none" />

                        {outerTabs.map((tab, index) => {
                            const Icon = tab.icon;
                            const radius = 220;
                            const angle = outerAngles[index];
                            const radian = (angle - 90) * (Math.PI / 180);
                            const isActive = currentTab === tab.id;

                            const left = 250 + radius * Math.cos(radian);
                            const top = 250 + radius * Math.sin(radian);

                            return (
                                <button
                                    key={tab.id}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onTabChange(tab.id);
                                    }}
                                    className="absolute pointer-events-auto flex flex-col items-center justify-center group"
                                    style={{
                                        left,
                                        top,
                                        transform: `translate(-50%, -50%) rotate(${-baseOuterRotation}deg)`
                                    }}
                                >
                                    <div className={clsx(
                                        "p-3 rounded-full transition-all duration-300",
                                    )}>
                                        <Icon
                                            size={isActive ? 32 : 24}
                                            className={clsx(isActive ? tab.color : "text-slate-500 group-hover:text-slate-400")}
                                        />
                                    </div>

                                    {isActive && (
                                        <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mt-2">
                                            {tab.label}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </motion.div>

                    {/* Chevron Hint */}
                    {!isExpanded && (
                        <motion.div
                            animate={{ y: [0, -5, 0] }}
                            transition={{ duration: 2, repeat: Infinity }}
                            className="absolute bottom-10 z-40 text-slate-700 pointer-events-none"
                        >
                            <ChevronUp />
                        </motion.div>
                    )}

                </div>
            </div>
        </>
    );
};

export default Navigation;
