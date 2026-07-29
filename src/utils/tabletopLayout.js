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
        topPercent: 71.1,
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
    mobileTranslateXVw: 14.1,
    mobileTranslateYVh: -8,
    mobilePaddingTopVh: 36,
    desktopInnerScale: 0.52,
    desktopPaddingTopVh: 45
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

export const getTabletopTransitionUiState = ({ currentTab, cameraMove }) => ({
    interfaceDashboardIsActive: currentTab === 'dashboard',
    shouldAnimateInterface: Boolean(cameraMove)
});
