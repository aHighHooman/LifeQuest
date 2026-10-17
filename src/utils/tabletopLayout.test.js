import { describe, expect, it } from 'vitest';
import {
    DASHBOARD_HEX_LAYOUT,
    DASHBOARD_COIN_HIT_TARGET,
    DASHBOARD_HOTSPOTS,
    DASHBOARD_PHYSICAL_TARGETS,
    getDashboardHexPositions
} from './tabletopLayout.js';

const getHotspotCenter = (hotspot) => ({
    x: hotspot.leftPercent + (hotspot.widthPercent / 2),
    y: hotspot.topPercent + (hotspot.heightPercent / 2)
});

const pointIsInsideBounds = (point, bounds) => (
    point.x >= bounds.leftPercent
    && point.x <= bounds.rightPercent
    && point.y >= bounds.topPercent
    && point.y <= bounds.bottomPercent
);

const projectPolygon = (polygon, axis) => {
    const values = polygon.map((point) => (point.x * axis.x) + (point.y * axis.y));
    return { min: Math.min(...values), max: Math.max(...values) };
};

const polygonsOverlap = (first, second) => {
    const edges = [...first, ...second].map((point, index) => {
        const polygon = index < first.length ? first : second;
        const polygonIndex = index < first.length ? index : index - first.length;
        const next = polygon[(polygonIndex + 1) % polygon.length];
        return { x: next.x - point.x, y: next.y - point.y };
    });

    return edges.every((edge) => {
        const axis = { x: -edge.y, y: edge.x };
        const firstProjection = projectPolygon(first, axis);
        const secondProjection = projectPolygon(second, axis);
        return firstProjection.max > secondProjection.min
            && secondProjection.max > firstProjection.min;
    });
};

const getMobileHexNodePolygons = ({
    frameWidth = 390,
    frameHeight = 844,
    safeAreaTop = 59
} = {}) => {
    const positions = getDashboardHexPositions();
    const scale = DASHBOARD_HEX_LAYOUT.mobileInnerScale
        * DASHBOARD_HEX_LAYOUT.mobileOuterScale;
    const width = DASHBOARD_HEX_LAYOUT.nodeWidth * scale;
    const height = DASHBOARD_HEX_LAYOUT.nodeHeight * scale;
    const originX = frameWidth / 2;
    const contentInset = 8 + safeAreaTop;
    const hudPadding = (frameHeight * DASHBOARD_HEX_LAYOUT.mobilePaddingTopVh / 100)
        - contentInset;
    const matrixTopInsideHud = (380 - 320) / 2;
    const matrixCenter = 320 / 2;
    const translatedY = frameHeight
        * DASHBOARD_HEX_LAYOUT.mobileTranslateYVh
        / 100
        * DASHBOARD_HEX_LAYOUT.mobileOuterScale;
    const originY = contentInset
        + hudPadding
        + matrixTopInsideHud
        + matrixCenter
        + translatedY;

    return positions.map((position) => {
        const centerX = originX + (position.x * scale);
        const centerY = originY + (position.y * scale);
        const halfWidth = width / 2;
        const halfHeight = height / 2;

        return [
            { x: centerX, y: centerY - halfHeight },
            { x: centerX + halfWidth, y: centerY - (halfHeight / 2) },
            { x: centerX + halfWidth, y: centerY + (halfHeight / 2) },
            { x: centerX, y: centerY + halfHeight },
            { x: centerX - halfWidth, y: centerY + (halfHeight / 2) },
            { x: centerX - halfWidth, y: centerY - (halfHeight / 2) }
        ];
    });
};

// Tight silhouettes measured from the 390px-wide Blender dashboard plate.
// These deliberately follow the props instead of reserving broad screen-wide boxes.
const injectorSilhouette = [
    { x: 0, y: 63 },
    { x: 104, y: 81 },
    { x: 350, y: 259 },
    { x: 320, y: 294 },
    { x: 192, y: 208 },
    { x: 0, y: 112 }
];

const coinPileSilhouette = [
    { x: 53, y: 560 },
    { x: 85, y: 558 },
    { x: 111, y: 570 },
    { x: 132, y: 591 },
    { x: 149, y: 617 },
    { x: 145, y: 651 },
    { x: 128, y: 681 },
    { x: 96, y: 697 },
    { x: 61, y: 696 },
    { x: 33, y: 680 },
    { x: 8, y: 657 },
    { x: 3, y: 624 },
    { x: 21, y: 593 }
];

describe('tabletop layout contracts', () => {
    it('keeps the health readout centered on the injector display', () => {
        const center = getHotspotCenter(DASHBOARD_HOTSPOTS.health);

        expect(pointIsInsideBounds(center, DASHBOARD_PHYSICAL_TARGETS.injectorDisplay)).toBe(true);
    });

    it('keeps the coin count centered on the intended coin face', () => {
        const center = getHotspotCenter(DASHBOARD_HOTSPOTS.coins);
        expect(pointIsInsideBounds(center, DASHBOARD_PHYSICAL_TARGETS.coinFace)).toBe(true);
    });

    it('makes the whole physical coin pile open the budget', () => {
        const pileBounds = {
            leftPercent: DASHBOARD_COIN_HIT_TARGET.leftPercent,
            topPercent: DASHBOARD_COIN_HIT_TARGET.topPercent,
            rightPercent: DASHBOARD_COIN_HIT_TARGET.leftPercent + DASHBOARD_COIN_HIT_TARGET.widthPercent,
            bottomPercent: DASHBOARD_COIN_HIT_TARGET.topPercent + DASHBOARD_COIN_HIT_TARGET.heightPercent
        };
        const coinFaceCenter = getHotspotCenter(DASHBOARD_HOTSPOTS.coins);

        expect(pointIsInsideBounds(coinFaceCenter, pileBounds)).toBe(true);
        expect(coinPileSilhouette.every((point) => pointIsInsideBounds({
            x: point.x / 3.9,
            y: point.y / (8.67)
        }, pileBounds))).toBe(true);
    });

    it('keeps a symmetric, horizontally centered grid inside the real prop corridor', () => {
        const positions = getDashboardHexPositions();
        const nodePolygons = getMobileHexNodePolygons();
        const nodePolygonsWithoutSafeArea = getMobileHexNodePolygons({ safeAreaTop: 0 });
        const allX = nodePolygons.flatMap((polygon) => polygon.map((point) => point.x));
        const leftMargin = Math.min(...allX);
        const rightMargin = 390 - Math.max(...allX);

        expect(positions).toHaveLength(7);
        expect(positions.every((point) => positions.some((other) => other.x === -point.x && other.y === -point.y))).toBe(true);
        expect(leftMargin).toBeCloseTo(rightMargin, 5);
        expect(nodePolygonsWithoutSafeArea).toEqual(nodePolygons);
        expect(nodePolygons.every((polygon) => !polygonsOverlap(polygon, injectorSilhouette))).toBe(true);
        expect(nodePolygons.every((polygon) => !polygonsOverlap(polygon, coinPileSilhouette))).toBe(true);
    });

});
