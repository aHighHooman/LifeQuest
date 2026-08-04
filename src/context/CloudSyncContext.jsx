/* eslint-disable react-refresh/only-export-components */
import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState
} from 'react';
import { useAuth } from './AuthContext.jsx';
import { useGame } from './GameContext.jsx';
import { firebaseDb } from '../services/firebase.js';
import {
    CloudSnapshotConflictError,
    hashPortableSnapshotState,
    loadCloudSnapshot,
    saveCloudSnapshot
} from '../utils/cloudSnapshot.js';
import {
    isPortableSnapshotCurrent,
    migrateLegacyPortableSnapshot
} from '../utils/portableState.js';
import { safeGet, safeSet } from '../utils/persistence.js';
import {
    CLOUD_SYNC_META_KEY,
    getCloudSyncMetaKey,
    getCloudSyncStartupState
} from '../utils/cloudSyncState.js';

const CLOUD_SAVE_DEBOUNCE_MS = 1800;
const CloudSyncContext = createContext(null);

const emptyConflict = {
    cloudSnapshot: null,
    cloudRevisionId: null,
    cloudNeedsCurrencyMigration: false
};

export const useCloudSync = () => {
    const context = useContext(CloudSyncContext);
    if (!context) throw new Error('useCloudSync must be used within CloudSyncProvider.');
    return context;
};

