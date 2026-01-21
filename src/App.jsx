import React, { useState } from 'react';
import { GameProvider, useGame } from './context/GameContext';
import Dashboard from './components/Dashboard';
import QuestBoard from './components/QuestBoard';
import HabitTracker from './components/HabitTracker';
import Navigation from './components/Navigation';

import BudgetView from './components/BudgetView';
import CalendarView from './components/CalendarView';
import CalorieTracker from './components/CalorieTracker';
import { BudgetProvider } from './context/BudgetContext';
import SettingsModal from './components/SettingsModal';

function AppContent({ currentTab, setCurrentTab }) {
  const context = useGame();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  if (!context) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <p>Initialization Error: GameContext not found.</p>
      </div>
    );
  }

  // Widget mode logic removed

  return (
    <div className="min-h-screen bg-game-bg text-game-text bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-800 via-game-bg to-black bg-fixed p-2 md:p-8 pt-[calc(0.5rem+env(safe-area-inset-top))] font-sans selection:bg-game-accent selection:text-slate-900 overflow-x-hidden">
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

      <div className="max-w-4xl mx-auto pl-0 md:pl-24 relative z-10">
        <header className="mb-4 flex items-center justify-between">
          <div className={`${currentTab !== 'dashboard' ? 'opacity-0 pointer-events-none' : ''}`}>
            <h1
              onClick={() => setIsSettingsOpen(true)}
              className="text-4xl md:text-5xl font-black font-game text-transparent bg-clip-text bg-gradient-to-r from-game-accent to-game-gold tracking-tighter drop-shadow-lg p-1 cursor-pointer hover:opacity-80 transition-opacity"
            >
              LIFEQUEST
            </h1>
          </div>
          <div className="text-right hidden md:block">
            <p className="text-game-muted font-game uppercase tracking-[0.2em] text-xs">System Online</p>
            <p className="text-[10px] text-slate-600 font-mono">{new Date().toLocaleDateString()}</p>
          </div>
        </header>

        <main className="min-h-[600px] relative z-10">
          {currentTab === 'dashboard' && <Dashboard onTabChange={setCurrentTab} />}
          {currentTab === 'quests' && <QuestBoard />}
          {currentTab === 'calendar' && <CalendarView />}
          {currentTab === 'protocols' && <HabitTracker />}
          {currentTab === 'budget' && <BudgetView />}
          {currentTab === 'calories' && <CalorieTracker />}
        </main>
      </div>

      <Navigation currentTab={currentTab} onTabChange={setCurrentTab} />

      <div className="fixed inset-0 pointer-events-none z-[0] opacity-20"
        style={{
          backgroundImage: 'linear-gradient(#334155 1px, transparent 1px), linear-gradient(90deg, #334155 1px, transparent 1px)',
          backgroundSize: '40px 40px'
        }}
      />
    </div>
  );
}

function App() {
  const [currentTab, setCurrentTab] = useState('dashboard');

  return (
    <BudgetProvider>
      <GameProvider>
        <AppContent currentTab={currentTab} setCurrentTab={setCurrentTab} />
      </GameProvider>
    </BudgetProvider>
  );
}

export default App;
