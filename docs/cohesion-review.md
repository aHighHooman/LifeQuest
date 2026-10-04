# LifeQuest cohesion review

Branch `refactor/cohesive-domain-state` at `548e92e`, whole system, read-only. Reviewed 2026-10-02.

**Spatial model used.** The request's spatial-model sentence was left as a placeholder, so this review uses the "Product and design intent" section of `AGENTS.md`:

- one continuous tabletop
- objects that persist unless they move out of view, become occluded, or the user removes them
- camera motion done with transforms, never with fades

**Evidence.** Every claim cites a file, function, and lines. For every possible divergence, both sides were read.

- Findings 1 and 5 were reproduced with a scratch script that imports `src/domain/*` and `worker/src/stateEngine.js` directly. The script is not in the repo.
- Finding 2 is traced through the code but was not exercised against Firestore.
- The existing suite passes (133 tests).

## System map

LifeQuest keeps one plain state object (`stats`, `settings`, `quests`, `habits`, `calories`, `coinHistory`, `budget`) in `AppStateProvider` (`src/context/AppStateContext.jsx`). It is persisted as a single localStorage checkpoint, `lq_app_checkpoint` (`src/utils/appStatePersistence.js`).

Game rules are pure functions in `src/domain/`:

- `transactions.js`: quest, protocol, grocery, and calorie transactions over `(state, input, event)`
- `protocols.js`: one recurrence model
- `settlement.js`: `settleDaily`, covering passive income, stipends, and day cleanup
- `rewards.js`
- `calendar.js`: day-key arithmetic
- `views.js`: assistant-facing nouns

`GameProvider` (`src/context/GameContext.jsx`) turns these into React callbacks. It also owns several effects: normalization, passive calorie fills on a 30 s timer, daily settlement, and the discarded-quest purge. `useBudget` is a field view over the same state.

Persistence and sync form one pipeline. State is exported through `createPortableSnapshot` / `normalizePortableSnapshot` (`src/utils/portableState.js`), which also defines the editable `.lq` text format. `CloudSyncProvider` (`src/context/CloudSyncContext.jsx`) reconciles that snapshot against a Firestore copy that is chunked, checksummed, and revision-guarded (`src/utils/cloudSnapshot.js`).

There are two assistant surfaces:

- **Custom GPT Action worker** (`worker/src/*`). It loads the same Firestore snapshot, applies the same `src/domain/transactions.js` functions, and writes back with an `updateTime` precondition.
- **In-app LLM page** (`src/components/LlmInterface.jsx`). A text UI over `GameContext`.

The visible world is a 200%-wide tabletop stage holding Quests and Dashboard (`App.jsx`, `TabletopStage`). Protocols, Budget, and Health are separate screens.

## End-to-end traces (summary)

- **Quest completion and undo.**
  - **Completion path:** Swipe right (`QuestBoard.jsx:579`) or tap a hex (`Dashboard.jsx:404-413`) → `GameContext.completeQuest` → `transactions.completeQuest` → `resolveQuestReward` (gold from live settings, XP stored at creation) → `grantReward`.
  - **One update:** Wallet, ledger entry, XP, and the `completedReward` receipt all change in a single `updateState`.
  - **Undo:** "Restore" in the Victory Log (`QuestBoard.jsx:897-898`) → `undoQuest`, which reverses the receipt, including a level-down.
  - **Undo window:** The tabletop offers undo only for the last 3 days (`QuestBoard.jsx:601-602`). The LLM page and the worker have no window.
  - **Worker path:** It uses the same transaction and is idempotent by state.
- **Protocol recurrence.**
  - Anchor is the later of the last completion and the last skip/reset; due date is anchor + interval (`protocols.js:20-31`).
  - The due-day bonus is paid only when the protocol is completed on its due day (`transactions.js:123-127`).
  - Passive income pays each day in (anchor, due] through a cursor, and only from `settleDaily`.
- **Reward settlement.**
  - Runs only in the browser, on mount and on a day change.
  - The day-change signal is the passive-calorie timer changing `passiveCheckpointDate` (`GameContext.jsx:777-781`; documented in `rules/documentation/context.md:19`).
  - The worker never settles.
- **Local change.**
  - `updateState` → checkpoint written on idle and flushed on `pagehide` (`persistence.js:43-66`).
  - If sync status is `synced`, autosave runs 1.8 s later with the expected revision (`CloudSyncContext.jsx:228-269`).
