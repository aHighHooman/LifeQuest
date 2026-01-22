import React, { createContext, useContext, useState, useEffect } from 'react';
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

    const addRewardFromGold = (goldAmount) => {
        const usdValue = goldAmount / goldToUsdRatio;
        setEarnedRewards(prev => prev + usdValue);
    };

    const updatePrice = (name, price) => {
        setPriceDatabase(prev => ({ ...prev, [name]: parseFloat(price) }));
    };

    const addGroceryItem = (name, quantity = 1) => {
        const price = priceDatabase[name] || 0;
        const newItem = {
            id: Date.now().toString(),
            name,
            quantity,
            price,
            completed: false
        };
        setGroceryList(prev => [...prev, newItem]);
    };

    const toggleGroceryItem = (id) => {
        setGroceryList(prev => prev.map(item =>
            item.id === id ? { ...item, completed: !item.completed } : item
        ));
    };

    const removeGroceryItem = (id) => {
        setGroceryList(prev => prev.filter(item => item.id !== id));
    };

    const resetGroceryList = () => {
        setGroceryList(prev => prev.map(item => ({ ...item, completed: false })));
    };

    const clearGroceryList = () => {
        setGroceryList([]);
    };

    const totalGrocerySpent = groceryList
        .filter(item => item.completed)
        .reduce((sum, item) => sum + (item.price * item.quantity), 0);

    const totalGroceryEstimated = groceryList
        .reduce((sum, item) => sum + (item.price * item.quantity), 0);

    return (
        <BudgetContext.Provider value={{
            totalMonthlyBudget, setTotalMonthlyBudget,
            groceryAllocation, setGroceryAllocation,
            earnedRewards, setEarnedRewards,
            groceryList, setGroceryList,
            priceDatabase, updatePrice,
            groceryPeriod, setGroceryPeriod,
            goldToUsdRatio, setGoldToUsdRatio,
            addRewardFromGold,
            addGroceryItem, toggleGroceryItem, removeGroceryItem,
            resetGroceryList, clearGroceryList,
            totalGrocerySpent, totalGroceryEstimated
        }}>
            {children}
        </BudgetContext.Provider>
    );
};
