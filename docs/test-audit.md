# Test audit

Reviewed all 194 original test cases across 26 files, including each generated
parameterized case, against the production behavior they exercise. Removed nine
cases and added five regression cases. The resulting 190 cases pass.

This inventory describes the working tree reviewed on 2026-10-12, including
separate Today-window changes that remain uncommitted. The isolated fix and
audit commits pass 181 tests across 25 files, with lint and the production build
also passing.

## What makes a test useful

A failure should identify a broken user behavior, accounting invariant, access
boundary, or supported data/API contract. Refactoring, moving assets, reordering
tools, tuning coordinates within their physical bounds, and editing wording
should normally leave tests passing. Intentionally changing a contract should
require its test to change: reward amounts, date rules, and supported save formats
are examples. Test count is not a quality target.

## Suite inventory

Paths are relative to the repository root. Counts include parameterized cases.

| Suite | Before | After | Decision and behavior protected |
| --- | ---: | ---: | --- |
| `src/constants/cloudAccess.test.js` | 3 | 3 | Keep: owner/assistant surface separation and rejection of other identities. |
| `src/domain/calendar.test.js` | 6 | 6 | Keep: leap days, DST-adjacent days, year/month boundaries, and invalid calendar input. |
| `src/domain/currencyMigration.test.js` | 2 | 2 | Keep: scale credits once, preserve USD and receipt deltas, tolerate malformed legacy fields. |
| `src/domain/gameState.test.js` | 3 | 3 | Keep: Today membership, discard behavior, and stale-record rejection. |
| `src/domain/protocols.test.js` | 14 | 14 | Keep: recurrence variants, invalid intervals, anchors, due/overdue states, passive payment limits, pause cursors, and streaks. Parameterized boundaries cover different failures. |
| `src/domain/protocolTimeWindow.test.js` | 7 | 7 | Keep: inclusive start/exclusive end, overnight and partial windows, saved timezone/DST, activation, and persistence without accounting changes. |
| `src/domain/settlement.test.js` | 7 | 7 | Keep: exactly-once passive/stipend payment, missed days, legacy cursors, pause/resume, and day cleanup. |
| `src/domain/transactions.test.js` | 24 | 27 | Keep accounting checks; add empty-reward and deferred-schedule regressions. Update the immediate-schedule assertion to the intended tomorrow behavior. |
| `src/utils/appStatePersistence.test.js` | 7 | 7 | Keep: atomic checkpoint writes, reload consistency, quota failure, corrupt/future saves, legacy migration, and backup completeness. |
| `src/utils/cloudSnapshot.test.js` | 3 | 3 | Keep; strengthen chunk-size and changed-state checks. Protect Unicode transfer, a known SHA-256 checksum, and logical-state comparison that ignores only generation time. |
| `src/utils/cloudSyncState.test.js` | 3 | 3 | Keep: resume only matching identity metadata and isolate persistence keys. |
| `src/utils/dateAdapters.test.js` | 4 | 4 | Keep: actual browser/worker date adapters in multiple timezones, preserving day keys while converting instants. |
| `src/utils/homeScreenIcons.test.js` | 3 | 3 | Replace filename/folder regex with asset existence; check metadata reuse and absence of duplicate icon links. Keep unknown-ID fallback. |
| `src/utils/llmInterface.test.js` | 4 | 4 | Strengthen Today checks to identify the selected records, rather than accepting any single record. Keep route, local-midnight, and guarded import contracts. |
| `src/utils/persistence.test.js` | 1 | 1 | Keep the full migration/backup check; derive the backup version prefix instead of pinning the current application version. |
| `src/utils/portableState.test.js` | 9 | 9 | Keep transfer/error/migration contracts. Compare different insertion orders, use unequal section counts, remove default-icon spelling/order coupling, and cover pending-schedule transfer under a fixed clock. |
| `src/utils/tabletopLayout.test.js` | 6 | 4 | Remove arithmetic tautology and motion source scan. Keep geometric alignment, hit-area coverage, symmetry, and collision checks; remove exact coordinate/scale/easing locks. |
| `worker/src/domainParity.test.js` | 20 | 20 | Keep: adapter wiring, in-place worker state, supplied calendar day, errors, retry semantics, payouts, and browser/worker agreement. Independent expected rewards/balances remain alongside parity comparisons. |
| `worker/src/index.test.js` | 3 | 3 | Keep: public health/privacy routes and removal of retired write routes. |
| `worker/src/mcp.test.js` | 26 | 26 | Keep transport and end-to-end tool tests. Allow tool additions/reordering, check read-only annotations, cover empty-reward edits, and verify saved schedules and bonuses across midnight. Remove serialized-handler and instruction-wording assertions. |
| `worker/src/oauth.test.js` | 13 | 15 | Keep token/refresh/discovery/denial/access checks. Add invalid-consent and cross-site regressions; strengthen existing retry, concurrent-limit, and address-isolation cases. Remove dependence on a particular HTML entity spelling. |
| `worker/src/ownerSignInLimiter.test.js` | 3 | 3 | Keep: serialized failures, eviction persistence, successful checks, configuration rejection, and exact expiry. Advance the clock between failures to catch an accidentally extended window. |
| `worker/src/snapshotFormat.test.js` | 7 | 6 | Consolidate duplicate v3 migration coverage into the existing version matrix, with explicit expected amounts. Keep decimal rounding and future-format rejection. |
| `worker/src/stateEngine.test.js` | 7 | 2 | Remove five basic action/retry duplicates already covered by domain parity and MCP, and trim their unused fixtures. Retain precise receipts and reload/undo preservation, including unrelated malformed legacy records. |
| `worker/src/views.test.js` | 6 | 5 | Remove function-identity assertion; retain actual projection parity, selected records, configured/custom/paid rewards, time windows, and calorie health. |
| `tools/production-env.test.js` | 3 | 3 | Keep: missing/blank configuration and CI guard wiring; ignore required-key ordering. The workflow check is a configuration contract; it intentionally changes when deployment wiring changes. |
| **Total** | **194** | **190** | **9 removed, 5 added; retained assertions revised where needed.** |

