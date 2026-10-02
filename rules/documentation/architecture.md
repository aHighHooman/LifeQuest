# Project Architecture

LifeQuest is a gamified life management application built with **React** and **Vite**. It allows users to track quests (tasks), protocols (habits), calories, and a budget, rewarding them with virtual currency (gold) and experience points (XP).

## Core Technologies
- **Frontend Framework:** React (with Hooks and Context API)
- **Styling:** Tailwind CSS for utility-first styling.
- **Animations:** Framer Motion for smooth UI transitions and interactions.
- **State Management:** One shared application state, exposed through `GameContext`, `CalorieContext`, and `useBudget`.
- **Persistence:** LocalStorage with custom hooks and error handling.
- **Build Tool:** Vite.

## High-Level Structure

### 1. State Management (Context)
`AppStateProvider` owns game and budget data together. `GameContext`, `CalorieContext`, and `useBudget` expose screen actions and views of that state. Completion, undo, purchase, and refund use the transitions in `src/domain/transactions.js`; see [State and transactions](context.md).

### 2. UI Components
The UI is divided into several main views, accessible via a bottom navigation bar:
- **Dashboard**: The primary landing page showing a summary of daily focus items (hexagonal grid), system status, and a day timer.
- **QuestBoard**: A specialized view for managing one-time tasks with varying difficulty levels.
- **HabitTracker (Protocols)**: A view for managing recurring habits and tracking streaks.
- **BudgetView**: A tool for tracking income, expenses, and a "vault" balance.
- **CalorieTracker**: A simple interface for logging daily caloric intake against a target.

### 3. Data Flow
1. **User Interaction**: User interacts with a component (e.g., completes a quest).
2. **Action Dispatch**: The component calls an action provided by `useGame` or `useBudget` (e.g., `completeQuest(id)`).
3. **Logic Execution**: A functional transaction updates balances, ledger, status, and receipts together in the shared application state.
4. **Persistence**: The complete game/budget state is saved as one local checkpoint. Compatibility readers load the existing per-field keys when no checkpoint exists.
5. **Re-render**: React re-renders the affected components with the new state.

## Navigation & Routing
The app uses a custom tab-based navigation system rather than standard URL routing, managed by the `currentTab` state in `App.jsx`. This provides a more app-like feel for the mobile-first design.

## UI/UX Principles
- **Mobile-First Design**: Optimized for small screens with safe-area considerations (e.g., iPhone notch).
- **Gamification**: Use of RPG elements like HP, XP, Leveling, and Gold to motivate completion of real-world tasks.
- **Accessibility**: High contrast themes and clear visual feedback for actions.
