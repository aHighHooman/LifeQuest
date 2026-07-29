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
        leftPercent: 14.8,
        topPercent: 70.2,
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
        leftPercent: 12,
        topPercent: 66,
        rightPercent: 25,
        bottomPercent: 75
    }
};

export const DASHBOARD_HEX_LAYOUT = {
    nodeWidth: 144,
    nodeHeight: 160,
    dx: 76,
    dy: 128,
    mobileInnerScale: 0.75,
    mobileOuterScale: 0.9,
    mobileTranslateYVh: -8,
    mobilePaddingTopVh: 36,
    desktopInnerScale: 0.52,
    desktopPaddingTopVh: 45,
    bottomRowShiftX: 88
};

export const getDashboardHexPositions = () => {
    const {
        dx,
        dy,
        bottomRowShiftX
    } = DASHBOARD_HEX_LAYOUT;

    return [
        { x: 0, y: 0 },
        { x: dx, y: -dy },
        { x: dx * 2, y: 0 },
        { x: dx + bottomRowShiftX, y: dy },
        { x: -dx + bottomRowShiftX, y: dy },
        { x: -dx * 2, y: 0 },
        { x: -dx, y: -dy }
    ];
};

export const getHotspotCenter = (hotspot) => ({
    x: hotspot.leftPercent + (hotspot.widthPercent / 2),
    y: hotspot.topPercent + (hotspot.heightPercent / 2)
});

export const pointIsInsideBounds = (point, bounds) => (
    point.x >= bounds.leftPercent
    && point.x <= bounds.rightPercent
    && point.y >= bounds.topPercent
    && point.y <= bounds.bottomPercent
);

export const rectanglesOverlap = (first, second) => (
    first.left < second.right
    && first.right > second.left
    && first.top < second.bottom
    && first.bottom > second.top
);

export const getCoordinatePlaneOffset = (contentInset) => -contentInset;

export const getMobileHexNodeRects = ({
    frameWidth = 390,
    gridOriginY = 500
} = {}) => {
    const positions = getDashboardHexPositions();
    const scale = DASHBOARD_HEX_LAYOUT.mobileInnerScale
        * DASHBOARD_HEX_LAYOUT.mobileOuterScale;
    const width = DASHBOARD_HEX_LAYOUT.nodeWidth * scale;
    const height = DASHBOARD_HEX_LAYOUT.nodeHeight * scale;
    const originX = frameWidth / 2;

    return positions.map((position) => {
        const centerX = originX + (position.x * scale);
        const centerY = gridOriginY + (position.y * scale);

        return {
            left: centerX - (width / 2),
            right: centerX + (width / 2),
            top: centerY - (height / 2),
            bottom: centerY + (height / 2)
        };
    });
};

export const getTabletopTransitionUiState = ({ currentTab, cameraMove }) => ({
    interfaceDashboardIsActive: currentTab === 'dashboard',
    shouldAnimateInterface: Boolean(cameraMove)
});
