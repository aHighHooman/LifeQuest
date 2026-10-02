import { execFileSync } from 'node:child_process';
import process from 'node:process';
import { describe, expect, it } from 'vitest';
import { getDateKey } from '../../worker/src/date.js';

// Separate processes keep each local timezone independent, including on Windows.
const inspectBrowserCalendar = (timeZone) => JSON.parse(execFileSync(process.execPath, [
    '--input-type=module', '-e', `
        import { toLocalDateKey, isWithinDays } from './src/utils/dateUtils.js';
        import { parseDateKey, getDaysUntilDue } from './src/utils/gameLogic.js';
        const NativeDate = Date;
        const now = new NativeDate('2026-11-02T12:00:00Z');
        globalThis.Date = class extends NativeDate {
            constructor(...args) { super(...(args.length ? args : [now])); }
        };
        console.log(JSON.stringify({
            day: toLocalDateKey('2026-03-08'),
            parsedDay: toLocalDateKey(parseDateKey('2026-03-08')),
            instantDay: toLocalDateKey(new NativeDate('2026-03-08T00:30:00Z')),
            dueTomorrow: getDaysUntilDue({frequency: 'daily', history: {'2026-03-08': 1}}, '2026-03-08'),
            withinOneCalendarDay: isWithinDays('2026-11-01', 1),
            invalidWithinDays: isWithinDays('invalid', 7)
        }));
    `
], { cwd: process.cwd(), env: { ...process.env, TZ: timeZone }, encoding: 'utf8' }));

describe('date boundary adapters', () => {
    it.each([
        ['America/Los_Angeles', '2026-03-07'],
        ['Asia/Tokyo', '2026-03-08'],
        ['UTC', '2026-03-08']
    ])('keeps browser calendar keys intact and converts instants locally in %s', (timeZone, instantDay) => {
        expect(inspectBrowserCalendar(timeZone)).toEqual({
            day: '2026-03-08',
            parsedDay: '2026-03-08',
            instantDay,
            dueTomorrow: 1,
            withinOneCalendarDay: true,
            invalidWithinDays: false
        });
    });

    it('uses the authenticated request timezone for worker instants while preserving calendar keys', () => {
        const instant = new Date('2026-03-08T00:30:00Z');
        expect(getDateKey(instant, 'America/Los_Angeles')).toBe('2026-03-07');
        expect(getDateKey(instant, 'Asia/Tokyo')).toBe('2026-03-08');
        expect(getDateKey(instant.toISOString(), 'America/Los_Angeles')).toBe('2026-03-07');
        expect(getDateKey('2026-03-08', 'America/Los_Angeles')).toBe('2026-03-08');
    });
});
