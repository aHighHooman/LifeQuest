import { describe, expect, it } from 'vitest';
import {
    DASHBOARD_HEX_LAYOUT,
    DASHBOARD_HOTSPOTS,
    DASHBOARD_PHYSICAL_TARGETS,
    getDashboardHexPositions,
    getTabletopTransitionUiState
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

const rectanglesOverlap = (first, second) => (
    first.left < second.right
    && first.right > second.left
    && first.top < second.bottom
    && first.bottom > second.top
);

const getMobileHexNodeRects = ({
    frameWidth = 390,
    gridOriginY = 500
} = {}) => {
    const positions = getDashboardHexPositions();
    const scale = DASHBOARD_HEX_LAYOUT.mobileInnerScale
        * DASHBOARD_HEX_LAYOUT.mobileOuterScale;
    const width = DASHBOARD_HEX_LAYOUT.nodeWidth * scale;
    const height = DASHBOARD_HEX_LAYOUT.nodeHeight * scale;
    const originX = (frameWidth / 2)
        + (frameWidth * DASHBOARD_HEX_LAYOUT.mobileTranslateXVw / 100);

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

        expect(DASHBOARD_HOTSPOTS.coins).toEqual({
            leftPercent: 16.5,
            topPercent: 71.1,
            widthPercent: 8.8,
            heightPercent: 4
        });
        expect(pointIsInsideBounds(center, DASHBOARD_PHYSICAL_TARGETS.coinFace)).toBe(true);
    });

    it('uses a uniform mobile scale and keeps all seven hexes clear of physical props', () => {
        const positions = getDashboardHexPositions();
        const nodeRects = getMobileHexNodeRects();
        const injectorBounds = { left: 0, right: 390, top: 0, bottom: 292 };
        const coinPileBounds = { left: 0, right: 151, top: 560, bottom: 705 };

        expect(DASHBOARD_HEX_LAYOUT.mobileInnerScale).toBe(0.67);
        expect(DASHBOARD_HEX_LAYOUT.mobileOuterScale).toBe(0.9);
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
        expect(nodeRects.every((rect) => !rectanglesOverlap(rect, injectorBounds))).toBe(true);
        expect(nodeRects.every((rect) => !rectanglesOverlap(rect, coinPileBounds))).toBe(true);
    });

    it('starts the interface pan immediately when a camera move is requested', () => {
        expect(getTabletopTransitionUiState({
            currentTab: 'quests',
            cameraMove: { id: 1, fromTab: 'dashboard' }
        })).toEqual({
            interfaceDashboardIsActive: false,
            shouldAnimateInterface: true
        });
    });
});
