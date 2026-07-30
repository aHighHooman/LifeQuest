import React, { Profiler, useCallback, useEffect, useRef, useState } from 'react';
import { GameProvider } from './context/GameContext';
import { BudgetProvider } from './context/BudgetContext';
import SettingsModal from './components/SettingsModal';
import { checkVersionAndEnsurePersistence } from './utils/persistence';
import { animate, AnimatePresence, motion as Motion, useMotionValue } from 'framer-motion';
import { beginTrackedSpan, endTrackedSpan, onProfileRender } from './utils/perfMonitor';
import Navigation from './components/Navigation';
import { isLlmInterfaceLocation } from './utils/llmInterface';
import { CloudSyncProvider } from './context/CloudSyncContext.jsx';
import tabletopWide from './assets/tabletop/lifequest-tabletop-wide.webp';
import { TABLETOP_TRANSITION } from './utils/tabletopLayout';

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

const TabletopPanelFallback = ({ label }) => (
  <div
    className="flex h-full w-full items-center justify-center"
    role="status"
    aria-label={`Loading ${label}`}
  >
    <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/45 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-300 backdrop-blur-sm">
      <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
      Loading {label}
    </div>
  </div>
);

const getTabletopTurnAnimation = (cameraMove) => {
  const direction = cameraMove?.toTab === 'quests' ? 1 : -1;

  return {
    animate: {
      rotateY: cameraMove ? [0, direction * TABLETOP_TRANSITION.turnTiltDegrees, 0] : 0,
      scale: cameraMove ? [1, TABLETOP_TRANSITION.turnScale, 1] : 1
    },
    transition: {
      duration: TABLETOP_TRANSITION.durationSeconds,
      ease: TABLETOP_TRANSITION.ease,
      times: [0, 0.5, 1]
    }
  };
};

const TabletopBackdrop = ({ cameraMove, stageX }) => {
  const turnAnimation = getTabletopTurnAnimation(cameraMove);

  return (
    <Motion.img
      src={tabletopWide}
      alt=""
      draggable="false"
      animate={turnAnimation.animate}
      transition={turnAnimation.transition}
      style={{
        x: stageX,
        transformPerspective: 1200
      }}
      className="pointer-events-none absolute inset-y-0 left-0 block h-full w-[200%] max-w-none origin-center select-none will-change-transform"
    />
  );
};

function TabletopStage({ currentTab, setCurrentTab, onOpenSettings, cameraMove, onCameraMoveEnd }) {
  const dashboardIsActive = currentTab === 'dashboard';
  const questIsActive = currentTab === 'quests';
  const stageX = useMotionValue(dashboardIsActive ? '-50%' : '0%');
  const interfaceAnimationRef = useRef(null);
  const turnAnimation = getTabletopTurnAnimation(cameraMove);

  useEffect(() => {
    interfaceAnimationRef.current?.stop();

    if (cameraMove) {
      interfaceAnimationRef.current = animate(
        stageX,
        cameraMove.toTab === 'dashboard' ? '-50%' : '0%',
        {
          duration: TABLETOP_TRANSITION.durationSeconds,
          ease: TABLETOP_TRANSITION.ease,
          onComplete: () => onCameraMoveEnd(cameraMove.id)
        }
      );
    } else {
      stageX.set(currentTab === 'dashboard' ? '-50%' : '0%');
    }

    return () => interfaceAnimationRef.current?.stop();
  }, [cameraMove, currentTab, onCameraMoveEnd, stageX]);

  return (
    <main className="absolute inset-0 z-10 overflow-visible">
      <div className="absolute left-1/2 top-0 aspect-[9/20] w-[min(100vw,540px)] -translate-x-1/2 overflow-hidden">
        <TabletopBackdrop cameraMove={cameraMove} stageX={stageX} />
      </div>

      <div className="absolute left-1/2 top-0 h-full w-[min(100vw,540px)] -translate-x-1/2 overflow-hidden">
        <Motion.div
          className="absolute left-0 top-0 z-10 flex aspect-[9/10] w-[200%] will-change-transform"
          animate={turnAnimation.animate}
          transition={turnAnimation.transition}
          style={{
            x: stageX,
            transformPerspective: 1200
          }}
        >
          <section
            className="shared-tabletop-panel relative h-full w-1/2 shrink-0 overflow-visible"
            aria-hidden={!questIsActive}
            style={{ pointerEvents: questIsActive ? 'auto' : 'none' }}
          >
            <Profiler id="screen:quests" onRender={onProfileRender}>
              <React.Suspense fallback={<TabletopPanelFallback label="quests" />}>
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
              <React.Suspense fallback={<TabletopPanelFallback label="dashboard" />}>
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
                className="absolute inset-x-0 bottom-0 top-[calc(0.5rem+env(safe-area-inset-top))] z-10 flex flex-col will-change-transform md:top-[calc(0.75rem+env(safe-area-inset-top))]"
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
      setTabletopCameraMove({
        id: cameraMoveIdRef.current,
        fromTab: currentTab,
        toTab: nextTab
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
