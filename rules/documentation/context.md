# Context & State Management

The application relies heavily on React's Context API to share state across the component tree without prop drilling.

## GameContext (`src/context/GameContext.jsx`)

The `GameContext` is the "brain" of the application, managing all gamified elements and core functional data.

### State Variables
- **`stats`**: An object containing:
  - `level`: User's current level.
  - `xp`: Current experience points.
  - `maxXp`: Points required for the next level.
  - `hp`: Current health points (lost if habits are checked negatively).
  - `gold`: Virtual currency earned from tasks.
- **`quests`**: An array of quest objects.
- **`habits`**: An array of protocol (habit) objects.
- **`settings`**: Configuration for rewards (protocol rewards, quest rewards by difficulty).
- **`calories`**: Daily tracking information (current, target, history).
- **`coinHistory`**: A log of all gold transactions (earning and spending).

### Key Functions
- **`addQuest(title, difficulty, ...)`**: Creates a new quest.
- **`completeQuest(id)`**: Marks a quest as done, awards XP and Gold, and triggers the `BudgetContext` reward logic.
- **`addHabit(title, frequency, ...)`**: Adds a new protocol to the tracker.
- **`checkHabit(id, direction)`**: Logs a habit completion (+XP/Gold) or failure (-HP).
- **`toggleToday(id, type)`**: Adds or removes a quest/habit from the "Today's Focus" list on the dashboard.
- **`addXp(amount)`**: Increments XP and handles leveling up (or down if negative).
- **`spendCoins(amount, description)`**: Deducts gold from the user's total.

### Automatic Logic
- **Daily Reset**: When the app is opened on a new day, it:
  - Resets "isToday" focus list.
  - Auto-populates "isToday" with quests and habits due that day.
  - Resets daily calorie count.

---

## BudgetContext (`src/context/BudgetContext.jsx`)

The `BudgetContext` handles the physical financial tracking, which is decoupled but influenced by the gold system.

### State Variables
- **`transactions`**: List of all bank/cash movements.
- **`categories`**: User-defined budgeting categories.
- **`vault`**: Total savings or current balance.

### Integration with Gold
When a user earns **Gold** in the `GameContext`, the `BudgetContext`'s `addRewardFromGold` function is triggered. This maintains a link between the gamified rewards and the actual budget if the user chooses to treat gold as "real" spendable reward money.
