import { describe, expect, it } from 'vitest';
import {
    DASHBOARD_HEX_LAYOUT,
    DASHBOARD_HOTSPOTS,
    DASHBOARD_PHYSICAL_TARGETS,
    getCoordinatePlaneOffset,
    getDashboardHexPositions,
    getHotspotCenter,
    getMobileHexNodeRects,
    getTabletopTransitionUiState,
    pointIsInsideBounds,
    rectanglesOverlap
} from './tabletopLayout.js';

describe('tabletop layout contracts', () => {
    it('cancels the content safe-area inset for physical Blender coordinates', () => {
        const contentInset = 67;

        expect(contentInset + getCoordinatePlaneOffset(contentInset)).toBe(0);
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
            leftPercent: 14.8,
            topPercent: 70.2,
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

        expect(DASHBOARD_HEX_LAYOUT.mobileInnerScale).toBe(0.75);
        expect(DASHBOARD_HEX_LAYOUT.mobileOuterScale).toBe(0.9);
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
