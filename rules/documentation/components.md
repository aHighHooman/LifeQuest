# Component Documentation

The LifeQuest UI is built with functional React components, utilizing **Tailwind CSS** for styling and **Framer Motion** for animations.

## Primary Layout Components

### `App.jsx`
The root component that wraps the application in context providers (`BudgetProvider`, `GameProvider`). It manages the top-level tab state (`currentTab`) and renders the `Navigation` wrapper.

### `Navigation.jsx`
A wrapper component that provides the bottom navigation bar. It handles tab switching and includes a responsive side-navigation for desktop views. It also manages global swipe gestures for tab navigation.

---

## Core Views

### `Dashboard.jsx`
The main HUD (Heads-Up Display) of the app.
- **Key Features**: 
  - **HexMatrix**: A central hexagonal grid showing "Today's Focus" items (quests and habits).
  - **HUD Arcs**: SVG-based semi-circular bars showing Health (HP) and Experience (XP).
  - **Systems Status**: Displays "System Online" and the current date.
  - **Gestures**: Swipe down to open the `StatsView`.
- **Sub-components**: `HexNode`, `HexMatrix`, `DayTimer`.

### `QuestBoard.jsx`
The interface for managing tasks ("Quests").
- **Key Features**:
  - Filter by difficulty (Easy, Medium, Hard, Legendary).
  - Quest creation with metadata (Title, Mission Brief, Difficulty, Due Date).
  - Archive/Undo system for completed or discarded quests.

### `HabitTracker.jsx`
The "Protocols" view for recurring tasks.
- **Key Features**:
  - Streak tracking and history visualization.
  - Activation/Deactivation toggle for many habits.
  - Swipe down to quickly add a new protocol.

### `BudgetView.jsx`
A complete financial tracking sub-module.
- **Key Features**:
  - Transaction ledger (Income/Expense).
  - Category-based budgeting.
  - "Vault" management for savings.

### `CalorieTracker.jsx`
A dedicated view for nutrtion tracking.
- **Key Features**:
  - Visual circle progress bar for daily intake.
  - History log of calorie entries.
  - Target setting.

---

## Modals & Specialized Views

### `StatsView.jsx`
A full-screen overlay (accessible from Dashboard) that provides data visualization.
- **Charts**: Uses `recharts` to show:
  - Quest completion velocity.
  - Protocol consistency.
  - Net worth history (Cumulative Gold).
  - Calorie intake vs. Target.
- **Gestures**: Drag the bottom handle up to close.

### `FocusSelectionModal.jsx`
The "Mission Control" modal used to select which quests and habits should appear on the Dashboard's hexagonal grid today.
- **Logic**: Filters for non-completed quests and active protocols.
- **Gestures**: Persistent bottom handle for "Blindfold" style drag-to-close.

### `SettingsModal.jsx`
Allows users to adjust reward parameters (e.g., how much gold a protocol is worth) and debug stats directly.
