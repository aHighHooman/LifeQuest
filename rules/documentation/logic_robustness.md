# Logic Robustness & Edge Cases

This document covers potential "hidden" bugs or logic flaws that could affect the accuracy and reliability of the application's data.

## 1. Daily Reset Trigger
The existing calorie checkpoint timer signals day changes to the daily settlement effect. `settleDaily` compares its explicit day key with `stats.lastLoginDate`, then updates payouts, cursors, balances, ledger, grocery cleanup, and calorie totals together. A repeated same-day settlement does nothing. Live rollover is covered by the isolated browser check; no extra reset timer is needed.

## 2. Loose Typing in Stat Calculations
Throughout `GameContext.jsx`, variables like Gold and XP are manually wrapped in `Number()` before addition.
- **Flaw**: This suggests that the underlying data source (`localStorage`) might occasionally contain string values for these properties. Relying on inline coercion is a "Band-Aid" fix.
- **Recommendation**: Validate and sanitize data strictly at the "Persistence" layer (`safeGet`). Ensure that `stats` always contains number types for numeric fields before they even reach the Context.

## 3. Habit Completion Reversibility
Quest completion has a receipt-backed undo action. Protocol completion currently has no undo interaction. The old, uncalled protocol history-only undo and failure dispatcher have been removed; they did not reverse completion rewards and should not be mistaken for a financial undo guarantee.

## 4. Completion Transactions
Quest completion and undo now apply XP, credits, earned-reward balances, ledger entries, and status together through `src/domain/transactions.js`. Functional updaters guard against repeated commands using the latest shared state. `completedReward.earnedRewardsDelta` preserves the conversion amount for undo after rate changes. The complete game/budget state is persisted as one checkpoint; see [State and transactions](context.md).

## 5. Persistence "Pollution"
Corrupted data is backed up to `localStorage` with keys like `${key}_corrupted_${Date.now()}`.
- **Issue**: While great for data recovery, it can eventually "pollute" `localStorage` with a lot of dead data if many errors occur, potentially hitting the 5MB browser limit.
- **Recommendation**: Implement a simple cleanup strategy or a dedicated "Backup" section in the Settings menu to allow users to view or clear these corrupted backups.
