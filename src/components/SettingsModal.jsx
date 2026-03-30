import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import { AlertTriangle, CheckCircle2, Copy, Download, Save, Upload, X } from 'lucide-react';
import {
    formatPortableSnapshot,
    parsePortableSnapshot,
    summarizePortableSnapshot
} from '../utils/portableState.js';

const SettingsModal = ({ isOpen, onClose }) => {
    const {
        stats,
        updateStats,
        settings,
        updateSettings,
        exportAppState,
        importAppState
    } = useGame();

    const [localStats, setLocalStats] = useState(stats);
    const [localSettings, setLocalSettings] = useState(settings);
    const [exportText, setExportText] = useState('');
    const [copyStatus, setCopyStatus] = useState('');
    const [importText, setImportText] = useState('');
    const [importError, setImportError] = useState('');
    const [importStatus, setImportStatus] = useState('');
    const [importSummary, setImportSummary] = useState(null);
    const [validatedSnapshot, setValidatedSnapshot] = useState(null);

    React.useEffect(() => {
        if (isOpen) {
            setLocalStats(stats);
            setLocalSettings(settings);
        }
    }, [isOpen, stats, settings]);

    if (!isOpen) return null;

    const resetImportValidation = () => {
        setImportError('');
        setImportStatus('');
        setImportSummary(null);
        setValidatedSnapshot(null);
    };

    const handleStatChange = (e) => {
        const { name, value } = e.target;
        setLocalStats(prev => ({
            ...prev,
            [name]: parseInt(value, 10) || 0
        }));
    };

    const handleSettingChange = (e) => {
        const { name, value } = e.target;
        if (name === 'protocolReward') {
            setLocalSettings(prev => ({ ...prev, protocolReward: parseInt(value, 10) || 0 }));
            return;
        }

        setLocalSettings(prev => ({
            ...prev,
            questRewards: {
                ...prev.questRewards,
                [name]: parseInt(value, 10) || 0
            }
        }));
    };

    const handleSave = () => {
        updateStats(localStats);
        updateSettings(localSettings);
        onClose();
    };

    const handleGenerateExport = () => {
        const snapshot = exportAppState();
        setExportText(formatPortableSnapshot(snapshot));
        setCopyStatus('');
    };

    const handleCopyExport = async () => {
        if (!exportText) return;

        try {
            await navigator.clipboard.writeText(exportText);
            setCopyStatus('Export copied to clipboard.');
        } catch {
            setCopyStatus('Clipboard copy failed. Copy the text manually.');
        }
    };

    const handleValidateImport = () => {
        try {
            const snapshot = parsePortableSnapshot(importText);
            setValidatedSnapshot(snapshot);
            setImportSummary(summarizePortableSnapshot(snapshot));
            setImportError('');
            setImportStatus('Import text is valid and ready to replace current data.');
        } catch (error) {
            setValidatedSnapshot(null);
            setImportSummary(null);
            setImportStatus('');
            setImportError(error.message);
        }
    };

    const handleReplaceImport = () => {
        if (!validatedSnapshot) return;

        const confirmed = window.confirm(
            'Replace all current LifeQuest data with the validated import text? This overwrites the current app state.'
        );

        if (!confirmed) return;

        const { backupKey } = importAppState(validatedSnapshot);
        setExportText('');
        setCopyStatus('');
        setImportText('');
        setImportSummary(null);
        setValidatedSnapshot(null);
        setImportError('');
        setImportStatus(`Import complete. Pre-import backup saved in localStorage as ${backupKey}.`);
    };

    return (
        <div className="fixed inset-0 z-[101] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" data-no-swipe="true">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[85vh] overflow-y-auto shadow-2xl">
                <div className="sticky top-0 bg-slate-900/95 backdrop-blur border-b border-slate-700 p-4 flex justify-between items-center z-10">
                    <h2 className="text-xl font-game text-game-accent uppercase tracking-wider">System Configuration</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6 space-y-8">
                    <div className="space-y-4">
                        <h3 className="text-lg font-bold text-white border-b border-slate-800 pb-2">Player Parameters</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-xs text-game-muted uppercase font-bold">Level</label>
                                <input
                                    type="number"
                                    name="level"
                                    value={localStats.level}
                                    onChange={handleStatChange}
                                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-white focus:border-game-accent focus:outline-none font-mono"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs text-game-muted uppercase font-bold">Experience (XP)</label>
                                <input
                                    type="number"
                                    name="xp"
                                    value={localStats.xp}
                                    onChange={handleStatChange}
                                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-white focus:border-game-accent focus:outline-none font-mono"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs text-game-muted uppercase font-bold">Current HP</label>
                                <input
                                    type="number"
                                    name="hp"
                                    value={localStats.hp}
                                    onChange={handleStatChange}
                                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-white focus:border-game-accent focus:outline-none font-mono"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs text-game-muted uppercase font-bold">Max HP</label>
                                <input
                                    type="number"
                                    name="maxHp"
                                    value={localStats.maxHp}
                                    onChange={handleStatChange}
                                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-white focus:border-game-accent focus:outline-none font-mono"
                                />
                            </div>
                            <div className="space-y-1 md:col-span-2">
                                <label className="text-xs text-game-muted uppercase font-bold text-game-gold">Credits Balance</label>
                                <input
                                    type="number"
                                    name="gold"
                                    value={localStats.gold}
                                    onChange={handleStatChange}
                                    className="w-full bg-slate-950 border border-game-gold/30 rounded px-3 py-2 text-game-gold focus:border-game-gold focus:outline-none font-mono"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-lg font-bold text-white border-b border-slate-800 pb-2">Reward Configuration</h3>

                        <div className="space-y-3">
                            <label className="text-sm font-bold text-gray-300">Default Protocol Bonus (Credits)</label>
                            <input
                                type="number"
                                name="protocolReward"
                                value={localSettings?.protocolReward || 1}
                                onChange={handleSettingChange}
                                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-white focus:border-game-accent focus:outline-none font-mono"
                            />
                        </div>

                        <div className="space-y-3">
                            <label className="text-sm font-bold text-gray-300">Quest Difficulty Rewards (Credits)</label>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs text-gray-500">Easy</label>
                                    <input
                                        type="number"
                                        name="easy"
                                        value={localSettings?.questRewards?.easy || 5}
                                        onChange={handleSettingChange}
                                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-white focus:border-game-accent focus:outline-none font-mono"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs text-gray-500">Medium</label>
                                    <input
                                        type="number"
                                        name="medium"
                                        value={localSettings?.questRewards?.medium || 15}
                                        onChange={handleSettingChange}
                                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-white focus:border-game-accent focus:outline-none font-mono"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs text-gray-500">Hard</label>
                                    <input
                                        type="number"
                                        name="hard"
                                        value={localSettings?.questRewards?.hard || 40}
                                        onChange={handleSettingChange}
                                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-white focus:border-game-accent focus:outline-none font-mono"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs text-gray-500">Legendary</label>
                                    <input
                                        type="number"
                                        name="legendary"
                                        value={localSettings?.questRewards?.legendary || 100}
                                        onChange={handleSettingChange}
                                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-white focus:border-game-accent focus:outline-none font-mono"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-5">
                        <div className="border-b border-slate-800 pb-2">
                            <h3 className="text-lg font-bold text-white">Data Transfer</h3>
                            <p className="text-sm text-slate-400 mt-1">Generate a readable full-state export, then validate and replace from pasted transfer text.</p>
                        </div>

                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-sm font-bold text-gray-300 uppercase tracking-wide">Export Snapshot</h4>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={handleGenerateExport}
                                            className="px-3 py-2 rounded bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors text-sm flex items-center gap-2"
                                        >
                                            <Download size={15} />
                                            Generate Export
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleCopyExport}
                                            disabled={!exportText}
                                            className="px-3 py-2 rounded bg-game-accent text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-cyan-300 transition-colors text-sm flex items-center gap-2"
                                        >
                                            <Copy size={15} />
                                            Copy
                                        </button>
                                    </div>
                                </div>
                                <textarea
                                    readOnly
                                    value={exportText}
                                    placeholder="Generate export text here."
                                    className="w-full min-h-[380px] bg-slate-950 border border-slate-800 rounded px-3 py-3 text-sm text-slate-100 focus:outline-none font-mono resize-y"
                                />
                                {copyStatus && (
                                    <div className="text-xs text-slate-400">{copyStatus}</div>
                                )}
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-sm font-bold text-gray-300 uppercase tracking-wide">Import Snapshot</h4>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={handleValidateImport}
                                            disabled={!importText.trim()}
                                            className="px-3 py-2 rounded bg-slate-800 text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-700 transition-colors text-sm flex items-center gap-2"
                                        >
                                            <CheckCircle2 size={15} />
                                            Validate Import
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleReplaceImport}
                                            disabled={!validatedSnapshot}
                                            className="px-3 py-2 rounded bg-rose-600 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-rose-500 transition-colors text-sm flex items-center gap-2"
                                        >
                                            <Upload size={15} />
                                            Replace Current Data
                                        </button>
                                    </div>
                                </div>
                                <textarea
                                    value={importText}
                                    onChange={(e) => {
                                        setImportText(e.target.value);
                                        resetImportValidation();
                                    }}
                                    placeholder="Paste LifeQuest transfer text here."
                                    className="w-full min-h-[380px] bg-slate-950 border border-slate-800 rounded px-3 py-3 text-sm text-slate-100 focus:border-game-accent focus:outline-none font-mono resize-y"
                                />

                                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-100/90">
                                    <div className="flex items-start gap-3">
                                        <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-300" />
                                        <div>
                                            Import replaces the current stored state across gameplay, budget, logs, and transfer preferences. A pre-import backup is written before replacement.
                                        </div>
                                    </div>
                                </div>

                                {importSummary && (
                                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
                                        <div className="text-xs uppercase tracking-widest text-emerald-300 font-bold mb-2">Validated Summary</div>
                                        <div className="grid grid-cols-2 gap-2 text-sm text-emerald-100">
                                            <div>Quests: {importSummary.quests}</div>
                                            <div>Protocols: {importSummary.habits}</div>
                                            <div>Coin Entries: {importSummary.coinHistory}</div>
                                            <div>Calorie Entries: {importSummary.calorieHistory}</div>
                                            <div>Groceries: {importSummary.groceryList}</div>
                                            <div>Price DB Items: {importSummary.priceDatabase}</div>
                                        </div>
                                    </div>
                                )}

                                {importError && (
                                    <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 px-4 py-3 text-sm text-rose-200">
                                        {importError}
                                    </div>
                                )}

                                {importStatus && !importError && (
                                    <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 px-4 py-3 text-sm text-sky-100">
                                        {importStatus}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t border-slate-800 flex justify-end gap-3 sticky bottom-0 bg-slate-900/95 backdrop-blur">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded text-gray-400 hover:bg-slate-800 transition-colors font-bold text-sm"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-6 py-2 bg-game-accent text-slate-900 rounded font-bold shadow-neon hover:bg-cyan-300 transition-colors flex items-center gap-2"
                    >
                        <Save size={16} />
                        Save Configuration
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;
