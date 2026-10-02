import { useCallback, useMemo } from 'react';
import { useAppStateField } from '../context/AppStateContext.jsx';
import { createId } from '../domain/gameState.js';

const EDITABLE_BUDGET_FIELDS = [
    'totalMonthlyBudget', 'groceryAllocation', 'groceryPeriod',
    'stipendAmount', 'stipendPeriod', 'stipendPaidThrough', 'goldToUsdRatio'
];

// A budget view of the same state used by quests, food, and the wallet.
export const useBudget = () => {
    const [budget, setBudget] = useAppStateField('budget');
    const setters = useMemo(() => Object.fromEntries(EDITABLE_BUDGET_FIELDS.map((field) => [
        `set${field[0].toUpperCase()}${field.slice(1)}`,
        (update) => setBudget((previous) => ({
            ...previous,
            [field]: typeof update === 'function' ? update(previous[field]) : update
        }))
    ])), [setBudget]);

    const updatePrice = useCallback((name, price) => {
        setBudget((previous) => ({
            ...previous, priceDatabase: { ...previous.priceDatabase, [name]: Number(price) || 0 }
        }));
    }, [setBudget]);

    const addGroceryItem = useCallback((name, quantity = 1, price) => {
        const id = createId('grocery');
        setBudget((previous) => {
            const itemPrice = price === undefined ? previous.priceDatabase[name] || 0 : Number(price) || 0;
            return {
                ...previous,
                priceDatabase: price === undefined ? previous.priceDatabase : { ...previous.priceDatabase, [name]: itemPrice },
                groceryList: [...previous.groceryList, {
                    id, name, quantity: Math.max(1, Number(quantity) || 1), price: itemPrice,
                    completed: false, completedDateKey: null, completedAt: null
                }]
            };
        });
    }, [setBudget]);

    const removeGroceryItem = useCallback((id) => {
        setBudget((previous) => ({ ...previous, groceryList: previous.groceryList.filter((item) => item.id !== id) }));
    }, [setBudget]);

    const clearGroceryList = useCallback(() => {
        setBudget((previous) => ({ ...previous, groceryList: [] }));
    }, [setBudget]);

    return useMemo(() => ({
        ...budget,
        ...setters,
        updatePrice,
        addGroceryItem,
        removeGroceryItem,
        clearGroceryList,
        totalGroceryEstimated: budget.groceryList.reduce((sum, item) => sum + item.price * item.quantity, 0)
    }), [addGroceryItem, budget, clearGroceryList, removeGroceryItem, setters, updatePrice]);
};
