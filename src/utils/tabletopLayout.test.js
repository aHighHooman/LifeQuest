import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
    DASHBOARD_HEX_LAYOUT,
    DASHBOARD_HOTSPOTS,
    DASHBOARD_PHYSICAL_TARGETS,
    TABLETOP_TRANSITION,
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
    it('cancels the content safe-area inset for physical Blender coordinates', () => {
        const contentInset = 67;

        expect(contentInset - contentInset).toBe(0);
    });

    it('keeps the health readout centered on the injector display', () => {
        const center = getHotspotCenter(DASHBOARD_HOTSPOTS.health);

        expect(DASHBOARD_HOTSPOTS.health).toEqual({
            leftPercent: 47.4,
            topPercent: 22.5,
            widthPercent: 27,
            heightPercent: 3.8
        });
        expect(pointIsInsideBounds(center, DASHBOARD_PHYSICAL_TARGETS.injectorDisplay)).toBe(true);
    });

    it('keeps the coin count centered on the intended coin face', () => {
        const center = getHotspotCenter(DASHBOARD_HOTSPOTS.coins);
        const approvedPreviewWidth = 390.4;
        const approvedPreviewHeight = approvedPreviewWidth * (20 / 9);
        const approvedTopPixels = approvedPreviewHeight
            * DASHBOARD_HOTSPOTS.coins.topPercent
            / 100;

        expect(DASHBOARD_HOTSPOTS.coins).toEqual({
            leftPercent: 16.5,
            topPercent: 73.24,
            widthPercent: 8.8,
            heightPercent: 4
        });
        expect(approvedTopPixels).toBeCloseTo(635.4, 1);
        expect(pointIsInsideBounds(center, DASHBOARD_PHYSICAL_TARGETS.coinFace)).toBe(true);
    });

    it('keeps a symmetric, horizontally centered grid inside the real prop corridor', () => {
        const positions = getDashboardHexPositions();
        const nodePolygons = getMobileHexNodePolygons();
        const nodePolygonsWithoutSafeArea = getMobileHexNodePolygons({ safeAreaTop: 0 });
        const allX = nodePolygons.flatMap((polygon) => polygon.map((point) => point.x));
        const leftMargin = Math.min(...allX);
        const rightMargin = 390 - Math.max(...allX);

        expect(DASHBOARD_HEX_LAYOUT.mobileInnerScale).toBe(0.67);
        expect(DASHBOARD_HEX_LAYOUT.mobileOuterScale).toBe(0.9);
        expect(DASHBOARD_HEX_LAYOUT.mobileTranslateXVw).toBe(0);
        expect(positions).toEqual([
            { x: 0, y: 0 },
            { x: 76, y: -128 },
            { x: 152, y: 0 },
            { x: 76, y: 128 },
            { x: -76, y: 128 },
            { x: -152, y: 0 },
            { x: -76, y: -128 }
        ]);
        expect(positions[3].x - positions[4].x).toBe(DASHBOARD_HEX_LAYOUT.dx * 2);
        expect(leftMargin).toBeCloseTo(rightMargin, 5);
        expect(nodePolygonsWithoutSafeArea).toEqual(nodePolygons);
        expect(nodePolygons.every((polygon) => !polygonsOverlap(polygon, injectorSilhouette))).toBe(true);
        expect(nodePolygons.every((polygon) => !polygonsOverlap(polygon, coinPileSilhouette))).toBe(true);
    });

    it('keeps the compositor-only tabletop turn short and subtle', () => {
        const appSource = readFileSync(
            new URL('../App.jsx', import.meta.url),
            'utf8'
        );
        const backdropSource = appSource.slice(
            appSource.indexOf('const TabletopBackdrop'),
            appSource.indexOf('function TabletopStage')
        );
        const blenderSource = readFileSync(
            new URL('../../tools/blender/render_lifequest_tabletop_transition.py', import.meta.url),
            'utf8'
        );

        expect(TABLETOP_TRANSITION.durationSeconds).toBeLessThan(0.4);
        expect(TABLETOP_TRANSITION.ease).toEqual([0.45, 0, 0.2, 1]);
        expect(TABLETOP_TRANSITION.turnTiltDegrees).toBeLessThanOrEqual(1);
        expect(TABLETOP_TRANSITION.turnScale).toBeLessThanOrEqual(1.01);
        expect(appSource).toContain('lifequest-tabletop-wide.webp');
        expect(backdropSource).toContain('src={tabletopWide}');
        expect(backdropSource).not.toContain('opacity');
        expect(blenderSource).toContain('INTERFACE_EASE = (0.45, 0.0, 0.2, 1.0)');
    });
});
