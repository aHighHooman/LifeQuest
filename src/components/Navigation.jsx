import React from 'react';
import { LayoutDashboard, Scroll, Repeat, Minimize2, Wallet, Calendar } from 'lucide-react';
import clsx from 'clsx';
import { useGame } from '../context/GameContext';

const Navigation = ({ currentTab, onTabChange }) => {
    const { setWidgetMode } = useGame();
    const tabs = [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'quests', label: 'Quests', icon: Scroll },
        { id: 'calendar', label: 'Calendar', icon: Calendar },
        { id: 'protocols', label: 'Protocols', icon: Repeat },
        { id: 'budget', label: 'Budget', icon: Wallet },
    ];

    const enterWidgetMode = () => {
        setWidgetMode(true);
        // Resize window to widget size
        if (window.resizeTo) {
            window.resizeTo(320, 480);
        }
    };

    return (
        <nav className="fixed bottom-0 left-0 right-0 md:top-0 md:bottom-auto md:left-6 md:right-auto md:fixed z-50 bg-slate-950/80 border-t md:border-t-0 md:border border-slate-700 backdrop-blur-md md:rounded-full md:m-6 md:px-6 p-2 md:p-2 flex justify-around md:gap-4 shadow-2xl">
            {tabs.map(tab => {
                const Icon = tab.icon;
                const isActive = currentTab === tab.id;
                return (
                    <button
                        key={tab.id}
                        onClick={() => onTabChange(tab.id)}
                        className={clsx(
                            "flex flex-col md:flex-row items-center gap-1 md:gap-2 px-4 py-2 rounded-xl transition-all",
                            isActive
                                ? "bg-game-accent/20 text-game-accent shadow-[0_0_10px_rgba(56,189,248,0.3)]"
                                : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
                        )}
                    >
                        <Icon size={20} />
                        <span className="text-[10px] md:text-sm font-bold uppercase tracking-wider">{tab.label}</span>
                    </button>
                );
            })}

            <div className="w-[1px] bg-slate-800 mx-1 hidden md:block" />

            <button
                onClick={enterWidgetMode}
                className="flex flex-col md:flex-row items-center gap-1 md:gap-2 px-4 py-2 rounded-xl transition-all text-game-gold/60 hover:text-game-gold hover:bg-game-gold/10"
                title="Enter Widget Mode"
            >
                <Minimize2 size={20} />
                <span className="text-[10px] md:text-sm font-bold uppercase tracking-wider">Widget</span>
            </button>
        </nav>
    );
};

export default Navigation;
