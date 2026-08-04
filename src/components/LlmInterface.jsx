import { useEffect, useMemo, useState } from 'react';
import { useGame } from '../context/GameContext';
import { useAuth } from '../context/AuthContext.jsx';
import { useCloudSync } from '../context/CloudSyncContext.jsx';
import { firebaseDb } from '../services/firebase.js';
import { loadCloudSnapshot } from '../utils/cloudSnapshot.js';
import {
    AUTH_SURFACES,
    getLifeQuestAccountAccess
} from '../constants/cloudAccess.js';
import {
    applyCloudSnapshotToDevice,
    buildLlmSnapshot,
    getDayTimeRemaining
} from '../utils/llmInterface';
import { formatCurrencyAmount } from '../constants/currency.js';

const inputClassName = 'w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white';
const buttonClassName = 'rounded border border-slate-500 bg-slate-800 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50';
const dangerButtonClassName = 'rounded border border-red-700 bg-red-950 px-3 py-2 text-sm font-semibold text-red-100 hover:bg-red-900';
const AUTH_ERROR_MESSAGES = {
    'auth/invalid-credential': 'The email or password is incorrect.',
    'auth/invalid-email': 'Enter a valid email address.',
    'auth/too-many-requests': 'Firebase temporarily blocked sign-in attempts. Wait before trying again.',
    'auth/user-disabled': 'This Firebase account has been disabled.',
    'auth/unauthorized-surface': 'This account is not authorized for the LifeQuest LLM interface.'
};

