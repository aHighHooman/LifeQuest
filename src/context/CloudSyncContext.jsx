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
import { safeGet, safeSet } from '../utils/persistence.js';

const CLOUD_SYNC_META_KEY = 'lq_cloud_sync_meta';
const CLOUD_SAVE_DEBOUNCE_MS = 1800;
const CloudSyncContext = createContext(null);

const emptyConflict = {
    cloudSnapshot: null,
    cloudRevisionId: null
};

export const useCloudSync = () => {
    const context = useContext(CloudSyncContext);
    if (!context) throw new Error('useCloudSync must be used within CloudSyncProvider.');
    return context;
};

export const CloudSyncProvider = ({ children }) => {
    const { user } = useAuth();
    const { exportAppState, importAppState } = useGame();
    const [enabled, setEnabled] = useState(false);
    const [status, setStatus] = useState('paused');
    const [lastSyncedAt, setLastSyncedAt] = useState(null);
    const [conflict, setConflict] = useState(emptyConflict);
    const revisionRef = useRef(null);
    const stateChecksumRef = useRef(null);
    const inFlightRef = useRef(false);
    const reconciliationKeyRef = useRef(null);

    const persistMeta = useCallback((next = {}) => {
        if (!user) return;

        const metadata = {
            uid: user.uid,
            enabled,
            revisionId: revisionRef.current,
            stateChecksum: stateChecksumRef.current,
            lastSyncedAt,
            ...next
        };

        safeSet(CLOUD_SYNC_META_KEY, metadata);
    }, [enabled, lastSyncedAt, user]);

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
            uid: user.uid,
            snapshot,
            expectedRevisionId,
            kind: 'lifequest'
        });
        markSynced(result, result.stateChecksum);
        return result;
    }, [markSynced, user]);

    const reconcile = useCallback(async () => {
        if (!enabled || !firebaseDb || !user || inFlightRef.current) return;
        if (!navigator.onLine) {
            setStatus('offline');
            return;
        }

        inFlightRef.current = true;
        setStatus('checking');

        try {
            const localSnapshot = exportAppState();
            const localChecksum = await hashPortableSnapshotState(localSnapshot);
            const storedMeta = safeGet(CLOUD_SYNC_META_KEY, null);
            const validStoredMeta = storedMeta?.uid === user.uid ? storedMeta : null;
            const cloud = await loadCloudSnapshot({ db: firebaseDb, uid: user.uid });

            if (!cloud || cloud.manifest.kind === 'dummy') {
                const expectedRevisionId = cloud?.manifest.revisionId || null;
                await saveLocalSnapshot(localSnapshot, expectedRevisionId);
                return;
            }

            if (cloud.manifest.kind !== 'lifequest') {
                setStatus('error');
                return;
            }

            const cloudChecksum = cloud.manifest.stateChecksum
                || await hashPortableSnapshotState(cloud.snapshot);
            revisionRef.current = cloud.manifest.revisionId;

            if (localChecksum === cloudChecksum) {
                markSynced(cloud.manifest, cloudChecksum);
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
                importAppState(cloud.snapshot);
                markSynced(cloud.manifest, cloudChecksum);
                return;
            }

            setConflict({
                cloudSnapshot: cloud.snapshot,
                cloudRevisionId: cloud.manifest.revisionId
            });
            setStatus('conflict');
        } catch (error) {
            console.error('Cloud reconciliation failed:', error);
            setStatus(error?.code === 'unavailable' ? 'offline' : 'error');
        } finally {
            inFlightRef.current = false;
        }
    }, [enabled, exportAppState, importAppState, markSynced, saveLocalSnapshot, user]);

    useEffect(() => {
        reconciliationKeyRef.current = null;

        if (!user) {
            setEnabled(false);
            setStatus('paused');
            setLastSyncedAt(null);
            revisionRef.current = null;
            stateChecksumRef.current = null;
            return;
        }

        const storedMeta = safeGet(CLOUD_SYNC_META_KEY, null);
        const isEnabledForUser = storedMeta?.uid === user.uid && storedMeta.enabled === true;

        revisionRef.current = storedMeta?.uid === user.uid ? storedMeta.revisionId || null : null;
        stateChecksumRef.current = storedMeta?.uid === user.uid ? storedMeta.stateChecksum || null : null;
        setLastSyncedAt(storedMeta?.uid === user.uid ? storedMeta.lastSyncedAt || null : null);
        setEnabled(isEnabledForUser);
        setStatus(isEnabledForUser ? 'checking' : 'paused');
    }, [user]);

    useEffect(() => {
        const reconciliationKey = enabled && user ? `${user.uid}:enabled` : null;
        if (!reconciliationKey || reconciliationKeyRef.current === reconciliationKey) return;

        reconciliationKeyRef.current = reconciliationKey;
        reconcile();
    }, [enabled, reconcile, user]);

    useEffect(() => {
        if (!enabled || !user || !firebaseDb || status !== 'synced') return undefined;

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
                    const cloud = await loadCloudSnapshot({ db: firebaseDb, uid: user.uid });
                    setConflict({
                        cloudSnapshot: cloud?.snapshot || null,
                        cloudRevisionId: cloud?.manifest.revisionId || null
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
    }, [enabled, exportAppState, saveLocalSnapshot, status, user]);

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
        if (!user) return;
        setEnabled(true);
        setStatus('checking');
        persistMeta({ enabled: true });
    }, [persistMeta, user]);

    const disable = useCallback(() => {
        setEnabled(false);
        setStatus('paused');
        reconciliationKeyRef.current = null;
        persistMeta({ enabled: false });
    }, [persistMeta]);

    const useCloudCopy = useCallback(() => {
        if (!conflict.cloudSnapshot) return;

        importAppState(conflict.cloudSnapshot);
        hashPortableSnapshotState(conflict.cloudSnapshot).then((checksum) => {
            markSynced({
                revisionId: conflict.cloudRevisionId,
                stateChecksum: checksum
            }, checksum);
        });
    }, [conflict, importAppState, markSynced]);

    const useDeviceCopy = useCallback(async () => {
        if (!user || !conflict.cloudRevisionId) return;

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
    }, [conflict.cloudRevisionId, exportAppState, saveLocalSnapshot, user]);

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
