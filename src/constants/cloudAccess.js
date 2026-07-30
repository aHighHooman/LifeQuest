export const LIFEQUEST_OWNER_UID = import.meta.env.VITE_LIFEQUEST_OWNER_UID || '';
export const LIFEQUEST_LLM_UID = import.meta.env.VITE_LIFEQUEST_LLM_UID || '';

export const AUTH_SURFACES = Object.freeze({
    APP: 'app',
    LLM: 'llm'
});

const DEFAULT_ACCESS_CONFIG = Object.freeze({
    ownerUid: LIFEQUEST_OWNER_UID,
    llmUid: LIFEQUEST_LLM_UID
});

export const getLifeQuestAccountAccess = (uid, surface, config = DEFAULT_ACCESS_CONFIG) => {
    if (!uid) return null;

    if (surface === AUTH_SURFACES.APP && config.ownerUid && uid === config.ownerUid) {
        return {
            role: 'owner',
            dataUid: config.ownerUid
        };
    }

    if (surface === AUTH_SURFACES.LLM && config.llmUid && uid === config.llmUid) {
        return {
            role: 'llm',
            dataUid: config.ownerUid
        };
    }

    return null;
};