- **Assistant change.**
  - Worker: load → `prepareSnapshot` → transaction → `touchSnapshot` → conditional commit (`worker/src/index.js:169-220`, `snapshotStore.js:110-167`).
  - The app sees it only at its next `reconcile`, which runs on mount, on `online`, or on manual "Sync Now".
  - That reconcile either imports cleanly (local unchanged since the last sync) or becomes a conflict.

## Findings, ranked

Each finding is labelled:

- **observed:** the code contradicts itself, its docs, or another surface
- **preference:** the code is consistent but uses more mechanism, or less cohesion, than the job needs

### A. Correctness-risking divergence

#### 1. Assistant protocol actions forfeit passive income the app would have paid — observed, reproduced

**Where.**

- The worker applies transactions to a snapshot that was only loaded and normalized (`index.js:169-171`). `worker/src/index.js` `handleProtocolMutation` (130-143) calls `completeProtocol`, `skipProtocol`, or `deactivateProtocol`.
- These reach three functions in `src/domain/transactions.js`:
  - `completeProtocol` (120-142) moves `passivePaidThrough` to today and moves the cycle anchor.
  - `skipProtocol` (169-176) does the same.
  - `setProtocolActive` (160-167) moves the cursor to `getPausedPassivePaidThrough` (`protocols.js:72-79`).
- Only `settleDaily` pays passive income (`settlement.js:21-29`), and only `GameProvider` runs it (`GameContext.jsx:777-781`).
- `getProtocolPassivePayoutDateKeys` (`protocols.js:56-70`) pays only inside the current anchor's window. Once the anchor or cursor moves, the unsettled days can never be paid.

**Interaction.** In the app, settlement always runs before the user can act: on mount and at the midnight tick. Completing, skipping, or pausing through the app therefore pays every day up to today first. Through ChatGPT, the days since the app last settled are silently dropped. That covers any assistant protocol action taken before the app has been opened that day.

**Reproduction.** Weekly protocol, passive reward 0.1, last settled 03-09. The action happens on 03-12, and the app is opened on 03-13.

| Action on 03-12 | App path gold | Assistant path gold | Passive days paid (app / assistant) |
|---|---|---|---|
| complete | 10.4 | 10.1 | 4 / 1 |
| skip | 10.4 | 10.1 | 4 / 1 |
| pause | 10.3 | 10.0 | 3 / 0 |

The tests cannot catch this:

- The parity suite compares one transaction on identical input (`worker/src/domainParity.test.js:123-174`).
- `src/domain/settlement.test.js:49-66` ("caps paused income…", "uses the same cycle anchor after skipping…") actually encodes the forfeiture when a transaction runs before settlement.

**Simplest direction.** Make the three anchor- and cursor-moving transactions close the old window themselves: before moving the cursor, pay `(passivePaidThrough, min(todayKey, due)]`. This is a per-protocol slice of what `settleDaily` already does.

- In the app that slice is always empty, because settlement already ran, so app behavior does not change.
- The worker becomes correct without having to know about settlement.

Having the worker call `settleDaily` before every mutation would also work. But then two writers create settlement ledger entries with different IDs, which makes finding 2 worse.

#### 2. Assistant changes reach the app as whole-snapshot conflicts, and a conflict silently stops cloud saves — observed, traced (not run against Firestore)

**Where.** Three paths lead into, or follow from, a conflict.

- **New day.** Auth resolves asynchronously (`AuthContext.jsx:40`, `onAuthStateChanged`). So `GameProvider`'s mount effects always commit first: `settleDaily` (`GameContext.jsx:777-781`) and the passive calorie fills (385-475).
  - Only then does `CloudSyncProvider` restore `enabled` (`CloudSyncContext.jsx:194-216`) and run `reconcile` (218-226).
  - On the first open of a day, settlement has already changed local state (at least `lastLoginDate`), so `localMatchesBase` is false (161).
  - If the worker or another device wrote since the last sync, `cloudMatchesBase` is false too (160), and the result is `conflict` (180-185).
  - The LLM page follows the same path. It imports the cloud copy (`LlmInterface.jsx:262`), settlement runs on the imported state, and sync is enabled afterwards (174-176).
