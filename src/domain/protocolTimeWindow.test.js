import { describe, expect, it } from 'vitest';
import { isProtocolInTimeWindow, normalizeProtocolTimeWindow } from './protocolTimeWindow.js';
import { isHabitDueForFocus, normalizeHabitRecord } from './gameState.js';
import { protocolView } from './views.js';
import { createProtocol, updateProtocolDetails } from './transactions.js';
import { createInitialAppState } from './initialState.js';

const at = (time) => new Date(`2026-10-09T${time}:00Z`);
const habit = (start, end) => ({ frequency: 'daily', history: {}, todayWindow: { start, end, timeZone: 'UTC' } });

describe('protocol Today time windows', () => {
    it('keeps legacy and blank windows available for the whole day', () => {
        for (const time of ['00:00', '12:00', '23:59']) {
            expect(isProtocolInTimeWindow({}, at(time))).toBe(true);
            expect(isProtocolInTimeWindow(habit('', ''), at(time))).toBe(true);
        }
        expect(normalizeProtocolTimeWindow({ start: '', end: '' })).toBeNull();
    });

    it('includes the start and excludes the end, without carrying expired windows into Today', () => {
        const protocol = habit('12:00', '13:00');
        for (const [time, expected] of [['11:59', false], ['12:00', true], ['12:59', true], ['13:00', false], ['23:59', false]]) {
            expect(isProtocolInTimeWindow(protocol, at(time))).toBe(expected);
            expect(protocolView(protocol, '2026-10-09', at(time)).selectedForToday).toBe(expected);
            expect(isHabitDueForFocus(protocol, at(time))).toBe(expected);
        }
    });

    it('uses day boundaries for a single configured endpoint', () => {
        expect(isProtocolInTimeWindow(habit('', '12:00'), at('00:00'))).toBe(true);
        expect(isProtocolInTimeWindow(habit('', '12:00'), at('12:00'))).toBe(false);
        expect(isProtocolInTimeWindow(habit('12:00', ''), at('11:59'))).toBe(false);
        expect(isProtocolInTimeWindow(habit('12:00', ''), at('23:59'))).toBe(true);
    });

    it('handles overnight windows and midnight endpoints', () => {
        for (const [time, expected] of [['21:59', false], ['22:00', true], ['23:59', true], ['00:00', true], ['01:59', true], ['02:00', false]]) {
            expect(isProtocolInTimeWindow(habit('22:00', '02:00'), at(time))).toBe(expected);
        }
        expect(isProtocolInTimeWindow(habit('22:00', '00:00'), at('23:59'))).toBe(true);
        expect(isProtocolInTimeWindow(habit('22:00', '00:00'), at('00:00'))).toBe(false);
        expect(isProtocolInTimeWindow(habit('12:00', '12:00'), at('12:00'))).toBe(false);
    });

    it('uses the saved device timezone on servers, including DST changes', () => {
        const protocol = { ...habit('08:00', '09:00'), todayWindow: { start: '08:00', end: '09:00', timeZone: 'America/Los_Angeles' } };
        expect(isProtocolInTimeWindow(protocol, new Date('2026-10-09T15:00:00Z'))).toBe(true);
        expect(isProtocolInTimeWindow(protocol, new Date('2026-10-09T16:00:00Z'))).toBe(false);
        expect(isProtocolInTimeWindow(protocol, new Date('2026-11-09T16:00:00Z'))).toBe(true);
    });

    it('still respects activation, recurrence, and completed-today rules', () => {
        const protocol = habit('12:00', '13:00');
        expect(protocolView({ ...protocol, isActive: false }, '2026-10-09', at('12:30')).selectedForToday).toBe(false);
        expect(protocolView({ ...protocol, frequency: 'weekly', history: { '2026-10-08': 1 } }, '2026-10-09', at('12:30')).selectedForToday).toBe(false);
        expect(protocolView({ ...protocol, history: { '2026-10-09': 1 } }, '2026-10-09', at('12:30')).completedToday).toBe(true);
    });

    it('persists creation and edits through normalization, and clears to all day without touching accounting', () => {
        const state = createInitialAppState();
        const event = { id: 'window-test', date: at('12:30').toISOString(), todayKey: '2026-10-09' };
        const window = habit('12:00', '13:00').todayWindow;
        const created = createProtocol(state, { title: 'Midday routine', todayWindow: window }, event);
        expect(normalizeHabitRecord(created.habits[0], 0, event.todayKey).todayWindow).toEqual(window);
        const edited = updateProtocolDetails(created, event.id, { todayWindow: { ...window, end: '14:00' } }, event);
        expect(edited.habits[0].todayWindow.end).toBe('14:00');
        expect(edited.stats).toBe(created.stats);
        expect(edited.coinHistory).toBe(created.coinHistory);
        expect(edited.habits[0].history).toEqual({});
        expect(updateProtocolDetails(edited, event.id, { todayWindow: null }, event).habits[0].todayWindow).toBeNull();
        expect(normalizeProtocolTimeWindow({ start: '27:00', end: 'invalid', timeZone: 'invalid' })).toBeNull();
    });
});
