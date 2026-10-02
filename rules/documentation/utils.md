# Utility Functions

The `src/utils` directory contains helper functions and custom hooks that handle cross-cutting concerns like persistence, date formatting, and business logic.

## Persistence (`src/utils/persistence.js`)

This module manages the application's interface with `localStorage`.

### Key Functions
- **`usePersistedValue(key, value)`**: Schedules one value for debounced persistence and flushes pending work on page hide, unload, or unmount. `AppStateProvider` uses it for the whole game/budget checkpoint.
- **`usePersistentState(key, initialValue)`**: A custom hook that wraps `useState`. It automatically reads the initial value from `localStorage` on mount and writes any state changes back to `localStorage`.
- **`safeGet(key, initialValue)`**: Safely retrieves and parses JSON from `localStorage`. If parsing fails, it backs up the corrupted data with a timestamped key and returns the `initialValue`.
- **`safeSet(key, value)`**: Safely stringifies and writes data to `localStorage`.
- **`checkVersionAndEnsurePersistence()`**: Called on app launch (`App.jsx`). It checks the stored version against `APP_VERSION` and triggers a `performSafetyBackup()` if they differ, ensuring data safety during updates.

---

## Game Logic (`src/utils/gameLogic.js`)

Contains the browser adapters used by the quest and protocol screens. Shared calendar and recurrence calculations live in `src/domain/calendar.js` and `src/domain/protocols.js`.

### Key Functions
- **`parseDateKey(value)`**: Creates a local calendar Date for the quest due-date label, preserving bare day keys.
- **`getHabitCycleState(habit, referenceDate)`**: Converts the reference date to a local day key and delegates to the shared protocol cycle calculation.
- **`getDaysUntilDue(habit, referenceDate)`**: Reads the day difference from that cycle state for protocol screen labels and filtering.

---

## Date Utilities (`src/utils/dateUtils.js`)

Handles date formatting and comparisons, specifically focusing on **local time** to avoid the "off-by-one" day errors often caused by UTC conversions in JavaScript.

### Key Functions
- **`getTodayISO()`**: Returns the current local date as a `YYYY-MM-DD` string. This is the primary format used for keys in habit history and date comparisons.
- **`toLocalISOString(date)`**: Formats any Date object as a local `YYYY-MM-DD` string.
- **`isWithinDays(dateStr, days)`**: Checks if a given date string is within a specific number of days from today.
