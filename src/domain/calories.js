// Calorie record rules shared by the app and the assistant worker. Callers
// supply IDs, timestamps, and date keys so these stay free of clocks.
import { addDays } from './calendar.js';
import { normalizeNonNegativeCurrencyAmount } from '../constants/currency.js';

export const PASSIVE_CALORIE_SOURCE = 'passive';

export const normalizeCalorieNumber = (value) => Math.max(0, Math.round(Number(value) || 0));

export const normalizeSignedCalorieNumber = (value) => Math.round(Number(value) || 0);

export const normalizeCalorieLabel = (label, fallback = 'Manual Entry') => {
    const trimmed = `${label ?? ''}`.trim();
    return trimmed || fallback;
};

// Entries may be edited or removed today and yesterday only.
export const getEditableCalorieDateKeys = (todayKey) => new Set([todayKey, addDays(todayKey, -1)]);

export const createCalorieEntry = ({
    id, timestamp, dateKey, calories, label, source = 'manual', foodId = null, coinCost = 0
}) => {
    const safeCalories = normalizeSignedCalorieNumber(calories);
    const safeSource = source || 'manual';
    return {
        id,
        timestamp,
        dateKey,
        calories: safeCalories,
        label: normalizeCalorieLabel(
            label,
            safeSource === 'preset'
                ? `Quick Add ${Math.abs(safeCalories)}`
                : safeCalories < 0
                    ? 'Exercise Burn'
                    : 'Manual Entry'
        ),
        source: safeSource,
        foodId: foodId || null,
        coinCost: normalizeNonNegativeCurrencyAmount(coinCost)
    };
};

export const createSavedFood = ({ id, name, calories, coinCost = 0, createdAt, updatedAt = createdAt }) => ({
    id,
    name: normalizeCalorieLabel(name, 'Untitled Food'),
    calories: Math.max(1, normalizeCalorieNumber(calories)),
    coinCost: normalizeNonNegativeCurrencyAmount(coinCost),
    createdAt,
    updatedAt
});
