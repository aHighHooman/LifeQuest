# Logic Robustness & Edge Cases

This document covers potential "hidden" bugs or logic flaws that could affect the accuracy and reliability of the application's data.

## 1. Daily Reset Trigger
The daily reset logic in `GameContext.jsx` is inside a `useEffect` with an empty dependency array.
- **Flaw**: It only runs when the app is first mounted. If a user leaves the application open in a browser tab or Electron window overnight, the "Daily Reset" (quests due, calorie reset) will **not** trigger when midnight passes.
- **Recommendation**: Implement a background check (e.g., using `setInterval` or checking on window focus) that compares the current date with `stats.lastLoginDate` and performs the reset if they differ.

## 2. Loose Typing in Stat Calculations
Throughout `GameContext.jsx`, variables like Gold and XP are manually wrapped in `Number()` before addition.
- **Flaw**: This suggests that the underlying data source (`localStorage`) might occasionally contain string values for these properties. Relying on inline coercion is a "Band-Aid" fix.
- **Recommendation**: Validate and sanitize data strictly at the "Persistence" layer (`safeGet`). Ensure that `stats` always contains number types for numeric fields before they even reach the Context.

## 3. Habit Completion Reversibility
- **Issue**: `completeQuest` has a corresponding `undoCompleteQuest`, but `checkHabit` does not have an "undo" counterpart.
- **Impact**: If a user accidentally checks a habit as positive, there is no easy way to revert the XP and Gold gains without manually editing the history or settings.
- **Recommendation**: Implement `undoCheckHabit` to maintain consistency with the Quest system.

## 4. Race Conditions in Multi-Context Updates
When a quest is completed, it updates `GameContext` and then calls `addRewardFromGold` in `BudgetContext`.
- **Potential Issue**: In some React versions, these independent context updates might trigger two separate render cycles.
- **Recommendation**: Ensure that cross-context dependencies are handled gracefully, perhaps by combining related functionality into a single provider or using a synchronized update pattern.

## 5. Persistence "Pollution"
Corrupted data is backed up to `localStorage` with keys like `${key}_corrupted_${Date.now()}`.
- **Issue**: While great for data recovery, it can eventually "pollute" `localStorage` with a lot of dead data if many errors occur, potentially hitting the 5MB browser limit.
- **Recommendation**: Implement a simple cleanup strategy or a dedicated "Backup" section in the Settings menu to allow users to view or clear these corrupted backups.
