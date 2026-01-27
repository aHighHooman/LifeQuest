/**
 * Shared animation configurations for consistent motion throughout the app.
 */

// Standard spring for card deck animations (Quest/Protocol cards)
export const SPRING_CONFIG = {
    type: "spring",
    stiffness: 400,
    damping: 40
};

// Softer spring for navigation wheel animations
export const NAV_SPRING_CONFIG = {
    stiffness: 160,
    damping: 20
};