const formatTimeRemaining = ({ hours, minutes, seconds }) =>
    `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

const StatusMessage = ({ message }) => (
    <p id="action-status" role="status" aria-live="polite" className="min-h-6 text-sm text-emerald-300">
        {message}
    </p>
);

const EmptyMessage = ({ children }) => (
    <p className="rounded border border-dashed border-slate-700 p-3 text-sm text-slate-400">{children}</p>
);

const QuestItem = ({
    quest,
    onComplete,
    onUndoComplete,
    onDiscard,
    onRestore,
    onToggleToday
}) => (
    <li className="rounded border border-slate-700 bg-slate-900 p-4">
        <h3 className="text-base font-bold text-white">{quest.title}</h3>
        <dl className="mt-2 grid gap-x-5 gap-y-1 text-sm sm:grid-cols-2">
            <div><dt className="inline text-slate-400">ID: </dt><dd className="inline break-all font-mono">{quest.id}</dd></div>
            <div><dt className="inline text-slate-400">Status: </dt><dd className="inline">{quest.status}</dd></div>
            <div><dt className="inline text-slate-400">Selected for today: </dt><dd className="inline">{quest.selectedForToday ? 'yes' : 'no'}</dd></div>
            <div><dt className="inline text-slate-400">Difficulty: </dt><dd className="inline">{quest.difficulty}</dd></div>
            <div><dt className="inline text-slate-400">Due date: </dt><dd className="inline">{quest.dueDate || 'none'}</dd></div>
            <div><dt className="inline text-slate-400">Reward: </dt><dd className="inline">{quest.reward.xp || 0} XP, {formatCurrencyAmount(quest.reward.gold)} credits</dd></div>
        </dl>
        {quest.missionBrief ? <p className="mt-2 whitespace-pre-wrap text-sm text-slate-300"><span className="text-slate-400">Mission brief: </span>{quest.missionBrief}</p> : null}
        <div className="mt-3 flex flex-wrap gap-2" aria-label={`Actions for quest ${quest.title}`}>
            {quest.status === 'active' ? (
                <>
                    <button className={buttonClassName} type="button" onClick={() => onComplete(quest.id)}>Complete quest</button>
                    <button className={dangerButtonClassName} type="button" onClick={() => onDiscard(quest.id)}>Discard quest</button>
                </>
            ) : null}
            {quest.status === 'completed' ? <button className={buttonClassName} type="button" onClick={() => onUndoComplete(quest.id)}>Undo completion</button> : null}
            {quest.status === 'discarded' ? <button className={buttonClassName} type="button" onClick={() => onRestore(quest.id)}>Restore quest</button> : null}
            <button className={buttonClassName} type="button" onClick={() => onToggleToday(quest.id)}>
                {quest.selectedForToday ? 'Remove from today' : 'Select for today'}
            </button>
        </div>
    </li>
);

const ProtocolItem = ({
    protocol,
    onComplete,
    onSkip,
    onToggleActive,
    onDelete
}) => (
    <li className="rounded border border-slate-700 bg-slate-900 p-4">
        <h3 className="text-base font-bold text-white">{protocol.title}</h3>
        <dl className="mt-2 grid gap-x-5 gap-y-1 text-sm sm:grid-cols-2">
            <div><dt className="inline text-slate-400">ID: </dt><dd className="inline break-all font-mono">{protocol.id}</dd></div>
            <div><dt className="inline text-slate-400">Status: </dt><dd className="inline">{protocol.status}</dd></div>
            <div><dt className="inline text-slate-400">Selected for today: </dt><dd className="inline">{protocol.selectedForToday ? 'yes' : 'no'}</dd></div>
            <div><dt className="inline text-slate-400">Completed today: </dt><dd className="inline">{protocol.completedToday ? `yes (${protocol.completionsToday})` : 'no'}</dd></div>
            <div><dt className="inline text-slate-400">Schedule: </dt><dd className="inline">{protocol.frequency}{protocol.frequency === 'interval' ? ` every ${protocol.frequencyParam} days` : ''}</dd></div>
            <div><dt className="inline text-slate-400">Due: </dt><dd className="inline">{protocol.dueDate || 'today'} ({protocol.daysUntilDue} days)</dd></div>
            <div><dt className="inline text-slate-400">Streak: </dt><dd className="inline">{protocol.streak}</dd></div>
            <div><dt className="inline text-slate-400">Rewards: </dt><dd className="inline">{formatCurrencyAmount(protocol.completionReward)} completion, {formatCurrencyAmount(protocol.passiveReward)} passive</dd></div>
        </dl>
        <div className="mt-3 flex flex-wrap gap-2" aria-label={`Actions for protocol ${protocol.title}`}>
            <button className={buttonClassName} type="button" onClick={() => onComplete(protocol.id)}>Complete protocol</button>
            <button className={buttonClassName} type="button" onClick={() => onSkip(protocol.id)}>Skip current cycle</button>
            <button className={buttonClassName} type="button" onClick={() => onToggleActive(protocol.id, protocol.status !== 'active')}>
                {protocol.status === 'active' ? 'Deactivate / remove from today' : 'Activate'}
            </button>
            <button className={dangerButtonClassName} type="button" onClick={() => onDelete(protocol.id, protocol.title)}>Delete permanently</button>
        </div>
    </li>
);

const LlmInterface = () => {
    const {
        stats,
        quests,
        habits,
        addQuest,
        completeQuest,
        undoCompleteQuest,
        deleteQuest,
        restoreQuest,
        toggleToday,
        addHabit,
        completeHabit,
        skipHabitCycle,
        toggleHabitActivation,
        deleteHabit,
        importAppState
    } = useGame();
    const {
        user,
        dataUid,
        status: authStatus,
        isConfigured: isAuthConfigured,
        signIn,
        signOut
    } = useAuth();
    const {
        enabled: isCloudSyncEnabled,
        status: cloudSyncStatus,
        lastSyncedAt,
        enable: enableCloudSync,
        disable: disableCloudSync
    } = useCloudSync();
    const [now, setNow] = useState(() => new Date());
    const [message, setMessage] = useState('Ready.');
    const [isAuthBusy, setIsAuthBusy] = useState(false);
    const [pendingCloudSyncUid, setPendingCloudSyncUid] = useState(null);
    const [cloudReadyUid, setCloudReadyUid] = useState(null);

    useEffect(() => {
        const intervalId = window.setInterval(() => setNow(new Date()), 1000);
        const previousTitle = document.title;
        const robotsMeta = document.querySelector('meta[name="robots"]');
        const previousRobotsContent = robotsMeta?.getAttribute('content') || null;
        const activeRobotsMeta = robotsMeta || document.head.appendChild(document.createElement('meta'));

        activeRobotsMeta.setAttribute('name', 'robots');
        activeRobotsMeta.setAttribute('content', 'noindex, nofollow, noarchive');
        document.title = 'LifeQuest Text Interface';

        return () => {
            window.clearInterval(intervalId);
            document.title = previousTitle;
            if (!robotsMeta) {
                activeRobotsMeta.remove();
            } else if (previousRobotsContent === null) {
                robotsMeta.removeAttribute('content');
            } else {
                robotsMeta.setAttribute('content', previousRobotsContent);
            }
        };
    }, []);

    useEffect(() => {
        if (!pendingCloudSyncUid || user?.uid !== pendingCloudSyncUid) return undefined;

        // Let CloudSyncProvider finish processing the new authenticated user first.
        const timeoutId = window.setTimeout(() => {
            enableCloudSync();
            setPendingCloudSyncUid(null);
        }, 0);

        return () => window.clearTimeout(timeoutId);
    }, [enableCloudSync, pendingCloudSyncUid, user]);

    useEffect(() => {
        if (user) return;
        setCloudReadyUid(null);
        setPendingCloudSyncUid(null);
    }, [user]);

    const snapshot = useMemo(
        () => buildLlmSnapshot({ stats, quests, habits }, now),
        [stats, quests, habits, now]
    );
    const jsonSnapshot = useMemo(() => JSON.stringify(snapshot, null, 2), [snapshot]);
    const timeRemaining = getDayTimeRemaining(now);
    const isCloudDataReady = Boolean(user && dataUid && cloudReadyUid === user.uid);

    const runAction = (action, successMessage) => {
        action();
        setMessage(successMessage);
    };

    const handleCreateQuest = (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        const title = `${data.get('title') || ''}`.trim();
        if (!title) return;

        const customXp = `${data.get('customXp') || ''}`.trim();
        const customGold = `${data.get('customGold') || ''}`.trim();
        const customReward = customXp || customGold
            ? { xp: Number(customXp || 0), gold: Number(customGold || 0) }
            : null;

        addQuest(
            title,
            `${data.get('difficulty') || 'easy'}`,
            `${data.get('dueDate') || ''}` || null,
            customReward,
            `${data.get('missionBrief') || ''}`.trim()
        );
        form.reset();
        setMessage(`Created quest "${title}".`);
    };

    const handleCreateProtocol = (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        const title = `${data.get('title') || ''}`.trim();
        if (!title) return;

        const frequency = `${data.get('frequency') || 'daily'}`;
        addHabit(title, frequency, Number(data.get('frequencyParam') || 1), {
            completionReward: Number(data.get('completionReward') || 0),
            passiveReward: Number(data.get('passiveReward') || 0)
        });
        form.reset();
        setMessage(`Created inactive protocol "${title}". Activate it to include it in scheduling.`);
    };

    const handleDeleteProtocol = (id, title) => {
        if (!window.confirm(`Permanently delete protocol "${title}"? This cannot be undone.`)) return;
        runAction(() => deleteHabit(id), `Permanently deleted protocol "${title}".`);
    };

    const loadAuthenticatedCloudState = async (authenticatedUser) => {
        if (!firebaseDb || !authenticatedUser) {
            throw new Error('Firebase cloud storage is not configured.');
        }

        const access = getLifeQuestAccountAccess(authenticatedUser.uid, AUTH_SURFACES.LLM);
        if (!access) {
            throw new Error('This account is not authorized for the LifeQuest LLM interface.');
        }

        const cloud = await loadCloudSnapshot({
            db: firebaseDb,
            uid: access.dataUid
        });

        const result = applyCloudSnapshotToDevice(cloud, importAppState);

        if (result.status === 'empty') {
            setCloudReadyUid(null);
            throw new Error('The owner account does not have a LifeQuest cloud copy yet. Upload or synchronize it from the normal interface before using the LLM interface.');
        }

        setCloudReadyUid(authenticatedUser.uid);
        setPendingCloudSyncUid(authenticatedUser.uid);
        setMessage(`Signed in and loaded the verified cloud copy. Previous device data was backed up locally as ${result.backupKey}. Cloud sync is being enabled.`);
    };

    const handleSignInAndLoad = async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        const email = `${data.get('email') || ''}`.trim();
        const password = `${data.get('password') || ''}`;

        setIsAuthBusy(true);
        setCloudReadyUid(null);
        setMessage('Signing in to Firebase and checking the cloud copy…');

        try {
            const credential = await signIn(email, password);
            form.reset();
            await loadAuthenticatedCloudState(credential.user);
        } catch (error) {
            setMessage(
                AUTH_ERROR_MESSAGES[error?.code]
                || error?.message
                || 'Sign-in or cloud loading failed. Device data was not changed.'
            );
        } finally {
            setIsAuthBusy(false);
        }
    };

    const handleReloadCloud = async () => {
        if (!user) return;

        setIsAuthBusy(true);
        setCloudReadyUid(null);
        setMessage('Checking and loading the latest verified cloud copy…');

        try {
            if (isCloudSyncEnabled) disableCloudSync();
            await loadAuthenticatedCloudState(user);
        } catch (error) {
            setMessage(error?.message || 'The cloud copy could not be loaded. Device data was not changed.');
        } finally {
            setIsAuthBusy(false);
        }
    };

    const handleSignOut = async () => {
        setIsAuthBusy(true);
        setMessage('Signing out…');

        try {
            if (isCloudSyncEnabled) disableCloudSync();
            await signOut();
            setPendingCloudSyncUid(null);
            setCloudReadyUid(null);
            setMessage('Signed out. LifeQuest data and actions are locked.');
        } catch {
            setMessage('Sign-out failed. Try again.');
        } finally {
            setIsAuthBusy(false);
        }
    };

    return (
        <main data-interface="lifequest-llm-text-v2" className="h-screen overflow-y-auto bg-slate-950 text-slate-100">
            <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
                <header>
                    <h1 className="text-3xl font-bold">LifeQuest Text Interface</h1>
                    <p className="mt-2 max-w-3xl text-sm text-slate-300">
                        Semantic HTML access to authentication, cloud state, dashboard, quests, protocols, and actions.
                        Text-based browser agents can use this page without screenshots. Access requires the dedicated LLM Firebase account.
                    </p>
                    <p className="mt-2 font-mono text-xs text-slate-400">Snapshot generated: {snapshot.interface.generatedAt}</p>
                    <div className="mt-4"><StatusMessage message={message} /></div>
                </header>

                <nav aria-label="Text interface sections" className="mt-6 border-y border-slate-700 py-3 text-sm">
                    <span className="mr-3 text-slate-400">Sections:</span>
                    <a className="mr-3 underline" href="#account">Account and cloud</a>
                    {isCloudDataReady ? (
                        <>
                            <a className="mr-3 underline" href="#dashboard">Dashboard and today</a>
                            <a className="mr-3 underline" href="#quests">Quests</a>
                            <a className="mr-3 underline" href="#protocols">Protocols</a>
                            <a className="underline" href="#machine-state">Optional JSON</a>
                        </>
                    ) : null}
                </nav>

                <section id="account" aria-labelledby="account-heading" aria-busy={isAuthBusy} className="mt-8 border-t border-slate-700 pt-6">
                    <h2 id="account-heading" className="text-2xl font-bold">Account and cloud</h2>
                    <p className="mt-1 text-sm text-slate-400">
                        Signing in with the dedicated LLM account immediately verifies and loads the owner&apos;s LifeQuest cloud copy.
                        A local backup is created before device data is replaced. The password is sent directly to Firebase Authentication and is not included in page state or JSON.
                    </p>
                    <dl className="mt-4 grid gap-x-5 gap-y-1 text-sm sm:grid-cols-2">
                        <div><dt className="inline text-slate-400">Authentication status: </dt><dd className="inline">{authStatus}</dd></div>
                        <div><dt className="inline text-slate-400">Cloud sync status: </dt><dd className="inline">{cloudSyncStatus}</dd></div>
                        <div><dt className="inline text-slate-400">Cloud sync enabled: </dt><dd className="inline">{isCloudSyncEnabled ? 'yes' : 'no'}</dd></div>
                        <div><dt className="inline text-slate-400">Last synchronized: </dt><dd className="inline">{lastSyncedAt || 'never on this device'}</dd></div>
                        <div><dt className="inline text-slate-400">Verified cloud data loaded: </dt><dd className="inline">{isCloudDataReady ? 'yes' : 'no'}</dd></div>
                    </dl>

                    {!isAuthConfigured ? (
                        <EmptyMessage>Firebase authentication is unavailable in this build, so this interface cannot unlock LifeQuest data.</EmptyMessage>
                    ) : authStatus === 'loading' ? (
                        <p className="mt-4 text-sm">Checking the saved Firebase session…</p>
                    ) : user ? (
                        <div className="mt-4">
                            <dl className="space-y-1 text-sm">
                                <div><dt className="inline text-slate-400">Signed-in email: </dt><dd className="inline">{user.email || 'not provided'}</dd></div>
                                <div><dt className="inline text-slate-400">Firebase user ID: </dt><dd className="inline break-all font-mono">{user.uid}</dd></div>
                            </dl>
                            <div className="mt-3 flex flex-wrap gap-2" aria-label="Authenticated account actions">
                                <button className={buttonClassName} type="button" disabled={isAuthBusy} onClick={handleReloadCloud}>
                                    Load latest cloud copy
                                </button>
                                <button className={buttonClassName} type="button" disabled={isAuthBusy} onClick={handleSignOut}>
                                    Sign out
                                </button>
                            </div>
                        </div>
                    ) : (
                        <form aria-label="Firebase sign in and cloud load" className="mt-4 grid gap-3 rounded border border-slate-700 p-4" onSubmit={handleSignInAndLoad}>
                            <h3 className="font-bold">Sign in and load cloud data</h3>
                            <label htmlFor="llm-account-email">Email</label>
                            <input
                                id="llm-account-email"
                                className={inputClassName}
                                name="email"
                                type="email"
                                autoComplete="username"
                                required
                            />
                            <label htmlFor="llm-account-password">Password</label>
                            <input
                                id="llm-account-password"
                                className={inputClassName}
                                name="password"
                                type="password"
                                autoComplete="current-password"
                                required
                            />
                            <button className={buttonClassName} type="submit" disabled={isAuthBusy}>
                                {isAuthBusy ? 'Signing in and loading…' : 'Sign in and load cloud data'}
                            </button>
                        </form>
                    )}
                </section>

                {isCloudDataReady ? (
                    <>
                <section id="dashboard" aria-labelledby="dashboard-heading" className="mt-8 border-t border-slate-700 pt-6">
                    <h2 id="dashboard-heading" className="text-2xl font-bold">Dashboard</h2>
                    <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="rounded border border-slate-700 p-3"><dt className="text-sm text-slate-400">Health remaining</dt><dd className="text-xl font-bold">{snapshot.dashboard.health.current} / {snapshot.dashboard.health.maximum}</dd></div>
                        <div className="rounded border border-slate-700 p-3"><dt className="text-sm text-slate-400">Credits on hand</dt><dd className="text-xl font-bold">{formatCurrencyAmount(snapshot.dashboard.coinsOnHand)}</dd></div>
                        <div className="rounded border border-slate-700 p-3"><dt className="text-sm text-slate-400">Level and XP</dt><dd className="text-xl font-bold">Level {snapshot.dashboard.level}; {snapshot.dashboard.xp.current} / {snapshot.dashboard.xp.nextLevelAt} XP</dd></div>
                        <div className="rounded border border-slate-700 p-3"><dt className="text-sm text-slate-400">Time remaining today</dt><dd className="font-mono text-xl font-bold">{formatTimeRemaining(timeRemaining)}</dd></div>
                    </dl>

                    <section aria-labelledby="today-heading" className="mt-6">
                        <h3 id="today-heading" className="text-xl font-bold">Today</h3>
                        <p className="mt-1 text-sm text-slate-400">All pending quests selected for today and all incomplete active protocols currently due. Unlike the visual dashboard, this list is not capped at seven items.</p>
                        <h4 className="mt-4 font-bold">Today&apos;s quests ({snapshot.dashboard.today.quests.length})</h4>
                        {snapshot.dashboard.today.quests.length ? (
                            <ul className="mt-2 list-disc space-y-1 pl-6">
                                {snapshot.dashboard.today.quests.map((quest) => <li key={quest.id}><span className="font-semibold">{quest.title}</span> — {quest.status}; ID: <code>{quest.id}</code></li>)}
                            </ul>
                        ) : <EmptyMessage>No quests are selected for today.</EmptyMessage>}
                        <h4 className="mt-4 font-bold">Today&apos;s protocols ({snapshot.dashboard.today.protocols.length})</h4>
                        {snapshot.dashboard.today.protocols.length ? (
                            <ul className="mt-2 list-disc space-y-1 pl-6">
                                {snapshot.dashboard.today.protocols.map((protocol) => <li key={protocol.id}><span className="font-semibold">{protocol.title}</span> — {protocol.completedToday ? 'completed today' : 'pending'}; ID: <code>{protocol.id}</code></li>)}
                            </ul>
                        ) : <EmptyMessage>No active protocols are currently due.</EmptyMessage>}
                    </section>
                </section>

                <section id="quests" aria-labelledby="quests-heading" className="mt-8 border-t border-slate-700 pt-6">
                    <h2 id="quests-heading" className="text-2xl font-bold">Quests ({snapshot.quests.length})</h2>
                    <form aria-label="Create quest" className="mt-4 grid gap-3 rounded border border-slate-700 p-4 sm:grid-cols-2" onSubmit={handleCreateQuest}>
                        <h3 className="font-bold sm:col-span-2">Create quest</h3>
                        <label htmlFor="llm-quest-title">Title</label><input id="llm-quest-title" className={inputClassName} name="title" required />
                        <label htmlFor="llm-quest-difficulty">Difficulty</label><select id="llm-quest-difficulty" className={inputClassName} name="difficulty" defaultValue="easy"><option value="easy">easy</option><option value="medium">medium</option><option value="hard">hard</option><option value="legendary">legendary</option></select>
                        <label htmlFor="llm-quest-due-date">Due date</label><input id="llm-quest-due-date" className={inputClassName} name="dueDate" type="date" />
                        <label htmlFor="llm-quest-custom-xp">Custom XP (optional)</label><input id="llm-quest-custom-xp" className={inputClassName} min="0" name="customXp" type="number" />
                        <label htmlFor="llm-quest-custom-gold">Custom credits (optional)</label><input id="llm-quest-custom-gold" className={inputClassName} min="0" step="0.1" name="customGold" type="number" />
                        <label htmlFor="llm-quest-brief" className="sm:col-span-2">Mission brief</label><textarea id="llm-quest-brief" className={`${inputClassName} sm:col-span-2`} name="missionBrief" rows="3" />
                        <button className={`${buttonClassName} sm:col-span-2`} type="submit">Create quest</button>
                    </form>
                    {snapshot.quests.length ? (
                        <ul className="mt-4 space-y-3">
                            {snapshot.quests.map((quest) => (
                                <QuestItem
                                    key={quest.id}
                                    quest={quest}
                                    onComplete={(id) => runAction(() => completeQuest(id), `Completed quest ${id}.`)}
                                    onUndoComplete={(id) => runAction(() => undoCompleteQuest(id), `Undid completion for quest ${id}.`)}
                                    onDiscard={(id) => runAction(() => deleteQuest(id), `Discarded quest ${id}.`)}
                                    onRestore={(id) => runAction(() => restoreQuest(id), `Restored quest ${id}.`)}
                                    onToggleToday={(id) => runAction(() => toggleToday(id, 'quest'), `Changed today selection for quest ${id}.`)}
                                />
                            ))}
                        </ul>
                    ) : <div className="mt-4"><EmptyMessage>No quests exist.</EmptyMessage></div>}
                </section>

                <section id="protocols" aria-labelledby="protocols-heading" className="mt-8 border-t border-slate-700 pt-6">
                    <h2 id="protocols-heading" className="text-2xl font-bold">Protocols ({snapshot.protocols.length})</h2>
                    <form aria-label="Create protocol" className="mt-4 grid gap-3 rounded border border-slate-700 p-4 sm:grid-cols-2" onSubmit={handleCreateProtocol}>
                        <h3 className="font-bold sm:col-span-2">Create protocol</h3>
                        <label htmlFor="llm-protocol-title">Title</label><input id="llm-protocol-title" className={inputClassName} name="title" required />
                        <label htmlFor="llm-protocol-frequency">Frequency</label><select id="llm-protocol-frequency" className={inputClassName} name="frequency" defaultValue="daily"><option value="daily">daily</option><option value="weekly">weekly</option><option value="monthly">monthly</option><option value="interval">interval</option></select>
                        <label htmlFor="llm-protocol-interval">Interval days</label><input id="llm-protocol-interval" className={inputClassName} defaultValue="1" min="1" name="frequencyParam" type="number" />
                        <label htmlFor="llm-protocol-completion-reward">Completion credit reward</label><input id="llm-protocol-completion-reward" className={inputClassName} defaultValue="0" min="0" step="0.1" name="completionReward" type="number" />
                        <label htmlFor="llm-protocol-passive-reward">Passive daily credit reward</label><input id="llm-protocol-passive-reward" className={inputClassName} defaultValue="0" min="0" step="0.1" name="passiveReward" type="number" />
                        <button className={`${buttonClassName} sm:col-span-2`} type="submit">Create protocol</button>
                    </form>
                    {snapshot.protocols.length ? (
                        <ul className="mt-4 space-y-3">
                            {snapshot.protocols.map((protocol) => (
                                <ProtocolItem
                                    key={protocol.id}
                                    protocol={protocol}
                                    onComplete={(id) => runAction(() => completeHabit(id), `Completed protocol ${id}.`)}
                                    onSkip={(id) => runAction(() => skipHabitCycle(id), `Skipped the current cycle for protocol ${id}.`)}
                                    onToggleActive={(id, isActive) => runAction(() => toggleHabitActivation(id, isActive), `${isActive ? 'Activated' : 'Deactivated'} protocol ${id}.`)}
                                    onDelete={handleDeleteProtocol}
                                />
                            ))}
                        </ul>
                    ) : <div className="mt-4"><EmptyMessage>No protocols exist.</EmptyMessage></div>}
                </section>

                <section id="machine-state" aria-labelledby="json-heading" className="mt-8 border-t border-slate-700 pb-16 pt-6">
                    <h2 id="json-heading" className="text-2xl font-bold">Machine-readable state</h2>
                    <p className="mt-1 text-sm text-slate-400">
                        This duplicates the readable state above, so it is collapsed by default to reduce text-agent context usage.
                    </p>
                    <details className="mt-4">
                        <summary className="cursor-pointer font-semibold">Show complete JSON snapshot</summary>
                        <pre id="lifequest-state-json" data-format="application/json" className="mt-4 overflow-x-auto whitespace-pre-wrap rounded border border-slate-700 bg-black p-4 text-xs text-slate-200">{jsonSnapshot}</pre>
                    </details>
                </section>
                    </>
                ) : (
                    <section id="locked" aria-labelledby="locked-heading" className="mt-8 border-t border-slate-700 pb-16 pt-6">
                        <h2 id="locked-heading" className="text-2xl font-bold">LifeQuest data locked</h2>
                        <p className="mt-2 text-sm text-slate-300">
                            Authenticate with the dedicated LLM account and load its verified owner cloud copy to reveal state and actions.
                        </p>
                    </section>
                )}
            </div>
        </main>
    );
};

export default LlmInterface;
