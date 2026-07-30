import { describe, expect, it } from 'vitest';
import {
    AUTH_SURFACES,
    getLifeQuestAccountAccess
} from './cloudAccess.js';

const ACCESS_CONFIG = Object.freeze({
    ownerUid: 'owner-test-uid',
    llmUid: 'llm-test-uid'
});

describe('LifeQuest cloud account access', () => {
    it('allows the owner only on the normal application surface', () => {
        expect(getLifeQuestAccountAccess(ACCESS_CONFIG.ownerUid, AUTH_SURFACES.APP, ACCESS_CONFIG)).toEqual({
            role: 'owner',
            dataUid: ACCESS_CONFIG.ownerUid
        });
        expect(getLifeQuestAccountAccess(
            ACCESS_CONFIG.ownerUid,
            AUTH_SURFACES.LLM,
            ACCESS_CONFIG
        )).toBeNull();
    });

    it('allows the LLM account only on the LLM surface and maps it to owner data', () => {
        expect(getLifeQuestAccountAccess(
            ACCESS_CONFIG.llmUid,
            AUTH_SURFACES.LLM,
            ACCESS_CONFIG
        )).toEqual({
            role: 'llm',
            dataUid: ACCESS_CONFIG.ownerUid
        });
        expect(getLifeQuestAccountAccess(
            ACCESS_CONFIG.llmUid,
            AUTH_SURFACES.APP,
            ACCESS_CONFIG
        )).toBeNull();
    });

    it('rejects every other authenticated UID', () => {
        expect(getLifeQuestAccountAccess(
            'another-user',
            AUTH_SURFACES.APP,
            ACCESS_CONFIG
        )).toBeNull();
        expect(getLifeQuestAccountAccess(
            'another-user',
            AUTH_SURFACES.LLM,
            ACCESS_CONFIG
        )).toBeNull();
        expect(getLifeQuestAccountAccess(null, AUTH_SURFACES.LLM, ACCESS_CONFIG)).toBeNull();
    });
});