- **Same day.** Nothing reconciles on resume. Pulls happen only on mount, on `online`, and on "Sync Now" (`CloudSyncContext.jsx:271-285`).
  - A PWA resumed from the background keeps its pre-assistant state.
  - The next local edit autosaves with a stale `expectedRevisionId`, gets `CloudSnapshotConflictError`, and ends in `conflict` (247-258).
- **After a conflict.** Autosave runs only while `status === 'synced'` (229).
  - The conflict is shown only in Settings → Cloud Account (`CloudAccountSettings.jsx:487`) and on the LLM page. Nothing changes on the tabletop.
  - Local edits keep piling up while the assistant keeps writing to the cloud.
  - Resolution is all-or-nothing: `useCloudCopy` or `useDeviceCopy` (`CloudSyncContext.jsx:301-344`).

**Interaction.** "Ask ChatGPT to add a quest, then open LifeQuest tomorrow" routinely produces a conflict. The user won't see it unless they open Settings.

- Choosing "device copy" deletes the assistant's quest.
- Choosing "cloud copy" deletes local edits made since.
- Doing nothing leaves cloud backup paused.

**Preserve.** The revision guard and the three-way base comparison are correct. The problem is which everyday situations get routed into them.

**Simplest direction.**

- When sync is enabled, settle the day after the first reconcile finishes, or after it reports offline or error. The common case then takes the existing clean path ("cloud changed, local unchanged → import"), and settlement runs on the imported state.
- Add a `visibilitychange` → `reconcile` listener next to the existing `online` listener.
- Show `conflict` on the table, for example as a state of an existing prop, so a halted sync is visible where the user works.

Both writers apply the same transactions, so replaying local actions over the cloud copy is possible later. It is not needed to fix the common cases.

#### 3. Every automatic cloud pull writes an unpruned full backup into localStorage — observed (growth is certain; time-to-quota depends on data size)

**Where.** `GameContext.importAppState` (`GameContext.jsx:516-526`) always calls `storePortableImportBackup(exportAppState())` (`portableState.js:818-825`). That writes a full snapshot under a new `lq_backup_transfer_pre_import_<timestamp>` key, and nothing in `src` ever removes those keys.

`importAppState` is used by:

- the automatic clean pull (`CloudSyncContext.jsx:171`)
- `useCloudCopy` (306)
- the LLM page load (`llmInterface.js:45`)
- manual replace (`CloudAccountSettings.jsx:267`)
- Settings import

**Interaction.** localStorage has a small per-origin quota.

- `safeSet` (`persistence.js:93-100`) swallows quota errors, and the same function writes `lq_app_checkpoint`.
- Once the backups fill the quota, checkpoint writes fail silently, and a reload falls back to the last checkpoint that fit. Sync ends up breaking local-first durability.
- Calorie and coin histories grow daily, so each backup grows too.

For automatic pulls, the backup protects nothing new. The pull happens only when local equals the last-synced base, and that base revision stays in Firestore under `snapshotRevisions/<id>` (neither writer deletes revisions).

**Simplest direction.** Back up only when the user starts the replacement: Settings import, manual replace, and "use cloud copy". Keep one rolling transfer backup instead of one per import.

#### 4. The Dashboard freezes "today" at mount and hides daily protocols after midnight — observed

**Where.**

- `Dashboard.jsx:386` sets `const today = useMemo(() => getTodayISO(), [])`.
- The protocol filter (389-402) checks due-ness with the live clock (`isHabitDueForFocus` → `gameState.js:105-108`).
- It checks "already done" with the frozen key: `(h.history?.[today] || 0) <= 0` (393).

**Interaction.** The Dashboard stays mounted while moving between Dashboard and Quests (`App.jsx:170-196`), and a resumed PWA typically keeps it mounted.

- After midnight, a daily protocol completed yesterday is due again, but `history[<yesterday>]` hides it.
- It stays hidden until something unmounts the tabletop.
- Meanwhile the assistant's `dashboardView` (`worker/src/views.js:20-23`) applies `selectedForToday && !completedToday` against the request's day, so it does list the protocol.

**Same root, broader.** Nothing in the app owns "today":

- Rollover is triggered by the calorie timer changing `passiveCheckpointDate` (`GameContext.jsx:467-475` → dependency at 780). This is intentional per `rules/documentation/logic_robustness.md:6`.
- `DayTimer.jsx:7-28` and `LlmInterface.jsx` each run their own 1 s clock.
- The 7-day discarded-quest purge (`GameContext.jsx:783-793`) runs only when quests change, while grocery cleanup lives in `settleDaily`.
- The worker's day comes from `LIFEQUEST_TIME_ZONE`, defaulting to America/Vancouver (`stateEngine.js:188-191`). The app's day comes from the device, so the two agree only while the device is in that zone.

