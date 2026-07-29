import React, { Profiler, useCallback, useEffect, useRef, useState } from 'react';
import { GameProvider } from './context/GameContext';
import { BudgetProvider } from './context/BudgetContext';
import SettingsModal from './components/SettingsModal';
import { checkVersionAndEnsurePersistence } from './utils/persistence';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import { beginTrackedSpan, endTrackedSpan, onProfileRender } from './utils/perfMonitor';
import Navigation from './components/Navigation';
import { isLlmInterfaceLocation } from './utils/llmInterface';
import { CloudSyncProvider } from './context/CloudSyncContext.jsx';
import dashboardTabletop from './assets/tabletop/lifequest-dashboard-perspective.webp';
import questTabletop from './assets/tabletop/lifequest-quests-perspective.webp';
import dashboardToQuests from './assets/tabletop/lifequest-dashboard-to-quests.mp4';
import questsToDashboard from './assets/tabletop/lifequest-quests-to-dashboard.mp4';
import { getTabletopTransitionUiState, TABLETOP_TRANSITION } from './utils/tabletopLayout';

const screenLoaders = {
  dashboard: () => import('./components/Dashboard'),
  quests: () => import('./components/QuestBoard'),
  protocols: () => import('./components/HabitTracker'),
  budget: () => import('./components/BudgetView'),
  calories: () => import('./components/CalorieTracker')
};
const preloadedScreens = new Map();

const preloadScreen = (tabId) => {
  const loader = screenLoaders[tabId];
  if (!loader || preloadedScreens.has(tabId)) return;

  preloadedScreens.set(tabId, loader());
};

const loadScreen = (tabId) => {
  preloadScreen(tabId);
  return preloadedScreens.get(tabId);
};

const Dashboard = React.lazy(() => loadScreen('dashboard'));
const QuestBoard = React.lazy(() => loadScreen('quests'));
const HabitTracker = React.lazy(() => loadScreen('protocols'));
const BudgetView = React.lazy(() => loadScreen('budget'));
const CalorieTracker = React.lazy(() => loadScreen('calories'));
const LlmInterface = React.lazy(() => import('./components/LlmInterface'));

const TABLETOP_TABS = new Set(['dashboard', 'quests']);

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

function TabletopStage({ currentTab, setCurrentTab, onOpenSettings, cameraMove, onCameraMoveEnd }) {
  const dashboardIsActive = currentTab === 'dashboard';
  const questIsActive = currentTab === 'quests';
  const [playingCameraMoveId, setPlayingCameraMoveId] = useState(null);
  const {
    interfaceDashboardIsActive,
    shouldAnimateInterface
  } = getTabletopTransitionUiState({
    currentTab,
    cameraMove,
    playingCameraMoveId
  });

  return (
    <main className="absolute inset-0 z-10 overflow-visible">
      <div className="pointer-events-none absolute h-px w-px overflow-hidden opacity-0" aria-hidden="true">
        <video src={dashboardToQuests} preload="auto" muted playsInline />
        <video src={questsToDashboard} preload="auto" muted playsInline />
      </div>

      <div className="absolute left-1/2 top-0 aspect-[9/20] w-[min(100vw,540px)] -translate-x-1/2 overflow-hidden">
        <img
          src={dashboardIsActive ? dashboardTabletop : questTabletop}
          alt=""
          draggable="false"
          className="pointer-events-none absolute inset-0 block h-full w-full select-none object-cover"
        />

        {cameraMove && (
          <video
            key={cameraMove.id}
            src={cameraMove.source}
            poster={cameraMove.poster}
            autoPlay
            muted
            playsInline
            preload="auto"
            aria-hidden="true"
            onLoadedMetadata={(event) => {
              event.currentTarget.defaultPlaybackRate = TABLETOP_TRANSITION.playbackRate;
              event.currentTarget.playbackRate = TABLETOP_TRANSITION.playbackRate;
            }}
            onPlay={(event) => {
              event.currentTarget.playbackRate = TABLETOP_TRANSITION.playbackRate;
            }}
            onPlaying={() => {
              setPlayingCameraMoveId(cameraMove.id);
            }}
            onEnded={() => {
              setPlayingCameraMoveId(null);
              onCameraMoveEnd(cameraMove.id);
            }}
            onError={() => {
              setPlayingCameraMoveId(null);
              onCameraMoveEnd(cameraMove.id);
            }}
            className="pointer-events-none absolute inset-0 z-10 block h-full w-full object-cover"
          />
        )}
      </div>

      <div className="absolute left-1/2 top-0 h-full w-[min(100vw,540px)] -translate-x-1/2 overflow-hidden">
        <Motion.div
          className="absolute top-0 z-10 flex aspect-[9/10] w-[200%] will-change-[left]"
          initial={false}
          animate={{ left: interfaceDashboardIsActive ? '-100%' : '0%' }}
          transition={shouldAnimateInterface
            ? {
                duration: TABLETOP_TRANSITION.interfaceDurationSeconds,
                ease: TABLETOP_TRANSITION.ease
              }
            : { duration: 0 }}
        >
          <section
            className="shared-tabletop-panel relative h-full w-1/2 shrink-0 overflow-visible"
            aria-hidden={!questIsActive}
            style={{ pointerEvents: questIsActive ? 'auto' : 'none' }}
          >
            <Profiler id="screen:quests" onRender={onProfileRender}>
              <React.Suspense fallback={null}>
                <QuestBoard showTabletopBackdrop={false} />
              </React.Suspense>
            </Profiler>
          </section>

          <section
            className="shared-tabletop-panel relative h-full w-1/2 shrink-0 overflow-visible"
            aria-hidden={!dashboardIsActive}
            style={{ pointerEvents: dashboardIsActive ? 'auto' : 'none' }}
          >
            <Profiler id="screen:dashboard" onRender={onProfileRender}>
              <React.Suspense fallback={null}>
                <Dashboard
                  onTabChange={setCurrentTab}
                  onOpenSettings={onOpenSettings}
                  showTabletopBackdrop={false}
                />
              </React.Suspense>
            </Profiler>
          </section>
        </Motion.div>

        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-20"
          style={{
            background: 'radial-gradient(ellipse 92% 84% at 50% 40%, transparent 58%, rgba(0, 0, 0, 0.18) 100%)'
          }}
        />
      </div>
    </main>
  );
}

