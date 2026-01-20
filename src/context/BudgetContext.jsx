import React, { createContext, useContext, useState, useEffect } from 'react';

const BudgetContext = createContext();

export const useBudget = () => useContext(BudgetContext);

const INITIAL_GROCERY_ITEMS = []; // { id, name, quantity, price, completed }
const INITIAL_PRICE_DB = {}; // { "Milk": 4.00 }

export const BudgetProvider = ({ children }) => {
    const [totalMonthlyBudget, setTotalMonthlyBudget] = useState(() => {
        const saved = localStorage.getItem('lq_budget_total');
        return saved ? JSON.parse(saved) : 400;
    });

    const [groceryAllocation, setGroceryAllocation] = useState(() => {
        const saved = localStorage.getItem('lq_budget_grocery_alloc');
        return saved ? JSON.parse(saved) : 250;
    });

    const [earnedRewards, setEarnedRewards] = useState(() => {
        const saved = localStorage.getItem('lq_budget_earned');
        return saved ? JSON.parse(saved) : 0;
    });

    const [groceryList, setGroceryList] = useState(() => {
        const saved = localStorage.getItem('lq_grocery_list');
        return saved ? JSON.parse(saved) : INITIAL_GROCERY_ITEMS;
    });

    const [priceDatabase, setPriceDatabase] = useState(() => {
        const saved = localStorage.getItem('lq_price_db');
        return saved ? JSON.parse(saved) : INITIAL_PRICE_DB;
    });

    const [groceryPeriod, setGroceryPeriod] = useState(() => {
        const saved = localStorage.getItem('lq_grocery_period');
        return saved ? JSON.parse(saved) : 'weekly'; // 'weekly' or 'bi-weekly'
    });

    const [goldToUsdRatio, setGoldToUsdRatio] = useState(() => {
        const saved = localStorage.getItem('lq_gold_ratio');
        return saved ? JSON.parse(saved) : 10; // 10 gold = $1
    });

    useEffect(() => {
        localStorage.setItem('lq_budget_total', JSON.stringify(totalMonthlyBudget));
        localStorage.setItem('lq_budget_grocery_alloc', JSON.stringify(groceryAllocation));
        localStorage.setItem('lq_budget_earned', JSON.stringify(earnedRewards));
        localStorage.setItem('lq_grocery_list', JSON.stringify(groceryList));
        localStorage.setItem('lq_price_db', JSON.stringify(priceDatabase));
        localStorage.setItem('lq_grocery_period', JSON.stringify(groceryPeriod));
        localStorage.setItem('lq_gold_ratio', JSON.stringify(goldToUsdRatio));
    }, [totalMonthlyBudget, groceryAllocation, earnedRewards, groceryList, priceDatabase, groceryPeriod, goldToUsdRatio]);

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