**Simplest direction.** Publish the day key the existing timer already computes as shared state, without adding a clock. Then:

- Have the Dashboard use the same rule as the assistant: `protocolView(protocol, todayKey)` → `selectedForToday && !completedToday`.
- Make settlement and the purge depend on that key instead of on `passiveCheckpointDate`.

#### 5. "Health" and "streak" mean different things to the assistant and to the app — observed, reproduced

**Where.**

- **Health in the app is calorie capacity.**
  - The injector is labelled "Open health tracker. Capacity N percent" and computed from `calories.target` and `calories.current` (`Dashboard.jsx:79, 381-383`).
  - The nav's "Health" tab opens calories (`Navigation.jsx:15`).
- **Health for the assistant is `stats.hp / maxHp`.**
  - Defined in `worker/src/views.js:10-13` and `src/utils/llmInterface.js:63-66`.
  - The OpenAPI summary reads "Get current health, coins, level, XP…" (`worker/src/openapi.js:68`).
- **`stats.hp` barely changes.**
  - It moves only when `applyXp` refills it on level-up (`rewards.js:37`) or through Settings (`SettingsModal.jsx:181`).
  - Its only decrement, `recordHabitFailure` → `takeDamage(5)`, was removed in 548e92e because it had no callers.
  - Undo doesn't reverse the refill. Reproduced: level 1, XP 95, HP 0 → complete an easy quest → level 2, HP 100 → undo → level 1, XP 95, **HP 100**.
- **`streak` only ever increments.**
  - It increments at `transactions.js:132`. Its reset lived in the same removed function.
  - It is now a lifetime completion count, derivable from `history`, that the assistant and the LLM page present as "Streak" (`domain/views.js:37`, `LlmInterface.jsx:93`).
- **The doc is stale.** `rules/documentation/quest_habit_system.md:26-30, 38-42, 53-57` still describes HP lost on failed protocols, streak resets, and automatic focus by due date. None of these exist.

**Interaction.** The assistant can report "Health 100/100" while the injector on the table reads 30%. It can also call a habit done on scattered days a long "streak".

**Simplest direction.** Decide what health is:

- **If health is calorie capacity:** have the shared views report that, and retire `hp/maxHp` from views. Keep accepting both fields on import.
- **If HP is coming back:** give it a rule and put it on the completion receipt so undo restores it.

Separately, derive `streak` from `history` (consecutive on-time cycles), or rename it to "completions". Update the doc either way.

#### 6. The Settings balance edit moves the wallet without the ledger — observed exception to a stated invariant

**Where.** `SettingsModal.handleSave` (`SettingsModal.jsx:83-84`) → `GameContext.updateStats` (`GameContext.jsx:477-485`) overwrites `gold`, along with `xp`, `level`, `maxXp`, and `hp`. The comment at `transactions.js:13-14` says "Wallet and ledger always move together". This path breaks that.

**Interaction.** After a manual balance edit, ledger-based views no longer add up to the balance:

- the 14-day earned/spent totals (`StatsView.jsx:290-316`)
- today's in/out (`BudgetView.jsx:1315-1330`)

**Simplest direction.** Record the difference through `changeCoins` as a "Manual adjustment" entry. The admin override stays, and the invariant holds.

### B. Duplicated state and unclear ownership

#### 7. `budget.earnedRewards` is maintained everywhere and read nowhere — observed

**Writers.**

- `grantReward` computes a rounding-exact USD delta (`transactions.js:37-50`).
- `changeCoins` stores that delta on the ledger entry (15-35).
- `undoQuest` reverses it, with a legacy fallback (102-118).
- `settleDaily` adds passive income in aggregate, with no per-entry delta and stipends excluded (`settlement.js:56-58`).
- The worker normalizer keeps its full precision (`snapshotFormat.js:121-123`).
- About 15 assertions cover it across `transactions.test.js`, `stateEngine.test.js`, `domainParity.test.js`, and `settlement.test.js`.

**Readers.** None.

- `useBudget` spreads it into its return value, but `BudgetView` doesn't use it (`BudgetView.jsx:1270-1283`).
- No other component, view, or API response reads it.

