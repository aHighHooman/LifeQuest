import { describe, expect, it } from 'vitest';
import {
    AUTH_SURFACES,
    LIFEQUEST_LLM_UID,
    LIFEQUEST_OWNER_UID,
    getLifeQuestAccountAccess
} from './cloudAccess.js';

describe('LifeQuest cloud account access', () => {
    it('allows the owner only on the normal application surface', () => {
        expect(getLifeQuestAccountAccess(LIFEQUEST_OWNER_UID, AUTH_SURFACES.APP)).toEqual({
            role: 'owner',
            dataUid: LIFEQUEST_OWNER_UID
        });
        expect(getLifeQuestAccountAccess(LIFEQUEST_OWNER_UID, AUTH_SURFACES.LLM)).toBeNull();
    });

    it('allows the LLM account only on the LLM surface and maps it to owner data', () => {
        expect(getLifeQuestAccountAccess(LIFEQUEST_LLM_UID, AUTH_SURFACES.LLM)).toEqual({
            role: 'llm',
            dataUid: LIFEQUEST_OWNER_UID
        });
        expect(getLifeQuestAccountAccess(LIFEQUEST_LLM_UID, AUTH_SURFACES.APP)).toBeNull();
    });

    it('rejects every other authenticated UID', () => {
        expect(getLifeQuestAccountAccess('another-user', AUTH_SURFACES.APP)).toBeNull();
        expect(getLifeQuestAccountAccess('another-user', AUTH_SURFACES.LLM)).toBeNull();
        expect(getLifeQuestAccountAccess(null, AUTH_SURFACES.LLM)).toBeNull();
    });
});
