export const CLOUD_SYNC_META_KEY = 'lq_cloud_sync_meta';

export const getCloudSyncMetaKey = (uid, dataUid) => (
    `${CLOUD_SYNC_META_KEY}:${uid}:${dataUid}`
);

export const metadataMatchesIdentity = (metadata, user, dataUid) => (
    metadata?.uid === user?.uid
    && (metadata.dataUid || metadata.uid) === dataUid
);

export const getCloudSyncStartupState = (metadata, user, dataUid) => {
    const validMetadata = metadataMatchesIdentity(metadata, user, dataUid)
        ? metadata
        : null;
    const enabled = validMetadata?.enabled === true;

    return {
        metadata: validMetadata,
        enabled,
        status: enabled ? 'checking' : 'paused'
    };
};
