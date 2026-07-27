import React, { useEffect, useMemo, useState } from 'react';
import { useGame } from '../context/GameContext';
import { buildLlmSnapshot, getDayTimeRemaining } from '../utils/llmInterface';

const inputClassName = 'w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white';
const buttonClassName = 'rounded border border-slate-500 bg-slate-800 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50';
const dangerButtonClassName = 'rounded border border-red-700 bg-red-950 px-3 py-2 text-sm font-semibold text-red-100 hover:bg-red-900';

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
            <div><dt className="inline text-slate-400">Reward: </dt><dd className="inline">{quest.reward.xp || 0} XP, {quest.reward.gold || 0} coins</dd></div>
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
            <div><dt className="inline text-slate-400">Rewards: </dt><dd className="inline">{protocol.completionReward} completion, {protocol.passiveReward} passive</dd></div>
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
        deleteHabit
    } = useGame();
    const [now, setNow] = useState(() => new Date());
    const [message, setMessage] = useState('Ready.');

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

    const snapshot = useMemo(
        () => buildLlmSnapshot({ stats, quests, habits }, now),
        [stats, quests, habits, now]
    );
    const jsonSnapshot = useMemo(() => JSON.stringify(snapshot, null, 2), [snapshot]);
    const timeRemaining = getDayTimeRemaining(now);

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

    return (
        <main className="h-screen overflow-y-auto bg-slate-950 text-slate-100">
            <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
                <header>
                    <h1 className="text-3xl font-bold">LifeQuest Text Interface</h1>
                    <p className="mt-2 max-w-3xl text-sm text-slate-300">
                        Semantic, low-decoration access to dashboard, quest, and protocol state and actions.
                        This URL is unlisted but is not authentication.
                    </p>
                    <p className="mt-2 font-mono text-xs text-slate-400">Snapshot generated: {snapshot.interface.generatedAt}</p>
                    <div className="mt-4"><StatusMessage message={message} /></div>
                </header>

                <section aria-labelledby="dashboard-heading" className="mt-8 border-t border-slate-700 pt-6">
                    <h2 id="dashboard-heading" className="text-2xl font-bold">Dashboard</h2>
                    <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="rounded border border-slate-700 p-3"><dt className="text-sm text-slate-400">Health remaining</dt><dd className="text-xl font-bold">{snapshot.dashboard.health.current} / {snapshot.dashboard.health.maximum}</dd></div>
                        <div className="rounded border border-slate-700 p-3"><dt className="text-sm text-slate-400">Coins on hand</dt><dd className="text-xl font-bold">{snapshot.dashboard.coinsOnHand}</dd></div>
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

                <section aria-labelledby="quests-heading" className="mt-8 border-t border-slate-700 pt-6">
                    <h2 id="quests-heading" className="text-2xl font-bold">Quests ({snapshot.quests.length})</h2>
                    <form aria-label="Create quest" className="mt-4 grid gap-3 rounded border border-slate-700 p-4 sm:grid-cols-2" onSubmit={handleCreateQuest}>
                        <h3 className="font-bold sm:col-span-2">Create quest</h3>
                        <label>Title<input className={inputClassName} name="title" required /></label>
                        <label>Difficulty<select className={inputClassName} name="difficulty" defaultValue="easy"><option value="easy">easy</option><option value="medium">medium</option><option value="hard">hard</option><option value="legendary">legendary</option></select></label>
                        <label>Due date<input className={inputClassName} name="dueDate" type="date" /></label>
                        <label>Custom XP (optional)<input className={inputClassName} min="0" name="customXp" type="number" /></label>
                        <label>Custom coins (optional)<input className={inputClassName} min="0" name="customGold" type="number" /></label>
                        <label className="sm:col-span-2">Mission brief<textarea className={inputClassName} name="missionBrief" rows="3" /></label>
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

                <section aria-labelledby="protocols-heading" className="mt-8 border-t border-slate-700 pt-6">
                    <h2 id="protocols-heading" className="text-2xl font-bold">Protocols ({snapshot.protocols.length})</h2>
                    <form aria-label="Create protocol" className="mt-4 grid gap-3 rounded border border-slate-700 p-4 sm:grid-cols-2" onSubmit={handleCreateProtocol}>
                        <h3 className="font-bold sm:col-span-2">Create protocol</h3>
                        <label>Title<input className={inputClassName} name="title" required /></label>
                        <label>Frequency<select className={inputClassName} name="frequency" defaultValue="daily"><option value="daily">daily</option><option value="weekly">weekly</option><option value="monthly">monthly</option><option value="interval">interval</option></select></label>
                        <label>Interval days<input className={inputClassName} defaultValue="1" min="1" name="frequencyParam" type="number" /></label>
                        <label>Completion coin reward<input className={inputClassName} defaultValue="0" min="0" name="completionReward" type="number" /></label>
                        <label>Passive daily coin reward<input className={inputClassName} defaultValue="0" min="0" name="passiveReward" type="number" /></label>
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

                <section aria-labelledby="json-heading" className="mt-8 border-t border-slate-700 pb-16 pt-6">
                    <h2 id="json-heading" className="text-2xl font-bold">Machine-readable state</h2>
                    <p className="mt-1 text-sm text-slate-400">The same dashboard, today, quest, and protocol data as JSON.</p>
                    <pre id="lifequest-state-json" data-format="application/json" className="mt-4 overflow-x-auto whitespace-pre-wrap rounded border border-slate-700 bg-black p-4 text-xs text-slate-200">{jsonSnapshot}</pre>
                </section>
            </div>
        </main>
    );
};

export default LlmInterface;
