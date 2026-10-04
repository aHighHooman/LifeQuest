import { useEffect, useRef } from 'react';
import { useAppState } from '../context/AppStateContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useCloudSync } from '../context/CloudSyncContext.jsx';
import { createTransactionEvent } from '../context/GameContext.jsx';
import { settleDaily } from '../domain/settlement.js';
import { AUTH_SURFACES } from '../constants/cloudAccess.js';

const PULL_BEFORE_SETTLING_TIMEOUT_MS = 8000;

// Settling a new day is a local write. With sync on, the cloud copy is pulled
// first, so changes the assistant or another device made since the last sync
// import cleanly instead of colliding with this device's settlement. A slow or
// offline pull falls back to settling locally.
export const useDailySettlement = () => {
    const { state, updateState } = useAppState();
    const { surface } = useAuth();
    const { ready, active, syncNow } = useCloudSync();
    const pulledDayRef = useRef(null);
    const pendingDayRef = useRef(null);
    const { stats, habits, settings, calories, budget } = state;

    useEffect(() => {
        const event = createTransactionEvent();
        if (stats.lastLoginDate === event.todayKey || !ready) return;
        // The LLM page only works on its synced copy; settle once it is loaded.
        if (surface === AUTH_SURFACES.LLM && !active) return;

        if (active && pulledDayRef.current !== event.todayKey) {
            if (pendingDayRef.current === event.todayKey) return;
            pendingDayRef.current = event.todayKey;
            const timeout = new Promise((resolve) => {
                window.setTimeout(resolve, PULL_BEFORE_SETTLING_TIMEOUT_MS);
            });
            Promise.race([syncNow().catch(() => {}), timeout]).finally(() => {
                pulledDayRef.current = event.todayKey;
                pendingDayRef.current = null;
                updateState((previous) => settleDaily(previous, createTransactionEvent()));
            });
            return;
        }

        updateState((previous) => settleDaily(previous, event));
    }, [habits, settings.protocolReward, stats.lastLoginDate, calories.passiveCheckpointDate,
        budget.stipendAmount, budget.stipendPeriod, budget.stipendPaidThrough,
        ready, active, surface, syncNow, updateState]);
};
