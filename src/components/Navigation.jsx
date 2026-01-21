import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Scroll, Zap, Coins, ChevronUp, Heart } from 'lucide-react';
import clsx from 'clsx';
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion';

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

    const outerAngles = [-45, 0, 45];
    const validOuterIndex = outerIndex !== -1 ? outerIndex : 1;
    const baseOuterRotation = -outerAngles[validOuterIndex];

    const innerAngles = [-25, 25];
    const validInnerIndex = innerIndex !== -1 ? innerIndex : 0;
    const baseInnerRotation = -innerAngles[validInnerIndex];

    // ANIMATION FIX: Imperative Control
    // We use raw MotionValues and drive them with `animate()` to ensure robust handoffs and no drift.

    // 1. Source Values
    const innerRotationMV = useMotionValue(baseInnerRotation);
    const outerRotationMV = useMotionValue(baseOuterRotation);

    // 2. Helper to animate to a specific tab's target state
    const animateToTab = (targetTabId) => {
        const springConfig = { stiffness: 160, damping: 20 };

        // Calculate targets for the new tab
        const targetOuterIndex = outerTabs.findIndex(t => t.id === targetTabId);
        const targetValidOuterIndex = targetOuterIndex !== -1 ? targetOuterIndex : 1;
        const targetOuterRotation = -outerAngles[targetValidOuterIndex];

        const targetInnerIndex = innerTabs.findIndex(t => t.id === targetTabId);
        const targetValidInnerIndex = targetInnerIndex !== -1 ? targetInnerIndex : 0;
        const targetInnerRotation = -innerAngles[targetValidInnerIndex];

        animate(innerRotationMV, targetInnerRotation, springConfig);
        animate(outerRotationMV, targetOuterRotation, springConfig);
    };

    // 3. Sync with external State changes (e.g. user clicked a tab elsewhere)
    useEffect(() => {
        animateToTab(currentTab);
    }, [currentTab]); // Functionally dependent on currentTab only

    // Combine Spring (State) + Drag (User Input)
    const innerRotationTransform = useTransform(
        [innerRotationMV, dragOffset],
        ([base, drag]) => base + (isExpanded ? drag : 0)
    );

    const outerRotationTransform = useTransform(
        [outerRotationMV, dragOffset],
        ([base, drag]) => base + (!isExpanded ? drag : 0)
    );

    // Counter-rotation for icons so they stay upright DURING the animation
    const negInnerRotation = useTransform(innerRotationTransform, r => -r);
    const negOuterRotation = useTransform(outerRotationTransform, r => -r);


    // -- Global Gestures --

    const onPanEnd = (event, info) => {
        const threshold = 30;
        const { x, y } = info.offset;
        const absX = Math.abs(x);
        const absY = Math.abs(y);

        // HANDOFF: Snap MV to current visual state then reset drag
        const currentDrag = dragOffset.get();
        if (isExpanded) {
            innerRotationMV.set(innerRotationMV.get() + currentDrag);
        } else {
            outerRotationMV.set(outerRotationMV.get() + currentDrag);
        }
        dragOffset.set(0);

        // Predict Next Tab
        let nextTab = currentTab;
        let nextIsExpanded = isExpanded;

        if (absY > absX && absY > 30) {
            // Vertical Swipe
            if (y < 0 && !isExpanded) {
                // Swipe Up -> Expand
                nextIsExpanded = true;
                // Original logic: if (innerIndex === -1) onTabChange(innerTabs[0].id);
                // If innerIndex is VALID, we stay on it? Or do nothing?
                // "Swipe Up -> Expand" implies we just reveal the inner disk.
                // If we are already on 'dashboard' (outer), expanding reveals 'budget' (inner)?
                // Let's stick to original logic:
                if (innerIndex === -1) nextTab = innerTabs[0].id; // Default to first inner
            }
            if (y > 0 && isExpanded) {
                // Swipe Down -> Collapse
                nextIsExpanded = false;
                nextTab = 'dashboard';
            }
        } else if (absX > threshold) {
            // Horizontal Swipe
            if (isExpanded) {
                if (x > 0 && validInnerIndex > 0) {
                    nextTab = innerTabs[validInnerIndex - 1].id;
                } else if (x < 0 && validInnerIndex < innerTabs.length - 1) {
                    nextTab = innerTabs[validInnerIndex + 1].id;
                }
            } else {
                if (x > 0 && validOuterIndex > 0) {
                    nextTab = outerTabs[validOuterIndex - 1].id;
                } else if (x < 0 && validOuterIndex < outerTabs.length - 1) {
                    nextTab = outerTabs[validOuterIndex + 1].id;
                }
            }
        }

        // Apply Logic
        if (nextIsExpanded !== isExpanded) setIsExpanded(nextIsExpanded);

        // Optimize: Trigger animation IMMEDIATELY to predicted tab
        // This prevents drift even if onTabChange is slow or if tab doesn't change (snaps back)
        animateToTab(nextTab);

        if (nextTab !== currentTab) {
            onTabChange(nextTab);
        }
    };

    const onPan = (event, info) => {
        // Direct update to motion value - NO RE-RENDER
        if (Math.abs(info.offset.x) > Math.abs(info.offset.y)) {
            // SENSITIVITY FIX:
            // 1. Reduced multiplier from 0.5 to 0.25 (Feel "heavier" and more controlled)
            // 2. Clamped to +/- 40 degrees max (Prevent "edge to edge" wild spinning)
            const raw = info.offset.x * 0.25;
            const clamped = Math.max(-40, Math.min(40, raw));
            dragOffset.set(clamped);
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
                            // rotate: handled in style by transform
                        }}
                        style={{
                            rotate: innerRotationTransform
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
                                <motion.button
                                    key={tab.id}
                                    className="absolute pointer-events-auto hover:scale-110 transition-transform p-3 rounded-full"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onTabChange(tab.id);
                                    }}
                                    style={{
                                        left,
                                        top,
                                        x: "-50%",
                                        y: "-50%",
                                        rotate: negInnerRotation,
                                    }}
                                >
                                    <Icon
                                        size={28}
                                        className={clsx(
                                            "transition-colors duration-300",
                                            isActive ? tab.color : "text-slate-600"
                                        )}
                                    />
                                </motion.button>
                            );
                        })}
                    </motion.div>


                    {/* Outer Disk (Quests/Dash/Proto) */}
                    <motion.div
                        animate={{
                            y: isExpanded ? -80 : 0,
                            // rotate: handled in style by transform
                        }}
                        style={{
                            rotate: outerRotationTransform
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
                                <motion.button
                                    key={tab.id}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onTabChange(tab.id);
                                    }}
                                    className="absolute pointer-events-auto flex flex-col items-center justify-center group"
                                    style={{
                                        left,
                                        top,
                                        x: "-50%",
                                        y: "-50%",
                                        rotate: negOuterRotation
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
                                </motion.button>
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
