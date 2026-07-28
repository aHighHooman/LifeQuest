import { describe, expect, it } from 'vitest';
import {
    encodeSnapshot,
    hashSnapshotBytes,
    hashPortableSnapshotState,
    joinSnapshotChunks,
    splitSnapshotBytes
} from './cloudSnapshot.js';

describe('cloud snapshot encoding', () => {
    it('round-trips unicode JSON through fixed-size chunks', () => {
        const snapshot = {
            formatVersion: 3,
            title: 'LifeQuest 🧭',
            entries: Array.from({ length: 30 }, (_, index) => `entry-${index}`)
        };
        const bytes = encodeSnapshot(snapshot);
        const chunks = splitSnapshotBytes(bytes, 31);
        const restored = JSON.parse(new TextDecoder().decode(joinSnapshotChunks(chunks)));

        expect(chunks.length).toBeGreaterThan(1);
        expect(restored).toEqual(snapshot);
    });

    it('generates a stable SHA-256 checksum', async () => {
        const bytes = encodeSnapshot({ safe: true });
        await expect(hashSnapshotBytes(bytes)).resolves.toBe(
            '13f513fe32a8991557ebf28941b75597641e94717c08569b7723d998c7428423'
        );
    });

    it('ignores generatedAt when comparing logical app state', async () => {
        const first = await hashPortableSnapshotState({
            formatVersion: 3,
            generatedAt: '2026-01-01T00:00:00.000Z',
            stats: { gold: 10 }
        });
        const second = await hashPortableSnapshotState({
            formatVersion: 3,
            generatedAt: '2026-07-28T00:00:00.000Z',
            stats: { gold: 10 }
        });

        expect(first).toBe(second);
    });
});
