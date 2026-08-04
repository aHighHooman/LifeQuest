export const DASHBOARD_COORDINATE_PLANE_TOP = 'calc(-1 * var(--tabletop-content-inset, calc(0.5rem + env(safe-area-inset-top))))';

export const DASHBOARD_HOTSPOTS = {
    health: {
        leftPercent: 45.9185,
        topPercent: 18.9167,
        widthPercent: 27,
        heightPercent: 3.8
    },
    coins: {
        leftPercent: 15.2037,
        topPercent: 70.74,
        widthPercent: 8.8,
        heightPercent: 4
    }
};

// The coin balance is printed on one coin, but the whole visible pile is the
// physical control. Keep its larger interaction bounds separate so the label
// can remain registered to the intended coin face.
export const DASHBOARD_COIN_HIT_TARGET = {
    leftPercent: 0,
    topPercent: 61,
    widthPercent: 39,
    heightPercent: 20
};

export const DASHBOARD_PHYSICAL_TARGETS = {
    injectorDisplay: {
        leftPercent: 37.5185,
        topPercent: 10.4167,
        rightPercent: 76.5185,
        bottomPercent: 26.4167
    },
    coinFace: {
        leftPercent: 14.7037,
        topPercent: 67.5,
        rightPercent: 25.7037,
        bottomPercent: 74.5
    }
};

export const DASHBOARD_HEX_LAYOUT = {
    nodeWidth: 144,
    nodeHeight: 160,
    dx: 76,
    dy: 128,
    mobileInnerScale: 0.67,
    mobileOuterScale: 0.9,
    mobileTranslateXVw: 0,
    mobileTranslateYVh: -9,
    mobilePaddingTopVh: 36,
    desktopInnerScale: 0.52,
    desktopPaddingTopVh: 45
};

export const TABLETOP_TRANSITION = {
    durationSeconds: 0.38,
    ease: [0.45, 0, 0.2, 1],
    turnTiltDegrees: 0.9,
    turnScale: 1.006
};

export const getDashboardHexPositions = () => {
    const { dx, dy } = DASHBOARD_HEX_LAYOUT;

    return [
        { x: 0, y: 0 },
        { x: dx, y: -dy },
        { x: dx * 2, y: 0 },
        { x: dx, y: dy },
        { x: -dx, y: dy },
        { x: -dx * 2, y: 0 },
        { x: -dx, y: -dy }
    ];
};
