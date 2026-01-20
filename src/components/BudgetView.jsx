import React, { useState } from 'react';
import { useBudget } from '../context/BudgetContext';
import {
    Plus,
    Trash2,
    CheckCircle2,
    Circle,
    TrendingUp,
    ShoppingCart,
    DollarSign,
    Settings,
    ChevronDown,
    RefreshCw,
    Package
} from 'lucide-react';
import clsx from 'clsx';

const BudgetView = () => {
    const {
        totalMonthlyBudget, setTotalMonthlyBudget,
        groceryAllocation, setGroceryAllocation,
        earnedRewards,
        groceryList,
        priceDatabase, updatePrice,
        groceryPeriod, setGroceryPeriod,
        addGroceryItem, toggleGroceryItem, removeGroceryItem,
        resetGroceryList, clearGroceryList,
        totalGrocerySpent, totalGroceryEstimated,
        goldToUsdRatio, setGoldToUsdRatio
    } = useBudget();

    const [newItemName, setNewItemName] = useState('');
    const [newItemPrice, setNewItemPrice] = useState('');
    const [showSettings, setShowSettings] = useState(false);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    const handleAddItem = (e) => {
        e.preventDefault();
        if (!newItemName) return;

        const price = newItemPrice || priceDatabase[newItemName] || 0;
        if (price > 0) {
            updatePrice(newItemName, price);
        }
        addGroceryItem(newItemName);
        setNewItemName('');
        setNewItemPrice('');
        setIsDropdownOpen(false);
    };

    const selectFromDb = (name) => {
        setNewItemName(name);
        setNewItemPrice(priceDatabase[name] || '');
        setIsDropdownOpen(false);
    };

    const filteredDbItems = Object.keys(priceDatabase).filter(item =>
        item.toLowerCase().includes(newItemName.toLowerCase())
    );

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-32 md:pb-0">
            {/* Header / Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50 backdrop-blur-sm shadow-xl">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-game-accent/20 rounded-lg">
                            <DollarSign className="text-game-accent" size={20} />
                        </div>
                        <span className="text-sm font-game text-game-muted uppercase">Total Budget</span>
                    </div>
                    <p className="text-3xl font-black text-white">${totalMonthlyBudget}</p>
                </div>

                <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50 backdrop-blur-sm shadow-xl">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-game-gold/20 rounded-lg">
                            <ShoppingCart className="text-game-gold" size={20} />
                        </div>
                        <span className="text-sm font-game text-game-muted uppercase">Grocery Alloc</span>
                    </div>
                    <p className="text-3xl font-black text-white">${groceryAllocation}</p>
                    <div className="mt-2 text-xs text-game-muted">
                        Spent: <span className="text-white">${totalGrocerySpent.toFixed(2)}</span> / Est: ${totalGroceryEstimated.toFixed(2)}
                    </div>
                </div>

                <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50 backdrop-blur-sm shadow-xl relative overflow-hidden group">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-emerald-500/20 rounded-lg">
                            <TrendingUp className="text-emerald-500" size={20} />
                        </div>
                        <span className="text-sm font-game text-game-muted uppercase">Earned Rewards</span>
                    </div>
                    <p className="text-3xl font-black text-emerald-400">${earnedRewards.toFixed(2)}</p>
                    <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                        <TrendingUp size={60} />
                    </div>
                </div>
            </div>

            {/* Grocery Section */}
            <div className="bg-slate-800/40 rounded-3xl border border-slate-700/50 shadow-2xl">
                <div className="p-6 border-b border-slate-700/50 bg-slate-800/30 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-black text-white flex items-center gap-3">
                            <Package className="text-game-accent" />
                            GROCERY LIST
                        </h2>
                        <p className="text-xs text-game-muted mt-1 uppercase tracking-widest">{groceryPeriod} CYCLE</p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={resetGroceryList}
                            className="p-2 hover:bg-slate-700 rounded-lg text-game-muted transition-colors"
                            title="Reset completion"
                        >
                            <RefreshCw size={18} />
                        </button>
                        <button
                            onClick={() => setShowSettings(!showSettings)}
                            className={clsx(
                                "p-2 rounded-lg transition-colors",
                                showSettings ? "bg-game-accent text-slate-900" : "hover:bg-slate-700 text-game-muted"
                            )}
                        >
                            <Settings size={18} />
                        </button>
                    </div>
                </div>

                <div className="p-6">
                    {showSettings && (
                        <div className="mb-6 p-4 bg-slate-900/50 rounded-2xl border border-slate-700/30 space-y-4 animate-in slide-in-from-top-2 duration-300">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-game text-game-muted uppercase mb-1">Monthly Budget ($)</label>
                                    <input
                                        type="number"
                                        value={totalMonthlyBudget}
                                        onChange={(e) => setTotalMonthlyBudget(Number(e.target.value))}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none focus:border-game-accent transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-game text-game-muted uppercase mb-1">Grocery Allocation ($)</label>
                                    <input
                                        type="number"
                                        value={groceryAllocation}
                                        onChange={(e) => setGroceryAllocation(Number(e.target.value))}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none focus:border-game-accent transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-game text-game-muted uppercase mb-1">Frequency</label>
                                    <select
                                        value={groceryPeriod}
                                        onChange={(e) => setGroceryPeriod(e.target.value)}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none focus:border-game-accent transition-colors"
                                    >
                                        <option value="weekly">Weekly</option>
                                        <option value="bi-weekly">Bi-Weekly</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-game text-game-muted uppercase mb-1">Gold Reward Ratio (Gold:$1)</label>
                                    <input
                                        type="number"
                                        value={goldToUsdRatio}
                                        onChange={(e) => setGoldToUsdRatio(Number(e.target.value))}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none focus:border-game-accent transition-colors"
                                    />
                                </div>
                            </div>
                            <button
                                onClick={clearGroceryList}
                                className="w-full py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[10px] font-bold uppercase rounded-lg border border-red-500/20 transition-all"
                            >
                                Clear Current List
                            </button>

                            <div className="pt-4 border-t border-slate-700/50">
                                <h4 className="text-[10px] font-bold text-game-accent uppercase mb-3 tracking-widest flex items-center gap-2">
                                    <TrendingUp size={12} /> Master Price Database
                                </h4>
                                <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto no-scrollbar pr-1">
                                    {Object.keys(priceDatabase).length === 0 ? (
                                        <p className="text-[10px] text-gray-600 italic">No historical price data established.</p>
                                    ) : (
                                        Object.entries(priceDatabase).map(([name, price]) => (
                                            <div key={name} className="flex items-center justify-between p-2 rounded bg-slate-800 border border-slate-700">
                                                <span className="text-xs text-slate-300">{name}</span>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-mono text-game-gold">${price.toFixed(2)}</span>
                                                    <button
                                                        onClick={() => {
                                                            const newPrice = prompt(`Update price for ${name}:`, price);
                                                            if (newPrice !== null && !isNaN(newPrice)) updatePrice(name, newPrice);
                                                        }}
                                                        className="p-1 hover:bg-slate-700 rounded text-game-muted hover:text-game-accent transition-colors"
                                                    >
                                                        <Settings size={12} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    <form onSubmit={handleAddItem} className="mb-6 relative">
                        <div className="flex gap-2">
                            <div className="flex-1 relative">
                                <input
                                    type="text"
                                    placeholder="Add grocery item..."
                                    value={newItemName}
                                    onChange={(e) => {
                                        setNewItemName(e.target.value);
                                        setIsDropdownOpen(true);
                                    }}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-game-accent transition-all pl-10"
                                />
                                <ShoppingCart className="absolute left-3 top-3.5 text-slate-500" size={18} />

                                {isDropdownOpen && filteredDbItems.length > 0 && newItemName && (
                                    <div className="absolute top-full left-0 right-0 mt-2 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden max-h-48 overflow-y-auto">
                                        {filteredDbItems.map(item => (
                                            <button
                                                key={item}
                                                type="button"
                                                onClick={() => selectFromDb(item)}
                                                className="w-full text-left px-4 py-2 hover:bg-slate-700 text-sm text-white flex justify-between items-center"
                                            >
                                                <span>{item}</span>
                                                <span className="text-game-muted">${priceDatabase[item]}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="w-24">
                                <input
                                    type="number"
                                    step="0.01"
                                    placeholder="$"
                                    value={newItemPrice}
                                    onChange={(e) => setNewItemPrice(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-game-accent transition-all"
                                />
                            </div>
                            <button
                                type="submit"
                                className="bg-game-accent hover:bg-game-accent/80 text-slate-900 p-3 rounded-xl transition-all shadow-lg shadow-game-accent/20"
                            >
                                <Plus size={24} />
                            </button>
                        </div>
                    </form>

                    <div className="space-y-3">
                        {groceryList.map(item => (
                            <div
                                key={item.id}
                                className={clsx(
                                    "group flex items-center justify-between p-4 rounded-2xl border transition-all duration-300",
                                    item.completed
                                        ? "bg-slate-900/30 border-slate-800 text-slate-600"
                                        : "bg-slate-800/20 border-slate-700/50 hover:border-game-accent/50 text-white"
                                )}
                            >
                                <div className="flex items-center gap-4">
                                    <button
                                        onClick={() => toggleGroceryItem(item.id)}
                                        className={clsx(
                                            "transition-colors",
                                            item.completed ? "text-emerald-500" : "text-slate-600 hover:text-game-accent"
                                        )}
                                    >
                                        {item.completed ? <CheckCircle2 size={24} /> : <Circle size={24} />}
                                    </button>
                                    <div>
                                        <p className={clsx("font-bold", item.completed && "line-through text-slate-500")}>{item.name}</p>
                                        <p className="text-[10px] text-game-muted font-mono uppercase">Database Price: ${item.price.toFixed(2)}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className="font-mono text-sm text-game-gold">${item.price.toFixed(2)}</span>
                                    <button
                                        onClick={() => removeGroceryItem(item.id)}
                                        className="p-2 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                        ))}

                        {groceryList.length === 0 && (
                            <div className="text-center py-12 text-slate-600 border-2 border-dashed border-slate-800 rounded-3xl">
                                <p className="font-game uppercase tracking-[0.2em] text-sm">Inventory Empty</p>
                                <p className="text-xs mt-2">Add items to start tracking your budget</p>
                            </div>
                        )}
                    </div>

                    {groceryList.length > 0 && (
                        <div className="mt-8 pt-6 border-t border-slate-700/50 space-y-4">
                            <div className="flex justify-between items-end">
                                <div>
                                    <p className="text-xs text-game-muted font-game uppercase">Estimated Total</p>
                                    <p className="text-2xl font-black text-white">${totalGroceryEstimated.toFixed(2)}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-emerald-500 font-game uppercase">Actual Spent</p>
                                    <p className="text-2xl font-black text-emerald-400">${totalGrocerySpent.toFixed(2)}</p>
                                </div>
                            </div>

                            <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-700">
                                <div
                                    className={clsx(
                                        "h-full transition-all duration-500 rounded-full",
                                        totalGroceryEstimated > groceryAllocation ? "bg-red-500" : "bg-game-accent"
                                    )}
                                    style={{ width: `${Math.min(100, (totalGroceryEstimated / groceryAllocation) * 100)}%` }}
                                />
                            </div>
                            <div className="flex justify-between text-[10px] font-game text-game-muted uppercase">
                                <span>0%</span>
                                <span>Budget: ${groceryAllocation}</span>
                                <span className={clsx(totalGroceryEstimated > groceryAllocation && "text-red-400 font-bold")}>
                                    {((totalGroceryEstimated / groceryAllocation) * 100).toFixed(0)}%
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BudgetView;
