export const HOME_SCREEN_ICON_IDS = [
    'abstract-path-compass-v2',
    'shield-check-v2',
    'mountain-path-star-v2'
];

export const DEFAULT_HOME_SCREEN_ICON_ID = 'abstract-path-compass-v2';

export const HOME_SCREEN_ICONS = {
    'abstract-path-compass-v2': {
        id: 'abstract-path-compass-v2',
        label: 'Path Compass',
        src: '/icon-concepts/corrected/lifequest-abstract-path-compass-v2.png',
        sizes: '180x180'
    },
    'shield-check-v2': {
        id: 'shield-check-v2',
        label: 'Shield Check',
        src: '/icon-concepts/corrected/lifequest-shield-check-v2.png',
        sizes: '180x180'
    },
    'mountain-path-star-v2': {
        id: 'mountain-path-star-v2',
        label: 'Mountain Path',
        src: '/icon-concepts/corrected/lifequest-mountain-path-star-v2.png',
        sizes: '180x180'
    }
};

export const normalizeHomeScreenIconId = (iconId) => (
    HOME_SCREEN_ICON_IDS.includes(iconId) ? iconId : DEFAULT_HOME_SCREEN_ICON_ID
);

export const getHomeScreenIcon = (iconId) => HOME_SCREEN_ICONS[normalizeHomeScreenIconId(iconId)];

const ensureLinkElement = (doc, selector, attributes) => {
    let link = doc.head.querySelector(selector);

    if (!link) {
        link = doc.createElement('link');
        doc.head.appendChild(link);
    }

    Object.entries(attributes).forEach(([name, value]) => {
        link.setAttribute(name, value);
    });

    return link;
};

export const applyHomeScreenIconMetadata = (iconId, doc = document) => {
    if (!doc?.head) return null;

    const icon = getHomeScreenIcon(iconId);

    const appleTouchIcon = ensureLinkElement(
        doc,
        'link[rel="apple-touch-icon"]',
        {
            rel: 'apple-touch-icon',
            sizes: icon.sizes,
            href: icon.src
        }
    );

    ensureLinkElement(
        doc,
        'link[rel="icon"]',
        {
            rel: 'icon',
            type: 'image/png',
            href: icon.src
        }
    );

    return appleTouchIcon;
};