export const CloudSyncProvider = ({ children }) => {
    const { user, dataUid } = useAuth();
    const { exportAppState, importAppState } = useGame();
    const [enabled, setEnabled] = useState(false);
    const [status, setStatus] = useState('paused');
    const [lastSyncedAt, setLastSyncedAt] = useState(null);
    const [conflict, setConflict] = useState(emptyConflict);
    const revisionRef = useRef(null);
    const stateChecksumRef = useRef(null);
    const inFlightRef = useRef(false);
    const reconciliationKeyRef = useRef(null);

    const readMeta = useCallback(() => {
        if (!user || !dataUid) return null;

        const scopedKey = getCloudSyncMetaKey(user.uid, dataUid);
        const scopedMeta = safeGet(scopedKey, null);
        const scopedState = getCloudSyncStartupState(scopedMeta, user, dataUid);
        if (scopedState.metadata) return scopedState.metadata;

        // Migrate the original single-account key without letting another
        // authenticated surface consume or overwrite this identity's setting.
        const legacyMeta = safeGet(CLOUD_SYNC_META_KEY, null);
        const legacyState = getCloudSyncStartupState(legacyMeta, user, dataUid);
        if (!legacyState.metadata) return null;

        safeSet(scopedKey, legacyState.metadata);
        return legacyState.metadata;
    }, [dataUid, user]);

    const persistMeta = useCallback((next = {}) => {
        if (!user || !dataUid) return;

        const metadata = {
            uid: user.uid,
            dataUid,
            enabled,
            revisionId: revisionRef.current,
            stateChecksum: stateChecksumRef.current,
            lastSyncedAt,
            ...next
        };

        safeSet(getCloudSyncMetaKey(user.uid, dataUid), metadata);
    }, [dataUid, enabled, lastSyncedAt, user]);

    const markSynced = useCallback((manifest, stateChecksum = manifest.stateChecksum) => {
        const syncedAt = new Date().toISOString();
        revisionRef.current = manifest.revisionId;
        stateChecksumRef.current = stateChecksum;
        setLastSyncedAt(syncedAt);
        setConflict(emptyConflict);
        setStatus('synced');
        persistMeta({
            enabled: true,
            revisionId: manifest.revisionId,
            stateChecksum,
            lastSyncedAt: syncedAt
        });
    }, [persistMeta]);

    const saveLocalSnapshot = useCallback(async (snapshot, expectedRevisionId) => {
        const result = await saveCloudSnapshot({
            db: firebaseDb,
            uid: dataUid,
            snapshot,
            expectedRevisionId,
            kind: 'lifequest'
        });
        markSynced(result, result.stateChecksum);
        return result;
    }, [dataUid, markSynced]);

    const reconcile = useCallback(async () => {
        if (!enabled || !firebaseDb || !user || !dataUid || inFlightRef.current) return;
        if (!navigator.onLine) {
            setStatus('offline');
            return;
        }

        inFlightRef.current = true;
        setStatus('checking');

        try {
            const localSnapshot = exportAppState();
            const localChecksum = await hashPortableSnapshotState(localSnapshot);
            const validStoredMeta = readMeta();
            const cloud = await loadCloudSnapshot({ db: firebaseDb, uid: dataUid });

            if (!cloud || cloud.manifest.kind === 'dummy') {
                const expectedRevisionId = cloud?.manifest.revisionId || null;
                await saveLocalSnapshot(localSnapshot, expectedRevisionId);
                return;
            }

            if (cloud.manifest.kind !== 'lifequest') {
                setStatus('error');
                return;
            }

            const cloudSnapshot = migrateLegacyPortableSnapshot(cloud.snapshot);
            const cloudNeedsCurrencyMigration = !isPortableSnapshotCurrent(cloud.snapshot);
            const cloudChecksum = await hashPortableSnapshotState(cloudSnapshot);
            revisionRef.current = cloud.manifest.revisionId;

            if (localChecksum === cloudChecksum) {
                if (cloudNeedsCurrencyMigration) {
                    await saveLocalSnapshot(localSnapshot, cloud.manifest.revisionId);
                } else {
                    markSynced(cloud.manifest, cloudChecksum);
                }
                return;
            }

            const cloudMatchesBase = validStoredMeta?.revisionId === cloud.manifest.revisionId;
            const localMatchesBase = validStoredMeta?.stateChecksum === localChecksum;

            if (cloudMatchesBase && !localMatchesBase) {
                await saveLocalSnapshot(localSnapshot, cloud.manifest.revisionId);
                return;
            }

            if (!cloudMatchesBase && localMatchesBase) {
                stateChecksumRef.current = cloudChecksum;
                revisionRef.current = cloud.manifest.revisionId;
                importAppState(cloudSnapshot);
                if (cloudNeedsCurrencyMigration) {
                    await saveLocalSnapshot(cloudSnapshot, cloud.manifest.revisionId);
                } else {
                    markSynced(cloud.manifest, cloudChecksum);
                }
                return;
            }

            setConflict({
                cloudSnapshot,
                cloudRevisionId: cloud.manifest.revisionId,
                cloudNeedsCurrencyMigration
            });
            setStatus('conflict');
        } catch (error) {
            console.error('Cloud reconciliation failed:', error);
            setStatus(error?.code === 'unavailable' ? 'offline' : 'error');
        } finally {
            inFlightRef.current = false;
        }
    }, [dataUid, enabled, exportAppState, importAppState, markSynced, readMeta, saveLocalSnapshot, user]);

    useEffect(() => {
        reconciliationKeyRef.current = null;

        if (!user || !dataUid) {
            setEnabled(false);
            setStatus('paused');
            setLastSyncedAt(null);
            revisionRef.current = null;
            stateChecksumRef.current = null;
            return;
        }

        const {
            metadata: validStoredMeta,
            enabled: restoredEnabled,
            status: restoredStatus
        } = getCloudSyncStartupState(readMeta(), user, dataUid);
        revisionRef.current = validStoredMeta?.revisionId || null;
        stateChecksumRef.current = validStoredMeta?.stateChecksum || null;
        setLastSyncedAt(validStoredMeta?.lastSyncedAt || null);
        setEnabled(restoredEnabled);
        setStatus(restoredStatus);
    }, [dataUid, readMeta, user]);

    useEffect(() => {
        const reconciliationKey = enabled && user && dataUid
            ? `${user.uid}:${dataUid}:enabled`
            : null;
        if (!reconciliationKey || reconciliationKeyRef.current === reconciliationKey) return;

        reconciliationKeyRef.current = reconciliationKey;
        reconcile();
    }, [dataUid, enabled, reconcile, user]);

    useEffect(() => {
        if (!enabled || !user || !dataUid || !firebaseDb || status !== 'synced') return undefined;

        const timeoutId = window.setTimeout(async () => {
            if (inFlightRef.current) return;
            if (!navigator.onLine) {
                setStatus('offline');
                return;
            }

            const snapshot = exportAppState();
            const checksum = await hashPortableSnapshotState(snapshot);
            if (checksum === stateChecksumRef.current) return;

            inFlightRef.current = true;
            setStatus('saving');

            try {
                await saveLocalSnapshot(snapshot, revisionRef.current);
            } catch (error) {
                if (error instanceof CloudSnapshotConflictError) {
                    const cloud = await loadCloudSnapshot({ db: firebaseDb, uid: dataUid });
                    const cloudSnapshot = cloud?.snapshot || null;
                    setConflict({
                        cloudSnapshot,
                        cloudRevisionId: cloud?.manifest.revisionId || null,
                        cloudNeedsCurrencyMigration: cloudSnapshot
                            ? !isPortableSnapshotCurrent(cloudSnapshot)
                            : false
                    });
                    setStatus('conflict');
                } else {
                    console.error('Automatic cloud save failed:', error);
                    setStatus(error?.code === 'unavailable' ? 'offline' : 'error');
                }
            } finally {
                inFlightRef.current = false;
            }
        }, CLOUD_SAVE_DEBOUNCE_MS);

        return () => window.clearTimeout(timeoutId);
    }, [dataUid, enabled, exportAppState, saveLocalSnapshot, status, user]);

    useEffect(() => {
        const handleOnline = () => {
            if (enabled) reconcile();
        };
        const handleOffline = () => {
            if (enabled) setStatus('offline');
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [enabled, reconcile]);

    const enable = useCallback(() => {
        if (!user || !dataUid) return;
        setEnabled(true);
        setStatus('checking');
        persistMeta({ enabled: true });
    }, [dataUid, persistMeta, user]);

    const disable = useCallback(() => {
        setEnabled(false);
        setStatus('paused');
        reconciliationKeyRef.current = null;
        persistMeta({ enabled: false });
    }, [persistMeta]);

    const useCloudCopy = useCallback(async () => {
        if (!conflict.cloudSnapshot) return;

        const cloudSnapshot = migrateLegacyPortableSnapshot(conflict.cloudSnapshot);
        const cloudNeedsCurrencyMigration = conflict.cloudNeedsCurrencyMigration;
        importAppState(cloudSnapshot);

        if (cloudNeedsCurrencyMigration) {
            if (!user || !dataUid) return;

            inFlightRef.current = true;
            setStatus('saving');
            try {
                await saveLocalSnapshot(cloudSnapshot, conflict.cloudRevisionId);
            } catch (error) {
                console.error('Migrated cloud copy could not be saved:', error);
                setStatus(error?.code === 'unavailable' ? 'offline' : 'error');
            } finally {
                inFlightRef.current = false;
            }
            return;
        }

        const checksum = await hashPortableSnapshotState(cloudSnapshot);
        markSynced({
            revisionId: conflict.cloudRevisionId,
            stateChecksum: checksum
        }, checksum);
    }, [conflict, dataUid, importAppState, markSynced, saveLocalSnapshot, user]);

    const useDeviceCopy = useCallback(async () => {
        if (!user || !dataUid || !conflict.cloudRevisionId) return;

        inFlightRef.current = true;
        setStatus('saving');
        try {
            await saveLocalSnapshot(exportAppState(), conflict.cloudRevisionId);
        } catch (error) {
            console.error('Conflict overwrite failed:', error);
            setStatus('error');
        } finally {
            inFlightRef.current = false;
        }
    }, [conflict.cloudRevisionId, dataUid, exportAppState, saveLocalSnapshot, user]);

    const value = useMemo(() => ({
        enabled,
        status,
        lastSyncedAt,
        enable,
        disable,
        syncNow: reconcile,
        useCloudCopy,
        useDeviceCopy
    }), [
        disable,
        enable,
        enabled,
        lastSyncedAt,
        reconcile,
        status,
        useCloudCopy,
        useDeviceCopy
    ]);

    return (
        <CloudSyncContext.Provider value={value}>
            {children}
        </CloudSyncContext.Provider>
    );
};
