import { describe, expect, it } from 'vitest';
import { addDays, diffDays, isDateKey } from './calendar.js';

describe('calendar day-key arithmetic', () => {
    it.each([
        ['2026-03-09', '2026-03-08'],
        ['2026-11-02', '2026-11-01'],
        ['2024-03-01', '2024-02-29'],
        ['2027-01-01', '2026-12-31']
    ])('counts adjacent calendar days across DST, leap days, and years: %s', (later, earlier) => {
        expect(diffDays(later, earlier)).toBe(1);
        expect(diffDays(earlier, later)).toBe(-1);
        expect(addDays(earlier, 1)).toBe(later);
        expect(addDays(later, -1)).toBe(earlier);
    });

    it('uses thirty calendar days for arithmetic, including month boundaries', () => {
        expect(addDays('2026-01-31', 30)).toBe('2026-03-02');
        expect(diffDays('2026-03-02', '2026-01-31')).toBe(30);
    });

    it('rejects impossible days and instant inputs rather than interpreting them in a timezone', () => {
        expect(isDateKey('2026-02-29')).toBe(false);
        expect(isDateKey('2024-02-29')).toBe(true);
        expect(addDays('2026-03-08T00:00:00Z', 1)).toBeNull();
        expect(addDays('2026-02-30', 1)).toBeNull();
        expect(addDays(null, 1)).toBeNull();
        expect(addDays('2026-03-08', Infinity)).toBeNull();
        expect(diffDays(null, '2026-03-08')).toBe(0);
    });
});
