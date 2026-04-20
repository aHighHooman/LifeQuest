import React, { Profiler, useCallback, useEffect, useRef, useState } from 'react';
import { GameProvider } from './context/GameContext';
import { BudgetProvider } from './context/BudgetContext';
import SettingsModal from './components/SettingsModal';
import { checkVersionAndEnsurePersistence } from './utils/persistence';
import { motion as Motion } from 'framer-motion';
import { beginTrackedSpan, endTrackedSpan, onProfileRender } from './utils/perfMonitor';
import Dashboard from './components/Dashboard';
import QuestBoard from './components/QuestBoard';
import HabitTracker from './components/HabitTracker';
import Navigation from './components/Navigation';
import BudgetView from './components/BudgetView';
import CalorieTracker from './components/CalorieTracker';

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('AppErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.error) {
      const message = this.state.error?.message || 'Unknown runtime error';
      return (
        <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
          <div className="w-full max-w-2xl rounded-3xl border border-rose-500/30 bg-black/60 p-6 shadow-2xl">
            <p className="text-xs uppercase tracking-[0.3em] text-rose-400/70">Runtime Failure</p>
            <h1 className="mt-2 text-2xl font-bold text-rose-100">LifeQuest hit an error while rendering.</h1>
            <pre className="mt-4 whitespace-pre-wrap rounded-2xl bg-slate-900/80 p-4 text-sm text-rose-100">{message}</pre>
            <p className="mt-4 text-sm text-slate-300">
              If this appeared right after an update, a stale app cache or service worker may also be involved.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function AppContent({ currentTab, setCurrentTab, pendingTabSwitchRef }) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    endTrackedSpan('app-bootstrap', { initialTab: currentTab });
  }, [currentTab]);

  useEffect(() => {
    const pendingTabSwitch = pendingTabSwitchRef.current;
    if (!pendingTabSwitch) return;

    endTrackedSpan('tab-switch', { currentTab });
    pendingTabSwitchRef.current = null;
  }, [currentTab, pendingTabSwitchRef]);

  return (
    <AppErrorBoundary>
      <div className="h-screen bg-game-bg text-game-text bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-800 via-game-bg to-black bg-fixed font-sans selection:bg-game-accent selection:text-slate-900 overflow-hidden flex flex-col">
        <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

        <Navigation currentTab={currentTab} onTabChange={setCurrentTab}>
          <div className={`relative z-10 mx-auto flex min-h-full w-full max-w-none flex-col px-0 pt-[calc(0.5rem+env(safe-area-inset-top))] sm:px-2 md:max-w-4xl md:pl-24 md:pr-8 md:pt-[calc(0.75rem+env(safe-area-inset-top))] ${currentTab === 'calories' ? 'bg-black md:bg-transparent' : ''}`}>
            <Motion.main
              className="flex-1 flex flex-col relative z-10"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Profiler id={`screen:${currentTab}`} onRender={onProfileRender}>
                {currentTab === 'dashboard' && <Dashboard onTabChange={setCurrentTab} onOpenSettings={() => setIsSettingsOpen(true)} />}
                {currentTab === 'quests' && <QuestBoard />}
                {currentTab === 'protocols' && <HabitTracker />}
                {currentTab === 'budget' && <BudgetView />}
                {currentTab === 'calories' && <CalorieTracker />}
              </Profiler>
            </Motion.main>
          </div>
        </Navigation>
      </div>
    </AppErrorBoundary>
  );
}

function App() {
  const [currentTab, setCurrentTab] = useState('dashboard');
  const pendingTabSwitchRef = useRef(null);

  useEffect(() => {
    // Check for version updates and ensure persistence validity on app launch
    checkVersionAndEnsurePersistence();
  }, []);

  const handleTabChange = useCallback((nextTab) => {
    setCurrentTab(prevTab => {
      if (prevTab === nextTab) return prevTab;

      pendingTabSwitchRef.current = nextTab;
      beginTrackedSpan('tab-switch', { from: prevTab, to: nextTab });
      return nextTab;
    });
  }, []);

  return (
    <BudgetProvider>
      <GameProvider>
        <AppContent currentTab={currentTab} setCurrentTab={handleTabChange} pendingTabSwitchRef={pendingTabSwitchRef} />
      </GameProvider>
    </BudgetProvider>
  );
}

export default App;
