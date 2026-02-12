# Structural Flaws

This document identifies architectural and organizational issues that may hinder the maintainability and scalability of the LifeQuest codebase.

## 1. High Code Duplication (Deck System)
The "Swipeable Deck" pattern is implemented almost identically twice:
- `QuestDeckCard` in `QuestBoard.jsx`
- `ProtocolDeckCard` in `HabitTracker.jsx`

**Impact**: Bug fixes or UI improvements to the swipe logic must be applied twice.
**Recommendation**: Create a generic `Deck` and `Card` component system in a shared directory. These should accept "content" as children or a render prop while handling the common Framer Motion swipe and drag logic.

## 2. Shared Utilities vs. Component Logic
Logic for determining dates and rewards is scattered.
- **Example**: `isWithinDays` is imported from `dateUtils`, but filtering for "recent" items is done manually inside `useMemo` blocks across different files.
- **Recommendation**: Create "Domain Utilities" or "Selectors" that encapsulate these business rules (e.g., `getRecentVictories(quests)`), making them easier to test and reuse.

## 3. Inline Modal and Form Definitions
Major UI pieces like `LogModal`, `ProtocolCreationPanel`, and `QuestDeck` are defined within the same files as their parent boards.
- **Impact**: Increased cognitive load when reading the code and reduced reusability.
- **Recommendation**: Move each distinct UI entity into its own file in `src/components/`. For example:
  - `src/components/quests/QuestForm.jsx`
  - `src/components/common/LogModal.jsx`

## 4. Fragile Deck Ordering
The system uses "Cycle Offsets" based on `Date.now()` and negative numbers to manipulate the order of items in the deck (e.g., `handlePrevious` in `QuestBoard`).
- **Impact**: This is a "hacky" way to manage priority that can lead to unpredictable behavior if multiple updates happen within the same millisecond or if the data is exported/imported.
- **Recommendation**: Implement a formal `priority` or `orderIndex` property on the Quest/Habit objects that is managed by the context logic.

## 5. UI Routing Logic
The app uses a `currentTab` string in `App.jsx` to manage views.
- **Impact**: There is no browser history support, and deep-linking to a specific tab (e.g., the Budget view) is not possible without manual implementation.
- **Recommendation**: For a more robust web experience, consider a light-weight router (like `Wouter` or `React Router`) or a hash-based routing system to manage tab state.
