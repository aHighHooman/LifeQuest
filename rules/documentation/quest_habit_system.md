# Quest & Habit System

LifeQuest uses a gamified system to encourage productivity. This document explains the mechanics of Quests, Protocols (Habits), and their associated rewards.

## Quests (Tasks)

Quests are one-time objectives with four defined difficulty levels. Each level provides a different amount of Experience Points (XP) and Gold.

### Difficulty & Default Rewards
| Difficulty | XP Reward | Gold Reward (Default) |
| :--- | :--- | :--- |
| **Easy** | 10 XP | 5 Gold |
| **Medium** | 25 XP | 15 Gold |
| **Hard** | 60 XP | 40 Gold |
| **Legendary** | 150 XP | 100 Gold |

*Note: Gold rewards for standard difficulties can be customized in the Settings menu.*

### Custom Rewards
Users can create "Custom Reward" quests, where the XP and Gold are manually specified at creation time. These quests ignore the default settings for gold rewards.

---

## Protocols (Habits)

Protocols are recurring actions. Unlike Quests, they have a "Streak" counter.

### Completion
- **Positive Check**: Awards **5 XP** and the global **Protocol Reward** amount (default: 1 Gold). Increases the habit's streak.
- **Negative Check (Failure)**: Deducts **5 HP**. Resets the habit's streak to 0.

---

## The "Today's Focus" System

The Dashboard center-piece (Hexagonal Grid) displays a curated list of items the user should focus on **today**.

### Automatic Population
Every time the app is launched on a new day:
1. **Quests Due**: Any quest with a `dueDate` matching today is automatically added to the "Focus" list.
2. **Protocols Due**: Any habit that is flagged as `isActive` and has reached its frequency interval (calculated by `getDaysUntilDue`) is automatically added.
3. **Calorie Reset**: Daily calorie intake is reset to 0.

### Manual Management
Users can manually add or remove any pending quest or protocol from the focus list via the **"Manage" (Mission Control)** button on the Dashboard.

---

## Leveling Mechanics

### Experience Points (XP)
XP is earned by completing quests and protocols. When XP exceeds `maxXp`, the user levels up.
- **Level Up**: Restores HP to full. Increases `maxXp` by 20% (cumulative growth).
- **Negative XP**: If XP drops below 0 due to an "Undo" action, the user may level down if they are above Level 1.

### Health Points (HP)
HP represents the user's "resilience." It is lost when habits are failed. Currently, dropping to 0 HP does not have a "Game Over" effect, but it serves as a visual indicator of low consistency.
