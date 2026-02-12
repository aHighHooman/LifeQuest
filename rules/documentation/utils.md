# Utility Functions

The `src/utils` directory contains helper functions and custom hooks that handle cross-cutting concerns like persistence, date formatting, and business logic.

## Persistence (`src/utils/persistence.js`)

This module manages the application's interface with `localStorage`.

### Key Functions
- **`usePersistentState(key, initialValue)`**: A custom hook that wraps `useState`. It automatically reads the initial value from `localStorage` on mount and writes any state changes back to `localStorage`.
- **`safeGet(key, initialValue)`**: Safely retrieves and parses JSON from `localStorage`. If parsing fails, it backs up the corrupted data with a timestamped key and returns the `initialValue`.
- **`safeSet(key, value)`**: Safely stringifies and writes data to `localStorage`.
- **`checkVersionAndEnsurePersistence()`**: Called on app launch (`App.jsx`). It checks the stored version against `APP_VERSION` and triggers a `performSafetyBackup()` if they differ, ensuring data safety during updates.

---

## Game Logic (`src/utils/gameLogic.js`)

Contains pure functions for computing game-related states.

### Key Functions
- **`getDaysUntilDue(habit)`**: Calculates the number of days until a habit is due for completion based on its frequency (`daily`, `weekly`, `monthly`, or `interval`) and its history of previous completions. This is used by `GameContext` to auto-populate the Dashboard's "Today's Focus" list.

---

## Date Utilities (`src/utils/dateUtils.js`)

Handles date formatting and comparisons, specifically focusing on **local time** to avoid the "off-by-one" day errors often caused by UTC conversions in JavaScript.

### Key Functions
- **`getTodayISO()`**: Returns the current local date as a `YYYY-MM-DD` string. This is the primary format used for keys in habit history and date comparisons.
- **`toLocalISOString(date)`**: Formats any Date object as a local `YYYY-MM-DD` string.
- **`isWithinDays(dateStr, days)`**: Checks if a given date string is within a specific number of days from today.
