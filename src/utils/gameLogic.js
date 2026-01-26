
export const getDaysUntilDue = (habit) => {
    // If no history, it's due
    if (!habit.history || Object.keys(habit.history).length === 0) return 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sortedDates = Object.keys(habit.history).sort();
    const lastDateIso = sortedDates.pop();
    const lastDate = new Date(lastDateIso);
    lastDate.setHours(0, 0, 0, 0);

    // Calculate diff
    const diffTime = today - lastDate;
    const daysSinceLast = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    let interval = 1; // Default daily
    if (habit.frequency === 'weekly') interval = 7;
    if (habit.frequency === 'monthly') interval = 30;
    if (habit.frequency === 'interval') interval = habit.frequencyParam || 1;

    // Days remaining until due
    const daysUntil = interval - daysSinceLast;
    return daysUntil;
};
