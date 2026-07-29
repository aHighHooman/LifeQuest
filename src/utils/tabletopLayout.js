export const TABLETOP_CONTENT_INSET = {
    mobileRem: 0.5,
    desktopRem: 0.75
};

export const DASHBOARD_COORDINATE_PLANE_TOP = 'calc(-1 * var(--tabletop-content-inset, calc(0.5rem + env(safe-area-inset-top))))';

export const DASHBOARD_HOTSPOTS = {
    health: {
        leftPercent: 47.4,
        topPercent: 22.5,
        widthPercent: 27,
        heightPercent: 3.8
    },
    coins: {
        leftPercent: 16.5,
        topPercent: 73.24,
        widthPercent: 8.8,
        heightPercent: 4
    }
};

export const DASHBOARD_PHYSICAL_TARGETS = {
    injectorDisplay: {
        leftPercent: 39,
        topPercent: 14,
        rightPercent: 78,
        bottomPercent: 30
    },
    coinFace: {
        leftPercent: 16,
        topPercent: 70,
        rightPercent: 27,
        bottomPercent: 77
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
    sourceDurationSeconds: 1,
    playbackRate: 2.2,
    wallDurationSeconds: 1 / 2.2,
    ease: [0.45, 0, 0.2, 1]
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

export const getTabletopTransitionProgress = (mediaTimeSeconds) => {
    const normalizedTime = Math.max(
        0,
        Math.min(1, mediaTimeSeconds / TABLETOP_TRANSITION.sourceDurationSeconds)
    );
    const [x1, y1, x2, y2] = TABLETOP_TRANSITION.ease;
    const sampleCurve = (time, point1, point2) => {
        const inverse = 1 - time;
        return (
            (3 * inverse * inverse * time * point1)
            + (3 * inverse * time * time * point2)
            + (time * time * time)
        );
    };
    let low = 0;
    let high = 1;

    for (let index = 0; index < 18; index += 1) {
        const midpoint = (low + high) / 2;
        if (sampleCurve(midpoint, x1, x2) < normalizedTime) {
            low = midpoint;
        } else {
            high = midpoint;
        }
    }

    return sampleCurve((low + high) / 2, y1, y2);
};

export const getTabletopInterfaceLeftPercent = ({ fromTab, mediaTimeSeconds }) => {
    const progress = getTabletopTransitionProgress(mediaTimeSeconds);
    return fromTab === 'dashboard'
        ? -100 + (progress * 100)
        : -(progress * 100);
};
