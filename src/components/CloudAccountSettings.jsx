import React, { useState } from 'react';
import { Cloud, CloudOff, LogIn, LogOut, RefreshCw, ShieldCheck, TestTube2 } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext.jsx';
import { firebaseDb } from '../services/firebase.js';
import {
    CloudSnapshotConflictError,
    encodeSnapshot,
    loadCloudSnapshot,
    saveCloudSnapshot
} from '../utils/cloudSnapshot.js';
import {
    PORTABLE_APP_NAME,
    PORTABLE_FORMAT_VERSION,
    summarizePortableSnapshot
} from '../utils/portableState.js';
import { useCloudSync } from '../context/CloudSyncContext.jsx';

const AUTH_ERROR_MESSAGES = {
    'auth/invalid-credential': 'The email or password is incorrect.',
    'auth/invalid-email': 'Enter a valid email address.',
    'auth/too-many-requests': 'Firebase temporarily blocked sign-in attempts. Wait a while and try again.',
    'auth/user-disabled': 'This Firebase account has been disabled.',
    'auth/unauthorized-surface': 'This account is not authorized for the normal LifeQuest interface.'
};

const CloudAccountSettings = ({ exportAppState, importAppState }) => {
    const { user, dataUid, status, isConfigured, signIn, signOut } = useAuth();
    const cloudSync = useCloudSync();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [message, setMessage] = useState('');
    const [securityStatus, setSecurityStatus] = useState('idle');
    const [dummyStatus, setDummyStatus] = useState('idle');
    const [cloudRevisionId, setCloudRevisionId] = useState(null);
    const [preparedLocalSnapshot, setPreparedLocalSnapshot] = useState(null);
    const [preparedLocalSummary, setPreparedLocalSummary] = useState(null);
    const [preparedLocalBytes, setPreparedLocalBytes] = useState(0);
    const [cloudSnapshot, setCloudSnapshot] = useState(null);
    const [cloudSummary, setCloudSummary] = useState(null);
    const [transferStatus, setTransferStatus] = useState('idle');

    const handleSignIn = async (event) => {
        event.preventDefault();
        setIsSubmitting(true);
        setMessage('');

        try {
            await signIn(email, password);
            setPassword('');
            setMessage('Signed in. Protected cloud controls are available below.');
        } catch (error) {
            setMessage(AUTH_ERROR_MESSAGES[error?.code] || 'Sign-in failed. Check Firebase Authentication setup and try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSignOut = async () => {
        setIsSubmitting(true);
        setMessage('');

        try {
            await signOut();
            setMessage('Signed out. LifeQuest remains available with its local device data.');
        } catch {
            setMessage('Sign-out failed. Try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSecurityTest = async () => {
        if (!firebaseDb || !user || !dataUid) return;

        setSecurityStatus('testing');
        setMessage('');

        try {
            const snapshot = await getDoc(doc(firebaseDb, 'users', dataUid, 'sync', 'current'));
            setSecurityStatus('passed');
            setMessage(snapshot.exists()
                ? 'Protected Firestore access confirmed. A cloud manifest already exists.'
                : 'Protected Firestore access confirmed. No cloud state exists and nothing was written.');
        } catch (error) {
            console.error('Firestore security check failed:', error);
            setSecurityStatus('failed');
            setMessage(error?.code === 'permission-denied'
                ? 'Firestore denied access. Publish the LifeQuest security rules, then test again.'
                : 'Firestore could not be reached. Check the database setup and try again.');
        }
    };

    const handleWriteDummy = async () => {
        if (!firebaseDb || !user || !dataUid) return;

        setDummyStatus('writing');
        setMessage('');

        try {
            const result = await saveCloudSnapshot({
                db: firebaseDb,
                uid: dataUid,
                expectedRevisionId: cloudRevisionId,
                kind: 'dummy',
                snapshot: {
                    formatVersion: 0,
                    kind: 'lifequest-dummy',
                    containsLifeQuestState: false,
                    message: 'Synthetic cloud transfer test'
                }
            });
            setCloudRevisionId(result.revisionId);
            setDummyStatus('written');
            setMessage(`Dummy snapshot written safely in ${result.chunkCount} chunk (${result.byteLength} bytes).`);
        } catch (error) {
            setDummyStatus('failed');
            setMessage(error instanceof CloudSnapshotConflictError
                ? 'Cloud data already exists or changed. Read it before attempting another dummy write.'
                : 'The dummy snapshot could not be written.');
        }
    };

    const handleReadDummy = async () => {
        if (!firebaseDb || !user || !dataUid) return;

        setDummyStatus('reading');
        setMessage('');

        try {
            const result = await loadCloudSnapshot({ db: firebaseDb, uid: dataUid });
            if (!result) {
                setCloudRevisionId(null);
                setDummyStatus('empty');
                setMessage('No cloud snapshot exists.');
                return;
            }

            if (result.manifest.kind !== 'dummy' || result.snapshot?.containsLifeQuestState !== false) {
                setDummyStatus('failed');
                setMessage('Cloud data exists, but it is not the expected dummy snapshot. Nothing was imported.');
                return;
            }

            setCloudRevisionId(result.manifest.revisionId);
            setDummyStatus('read');
            setMessage(`Dummy snapshot verified: ${result.manifest.byteLength} bytes with a valid SHA-256 checksum.`);
        } catch (error) {
            console.error('Dummy cloud read failed:', error);
            setDummyStatus('failed');
            setMessage(error?.message || 'The dummy snapshot could not be verified.');
        }
    };

    const handlePrepareRealUpload = async () => {
        if (!firebaseDb || !user || !dataUid) return;

        setTransferStatus('preparing');
        setMessage('');
        setPreparedLocalSnapshot(null);
        setPreparedLocalSummary(null);

        try {
            const existingCloud = await loadCloudSnapshot({ db: firebaseDb, uid: dataUid });
            const snapshot = exportAppState();
            const bytes = encodeSnapshot(snapshot).byteLength;

            setCloudRevisionId(existingCloud?.manifest.revisionId || null);
            setPreparedLocalSnapshot(snapshot);
            setPreparedLocalSummary(summarizePortableSnapshot(snapshot));
            setPreparedLocalBytes(bytes);
            setTransferStatus('prepared');
            setMessage(existingCloud?.manifest.kind === 'lifequest'
                ? 'Preview ready. Uploading will replace the current cloud copy with this device state.'
                : 'Preview ready. Uploading will replace the synthetic dummy with this device state.');
        } catch (error) {
            console.error('Preparing cloud upload failed:', error);
            setTransferStatus('failed');
            setMessage('Could not prepare the cloud upload preview. Nothing was written.');
        }
    };

    const handleUploadRealSnapshot = async () => {
        if (!firebaseDb || !user || !dataUid || !preparedLocalSnapshot) return;

        const confirmed = window.confirm(
            'Upload the previewed LifeQuest state to your private Firestore account? This sends quests, habits, statistics, calorie history, coin history, budget, groceries, and settings.'
        );
        if (!confirmed) return;

        setTransferStatus('uploading');
        setMessage('');

        try {
            const result = await saveCloudSnapshot({
                db: firebaseDb,
                uid: dataUid,
                snapshot: preparedLocalSnapshot,
                expectedRevisionId: cloudRevisionId,
                kind: 'lifequest'
            });

            setCloudRevisionId(result.revisionId);
            setPreparedLocalSnapshot(null);
            setPreparedLocalSummary(null);
            setTransferStatus('uploaded');
            setMessage(`LifeQuest cloud copy saved in ${result.chunkCount} chunk (${result.byteLength} bytes).`);
        } catch (error) {
            setTransferStatus('failed');
            setMessage(error instanceof CloudSnapshotConflictError
                ? 'The cloud copy changed after the preview. Nothing was overwritten; inspect it and prepare again.'
                : 'LifeQuest could not be uploaded. The existing cloud and device copies were not changed.');
        }
    };

    const handleInspectRealCloud = async () => {
        if (!firebaseDb || !user || !dataUid) return;

        setTransferStatus('inspecting');
        setMessage('');
        setCloudSnapshot(null);
        setCloudSummary(null);

        try {
            const result = await loadCloudSnapshot({ db: firebaseDb, uid: dataUid });
            if (!result) {
                setCloudRevisionId(null);
                setTransferStatus('empty');
                setMessage('No cloud snapshot exists.');
                return;
            }

            setCloudRevisionId(result.manifest.revisionId);

            if (
                result.manifest.kind !== 'lifequest'
                || result.snapshot?.appName !== PORTABLE_APP_NAME
                || Number(result.snapshot?.formatVersion) > PORTABLE_FORMAT_VERSION
            ) {
                setTransferStatus('not-lifequest');
                setMessage(result.manifest.kind === 'dummy'
                    ? 'Only the synthetic dummy exists in the cloud. No LifeQuest state is available to load.'
                    : 'The cloud data is not a supported LifeQuest snapshot. Nothing was imported.');
                return;
            }

            setCloudSnapshot(result.snapshot);
            setCloudSummary(summarizePortableSnapshot(result.snapshot));
            setTransferStatus('cloud-ready');
            setMessage('Cloud copy verified and previewed. Nothing has been imported.');
        } catch (error) {
            console.error('Inspecting cloud snapshot failed:', error);
            setTransferStatus('failed');
            setMessage(error?.message || 'The cloud copy could not be verified. Nothing was imported.');
        }
    };

    const handleReplaceFromCloud = () => {
        if (!cloudSnapshot) return;

        const confirmed = window.confirm(
            'Replace this device’s current LifeQuest state with the verified cloud copy? A local pre-import backup will be created first.'
        );
        if (!confirmed) return;

        const { backupKey } = importAppState(cloudSnapshot);
        setCloudSnapshot(null);
        setCloudSummary(null);
        setTransferStatus('imported');
        setMessage(`Cloud copy loaded. The previous device state was backed up locally as ${backupKey}.`);
    };

    return (
        <div className="space-y-4">
            <div className="border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                    <Cloud size={19} className="text-sky-300" />
                    <h3 className="text-lg font-bold text-white">Cloud Account</h3>
                </div>
                <p className="mt-1 text-sm text-slate-400">
                    Authentication checkpoint only. Signing in cannot upload, download, or modify LifeQuest data.
                </p>
            </div>

            {!isConfigured && (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-100">
                    Firebase browser configuration is not available in this build. LifeQuest continues locally.
                </div>
            )}

            {isConfigured && status === 'loading' && (
                <div className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-300">
                    Checking the saved Firebase session…
                </div>
            )}

            {isConfigured && user && (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <div className="flex items-center gap-2 text-sm font-bold text-emerald-200">
                                <ShieldCheck size={17} />
                                Authenticated
                            </div>
                            <div className="mt-1 break-all text-sm text-slate-300">{user.email}</div>
                        </div>
                        <button
                            type="button"
                            onClick={handleSignOut}
                            disabled={isSubmitting}
                            className="flex items-center justify-center gap-2 rounded bg-slate-800 px-4 py-2 text-sm font-bold text-slate-200 transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <LogOut size={16} />
                            Sign Out
                        </button>
                    </div>
                    <button
                        type="button"
                        onClick={handleSecurityTest}
                        disabled={isSubmitting || securityStatus === 'testing'}
                        className="mt-4 flex w-full items-center justify-center gap-2 rounded border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-bold text-emerald-100 transition-colors hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                    >
                        <TestTube2 size={16} />
                        {securityStatus === 'testing' ? 'Testing Protected Access…' : 'Test Protected Access'}
                    </button>
                    {securityStatus === 'passed' && (
                        <div className="mt-4 rounded-lg border border-sky-500/20 bg-sky-500/5 p-3">
                            <div className="text-xs font-bold uppercase tracking-wide text-sky-200">Synthetic transfer test</div>
                            <p className="mt-1 text-xs text-slate-400">
                                These controls send only a fixed dummy message. They cannot read or upload LifeQuest state.
                            </p>
                            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                                <button
                                    type="button"
                                    onClick={handleWriteDummy}
                                    disabled={dummyStatus === 'writing' || dummyStatus === 'reading'}
                                    className="rounded bg-sky-500 px-3 py-2 text-sm font-bold text-slate-950 hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {dummyStatus === 'writing' ? 'Writing Dummy…' : 'Write Dummy Snapshot'}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleReadDummy}
                                    disabled={dummyStatus === 'writing' || dummyStatus === 'reading'}
                                    className="rounded bg-slate-800 px-3 py-2 text-sm font-bold text-slate-200 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {dummyStatus === 'reading' ? 'Reading Dummy…' : 'Read & Verify Dummy'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {isConfigured && user && securityStatus === 'passed' && (
                <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
                    <div className="text-sm font-bold text-violet-100">Manual LifeQuest Cloud Transfer</div>
                    <p className="mt-1 text-xs text-slate-400">
                        Preview before every upload or device replacement. Automatic sync remains disabled.
                    </p>

                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <button
                            type="button"
                            onClick={handlePrepareRealUpload}
                            disabled={cloudSync.enabled || ['preparing', 'uploading', 'inspecting'].includes(transferStatus)}
                            className="rounded bg-violet-500 px-3 py-2 text-sm font-bold text-white hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {transferStatus === 'preparing' ? 'Preparing Preview…' : 'Preview This Device for Upload'}
                        </button>
                        <button
                            type="button"
                            onClick={handleInspectRealCloud}
                            disabled={cloudSync.enabled || ['preparing', 'uploading', 'inspecting'].includes(transferStatus)}
                            className="rounded bg-slate-800 px-3 py-2 text-sm font-bold text-slate-200 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {transferStatus === 'inspecting' ? 'Checking Cloud…' : 'Inspect Cloud Copy'}
                        </button>
                    </div>

                    {cloudSync.enabled && (
                        <div className="mt-3 text-xs text-slate-500">
                            Manual transfer is paused while automatic sync is enabled.
                        </div>
                    )}

                    {preparedLocalSummary && (
                        <div className="mt-4 rounded-lg border border-violet-400/20 bg-slate-950/70 p-3">
                            <div className="text-xs font-bold uppercase tracking-wide text-violet-200">Upload preview</div>
                            <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-300">
                                <div>Quests: {preparedLocalSummary.quests}</div>
                                <div>Protocols: {preparedLocalSummary.habits}</div>
                                <div>Coin entries: {preparedLocalSummary.coinHistory}</div>
                                <div>Calorie entries: {preparedLocalSummary.calorieHistory}</div>
                                <div>Groceries: {preparedLocalSummary.groceryList}</div>
                                <div>Price items: {preparedLocalSummary.priceDatabase}</div>
                                <div className="col-span-2">Encoded size: {preparedLocalBytes.toLocaleString()} bytes</div>
                            </div>
                            <button
                                type="button"
                                onClick={handleUploadRealSnapshot}
                                disabled={transferStatus === 'uploading'}
                                className="mt-3 w-full rounded bg-emerald-500 px-3 py-2 text-sm font-bold text-slate-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {transferStatus === 'uploading' ? 'Uploading…' : 'Upload Previewed State'}
                            </button>
                        </div>
                    )}

                    {cloudSummary && (
                        <div className="mt-4 rounded-lg border border-sky-400/20 bg-slate-950/70 p-3">
                            <div className="text-xs font-bold uppercase tracking-wide text-sky-200">Verified cloud preview</div>
                            <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-300">
                                <div>Quests: {cloudSummary.quests}</div>
                                <div>Protocols: {cloudSummary.habits}</div>
                                <div>Coin entries: {cloudSummary.coinHistory}</div>
                                <div>Calorie entries: {cloudSummary.calorieHistory}</div>
                                <div>Groceries: {cloudSummary.groceryList}</div>
                                <div>Price items: {cloudSummary.priceDatabase}</div>
                            </div>
                            <button
                                type="button"
                                onClick={handleReplaceFromCloud}
                                className="mt-3 w-full rounded bg-amber-500 px-3 py-2 text-sm font-bold text-slate-950 hover:bg-amber-400"
                            >
                                Replace This Device from Cloud
                            </button>
                        </div>
                    )}
                </div>
            )}

            {isConfigured && user && securityStatus === 'passed' && (
                <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <div className="text-sm font-bold text-cyan-100">Automatic Local-First Sync</div>
                            <p className="mt-1 text-xs text-slate-400">
                                Local device saves remain immediate. Cloud saves are delayed briefly and protected by revision checks.
                            </p>
                        </div>
                        <span className="rounded-full border border-slate-700 bg-slate-950 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-300">
                            {cloudSync.status}
                        </span>
                    </div>

                    {cloudSync.lastSyncedAt && (
                        <div className="mt-2 text-xs text-slate-500">
                            Last synced: {new Date(cloudSync.lastSyncedAt).toLocaleString()}
                        </div>
                    )}

                    <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                        {!cloudSync.enabled ? (
                            <button
                                type="button"
                                onClick={cloudSync.enable}
                                className="flex items-center justify-center gap-2 rounded bg-cyan-500 px-3 py-2 text-sm font-bold text-slate-950 hover:bg-cyan-400"
                            >
                                <Cloud size={16} />
                                Enable Automatic Sync
                            </button>
                        ) : (
                            <>
                                <button
                                    type="button"
                                    onClick={cloudSync.syncNow}
                                    disabled={['checking', 'saving'].includes(cloudSync.status)}
                                    className="flex items-center justify-center gap-2 rounded bg-cyan-500 px-3 py-2 text-sm font-bold text-slate-950 hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    <RefreshCw size={16} />
                                    Sync Now
                                </button>
                                <button
                                    type="button"
                                    onClick={cloudSync.disable}
                                    className="flex items-center justify-center gap-2 rounded bg-slate-800 px-3 py-2 text-sm font-bold text-slate-200 hover:bg-slate-700"
                                >
                                    <CloudOff size={16} />
                                    Pause Cloud Sync
                                </button>
                            </>
                        )}
                    </div>

                    {cloudSync.status === 'conflict' && (
                        <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                            <div className="text-sm font-bold text-amber-100">Both copies changed</div>
                            <p className="mt-1 text-xs text-amber-100/80">
                                Nothing was overwritten. Choose which complete copy should become authoritative.
                            </p>
                            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                                <button
                                    type="button"
                                    onClick={cloudSync.useCloudCopy}
                                    className="rounded bg-sky-500 px-3 py-2 text-sm font-bold text-slate-950 hover:bg-sky-400"
                                >
                                    Use Cloud Copy
                                </button>
                                <button
                                    type="button"
                                    onClick={cloudSync.useDeviceCopy}
                                    className="rounded bg-amber-500 px-3 py-2 text-sm font-bold text-slate-950 hover:bg-amber-400"
                                >
                                    Use This Device
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {isConfigured && status !== 'loading' && !user && (
                <form onSubmit={handleSignIn} className="space-y-3 rounded-xl border border-slate-800 bg-slate-950 p-4">
                    <div>
                        <label htmlFor="cloud-account-email" className="text-xs font-bold uppercase tracking-wide text-slate-400">
                            Email
                        </label>
                        <input
                            id="cloud-account-email"
                            type="email"
                            autoComplete="username"
                            required
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            className="mt-1 w-full rounded border border-slate-800 bg-slate-900 px-3 py-2 text-white focus:border-game-accent focus:outline-none"
                        />
                    </div>
                    <div>
                        <label htmlFor="cloud-account-password" className="text-xs font-bold uppercase tracking-wide text-slate-400">
                            Password
                        </label>
                        <input
                            id="cloud-account-password"
                            type="password"
                            autoComplete="current-password"
                            required
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            className="mt-1 w-full rounded border border-slate-800 bg-slate-900 px-3 py-2 text-white focus:border-game-accent focus:outline-none"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="flex w-full items-center justify-center gap-2 rounded bg-sky-500 px-4 py-2 font-bold text-slate-950 transition-colors hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                    >
                        <LogIn size={16} />
                        {isSubmitting ? 'Signing In…' : 'Sign In'}
                    </button>
                </form>
            )}

            {message && (
                <div className="rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-300">
                    {message}
                </div>
            )}
        </div>
    );
};

export default CloudAccountSettings;
