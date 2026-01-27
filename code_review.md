# LifeQuest Code Review

> A comprehensive review focused on code organization, consistency, maintainability, and optimization opportunities.  
> **Note:** Functionality, appearance, and animations are assumed to be working as desired.

---

## Executive Summary

The codebase is well-structured overall using React with Context API for state management and Framer Motion for animations. However, there are significant opportunities to improve **consistency**, **reduce duplication**, and **enhance maintainability**.

### Key Priority Areas
1. 🔴 **Component Size** – Several components exceed 600+ lines
2. 🟠 **Duplicated UI Patterns** – Card decks, modals, and radial layouts are repeated
3. 🟠 **Inconsistent Code Patterns** – Mixed animation configs, date handling, styling approaches
4. 🟡 **Missing TypeScript** – No type safety for complex data structures

---

## 1. Project Structure Review

### Current Structure
```
src/
├── App.jsx
├── components/         # 12 files (some very large)
├── context/            # 2 context providers
├── utils/              # 2 utility files
└── index.css
```

### Recommendations

#### 1.1 Organize Components by Feature
Currently all components live in a flat `components/` folder. Consider grouping:

```
src/
├── features/
│   ├── quests/
│   │   ├── QuestBoard.jsx
│   │   ├── QuestDeckCard.jsx
│   │   ├── QuestDeck.jsx
│   │   └── LogModal.jsx
│   ├── protocols/
│   │   ├── HabitTracker.jsx
│   │   ├── ProtocolDeckCard.jsx
│   │   └── ProtocolListModal.jsx
│   ├── budget/
│   │   ├── BudgetView.jsx
│   │   ├── CoinSwitch.jsx
│   │   └── LedgerView.jsx
│   └── dashboard/
│       ├── Dashboard.jsx
│       ├── HexNode.jsx
│       └── HexMatrix.jsx
├── shared/
│   ├── ui/              # Reusable UI primitives
│   │   ├── Modal.jsx
│   │   ├── DeckCard.jsx
│   │   └── RadialMenu.jsx
│   └── hooks/
│       └── useDeckNavigation.js
└── ...
```

#### 1.2 Extract Large Components
Several files contain multiple distinct components that should be extracted:

