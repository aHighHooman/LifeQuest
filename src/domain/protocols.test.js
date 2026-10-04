import { describe, expect, it } from 'vitest';
import {
    getProtocolIntervalDays,
    getLatestProtocolCompletionDateKey,
    getProtocolCycleAnchorDateKey,
    getProtocolDueDateKey,
    getProtocolCycleState,
    getProtocolPassivePayoutDateKeys,
    getPausedPassivePaidThrough,
    getProtocolStreak
} from './protocols.js';

describe('shared protocol recurrence', () => {
    it.each([
        ['daily', undefined, 1],
        ['weekly', undefined, 7],
        ['monthly', undefined, 30],
        ['interval', 4, 4],
        ['interval', '2.5', 2.5],
        ['interval', -2, 1],
        ['interval', 0, 1],
        ['interval', Infinity, 1],
        ['interval', 'invalid', 1]
    ])('preserves %s/%s interval policy', (frequency, frequencyParam, expected) => {
        const protocol = { frequency, frequencyParam };
        expect(getProtocolIntervalDays(protocol)).toBe(expected);
    });

    it('anchors on the later completion or skipped-cycle reset and ignores zero history counts', () => {
        const protocol = {
            frequency: 'monthly',
            history: { '2026-01-31': 2, '2026-02-01': 0 },
            lastCycleResetDateKey: '2026-02-02'
        };
        expect(getLatestProtocolCompletionDateKey(protocol)).toBe('2026-01-31');
        expect(getProtocolCycleAnchorDateKey(protocol)).toBe('2026-02-02');
        expect(getProtocolDueDateKey(protocol)).toBe('2026-03-04');
        expect(getProtocolCycleAnchorDateKey({ ...protocol, lastCycleResetDateKey: '2026-01-01' })).toBe('2026-01-31');
    });

    it('treats an unstarted protocol as due and tracks due/overdue calendar days across DST', () => {
        expect(getProtocolCycleState({ frequency: 'weekly' }, '2026-03-08')).toMatchObject({
            dueDateKey: null, daysUntilDue: 0, isDueToday: true, isOverdue: false
        });
        const protocol = { frequency: 'daily', history: { '2026-03-08': 1 } };
        expect(getProtocolCycleState(protocol, '2026-03-08')).toMatchObject({ daysUntilDue: 1, isDueToday: false });
        expect(getProtocolCycleState(protocol, '2026-03-09')).toMatchObject({ daysUntilDue: 0, isDueToday: true });
        expect(getProtocolCycleState(protocol, '2026-03-10')).toMatchObject({ daysUntilDue: -1, isOverdue: true });
    });

    it('pays only anchor+1 through due, honors the cursor, and never pays overdue days', () => {
        const protocol = { frequency: 'interval', frequencyParam: 3, passiveReward: 0.1, history: { '2026-03-07': 1 } };
        const expected = ['2026-03-08', '2026-03-09', '2026-03-10'];
        expect(getProtocolPassivePayoutDateKeys(protocol, null, '2026-03-20')).toEqual(expected);
        expect(getProtocolPassivePayoutDateKeys(protocol, '2026-03-08', '2026-03-09')).toEqual(['2026-03-09']);
        expect(getProtocolPassivePayoutDateKeys(protocol, '2026-03-10', '2026-03-20')).toEqual([]);
        expect(getProtocolPassivePayoutDateKeys(protocol, null, '2026-03-07')).toEqual([]);
        expect(getProtocolPassivePayoutDateKeys({ ...protocol, isActive: false }, null, '2026-03-20')).toEqual([]);
        expect(getProtocolPassivePayoutDateKeys({ ...protocol, passiveReward: 0 }, null, '2026-03-20')).toEqual([]);
        expect(getProtocolPassivePayoutDateKeys({ ...protocol, history: {} }, null, '2026-03-20')).toEqual([]);
    });

    it('advances the pause cursor through today or due without rewinding it or paying paused days', () => {
        const protocol = { frequency: 'weekly', passiveReward: 0.1, history: { '2026-03-07': 1 } };
        expect(getPausedPassivePaidThrough(protocol, '2026-03-10')).toBe('2026-03-10');
        expect(getPausedPassivePaidThrough(protocol, '2026-03-20')).toBe('2026-03-14');
        expect(getPausedPassivePaidThrough({ ...protocol, passivePaidThrough: '2026-03-12' }, '2026-03-10')).toBe('2026-03-12');
        expect(getPausedPassivePaidThrough({ history: {}, passivePaidThrough: '2026-03-06' }, '2026-03-10')).toBe('2026-03-06');
        const cursor = getPausedPassivePaidThrough(protocol, '2026-03-10');
        expect(getProtocolPassivePayoutDateKeys({ ...protocol, isActive: true }, cursor, '2026-03-12')).toEqual(['2026-03-11', '2026-03-12']);
    });

    it('derives the streak from on-time completions and breaks it when the cycle is overdue or late', () => {
        const daily = { frequency: 'daily', history: { '2026-03-05': 1, '2026-03-07': 1, '2026-03-08': 2, '2026-03-09': 1 } };
        expect(getProtocolStreak(daily, '2026-03-09')).toBe(3);
        expect(getProtocolStreak(daily, '2026-03-10')).toBe(3);
        expect(getProtocolStreak(daily, '2026-03-11')).toBe(0);
        expect(getProtocolStreak({ ...daily, isActive: false }, '2026-03-20')).toBe(3);
        const weekly = { frequency: 'weekly', history: { '2026-03-01': 1, '2026-03-08': 1, '2026-03-16': 1 } };
        expect(getProtocolStreak(weekly, '2026-03-16')).toBe(1);
        expect(getProtocolStreak({ frequency: 'weekly', history: {} }, '2026-03-16')).toBe(0);
    });
});