**Simplest direction.**

- **If nothing is meant to show it:** stop writing it, and stop adding `earnedRewardsDelta` to new receipts. Keep old values readable on import.
- **If it should be shown:** derive it from reward ledger entries when it is read, instead of keeping a running total.

#### 8. `calories.current` and the passive-checkpoint pair are stored derivations — preference (no wrong value observed)

**Where.**

- **`calories.current`** is the sum of today's history entries.
  - Read by `Dashboard.jsx:382`, `CalorieTracker.jsx:1588`, and `StatsView.jsx:594`.
  - Recomputed in four places:
    - `GameContext.recomputeCalorieCurrent` (`GameContext.jsx:189-194`, used at 240, 462, 581)
    - `transactions.calorieTotal` (214-216, used at 231 and 247)
    - `settleDaily` (`settlement.js:61-66`)
    - `portableState.recomputeCalorieCurrent` (400-402)
  - Cross-checked in `isCaloriesStateNormalized` (`GameContext.jsx:325`).
  - Every writer has to remember to update it for the right day, and part of what settlement does at midnight is refresh it.
- **`passiveCheckpointDate` + `passiveCheckpoints`** are just today's row of `passiveCheckpointLedger`.
  - They are merged back into the ledger on every read (`GameContext.jsx:230-233, 392-395`; `portableState.js:442-445`).
  - `passiveCheckpointDate` also serves as the settlement trigger (finding 4).

**Simplest direction.** Compute today's calories from `history` when they are read, using the shared day key, and keep the ledger as the only checkpoint record. For saved-data compatibility, keep accepting `current`, `passiveCheckpointDate`, and `passiveCheckpoints` on import. If older readers matter, keep writing them on export too.

#### 9. Protocol lookahead lives outside app state but inside the synced snapshot — observed

**Where.**

- Stored by `HabitTracker.jsx:730-737` with `usePersistentState` under `lq_protocol_lookahead_days` (`constants/persistenceKeys.js:1`).
- `exportAppState` reads it back from localStorage (`GameContext.jsx:511-514`), so it ends up in the snapshot, the checksum, and the cloud.
- `importAppState` writes it back (524).

**Interaction.**

- Changing it doesn't schedule a cloud save, because the export memo depends only on `state`.
- It does change the checksum, so the next reconcile counts it as a local edit (see finding 2).
- An import doesn't update a HabitTracker that is already mounted.

**Simplest direction.** Pick one owner:

- **As a setting:** `settings.protocolLookaheadDays`, persisted and synced like everything else, with the `[ui]` section mapped to it.
- **As device-local:** leave it out of the snapshot entirely.

### C. Disproportionate mechanism

#### 10. The same records are normalized in four places, with drift — preference with minor observed drift

**Where.**

- **Calorie normalization** has two copies: `GameContext.jsx:60-257` and `portableState.js:352-467`.
  - GameContext adds a ~90-line validator, `isCaloriesStateNormalized` (259-350), whose only job is deciding whether to rerun the normalizer (effect at 372-374).
  - The copies have drifted:
    - A legacy entry without `coinCost` takes the saved food's cost in GameContext (208-216) but `0` in portableState (368). That value is what `refundCalories` refunds (`transactions.js:242`).
    - A missing timestamp falls back to "now" in one copy and to the epoch in the other.
    - The fallback label for passive entries differs.
- **Habit and quest normalization** runs three times:
  - on import (`portableState.js:503-506`)
  - as effects on every change, with full `JSON.stringify` comparisons (`GameContext.jsx:758-775`)
  - inside every `settleDaily` (`settlement.js:22`)
- **Initial-state defaults** exist three times: `domain/initialState.js:6-39`, `portableState.js:116-155`, and the worker's `ensureShape` (`stateEngine.js:29-60`) plus its settings defaults (`snapshotFormat.js:47-69`).
- **Legacy currency scaling:** `persistence.js:140-266` re-implements `domain/currencyMigration.js:20-121` field for field, for the old per-key storage.
- **The dashboard view** is built twice: `worker/src/views.js:5-25` and `src/utils/llmInterface.js:49-85`. 548e92e moved `questView` and `protocolView` into `domain/views.js` but left this one behind.

**Simplest direction.**

