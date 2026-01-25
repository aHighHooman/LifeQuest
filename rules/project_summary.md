# LifeQuest Project Summary

## Project Overview
**LifeQuest** is a **gamified habit, task, and finance tracker** application. It serves as a personal dashboard to manage daily habits ("Protocols"), tasks ("Quests"), financial budgeting, and health tracking, all wrapped in a "gamified" interface.

The application treats your life as an RPG character, where completing tasks and sticking to habits rewards you with XP and currency, while failing them might have consequences.

## Technology Stack
- **Core Framework**: [React 19](https://react.dev/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Animations**: [Framer Motion](https://www.framer.com/motion/)
- **State Management**: React `Context` API
- **Icons**: [Lucide React](https://lucide.dev/)
- **Desktop Wrapper**: [Electron](https://www.electronjs.org/) (Project is set up to run as a desktop app)

## Directory Structure

### `src/`
The main source code directory.

- **`components/`**: Contains all the React UI components.
  - **`App.jsx`**: The root component. Handles the main tab-based navigation state, wraps the app in Providers (`GameProvider`, `BudgetProvider`), and renders the active view.
  - **`Dashboard.jsx`**: The landing page/overview. Shows a summary of today's progress.
  - **`QuestBoard.jsx`**: Task management. Users can create "Quests" (tasks), assign difficulty/rewards, and complete them.
  - **`HabitTracker.jsx`**: Referred to as **"Protocols"** in the UI. Tracks recurring daily/weekly habits.
  - **`BudgetView.jsx`**: Financial tracker. Handles income, expenses, and savings goals.
  - **`CalorieTracker.jsx`**: Health & Fitness tracking.
  - **`Navigation.jsx`**: The main navigation bar/menu component.

- **`context/`**: Global state management.
  - **`GameContext.jsx`**: Handles the gamification logic (XP, Level, Coins, Inventory) and likely shared state for Quests/Habits.
  - **`BudgetContext.jsx`**: Handles financial data state.

- **`utils/`**: Helper functions.
  - **`persistence.js`**: Logic for saving/loading data (Local Storage or File System).

## Key Concepts for Newcomers

1.  **Tab System**: The app uses a simple local state (`currentTab`) in `App.jsx` to switch between views (`dashboard`, `quests`, `protocols`, `budget`, `calories`) instead of a full client-side router like `react-router`.
2.  **Gamification**: Logic is centralized in `GameContext`. Actions in `QuestBoard` or `HabitTracker` dispatch updates to this context to award XP/Coins.
3.  **Styling**: The app relies heavily on Tailwind utility classes.
