export const LIFEQUEST_OWNER_UID = 'REDACTED_OWNER_UID';
export const LIFEQUEST_LLM_UID = 'REDACTED_LLM_UID';

export const AUTH_SURFACES = Object.freeze({
    APP: 'app',
    LLM: 'llm'
});

export const getLifeQuestAccountAccess = (uid, surface) => {
    if (!uid) return null;

    if (surface === AUTH_SURFACES.APP && uid === LIFEQUEST_OWNER_UID) {
        return {
            role: 'owner',
            dataUid: LIFEQUEST_OWNER_UID
        };
    }

    if (surface === AUTH_SURFACES.LLM && uid === LIFEQUEST_LLM_UID) {
        return {
            role: 'llm',
            dataUid: LIFEQUEST_OWNER_UID
        };
    }

    return null;
};