| File | Lines | Contains | Action |
|------|-------|----------|--------|
| [QuestBoard.jsx](file:///c:/Users/Umair/OneDrive/Desktop/Work/Random_Projects/LifeQuest/src/components/QuestBoard.jsx) | 722 | [QuestDeckCard](file:///c:/Users/Umair/OneDrive/Desktop/Work/Random_Projects/LifeQuest/src/components/QuestBoard.jsx#14-219), [QuestDeck](file:///c:/Users/Umair/OneDrive/Desktop/Work/Random_Projects/LifeQuest/src/components/QuestBoard.jsx#220-256), [LogModal](file:///c:/Users/Umair/OneDrive/Desktop/Work/Random_Projects/LifeQuest/src/components/QuestBoard.jsx#257-302), [QuestBoard](file:///c:/Users/Umair/OneDrive/Desktop/Work/Random_Projects/LifeQuest/src/components/QuestBoard.jsx#303-720) | Extract to 4 files |
| [HabitTracker.jsx](file:///c:/Users/Umair/OneDrive/Desktop/Work/Random_Projects/LifeQuest/src/components/HabitTracker.jsx) | 690 | [ProtocolDeckCard](file:///c:/Users/Umair/OneDrive/Desktop/Work/Random_Projects/LifeQuest/src/components/HabitTracker.jsx#24-148), [ProtocolDeck](file:///c:/Users/Umair/OneDrive/Desktop/Work/Random_Projects/LifeQuest/src/components/HabitTracker.jsx#149-185), [ProtocolListModal](file:///c:/Users/Umair/OneDrive/Desktop/Work/Random_Projects/LifeQuest/src/components/HabitTracker.jsx#186-261), [HabitTracker](file:///c:/Users/Umair/OneDrive/Desktop/Work/Random_Projects/LifeQuest/src/components/HabitTracker.jsx#262-688) | Extract to 4 files |
| [BudgetView.jsx](file:///c:/Users/Umair/OneDrive/Desktop/Work/Random_Projects/LifeQuest/src/components/BudgetView.jsx) | 626 | [CoinSwitch](file:///c:/Users/Umair/OneDrive/Desktop/Work/Random_Projects/LifeQuest/src/components/BudgetView.jsx#27-122), nested components | Extract nested components |
| [Dashboard.jsx](file:///c:/Users/Umair/OneDrive/Desktop/Work/Random_Projects/LifeQuest/src/components/Dashboard.jsx) | 464 | [HexNode](file:///c:/Users/Umair/OneDrive/Desktop/Work/Random_Projects/LifeQuest/src/components/Dashboard.jsx#11-195), [HexMatrix](file:///c:/Users/Umair/OneDrive/Desktop/Work/Random_Projects/LifeQuest/src/components/Dashboard.jsx#198-251), [Dashboard](file:///c:/Users/Umair/OneDrive/Desktop/Work/Random_Projects/LifeQuest/src/components/Dashboard.jsx#252-462) | Extract hex components |

---

## 2. Code Duplication Analysis

### 2.1 Deck Card Pattern Duplication 🔴 HIGH
[QuestDeckCard](file:///c:/Users/Umair/OneDrive/Desktop/Work/Random_Projects/LifeQuest/src/components/QuestBoard.jsx#14-219) and [ProtocolDeckCard](file:///c:/Users/Umair/OneDrive/Desktop/Work/Random_Projects/LifeQuest/src/components/HabitTracker.jsx#24-148) share **~80% identical logic**:

**Shared patterns:**
- Motion value setup (`x`, `y`, `rotate`)
- Drag handling ([handleDragEnd](file:///c:/Users/Umair/OneDrive/Desktop/Work/Random_Projects/LifeQuest/src/components/HabitTracker.jsx#33-49) with threshold checks)
- Swipe feedback overlays (left/right transforms)
- Card stacking animations (scale, offset, opacity)
- Exit/Initial variants logic

**Recommendation:** Create a shared [DeckCard](file:///c:/Users/Umair/OneDrive/Desktop/Work/Random_Projects/LifeQuest/src/components/QuestBoard.jsx#14-219) base component:

```jsx
// src/shared/ui/DeckCard.jsx
const DeckCard = ({ 
  item, 
  index, 
  isTop, 
  onSwipeRight, 
  onSwipeLeft, 
  onSwipeUp, 
  onSwipeDown,
  rightIcon,
  leftIcon,
  children,
  borderColor = 'border-slate-500'
}) => {
  // Shared drag logic, transforms, variants...
  return (
    <motion.div ...>
      {/* Swipe feedback with customizable icons */}
      {children}
    </motion.div>
  );
};
```

### 2.2 Modal Pattern Duplication 🟠 MEDIUM
Three nearly identical modal patterns exist:

| Modal | Location | Purpose |
|-------|----------|---------|
| [LogModal](file:///c:/Users/Umair/OneDrive/Desktop/Work/Random_Projects/LifeQuest/src/components/QuestBoard.jsx#257-302) | [QuestBoard.jsx:257](file:///c:/Users/Umair/OneDrive/Desktop/Work/Random_Projects/LifeQuest/src/components/QuestBoard.jsx#L257-L301) | Victory/Discarded logs |
| [ProtocolListModal](file:///c:/Users/Umair/OneDrive/Desktop/Work/Random_Projects/LifeQuest/src/components/HabitTracker.jsx#186-261) | [HabitTracker.jsx:186](file:///c:/Users/Umair/OneDrive/Desktop/Work/Random_Projects/LifeQuest/src/components/HabitTracker.jsx#L186-L260) | Active/Inactive protocols |
| [SettingsModal](file:///c:/Users/Umair/OneDrive/Desktop/Work/Random_Projects/LifeQuest/src/components/BudgetView.jsx#194-295) | [BudgetView.jsx:194](file:///c:/Users/Umair/OneDrive/Desktop/Work/Random_Projects/LifeQuest/src/components/BudgetView.jsx#L194-L294) | Budget settings |

**Recommendation:** Create a shared [Modal](file:///c:/Users/Umair/OneDrive/Desktop/Work/Random_Projects/LifeQuest/src/components/QuestBoard.jsx#257-302) component:

```jsx
// src/shared/ui/Modal.jsx
const Modal = ({ title, titleColor, onClose, children }) => (
  <div className="fixed inset-0 z-50 ..." onClick={onClose}>
    <motion.div ...>
      <header>...</header>
      <div className="flex-1 overflow-y-auto p-4">
        {children}
      </div>
    </motion.div>
  </div>
);
```

### 2.3 Radial Navigation Duplication 🟠 MEDIUM
The "orbiting" radial menu with icons appears in both:
- [HabitTracker.jsx:547-655](file:///c:/Users/Umair/OneDrive/Desktop/Work/Random_Projects/LifeQuest/src/components/HabitTracker.jsx#L547-L655)
- [QuestBoard.jsx:585-690](file:///c:/Users/Umair/OneDrive/Desktop/Work/Random_Projects/LifeQuest/src/components/QuestBoard.jsx#L585-L690)

Both use the same positioning math: `rotate(Xdeg) translateY(-Ypx) rotate(-Xdeg)`

**Recommendation:** Extract to shared `RadialMenu` component.

### 2.4 Animation Config Duplication 🟡 LOW
The same spring config is defined in multiple files:

```javascript
// QuestBoard.jsx:12
const SPRING_CONFIG = { type: "spring", stiffness: 400, damping: 40 };

// HabitTracker.jsx:18
const SPRING_CONFIG = { type: "spring", stiffness: 400, damping: 40 };

// Navigation.jsx:57
const springConfig = { stiffness: 160, damping: 20 };
```

**Recommendation:** Create a constants file:

```javascript
// src/constants/animations.js
export const SPRING_CONFIG = { type: "spring", stiffness: 400, damping: 40 };
export const NAV_SPRING_CONFIG = { stiffness: 160, damping: 20 };
```

---

## 3. Consistency Issues

### 3.1 Date Handling Inconsistency 🟠 MEDIUM
Multiple patterns for getting today's date:

```javascript
// Pattern 1: GameContext.jsx:292, 344
const today = new Date().toISOString().split('T')[0];

// Pattern 2: Dashboard.jsx:266
const today = new Date().toISOString().split('T')[0];

// Pattern 3: CalorieTracker (varies)
```

**All 5+ occurrences** do the same thing but repeat the logic.

**Recommendation:** Add to utils:

```javascript
// src/utils/dateUtils.js
export const getTodayISO = () => new Date().toISOString().split('T')[0];
```

### 3.2 ID Generation Inconsistency 🟡 LOW
Mixed approaches to generating IDs:

```javascript
// Some places use uuid
import { v4 as uuidv4 } from 'uuid';  // GameContext imports but doesn't use!

// All actual usage is Date.now()
id: Date.now().toString()
```

The `uuid` package is imported in [GameContext.jsx:2](file:///c:/Users/Umair/OneDrive/Desktop/Work/Random_Projects/LifeQuest/src/context/GameContext.jsx#L2) but **never used**.

**Recommendation:** Either use `uuid` consistently or remove the dependency.

### 3.3 clsx Usage Inconsistency 🟡 LOW
Most components import and use `clsx`, but sometimes inline conditional classes:

```jsx
// Good: Using clsx
className={clsx("base-classes", isActive && "active-class")}

// Inconsistent: Template literals
className={`base-classes ${isActive ? 'active' : ''}`}
```

**Recommendation:** Standardize on `clsx` for all conditional classes.

### 3.4 Naming Convention Inconsistency 🟡 LOW

| Pattern | Examples |
|---------|----------|
| `handleX` | [handleSubmit](file:///c:/Users/Umair/OneDrive/Desktop/Work/Random_Projects/LifeQuest/src/components/HabitTracker.jsx#308-323), [handleComplete](file:///c:/Users/Umair/OneDrive/Desktop/Work/Random_Projects/LifeQuest/src/components/HabitTracker.jsx#324-328) ✓ |
| `onX` callback props | `onComplete`, `onClose` ✓ |
| Mixed prefixes | [toggleDetails](file:///c:/Users/Umair/OneDrive/Desktop/Work/Random_Projects/LifeQuest/src/components/QuestBoard.jsx#42-47), [saveBrief](file:///c:/Users/Umair/OneDrive/Desktop/Work/Random_Projects/LifeQuest/src/components/QuestBoard.jsx#55-60) (should be `handleX`) |

---

## 4. Architecture Recommendations

### 4.1 Custom Hooks Extraction 🔴 HIGH

Extract reusable logic into custom hooks:

#### `useDeckNavigation`
```javascript
// src/shared/hooks/useDeckNavigation.js
export const useDeckNavigation = (items, onComplete, onSkip) => {
  const [cycleOffsets, setCycleOffsets] = useState({});
  const [slideDirection, setSlideDirection] = useState(1);
  
  const handleSkip = (id) => { ... };
  const handlePrevious = () => { ... };
  const getSortedItems = () => { ... };
  
  return { cycleOffsets, slideDirection, handleSkip, handlePrevious, getSortedItems };
};
```

This logic is **duplicated** between:
- [QuestBoard.jsx:340-373](file:///c:/Users/Umair/OneDrive/Desktop/Work/Random_Projects/LifeQuest/src/components/QuestBoard.jsx#L340-L373)
- [HabitTracker.jsx:334-373](file:///c:/Users/Umair/OneDrive/Desktop/Work/Random_Projects/LifeQuest/src/components/HabitTracker.jsx#L334-L373)

#### `useTodayCheck`
```javascript
// src/shared/hooks/useTodayCheck.js
export const useTodayCheck = (history) => {
  const today = getTodayISO();
  return (history?.[today] || 0) > 0;
};
```

### 4.2 Type Definitions 🟠 MEDIUM

Consider adding TypeScript or at least PropTypes/JSDoc for key data structures:

```typescript
// types/index.ts
interface Quest {
  id: string;
  title: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'legendary';
  dueDate: string | null;
  completed: boolean;
  discarded: boolean;
  reward: { xp: number; gold: number };
  isCustomReward: boolean;
  missionBrief?: string;
  isToday?: boolean;
  completedAt?: string;
  completedReward?: { xp: number; gold: number };
}

interface Habit {
  id: string;
  title: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'interval';
  frequencyParam: number;
  streak: number;
  history: Record<string, number>;
  isActive: boolean;
  isToday?: boolean;
}
```

### 4.3 Context Split 🟡 LOW

`GameContext` is doing a lot. Consider splitting:

| Context | Responsibility |
|---------|----------------|
| `StatsContext` | Player stats (level, xp, hp, gold) |
| `QuestsContext` | Quest CRUD and completion |
| `HabitsContext` | Habit/Protocol management |
| `SettingsContext` | App settings and rewards config |

This would reduce re-renders when unrelated state changes.

---

## 5. Dead Code to Remove

### 5.1 Unused Imports
```javascript
// GameContext.jsx:2
import { v4 as uuidv4 } from 'uuid';  // UNUSED

// QuestBoard.jsx:4
import { Circle, ... } from 'lucide-react';  // Circle unused

// QuestBoard.jsx:7
const USE_DECK_VIEW = true;  // Always true, never used conditionally
```

### 5.2 Backup Files
- [App_backup.txt](file:///c:/Users/Umair/OneDrive/Desktop/Work/Random_Projects/LifeQuest/src/App_backup.txt)
- [Dashboard_backup.txt](file:///c:/Users/Umair/OneDrive/Desktop/Work/Random_Projects/LifeQuest/src/components/Dashboard_backup.txt)

These should be removed and rely on git history instead.

### 5.3 Commented Code
[App.jsx:45-60](file:///c:/Users/Umair/OneDrive/Desktop/Work/Random_Projects/LifeQuest/src/App.jsx#L45-L60) has a large block of commented-out header code.

---

## 6. Performance Optimizations

### 6.1 Memoization Opportunities 🟠 MEDIUM

Several computed values should be memoized:

```javascript
// Dashboard.jsx - Recomputed every render
const pendingQueue = [
  ...allPendingTodayQuests.map(...),
  ...allPendingTodayHabits.map(...)
].sort(...);

// Should be:
const pendingQueue = useMemo(() => [...], [allPendingTodayQuests, allPendingTodayHabits]);
```

Other candidates:
- `matrixNodes` in Dashboard
- `deckHabits` in HabitTracker
- `activeQuests` in QuestBoard
- Gradient style objects in `HexNode.getNodeStyles`

### 6.2 Callback Memoization 🟡 LOW

Event handlers passed to child components should use `useCallback`:

```javascript
// Instead of inline functions in map()
onClick={() => onComplete(quest.id)}

// Use memoized callbacks
const handleComplete = useCallback((id) => completeQuest(id), [completeQuest]);
```

---

## 7. Style Consistency

### 7.1 Tailwind Color Tokens 🟠 MEDIUM

**Good:** Uses custom theme colors defined in [tailwind.config.js](file:///c:/Users/Umair/OneDrive/Desktop/Work/Random_Projects/LifeQuest/tailwind.config.js):
- `game-bg`, `game-panel`, `game-accent`, `game-gold`, `game-danger`, `game-success`

**Issue:** Many places use raw Tailwind colors instead of theme tokens:

```jsx
// Uses theme token (GOOD)
className="text-game-accent"

// Uses raw color (SHOULD USE THEME)
className="text-emerald-400"  // Should be a theme token if it represents "quests"
className="text-purple-400"   // Should be a theme token if it represents "protocols"
```

**Recommendation:** Add semantic tokens:

```javascript
// tailwind.config.js
colors: {
  game: {
    quest: '#10b981',    // emerald-500
    protocol: '#a855f7', // purple-500
    // ...
  }
}
```

### 7.2 Inline Styles 🟡 LOW

Several components use inline `style={}` for things that could be Tailwind:

```jsx
// Uses inline style
style={{ transform: 'translateY(100px)' }}

// Could be Tailwind
className="translate-y-[100px]"
```

Consider moving more to Tailwind for consistency, though some complex transforms may need inline styles.

---

## 8. Quick Wins (Low Effort, High Impact)

1. **Delete unused `uuid` import** – 1 line change
2. **Remove backup files** – Clean up repository
3. **Create `getTodayISO` utility** – 10 lines, removes 5+ duplications
4. **Create `animations.js` constants** – 5 lines, centralizes animation configs
5. **Remove commented code in App.jsx** – Clean up ~15 lines

---

## 9. Migration Path (Suggested Order)

If you decide to implement these recommendations, here's a suggested order:

### Phase 1: Quick Cleanup (1-2 hours)
- [ ] Remove unused imports (uuid, Circle, etc.)
- [ ] Delete backup files
- [ ] Remove commented code
- [ ] Create `src/constants/animations.js`
- [ ] Create `src/utils/dateUtils.js`

### Phase 2: Extract Shared Components (4-6 hours)
- [ ] Create `src/shared/ui/Modal.jsx`
- [ ] Create `src/shared/ui/DeckCard.jsx`
- [ ] Refactor QuestDeckCard and ProtocolDeckCard to use DeckCard
- [ ] Create `src/shared/ui/RadialMenu.jsx`

### Phase 3: Split Large Files (2-4 hours)
- [ ] Extract HexNode/HexMatrix from Dashboard
- [ ] Extract QuestDeckCard/QuestDeck/LogModal from QuestBoard
- [ ] Extract ProtocolDeckCard/ProtocolDeck/ProtocolListModal from HabitTracker

### Phase 4: Custom Hooks (2-3 hours)
- [ ] Create `useDeckNavigation` hook
- [ ] Refactor QuestBoard and HabitTracker to use it
- [ ] Add memoization throughout

### Phase 5: Optional - TypeScript Migration (8+ hours)
- [ ] Add type definitions for core data structures
- [ ] Convert context providers to TypeScript
- [ ] Convert components incrementally

---

## Summary Table

| Category | Priority | Effort | Items |
|----------|----------|--------|-------|
| Dead Code Removal | 🔴 High | Low | 3 items |
| Utility Extraction | 🔴 High | Low | 2 utilities |
| Component Extraction | 🟠 Medium | Medium | 3 base components |
| File Splitting | 🟠 Medium | Medium | 4 large files |
| Custom Hooks | 🟠 Medium | Medium | 2 hooks |
| Memoization | 🟡 Low | Low | 5+ locations |
| TypeScript | 🟡 Low | High | Full migration |