## Removed cases and replacement coverage

- Tabletop: `cancels the content safe-area inset for physical Blender coordinates`
  only checked `67 - 67 === 0`, without calling production code.
- Tabletop: `keeps the compositor-only tabletop turn short and subtle` searched
  source strings and pinned easing/scales. It could pass with broken motion and
  fail after a harmless refactor.
- Worker views: `keeps worker projection exports compatible` compared function
  identity. The remaining tests compare actual public results and selection.
- Worker snapshot format: `migrates v3 whole-unit currency once at the API boundary`
  duplicated the v3 case in the version matrix. Its numeric checks are retained
  in that matrix, alongside repeat-normalization and input-immutability checks.
- Worker state engine: `completes and undoes a quest with its rewards`,
  `discards and restores quests reversibly`, `deactivates a protocol explicitly`,
  `deduplicates creation requests`, and `deduplicates retried protocol completions`.
  The parity suite already exercises these same adapter paths with stronger
  coverage: changed settings, focus restoration, early/due/overdue days, passive
  income, unchanged state on retries, and explicit balances. MCP additionally
  exercises the wire format, argument validation, and saving.

## Regression evidence and validation

Before the fixes, the three new domain cases failed for empty reward edits,
today's lost protocol bonus, and repeated schedule edits. The revised/new OAuth
cases also failed against the previous authorization implementation for missing
or forged consent, cross-site requests, fresh retries, and isolation between
client addresses. These checks exercise observed failures, rather than copying
implementation details into expectations.

Final validation: `npm test` (190 passing), `npm run lint`, `npm run build`,
`git diff --check`, and a Worker bundle dry run with dummy configuration.
A local Wrangler runtime also rejected 12 forged submissions without locking
sign-in, returned a fresh form after a wrong passphrase, rejected replay of the
consumed form, approved the corrected retry, exchanged its PKCE code, and accepted
an authenticated MCP ping. No production services were contacted or modified by
these checks. The build retains its existing bundle-size/Browserslist warnings.

## Limits

This is an assertion and coverage-purpose audit, not an exhaustive mutation test
or proof that every possible bug is covered. Firebase persistence is mocked in
the MCP/OAuth suites; the local runtime check covers real Worker bindings and
OAuth without connecting to Firebase. Live account permissions and deployment
are outside this validation.

The remaining tabletop tests model geometry against measured silhouettes; they
do not render the UI. Motion continuity still needs inspection at start,
midpoint, and end in both directions, including reduced motion, whenever visual
behavior changes. A source-string test cannot substitute for that inspection.
