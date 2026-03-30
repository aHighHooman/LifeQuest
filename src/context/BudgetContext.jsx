/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useMemo } from 'react';
import { usePersistentState } from '../utils/persistence';

const BudgetContext = createContext();

export const useBudget = () => useContext(BudgetContext);

const INITIAL_GROCERY_ITEMS = []; // { id, name, quantity, price, completed }
const INITIAL_PRICE_DB = {}; // { "Milk": 4.00 }

export const BudgetProvider = ({ children }) => {
    const [totalMonthlyBudget, setTotalMonthlyBudget] = usePersistentState('lq_budget_total', 0);
    const [groceryAllocation, setGroceryAllocation] = usePersistentState('lq_budget_grocery_alloc', 0);
    const [earnedRewards, setEarnedRewards] = usePersistentState('lq_budget_earned', 0);
    const [groceryList, setGroceryList] = usePersistentState('lq_grocery_list', INITIAL_GROCERY_ITEMS);
    const [priceDatabase, setPriceDatabase] = usePersistentState('lq_price_db', INITIAL_PRICE_DB);
    const [groceryPeriod, setGroceryPeriod] = usePersistentState('lq_grocery_period', 'weekly');
    const [stipendAmount, setStipendAmount] = usePersistentState('lq_budget_stipend_amount', 0);
    const [stipendPeriod, setStipendPeriod] = usePersistentState('lq_budget_stipend_period', 'weekly');
    const [stipendPaidThrough, setStipendPaidThrough] = usePersistentState('lq_budget_stipend_paid_through', null);
    const [goldToUsdRatio, setGoldToUsdRatio] = usePersistentState('lq_gold_ratio', 10);

    const addRewardFromGold = useCallback((goldAmount) => {
        const usdValue = goldAmount / goldToUsdRatio;
        setEarnedRewards(prev => prev + usdValue);
    }, [goldToUsdRatio, setEarnedRewards]);

    const removeRewardFromGold = useCallback((goldAmount) => {
        const usdValue = Number(goldAmount) / goldToUsdRatio;
        setEarnedRewards(prev => prev - usdValue);
    }, [goldToUsdRatio, setEarnedRewards]);

    const updatePrice = useCallback((name, price) => {
        setPriceDatabase(prev => ({ ...prev, [name]: parseFloat(price) }));
    }, [setPriceDatabase]);

    const addGroceryItem = useCallback((name, quantity = 1) => {
        const price = priceDatabase[name] || 0;
        const newItem = {
            id: Date.now().toString(),
            name,
            quantity: Math.max(1, Number(quantity) || 1),
            price,
            completed: false,
            completedDateKey: null,
            completedAt: null
        };
        setGroceryList(prev => [...prev, newItem]);
    }, [priceDatabase, setGroceryList]);

    const markGroceryItemCompleted = useCallback((id, dateKey) => {
        setGroceryList(prev => prev.map(item =>
            item.id === id
                ? {
                    ...item,
                    completed: true,
                    completedDateKey: dateKey,
                    completedAt: new Date().toISOString()
                }
                : item
        ));
    }, [setGroceryList]);

    const unmarkGroceryItemCompleted = useCallback((id) => {
        setGroceryList(prev => prev.map(item =>
            item.id === id
                ? {
                    ...item,
                    completed: false,
                    completedDateKey: null,
                    completedAt: null
                }
                : item
        ));
    }, [setGroceryList]);

    const removeGroceryItem = useCallback((id) => {
        setGroceryList(prev => prev.filter(item => item.id !== id));
    }, [setGroceryList]);

    const resetGroceryList = useCallback(() => {
        setGroceryList(prev => prev.map(item => ({
            ...item,
            completed: false,
            completedDateKey: null,
            completedAt: null
        })));
    }, [setGroceryList]);

    const clearGroceryList = useCallback(() => {
        setGroceryList([]);
    }, [setGroceryList]);

    const removeCompletedGroceriesBefore = useCallback((todayKey) => {
        setGroceryList(prev => prev.filter(item => {
            if (!item.completed) return true;
            if (!item.completedDateKey) return false;
            return item.completedDateKey >= todayKey;
        }));
    }, [setGroceryList]);

    const totalGrocerySpent = useMemo(() => groceryList
        .filter(item => item.completed)
        .reduce((sum, item) => sum + (item.price * item.quantity), 0), [groceryList]);

    const totalGroceryEstimated = useMemo(() => groceryList
        .reduce((sum, item) => sum + (item.price * item.quantity), 0), [groceryList]);

    const contextValue = useMemo(() => ({
        totalMonthlyBudget, setTotalMonthlyBudget,
        groceryAllocation, setGroceryAllocation,
        earnedRewards, setEarnedRewards,
        groceryList, setGroceryList,
        priceDatabase, setPriceDatabase, updatePrice,
        groceryPeriod, setGroceryPeriod,
        stipendAmount, setStipendAmount,
        stipendPeriod, setStipendPeriod,
        stipendPaidThrough, setStipendPaidThrough,
        goldToUsdRatio, setGoldToUsdRatio,
        addRewardFromGold, removeRewardFromGold,
        addGroceryItem, markGroceryItemCompleted, unmarkGroceryItemCompleted, removeGroceryItem,
        resetGroceryList, clearGroceryList, removeCompletedGroceriesBefore,
        totalGrocerySpent, totalGroceryEstimated
    }), [
        totalMonthlyBudget, setTotalMonthlyBudget,
        groceryAllocation, setGroceryAllocation,
        earnedRewards, setEarnedRewards,
        groceryList, setGroceryList,
        priceDatabase, setPriceDatabase, updatePrice,
        groceryPeriod, setGroceryPeriod,
        stipendAmount, setStipendAmount,
        stipendPeriod, setStipendPeriod,
        stipendPaidThrough, setStipendPaidThrough,
        goldToUsdRatio, setGoldToUsdRatio,
        addRewardFromGold, removeRewardFromGold,
        addGroceryItem, markGroceryItemCompleted, unmarkGroceryItemCompleted, removeGroceryItem,
        resetGroceryList, clearGroceryList, removeCompletedGroceriesBefore,
        totalGrocerySpent, totalGroceryEstimated
    ]);

    return (
        <BudgetContext.Provider value={contextValue}>
            {children}
        </BudgetContext.Provider>
    );
};
