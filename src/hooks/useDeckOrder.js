import { useCallback, useMemo, useState } from 'react';

const reconcileOrder = (currentOrder, itemIds) => {
    const nextIds = itemIds.filter(Boolean);
    const nextIdSet = new Set(nextIds);
    const keptIds = currentOrder.filter((id) => nextIdSet.has(id));
    const knownIds = new Set(keptIds);
    const addedIds = nextIds.filter((id) => !knownIds.has(id));

    return [...keptIds, ...addedIds];
};

export const useDeckOrder = (itemIds = []) => {
    const stableItemIds = useMemo(() => itemIds.filter(Boolean), [itemIds]);
    const [order, setOrder] = useState(() => stableItemIds);

    const orderedIds = useMemo(() => reconcileOrder(order, stableItemIds), [order, stableItemIds]);

    const next = useCallback((id) => {
        setOrder((currentOrder) => {
            const reconciled = reconcileOrder(currentOrder, stableItemIds);
            if (!reconciled.includes(id)) return reconciled;
            return [...reconciled.filter((itemId) => itemId !== id), id];
        });
    }, [stableItemIds]);

    const prev = useCallback(() => {
        setOrder((currentOrder) => {
            const reconciled = reconcileOrder(currentOrder, stableItemIds);
            if (reconciled.length <= 1) return reconciled;
            const previousId = reconciled[reconciled.length - 1];
            return [previousId, ...reconciled.slice(0, -1)];
        });
    }, [stableItemIds]);

    const dismiss = useCallback((id) => {
        setOrder((currentOrder) => reconcileOrder(currentOrder, stableItemIds).filter((itemId) => itemId !== id));
    }, [stableItemIds]);

    const reset = useCallback(() => {
        setOrder(stableItemIds);
    }, [stableItemIds]);

    return {
        orderedIds,
        next,
        prev,
        complete: dismiss,
        dismiss,
        reset
    };
};
