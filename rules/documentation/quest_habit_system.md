# Quest & Habit System

LifeQuest uses a gamified system to encourage productivity. This document explains the mechanics of Quests, Protocols (Habits), and their associated rewards.

## Quests (Tasks)

Quests are one-time objectives with four defined difficulty levels. Each level provides a different amount of Experience Points (XP) and Credits.

### Difficulty & Default Rewards
| Difficulty | XP Reward | Credit Reward (Default) |
| :--- | :--- | :--- |
| **Easy** | 10 XP | 0.5 Credits |
| **Medium** | 25 XP | 1.5 Credits |
| **Hard** | 60 XP | 4 Credits |
| **Legendary** | 150 XP | 10 Credits |

*Note: Credit rewards for standard difficulties can be customized in the Settings menu.*

### Custom Rewards
Users can create "Custom Reward" quests, where the XP and Credits are manually specified at creation time. These quests ignore the default settings for credit rewards.

---

## Protocols (Habits)

Protocols are recurring actions on a daily, weekly, monthly (30-day), or custom interval.

### Completion
- **Complete**: Awards **5 XP**. Completing on the due day also awards the protocol's due-day bonus (default: the global Protocol Reward, 0.1 Credits).
- **Skip**: Starts a new cycle from today without a reward.
- **Passive income**: While active, a protocol pays its passive reward for each day between its last completion or skip and its due day. Completing, skipping, or pausing first pays any days still owed.

### Streak
The streak is derived from completion history, not stored: it counts consecutive completions, each made within the protocol's interval of the previous one. An active protocol whose current cycle is overdue has a streak of 0.

---

## The "Today's Focus" System

The Dashboard center-piece (Hexagonal Grid) displays a curated list of items the user should focus on **today**.

### What appears
1. **Quests**: Pending quests the user has selected for today.
2. **Protocols**: Active protocols that are due or overdue and not yet completed today. These appear automatically.

### Manual Management
Users select or remove pending quests via **Mission Control** on the Dashboard. Protocols cannot be selected manually; they follow their schedule.

---

## Leveling Mechanics

### Experience Points (XP)
XP is earned by completing quests and protocols. When XP exceeds `maxXp`, the user levels up.
- **Level Up**: Increases `maxXp` by 20% (cumulative growth).
- **Negative XP**: If XP drops below 0 due to an "Undo" action, the user may level down if they are above Level 1.

### Health
Health is calorie capacity: how much of today's calorie target remains. The Dashboard injector, the Health screen, and the assistant's `health` field all report this same value. There are no hit points; older saves and exports that contain `hp`/`maxHp` still import, and those fields are dropped.
