import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import { X, Save, RotateCcw } from 'lucide-react';

const SettingsModal = ({ isOpen, onClose }) => {
    const { stats, updateStats, settings, updateSettings } = useGame();

    // Local state for form handling
    const [localStats, setLocalStats] = useState(stats);
    const [localSettings, setLocalSettings] = useState(settings);

    // Sync local state when modal opens or stats change externally
    React.useEffect(() => {
        if (isOpen) {
            setLocalStats(stats);
            setLocalSettings(settings); // Ensure settings are synced too
        }
    }, [isOpen, stats, settings]);

    if (!isOpen) return null;

    const handleStatChange = (e) => {
        const { name, value } = e.target;
        setLocalStats(prev => ({
            ...prev,
            [name]: parseInt(value) || 0
        }));
    };

    const handleSettingChange = (e) => {
        const { name, value } = e.target;
        if (name === 'protocolReward') {
            setLocalSettings(prev => ({ ...prev, protocolReward: parseInt(value) || 0 }));
        } else {
            // Quest rewards
            setLocalSettings(prev => ({
                ...prev,
                questRewards: {
                    ...prev.questRewards,
                    [name]: parseInt(value) || 0
                }
            }));
        }
    };

    const handleSave = () => {
        updateStats(localStats);
        updateSettings(localSettings);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto shadow-2xl">
                <div className="sticky top-0 bg-slate-900/95 backdrop-blur border-b border-slate-700 p-4 flex justify-between items-center z-10">
                    <h2 className="text-xl font-game text-game-accent uppercase tracking-wider">System Configuration</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6 space-y-8">
                    {/* Player Stats Section */}
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

                    {/* Reward Settings Section */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-bold text-white border-b border-slate-800 pb-2">Reward Configuration</h3>

                        <div className="space-y-3">
                            <label className="text-sm font-bold text-gray-300">Protocol Rewards (Credits)</label>
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