- Use one boundary normalizer, `normalizePortableSnapshot` built on `createInitialAppState`, wherever state enters:
  - `readAppState`, including the legacy-key path. That path can apply `scaleLegacyPortableCurrency` in memory instead of rewriting keys.
  - `importAppState`.
- With that in place, the GameContext normalization effects and the validator can be deleted.
- Move `dashboardView` into `domain/views.js`.
- Keep the worker's own pass-through normalizer (see "Looks suspicious but should stay").

#### 11. Cloud rollout scaffolding remains beside automatic sync, with copy that contradicts it — observed stale copy; removal is preference

**Where.** Settings → Cloud Account has three tiers:

1. a protected-access test and dummy snapshot write/read (`CloudAccountSettings.jsx:74-154`)
2. manual preview, upload, inspect, and replace (156-271)
3. automatic sync

The first two tiers add mechanism:

- The dummy tier threads a `kind` parameter through `saveCloudSnapshot` (`cloudSnapshot.js:79-87`) and needs a `kind === 'dummy'` branch in `reconcile` (`CloudSyncContext.jsx:135-139`).
- Manual transfer keeps its own `cloudRevisionId`. It is disabled while sync is on (384), so it does not corrupt sync metadata.
- The conflict actions already cover both manual operations.

The copy on that panel is out of date:

- "Authentication checkpoint only. Signing in cannot upload, download, or modify LifeQuest data." (282)
- "Automatic sync remains disabled." (360)

**Simplest direction.** Retire the dummy tier and its `kind` plumbing. Fold manual transfer into the sync panel's two existing actions, with a preview step. Fix the copy.

### D. Spatial coherence

#### 12. Only Dashboard and Quests share the table; the other surfaces crossfade on a different background — observed against `AGENTS.md`

**Where.**

- `TABLETOP_TABS` is `{dashboard, quests}` (`App.jsx:42`). Those two share one stage, where a single `stageX` drives both backdrop and content (`TabletopStage`, `App.jsx:127-209`).
- Protocols, Budget, and Health render in a separate branch (`App.jsx:247-274`). That branch replaces the tabletop with a radial gradient (236-241) and enters and leaves with `opacity` + `y` (260-262).
- Leaving the table unmounts `TabletopStage` with no exit motion, so the table blinks out.
- Coming back re-creates the Dashboard: its printed readouts fade in (`Dashboard.jsx:83, 126`), and the hexes grow from `scale: 0, opacity: 0` (215).

**Interaction.** The table already points at these places, but the destinations are not in the same world:

- The coin pile opens Budget, and the injector opens Health (`Dashboard.jsx:448-449`).
- The nav wheel puts Protocols to the right of Dashboard (`Navigation.jsx:7-11`), which extends the stage's Quests | Dashboard order.

`AGENTS.md` asks for Dashboard, Quests, and Protocols to "feel spatially connected" and rules out "crossfades, dissolves, opacity swaps".

**Simplest direction.**

- Add Protocols as a third panel on the same stage (300% width, same `stageX`).
- Keep `TabletopStage` mounted while Budget or Health is open, so the table isn't rebuilt on return.
- Treat Budget and Health as transform-only moves toward their props, not fades.

#### 13. Departing objects fade or vanish instead of going somewhere — observed against `AGENTS.md`

**Where.**

- Quest cards leave on complete or dismiss with `{ x: ±430, opacity: 0 }` over 0.24 s (`QuestBoard.jsx:146-147`).
- Protocol cards leave with `{ x: ±200, opacity: 0 }` (`HabitTracker.jsx:236, 240`). 200 px does not clear a card up to 448 px wide, so it dissolves on the table.
- Dashboard hexes have no exit.
  - A completed node disappears in one frame (`Dashboard.jsx:355`), and the rest spring into new slots.
  - `HexNode`'s completed styling (checkmark, grayscale; `Dashboard.jsx:244-315`) can never render, because `matrixNodes` holds only pending items (389-402).

**Interaction.** The table already has destinations for these objects:

- The victory and discard piles re-render by count (`QuestBoard.jsx:610-611, 878, 886`).
- The victory log is where undo happens (897-898).

**Simplest direction.** Let completed and dismissed cards travel off-screen or onto their pile, using transforms only. Give hexes a transform exit, or show their existing completed state briefly before removing them.

### E. Smaller leftovers (taste)

