import { describe, expect, it } from 'vitest';
import {
    applyCloudSnapshotToDevice,
    buildLlmSnapshot,
    getDayTimeRemaining,
    isLlmInterfaceLocation
} from './llmInterface';

describe('LLM interface helpers', () => {
    it('recognizes both pathname and hash URLs', () => {
        const route = '/llm-interface-test-route';

        expect(isLlmInterfaceLocation({ pathname: route, hash: '' }, route)).toBe(true);
        expect(isLlmInterfaceLocation({ pathname: '/', hash: `#${route}` }, route)).toBe(true);
        expect(isLlmInterfaceLocation({ pathname: '/', hash: '#/dashboard' }, route)).toBe(false);
        expect(isLlmInterfaceLocation({ pathname: route, hash: '' }, '')).toBe(false);
    });

    it('calculates time remaining until local midnight', () => {
        expect(getDayTimeRemaining(new Date(2026, 6, 27, 23, 59, 30))).toEqual({
            totalSeconds: 30,
            hours: 0,
            minutes: 0,
            seconds: 30
        });
    });

    it('builds today, quest, and protocol views from existing state', () => {
        const now = new Date(2026, 6, 27, 12, 0, 0);
        const snapshot = buildLlmSnapshot({
            stats: { hp: 75, maxHp: 100, gold: 12, level: 2, xp: 20, maxXp: 120 },
            quests: [{
                id: 'quest-1',
                title: 'Ship feature',
                isFocusedToday: true,
                completed: false,
                discarded: false,
                reward: { xp: 10, gold: 5 }
            }, {
                id: 'quest-2',
                title: 'Already done',
                isFocusedToday: true,
                completed: true,
                discarded: false
            }],
            habits: [{
                id: 'habit-1',
                title: 'Walk',
                isActive: true,
                frequency: 'daily',
                history: {}
            }]
        }, now);

        expect(snapshot.dashboard.coinsOnHand).toBe(12);
        expect(snapshot.dashboard.today.quests).toHaveLength(1);
        expect(snapshot.dashboard.today.protocols).toHaveLength(1);
        expect(snapshot.protocols[0].completedToday).toBe(false);
    });

    it('only imports supported LifeQuest cloud snapshots', () => {
        const importedSnapshots = [];
        const importAppState = (snapshot) => {
            importedSnapshots.push(snapshot);
            return { backupKey: 'lq_backup_test' };
        };

        expect(applyCloudSnapshotToDevice(null, importAppState)).toEqual({
            status: 'empty',
            backupKey: null
        });
        expect(() => applyCloudSnapshotToDevice({
            manifest: { kind: 'dummy' },
            snapshot: { containsLifeQuestState: false }
        }, importAppState)).toThrow('does not contain a supported LifeQuest snapshot');

        expect(applyCloudSnapshotToDevice({
            manifest: { kind: 'lifequest' },
            snapshot: { formatVersion: 3, quests: [] }
        }, importAppState)).toEqual({
            status: 'loaded',
            backupKey: 'lq_backup_test'
        });
        expect(importedSnapshots).toEqual([{ formatVersion: 3, quests: [] }]);
    });
});
