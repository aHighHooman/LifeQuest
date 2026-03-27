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
            quantity,
            price,
            completed: false
        };
        setGroceryList(prev => [...prev, newItem]);
    }, [priceDatabase, setGroceryList]);

    const toggleGroceryItem = useCallback((id) => {
        setGroceryList(prev => prev.map(item =>
            item.id === id ? { ...item, completed: !item.completed } : item
        ));
    }, [setGroceryList]);

    const removeGroceryItem = useCallback((id) => {
        setGroceryList(prev => prev.filter(item => item.id !== id));
    }, [setGroceryList]);

    const resetGroceryList = useCallback(() => {
        setGroceryList(prev => prev.map(item => ({ ...item, completed: false })));
    }, [setGroceryList]);

    const clearGroceryList = useCallback(() => {
        setGroceryList([]);
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
        priceDatabase, updatePrice,
        groceryPeriod, setGroceryPeriod,
        goldToUsdRatio, setGoldToUsdRatio,
        addRewardFromGold, removeRewardFromGold,
        addGroceryItem, toggleGroceryItem, removeGroceryItem,
        resetGroceryList, clearGroceryList,
        totalGrocerySpent, totalGroceryEstimated
    }), [
        totalMonthlyBudget, setTotalMonthlyBudget,
        groceryAllocation, setGroceryAllocation,
        earnedRewards, setEarnedRewards,
        groceryList, setGroceryList,
        priceDatabase, updatePrice,
        groceryPeriod, setGroceryPeriod,
        goldToUsdRatio, setGoldToUsdRatio,
        addRewardFromGold, removeRewardFromGold,
        addGroceryItem, toggleGroceryItem, removeGroceryItem,
        resetGroceryList, clearGroceryList,
        totalGrocerySpent, totalGroceryEstimated
    ]);

    return (
        <BudgetContext.Provider value={contextValue}>
            {children}
        </BudgetContext.Provider>
    );
};
