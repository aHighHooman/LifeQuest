/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { APP_CHECKPOINT_KEY, createAppCheckpoint, readAppState } from '../utils/appStatePersistence.js';
import { usePersistedValue } from '../utils/persistence.js';

const AppStateContext = createContext();
export const useAppState = () => useContext(AppStateContext);

export const AppStateProvider = ({ children }) => {
    const [state, updateState] = useState(readAppState);
    const checkpoint = useMemo(() => createAppCheckpoint(state), [state]);
    usePersistedValue(APP_CHECKPOINT_KEY, checkpoint);
    const value = useMemo(() => ({ state, updateState }), [state]);

    return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
};

// Existing screen APIs can update one field without owning another copy of it.
export const useAppStateField = (section) => {
    const { state, updateState } = useAppState();
    const setValue = useCallback((update) => {
        updateState((previous) => {
            const current = previous[section];
            const next = typeof update === 'function' ? update(current) : update;
            if (Object.is(current, next)) return previous;
            return {
                ...previous,
                [section]: next
            };
        });
    }, [section, updateState]);

    return [state[section], setValue];
};
