import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { GameProvider, useGame } from './context/GameContext';
import { BudgetProvider } from './context/BudgetContext';
import SettingsModal from './components/SettingsModal';
import { checkVersionAndEnsurePersistence } from './utils/persistence';

const Dashboard = React.lazy(() => import('./components/Dashboard'));
const QuestBoard = React.lazy(() => import('./components/QuestBoard'));
const HabitTracker = React.lazy(() => import('./components/HabitTracker'));
const Navigation = React.lazy(() => import('./components/Navigation'));
const BudgetView = React.lazy(() => import('./components/BudgetView'));
const CalorieTracker = React.lazy(() => import('./components/CalorieTracker'));

// Loading component
const LoadingSpinner = () => (
  <div className="flex items-center justify-center p-8">
    <div className="w-8 h-8 border-4 border-game-accent border-t-transparent rounded-full animate-spin"></div>
  </div>
);

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
    <div className="h-[100dvh] bg-game-bg text-game-text bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-800 via-game-bg to-black bg-fixed font-sans selection:bg-game-accent selection:text-slate-900 overflow-hidden flex flex-col">
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

      <React.Suspense fallback={<div className="min-h-screen bg-game-bg" />}>
        <Navigation currentTab={currentTab} onTabChange={setCurrentTab}>
          <div className="max-w-4xl mx-auto pl-0 md:pl-24 relative z-10 p-2 md:p-8 pt-[calc(0.5rem+env(safe-area-inset-top))]">
            {currentTab === 'dashboard' && (
              <header className="mb-2 flex items-center justify-between px-6">
                <div>
                  <h1
                    onClick={() => setIsSettingsOpen(true)}
                    className="text-4xl md:text-5xl font-black font-game text-transparent bg-clip-text bg-gradient-to-r from-game-accent to-game-gold tracking-tighter drop-shadow-lg p-1 cursor-pointer hover:opacity-80 transition-opacity"
                  >
                    LIFEQUEST
                  </h1>
                </div>
                <div className="text-right hidden md:block">
                  <p className="text-game-muted font-game uppercase tracking-[0.2em] text-xs">System Online</p>
                  <p className="text-10px text-slate-600 font-mono">{new Date().toLocaleDateString()}</p>
                </div>
              </header>
            )}

            <motion.main
              className="min-h-[600px] relative z-10"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <React.Suspense fallback={<LoadingSpinner />}>
                {currentTab === 'dashboard' && <Dashboard onTabChange={setCurrentTab} />}
                {currentTab === 'quests' && <QuestBoard />}
                {currentTab === 'protocols' && <HabitTracker />}
                {currentTab === 'budget' && <BudgetView />}
                {currentTab === 'calories' && <CalorieTracker />}
              </React.Suspense>
            </motion.main>
          </div>
        </Navigation>
      </React.Suspense>

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

  useEffect(() => {
    // Check for version updates and ensure persistence validity on app launch
    checkVersionAndEnsurePersistence();
  }, []);

  return (
    <BudgetProvider>
      <GameProvider>
        <AppContent currentTab={currentTab} setCurrentTab={setCurrentTab} />
      </GameProvider>
    </BudgetProvider>
  );
}

export default App;
