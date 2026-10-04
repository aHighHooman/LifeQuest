# State and transactions

## One application state

`AppStateProvider` (`src/context/AppStateContext.jsx`) owns stats, settings, quests, protocols, calories, the coin ledger, and budget data in one React state object. Initial values come from `src/domain/initialState.js`.

`GameContext` and `CalorieContext` expose the existing screen actions and views of that state. `useBudget` (`src/hooks/useBudget.js`) exposes budget fields and grocery-list editing; it does not own another state or persistence lifecycle.

Single-field edits use functional setters into the shared state. Transactions use a functional update of the whole state, so guards and calculations see earlier queued changes even when several commands arrive before React renders.

## Completion, purchase, undo, and refund

`src/domain/transactions.js` contains shared quest creation, completion, undo, discard, restore and Today selection; protocol creation, completion, skip and activation; purchases, refunds, and wallet/ledger changes. IDs, timestamps and the command's day key are captured by callers before running an updater. Protocol completion calculates due-day eligibility inside the shared transition. Commands read no clock, write no storage and perform no network work.

- A quest completion updates XP, wallet, earned-reward balance, ledger, and quest status together. `completedReward` records XP, credits, and `earnedRewardsDelta`, the USD balance change actually applied after conversion and rounding. Undo subtracts those recorded amounts.
- A grocery purchase records the credits spent in the item's `coinCost`. A same-day refund reverses that amount, regardless of later price or conversion-rate changes. Repeated purchase or refund commands have no additional effect.
- Calorie logging debits the wallet and adds the entry together. A named manual food can also be saved in that transition. Each entry retains its `coinCost`; deleting an editable entry removes it and refunds that receipt once. The editing window remains today and yesterday.
- Protocol completion applies XP, a due-day bonus, and history/cycle updates together. Existing assistant request IDs still deduplicate retried completions.
- `src/domain/settlement.js` updates daily passive income, weekly/bi-weekly/monthly stipends, payout cursors, balances, ledger entries, and day rollover in one state update. It preserves the migration distinction between omitted and explicit-null passive cursors. The browser supplies local-noon ledger timestamps. Its existing calorie checkpoint timer also signals day changes to rollover; no second polling clock is needed. `useDailySettlement` runs it below `CloudSyncProvider`: with sync on, a new day is settled only after the cloud copy is pulled (or after an 8-second fallback), so assistant and other-device changes import cleanly instead of conflicting with this device's settlement. Automatic clean pulls skip the local pre-import backup because the replaced state is the last-synced revision, which stays in the cloud.

Receipts describe historical facts. Current reward settings, saved-food prices, and exchange rates are inputs to new transactions, rather than a way to reconstruct old ones. Older quest completions and grocery purchases without the new receipt fields retain the previous fallback calculations; their original conversion amounts cannot be recovered retrospectively.

The assistant-action worker adapts the same commands through `worker/src/stateEngine.js`. HTTP validation, missing-record errors, authentication, and snapshot revision checks remain at the worker boundary. Discard clears Today membership in both adapters; restoring a quest does not silently reselect it.

## Calendar, rewards and summaries

`src/domain/calendar.js` does calendar arithmetic on explicit YYYY-MM-DD day keys, so DST never changes the number of calendar days. `src/domain/protocols.js` owns frequency intervals, completion/reset anchors, due/overdue states, passive windows and pause cursors. Monthly remains a 30-day interval. Browser `dateUtils`/`gameLogic` and worker `date.js` are thin boundary adapters: browser instants become local day keys; the worker request clock uses its configured timezone. Unused aliases and re-exports have been removed. A bare day key is already a calendar day and is never parsed as midnight UTC.

`src/domain/rewards.js` owns reward defaults, quest reward resolution and XP progression. `src/constants/currency.js` owns credit precision, exchange-rate normalization, and USD/credit conversion. Budget displays and financial commands use the same conversion functions. The field-specific legacy portable currency migration in `src/domain/currencyMigration.js` serves both snapshot readers; HTTP/version validation and local storage migration remain at their respective boundaries.

`src/domain/views.js` supplies quest/protocol summaries to both assistant surfaces. A pending quest shows the currently configured or custom reward; a completed quest shows its receipt. Summary projections never settle income or change state.

## Local checkpoint and transfers

`src/utils/appStatePersistence.js` reads and writes the complete game/budget state as one versioned `lq_app_checkpoint` value. The existing debounced persistence scheduler writes that value and flushes pending work on page hide and unload. A rejected storage write leaves the previous complete checkpoint intact.

When the checkpoint key is absent, the reader loads the existing per-field game and budget keys after their currency migration. Those keys remain an older recovery copy and are no longer updated. A present checkpoint is authoritative: invalid JSON, an invalid shape, or an unsupported version stops loading instead of silently restoring old balances.

Portable text and cloud snapshots continue using format version 4. The receipt fields are optional additions to existing records and survive export/import and worker normalization. Import replaces game and budget state with one update after validating the snapshot and creating the existing recovery backup. Export reads that same coherent state. Protocol lookahead remains a separately persisted UI preference.

`CloudSyncContext` still owns cloud synchronization, revision/checksum conflict detection, and conflict resolution. It observes exported application state; transactions never write to cloud services directly. Authentication and account access rules are unchanged.
