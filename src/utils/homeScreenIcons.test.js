import { describe, expect, it } from 'vitest';
import {
    DEFAULT_HOME_SCREEN_ICON_ID,
    HOME_SCREEN_ICON_IDS,
    applyHomeScreenIconMetadata,
    getHomeScreenIcon,
    normalizeHomeScreenIconId
} from './homeScreenIcons.js';

const createFakeDocument = () => {
    const links = [];

    const createLink = () => {
        const attributes = {};

        return {
            setAttribute(name, value) {
                attributes[name] = value;
            },
            getAttribute(name) {
                return attributes[name];
            }
        };
    };

    return {
        links,
        head: {
            querySelector(selector) {
                const rel = selector.match(/rel="([^"]+)"/)?.[1];
                return links.find((link) => link.getAttribute('rel') === rel) || null;
            },
            appendChild(link) {
                links.push(link);
            }
        },
        createElement(tagName) {
            if (tagName !== 'link') throw new Error(`Unexpected tag: ${tagName}`);
            return createLink();
        }
    };
};

describe('homeScreenIcons', () => {
    it('returns valid curated asset URLs for every allowed id', () => {
        HOME_SCREEN_ICON_IDS.forEach((iconId) => {
            const icon = getHomeScreenIcon(iconId);

            expect(icon.id).toBe(iconId);
            expect(icon.label).toBeTruthy();
            expect(icon.src).toMatch(/^\/?\.?\/?icon-concepts\/corrected\/lifequest-.+\.png$/);
            expect(icon.sizes).toBe('180x180');
        });
    });

    it('normalizes unknown ids to the canonical default', () => {
        expect(normalizeHomeScreenIconId('unknown')).toBe(DEFAULT_HOME_SCREEN_ICON_ID);
        expect(normalizeHomeScreenIconId(undefined)).toBe(DEFAULT_HOME_SCREEN_ICON_ID);
    });

    it('creates and updates apple-touch-icon metadata deterministically', () => {
        const doc = createFakeDocument();
        const firstIcon = getHomeScreenIcon('shield-check-v2');
        const secondIcon = getHomeScreenIcon('mountain-path-star-v2');

        const firstLink = applyHomeScreenIconMetadata(firstIcon.id, doc);

        expect(firstLink.getAttribute('rel')).toBe('apple-touch-icon');
        expect(firstLink.getAttribute('href')).toBe(firstIcon.src);
        expect(firstLink.getAttribute('sizes')).toBe('180x180');
        expect(doc.links).toHaveLength(2);

        const secondLink = applyHomeScreenIconMetadata(secondIcon.id, doc);

        expect(secondLink).toBe(firstLink);
        expect(secondLink.getAttribute('href')).toBe(secondIcon.src);
        expect(doc.links).toHaveLength(2);
    });
});