- **Dead backdrop branches.** `showTabletopBackdrop` is `false` at both call sites (`App.jsx:177, 192`). The per-screen backdrop branches (`Dashboard.jsx:57-69`, `QuestBoard.jsx:625-629`) are unreachable. If reached, they would draw a different plate than the shared stage.
- **`toggleToday(id, type)`** ignores every type except quests (`GameContext.jsx:749-756`).
- **`updateQuest`** is a generic merge used only for the mission brief (679-681). It could bypass the transactions.
- **Manifest `stateChecksum`.** Both writers compute it, each over its own normalization (`cloudSnapshot.js:91`, `snapshotStore.js:121-122`). The app never reads it, because every `markSynced` call passes its own checksum.
- **Stored quest gold.** Non-custom quests store `reward.gold` at creation, but completion uses live settings while XP stays frozen (`rewards.js:17-26`). The stored gold is a second source, used only when the setting is missing.
- **Version check placement.** `checkVersionAndEnsurePersistence()` runs in `App`'s render body (`App.jsx:284`), so it reruns on every tab change.
- **Layout test.**
  - `tabletopLayout.test.js:117-121` asserts `contentInset - contentInset === 0`.
  - Several nearby assertions pin literal constants or source text.
  - The geometric ones are the real contract (hit targets inside silhouettes, no overlap). Keep those.
- **Tracked test output.** `test-results/.last-run.json` is tracked even though `test-results` is git-ignored.

## Well-integrated parts worth preserving

- **The transaction layer** (`src/domain/transactions.js`). Pure `(state, input, event) → state` functions shared by the browser and the worker.
  - Receipts (`completedReward`) make undo independent of later settings or exchange-rate changes.
  - Request IDs make assistant retries idempotent.
  - This is the strongest "tapestry" thread in the codebase.
- **One state, one checkpoint** (`AppStateContext.jsx`, `appStatePersistence.js`). Every mutation is one `updateState`, so wallet, ledger, and records change and persist together.
- **Day-key calendar** (`domain/calendar.js`). Timezone conversion happens only in the adapters (`utils/dateUtils.js`, `worker/src/date.js`).
- **One recurrence model** (`domain/protocols.js`). Views, settlement, transactions, and both surfaces use it.
- **Shared nouns** (`domain/views.js`). The assistant and the app describe quests and protocols identically.
- **Snapshot transport.**
  - Chunked, checksummed, and revision-guarded on both writers: a Firestore transaction in the app, an `updateTime` precondition in the worker.
  - The worker passes through fields it doesn't own.
- **The tabletop stage.**
  - One `stageX` drives backdrop and content, with transforms only.
  - Reduced motion jumps straight to the final position (`App.jsx:292-312`).
  - The artwork is precached (`vite.config.js:12`).
- **`useDeckOrder`.** Card order stays view state, out of the domain.

## Looks suspicious but should stay

- **`readAppState` throws on an unreadable checkpoint** (`appStatePersistence.js:38-49`) instead of falling back to legacy keys. It looks harsh, but it prevents a silent rollback.
- **Legacy `lq_*` keys stay in place** as a recovery copy. They are never merged into a checkpoint.
- **Checksums over normalized snapshots minus `generatedAt`** (`cloudSnapshot.js:63-66`). Without this, metadata-only differences would look like edits.
- **Two auth surfaces with a `dataUid` mapping** (`constants/cloudAccess.js`). This includes session-only persistence for the LLM surface and forced sign-out of unauthorized sessions. These are auth boundaries.
- **The worker's own, narrower normalizer** (`worker/src/snapshotFormat.js`). It must not rewrite fields it doesn't own, such as calories and budget lists, so passing them through is right. Only its duplicated defaults are worth folding (finding 10).
- **The calorie timer as the day tick.** It is documented and avoids a second poll. Keep the timer and just publish its day key (finding 4).
- **The `GameContext` + `CalorieContext` split.** Two providers over the same state look redundant, but they keep calorie-only updates from re-rendering quest and protocol consumers.
- **Day-scoped refund windows** (groceries same day, calories today or yesterday). They are enforced in the transactions, not in the UI, and settlement's grocery cleanup matches them.
- **Concept artifacts** (`protocols-concept` gitlink, `protocols-concept-site*.tar.gz`, about 26 MB). They were committed deliberately in 18454be ("preserve protocols concept site artifacts") and are not app code. One thing to confirm: the gitlink has no `.gitmodules`, so fresh clones get an empty directory.
