import { describe, expect, it } from 'vitest';
import {
    getCloudSyncMetaKey,
    getCloudSyncStartupState
} from './cloudSyncState.js';

const owner = { uid: 'owner-uid' };

describe('cloud sync startup state', () => {
    it('restores enabled sync for the matching authenticated identity', () => {
        const metadata = {
            uid: owner.uid,
            dataUid: owner.uid,
            enabled: true,
            revisionId: 'revision-1'
        };

        expect(getCloudSyncStartupState(metadata, owner, owner.uid)).toEqual({
            metadata,
            enabled: true,
            status: 'checking'
        });
    });

    it('does not restore metadata belonging to another authenticated surface', () => {
        const metadata = {
            uid: 'llm-uid',
            dataUid: owner.uid,
            enabled: true
        };

        expect(getCloudSyncStartupState(metadata, owner, owner.uid)).toEqual({
            metadata: null,
            enabled: false,
            status: 'paused'
        });
    });

    it('uses separate persistence keys for owner and LLM identities sharing cloud data', () => {
        expect(getCloudSyncMetaKey(owner.uid, owner.uid))
            .not.toBe(getCloudSyncMetaKey('llm-uid', owner.uid));
    });
});