function AppContent({
  currentTab,
  setCurrentTab,
  pendingTabSwitchRef,
  tabletopCameraMove,
  onTabletopCameraMoveEnd
}) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const isTabletop = TABLETOP_TABS.has(currentTab);

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
      <div className="relative flex h-screen flex-col overflow-hidden bg-[#020706] font-sans text-game-text selection:bg-game-accent selection:text-slate-900">
        {!isTabletop && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-800 via-game-bg to-black"
          />
        )}

        <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

        <Navigation currentTab={currentTab} onTabChange={setCurrentTab} onPreloadTab={preloadScreen}>
          <div className={`relative z-10 mx-auto flex h-full min-h-full w-full max-w-none flex-col px-0 pt-[calc(0.5rem+env(safe-area-inset-top))] sm:px-2 md:max-w-4xl md:pl-24 md:pr-8 md:pt-[calc(0.75rem+env(safe-area-inset-top))] ${currentTab === 'calories' ? 'bg-black md:bg-transparent' : ''}`}>
            {isTabletop ? (
              <TabletopStage
                currentTab={currentTab}
                setCurrentTab={setCurrentTab}
                onOpenSettings={() => setIsSettingsOpen(true)}
                cameraMove={tabletopCameraMove}
                onCameraMoveEnd={onTabletopCameraMoveEnd}
              />
            ) : (
            <AnimatePresence initial={false} mode="wait">
              <Motion.main
                key={currentTab}
                className="absolute inset-0 z-10 flex flex-col will-change-transform"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.32, ease: 'easeOut' }}
              >
                <Profiler id={`screen:${currentTab}`} onRender={onProfileRender}>
                  <React.Suspense fallback={null}>
                    {currentTab === 'protocols' && <HabitTracker />}
                    {currentTab === 'budget' && <BudgetView />}
                    {currentTab === 'calories' && <CalorieTracker />}
                  </React.Suspense>
                </Profiler>
              </Motion.main>
            </AnimatePresence>
            )}
          </div>
        </Navigation>
      </div>
    </AppErrorBoundary>
  );
}

function App() {
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [tabletopCameraMove, setTabletopCameraMove] = useState(null);
  const pendingTabSwitchRef = useRef(null);
  const cameraMoveIdRef = useRef(0);
  const isLlmInterface = isLlmInterfaceLocation();

  useEffect(() => {
    // Check for version updates and ensure persistence validity on app launch
    checkVersionAndEnsurePersistence();
  }, []);

  const handleTabChange = useCallback((nextTab) => {
    if (currentTab === nextTab) return;

    const prefersReducedMotion = typeof window !== 'undefined'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isTabletopMove = TABLETOP_TABS.has(currentTab) && TABLETOP_TABS.has(nextTab);
    if (isTabletopMove && !prefersReducedMotion) {
      cameraMoveIdRef.current += 1;
      const toQuests = nextTab === 'quests';
      setTabletopCameraMove({
        id: cameraMoveIdRef.current,
        fromTab: currentTab,
        source: toQuests ? dashboardToQuests : questsToDashboard,
        poster: toQuests ? dashboardTabletop : questTabletop
      });
    } else {
      setTabletopCameraMove(null);
    }

    pendingTabSwitchRef.current = nextTab;
    beginTrackedSpan('tab-switch', { from: currentTab, to: nextTab });
    setCurrentTab(nextTab);
  }, [currentTab]);

  const handleTabletopCameraMoveEnd = useCallback((cameraMoveId) => {
    setTabletopCameraMove((activeMove) => (
      activeMove?.id === cameraMoveId ? null : activeMove
    ));
  }, []);

    return (
    <BudgetProvider>
      <GameProvider>
        <CloudSyncProvider>
          {isLlmInterface
            ? <AppErrorBoundary><React.Suspense fallback={null}><LlmInterface /></React.Suspense></AppErrorBoundary>
            : (
              <AppContent
                currentTab={currentTab}
                setCurrentTab={handleTabChange}
                pendingTabSwitchRef={pendingTabSwitchRef}
                tabletopCameraMove={tabletopCameraMove}
                onTabletopCameraMoveEnd={handleTabletopCameraMoveEnd}
              />
            )}
        </CloudSyncProvider>
      </GameProvider>
    </BudgetProvider>
  );
}

export default App;
