export const CURRENCY_UNIT_VERSION = 2;
export const LEGACY_CURRENCY_DIVISOR = 10;
export const DEFAULT_CREDITS_PER_USD = 1;

const CURRENCY_PRECISION = 4;

export const normalizeCurrencyAmount = (value, fallback = 0) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;

    const factor = 10 ** CURRENCY_PRECISION;
    return Math.round((parsed + Number.EPSILON) * factor) / factor;
};

export const normalizeNonNegativeCurrencyAmount = (value, fallback = 0) => (
    Math.max(0, normalizeCurrencyAmount(value, fallback))
);

export const scaleLegacyCurrencyAmount = (value) => {
    if (value === null || value === undefined || value === '') return value;

    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return value;

    return normalizeCurrencyAmount(parsed / LEGACY_CURRENCY_DIVISOR);
};

export const formatCurrencyAmount = (value) => (
    normalizeCurrencyAmount(value).toLocaleString(undefined, {
        maximumFractionDigits: CURRENCY_PRECISION
    })
);
