# Performance Optimizations

This document outlines potential performance bottlenecks in LifeQuest and recommends optimizations to ensure a smooth user experience as the project grows.

## 1. Component Memoization
Several small, repetitive components are re-rendering more often than necessary.
- **`HexNode` (`Dashboard.jsx`)**: This component is rendered multiple times within the `HexMatrix`. It should be wrapped in `React.memo` to prevent re-renders when other parts of the Dashboard (like the background or timer) update, provided its own props haven't changed.
- **`QuestDeckCard` / `ProtocolDeckCard`**: These cards handle complex Framer Motion animations. Frequent state updates in the parent (`QuestBoard` or `HabitTracker`) can trigger unnecessary re-renders of the entire deck.

## 2. Monolithic Component Bloat
The `QuestBoard.jsx` and `HabitTracker.jsx` files are currently over 600 lines long.
- **Issue**: React's reconciliation process has more work to do when a single large component contains many sub-components and complex state logic.
- **Recommendation**: Decompose these into smaller, focused components (e.g., `QuestForm`, `QuestCard`, `QuestLog`). This reduces the "blast radius" of state changes, ensuring only the affected sub-tree re-renders.

## 3. Render-Phase Logic
Some calculations are performed directly within the component body on every render.
- **SVG Helpers** in `Dashboard.jsx`: Functions like `describeArc` and `polarToCartesian` are redefined on every render. They should be moved outside the component function or wrapped in `useCallback`.
- **`getNodeStyles`** in `HexNode`: While currently fast, this logic could be moved outside the render cycle or memoized if it expands to include more complex checks.

## 4. State Management Granularity
The `GameContext` provides a massive object containing all stats, quests, and habits.
- **Issue**: Components consuming `useGame()` will re-render whenever *any* part of the context changes (e.g., ticking a calorie count will re-render the `QuestBoard` if it uses `useGame`).
- **Recommendation**: Consider splitting `GameContext` into smaller contexts (e.g., `StatContext`, `TaskContext`) or using a state management library that supports selectors (like Zustand or Redux) to allow components to subscribe only to the specific data they need.

## 5. Migration Efficiency
The "MIGRATION" logic in `GameContext.jsx`'s `useEffect` runs every time the application mounts.
- **Optimization**: Move data migration logic to `src/utils/persistence.js` inside the `checkVersionAndEnsurePersistence` function. This ensures migrations only run once when the version changes, rather than on every app start.
