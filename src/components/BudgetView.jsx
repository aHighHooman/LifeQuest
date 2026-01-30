import React, { useState, useRef } from 'react';
import { useBudget } from '../context/BudgetContext';
import {
    Plus,
    Trash2,
    CheckCircle2,
    Circle,
    ShoppingCart,
    DollarSign,
    Settings,
    RefreshCw,
    Coins,
    Minus,
    CreditCard,
    ArrowRightLeft,
    X,
    Database
} from 'lucide-react';
import { useGame } from '../context/GameContext';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';

// Constants
const TAB_PROVISIONS = 'provisions';
const TAB_LEDGER = 'ledger';

const CoinSwitch = ({ onClick }) => {
    const [spinCount, setSpinCount] = useState(0);
    const rotating = useRef(false);

    const handleClick = (e) => {
        if (e) e.stopPropagation();
        if (rotating.current) return;
        rotating.current = true;
        setSpinCount(prev => prev + 1);
        if (onClick) onClick(e);
        setTimeout(() => { rotating.current = false; }, 900);
    };

    return (
        <div className="relative z-50 overflow-visible">
            <button
                onClick={handleClick}
                style={{ pointerEvents: 'auto', perspective: '1000px' }}
                className="relative w-28 h-28 group"
            >
                <motion.div
                    className="w-full h-full relative preserve-3d"
                    initial={false}
                    animate={{ rotateY: spinCount * 180 }}
                    transition={{ duration: 0.9, ease: [0.22, 0.9, 0.3, 1] }}
                    style={{ transformStyle: 'preserve-3d' }}
                >
                    {/* THICKNESS / EDGE LAYERS (The "meat" of the coin) */}
                    {/* We stack discs between Front (Z=6) and Back (Z=-6) */}
                    {[4, 3, 2, 1, 0, -1, -2, -3, -4].map((z) => (
                        <div
                            key={z}
                            className="absolute inset-0 rounded-full bg-amber-800 border-2 border-amber-900/50"
                            style={{ transform: `translateZ(${z}px)` }}
                        />
                    ))}

                    {/* FRONT FACE (Provisions) */}
                    <div
                        className="absolute inset-0 rounded-full bg-gradient-to-br from-amber-300 via-amber-500 to-amber-700 shadow-[0_0_15px_rgba(251,191,36,0.5)] border-4 border-amber-400/50 flex flex-col items-center justify-center backface-hidden"
                        style={{
                            backfaceVisibility: 'hidden',
                            transform: 'translateZ(6px)' // Moved forward
                        }}
                    >
                        <div className="absolute inset-1 rounded-full border border-amber-900/20" />
                        <div className="absolute inset-[6px] rounded-full border border-amber-100/30" />

                        {/* SVG Rim (Restored) */}
                        <div className="absolute inset-0 pointer-events-none opacity-50">
                            <svg width="100%" height="100%" viewBox="0 0 100 100" className="rounded-full">
                                <circle cx="50" cy="50" r="46" fill="none" stroke="#78350f" strokeWidth="2" />
                            </svg>
                        </div>

                        <ShoppingCart size={32} className="text-amber-900 drop-shadow-sm mb-1" />
                        <span className="text-[10px] font-black text-amber-900 uppercase tracking-widest drop-shadow-sm">Provisions</span>

                        {/* Shine Effect */}
                        <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-transparent via-white/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>

                    {/* BACK FACE (Ledger) */}
                    <div
                        className="absolute inset-0 rounded-full bg-gradient-to-br from-amber-400 via-amber-600 to-amber-800 shadow-[0_0_15px_rgba(251,191,36,0.5)] border-4 border-amber-400/50 flex flex-col items-center justify-center backface-hidden"
                        style={{
                            backfaceVisibility: 'hidden',
                            transform: 'rotateY(180deg) translateZ(6px)' // Rotated and moved "forward" (which is backward relative to scene)
                        }}
                    >
                        <div className="absolute inset-1 rounded-full border border-amber-900/20" />
                        <div className="absolute inset-[6px] rounded-full border border-amber-100/30" />

                        {/* SVG Rim (Restored) */}
                        <div className="absolute inset-0 pointer-events-none opacity-50">
                            <svg width="100%" height="100%" viewBox="0 0 100 100" className="rounded-full">
                                <circle cx="50" cy="50" r="46" fill="none" stroke="#78350f" strokeWidth="2" />
                            </svg>
                        </div>

                        <CreditCard size={32} className="text-amber-100 drop-shadow-sm mb-1" />
                        <span className="text-[10px] font-black text-amber-100 uppercase tracking-widest drop-shadow-sm">Ledger</span>

                        {/* Shine Effect */}
                        <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-transparent via-white/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                </motion.div>

                {/* Shadow underneath */}
                <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-20 h-5 bg-black/60 blur-xl rounded-[100%] pointer-events-none transition-transform duration-1000"
                    style={{ transform: `translateX(-50%) scale(${rotating.current ? 0.8 : 1})` }}
                />
            </button>
        </div>
    );
};

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

    const [activeTab, setActiveTab] = useState(TAB_PROVISIONS);
    const [showSettings, setShowSettings] = useState(false);

    // --- CURRENCY HELPERS ---
    // The backend (Context) stores values in USD (standard unit).
    // The UI (BudgetView) displays values in "Credits" (Gold), based on the exchange rate.

    // Display: USD -> Credits
    const toCredits = (usdAmount) => {
        return (usdAmount * goldToUsdRatio).toFixed(0);
    };

    // Input: Credits -> USD
    const fromCredits = (creditAmount) => {
        if (!creditAmount) return 0;
        return Number(creditAmount) / goldToUsdRatio;
    };

    const formatCredits = (usdAmount) => {
        return Math.floor(usdAmount * goldToUsdRatio).toLocaleString();
    }



    // --- SUB-COMPONENTS ---



    const VaultHeader = () => (
        <div className="shrink-0 grid grid-cols-3 gap-2 p-2 bg-black/40 border-b border-amber-900/50 backdrop-blur-md z-20" style={{ touchAction: 'none' }}>
            <div className="bg-amber-950/30 border border-amber-500/20 rounded p-2 flex flex-col justify-center items-center relative overflow-hidden group">
                <div className="absolute inset-0 bg-amber-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                <span className="text-[9px] font-bold text-amber-500/60 uppercase tracking-widest mb-0.5">Budget</span>
                <div className="flex items-center gap-1">
                    <Coins size={14} className="text-amber-500" />
                    <span className="text-lg font-black font-game text-amber-100 leading-none shadow-amber-glow">{formatCredits(totalMonthlyBudget)}</span>
                </div>
            </div>
            <div className="bg-amber-950/30 border border-amber-500/20 rounded p-2 flex flex-col justify-center items-center relative overflow-hidden group">
                <div className="absolute inset-0 bg-amber-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                <span className="text-[9px] font-bold text-amber-500/60 uppercase tracking-widest mb-0.5">Allocated</span>
                <div className="flex items-center gap-1">
                    <Coins size={14} className="text-amber-500" />
                    <span className="text-lg font-black font-game text-amber-100 leading-none shadow-amber-glow">{formatCredits(groceryAllocation)}</span>
                </div>
            </div>
            <div className="bg-amber-950/30 border border-amber-500/20 rounded p-2 flex flex-col justify-center items-center relative overflow-hidden group">
                <div className="absolute inset-0 bg-amber-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                <span className="text-[9px] font-bold text-amber-400/80 uppercase tracking-widest mb-0.5">Liquid Assets</span>
                <div className="flex items-center gap-1">
                    <Coins size={14} className="text-amber-400" />
                    <span className="text-lg font-black font-game text-amber-400 leading-none drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]">{formatCredits(earnedRewards)}</span>
                </div>
            </div>
        </div>
    );

    const SettingsModal = () => (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={() => setShowSettings(false)}>
            <div className="bg-slate-900 border border-amber-500/30 rounded-2xl w-full max-w-sm max-h-[80vh] flex flex-col shadow-[0_0_50px_rgba(245,158,11,0.1)] overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-amber-900/50 flex justify-between items-center bg-slate-950/80">
                    <h3 className="font-game font-bold text-lg text-amber-500 flex items-center gap-2">
                        <Settings size={18} /> VAULT CONFIG
                    </h3>
                    <button onClick={() => setShowSettings(false)} className="text-gray-500 hover:text-white transition-colors"><X size={20} /></button>
                </div>

                <div className="p-4 space-y-4 overflow-y-auto custom-scrollbar">
                    <div className="grid grid-cols-1 gap-4">
                        <div>
                            <label className="block text-[10px] font-game text-amber-700 uppercase mb-1">Monthly Budget (Credits)</label>
                            <div className="relative">
                                <Coins size={14} className="absolute left-3 top-3 text-amber-500/50" />
                                <input
                                    type="number"
                                    value={toCredits(totalMonthlyBudget)}
                                    onChange={(e) => setTotalMonthlyBudget(fromCredits(e.target.value))}
                                    className="w-full bg-black/50 border border-amber-900/50 rounded pl-9 pr-3 py-2 text-amber-100 font-mono focus:border-amber-500/50 outline-none transition-colors"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-[10px] font-game text-amber-700 uppercase mb-1">Grocery Allocation (Credits)</label>
                            <div className="relative">
                                <Coins size={14} className="absolute left-3 top-3 text-amber-500/50" />
                                <input
                                    type="number"
                                    value={toCredits(groceryAllocation)}
                                    onChange={(e) => setGroceryAllocation(fromCredits(e.target.value))}
                                    className="w-full bg-black/50 border border-amber-900/50 rounded pl-9 pr-3 py-2 text-amber-100 font-mono focus:border-amber-500/50 outline-none transition-colors"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-[10px] font-game text-amber-700 uppercase mb-1">Frequency</label>
                            <select
                                value={groceryPeriod}
                                onChange={(e) => setGroceryPeriod(e.target.value)}
                                className="w-full bg-black/50 border border-amber-900/50 rounded px-3 py-2 text-amber-100 font-mono focus:border-amber-500/50 outline-none transition-colors"
                            >
                                <option value="weekly">Weekly</option>
                                <option value="bi-weekly">Bi-Weekly</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-game text-amber-700 uppercase mb-1">Exchange Rate (Credits : $1)</label>
                            <input
                                type="number"
                                value={goldToUsdRatio}
                                onChange={(e) => setGoldToUsdRatio(Number(e.target.value))}
                                className="w-full bg-black/50 border border-amber-900/50 rounded px-3 py-2 text-amber-100 font-mono focus:border-amber-500/50 outline-none transition-colors"
                            />
                        </div>
                    </div>

                    <div className="pt-4 border-t border-amber-900/30">
                        <button
                            onClick={clearGroceryList}
                            className="w-full py-3 bg-red-900/10 hover:bg-red-900/20 text-red-500 text-[10px] font-bold uppercase rounded border border-red-900/30 hover:border-red-500/50 transition-all flex items-center justify-center gap-2"
                        >
                            <Trash2 size={14} /> Purge Provision Manifest
                        </button>
                    </div>

                    <div className="pt-2">
                        <h4 className="text-[10px] font-bold text-amber-500/70 uppercase mb-3 tracking-widest flex items-center gap-2">
                            <Database size={12} /> Master Price Database
                        </h4>
                        <div className="grid grid-cols-1 gap-1 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                            {Object.entries(priceDatabase).map(([name, price]) => (
                                <div key={name} className="flex items-center justify-between p-2 rounded bg-black/40 border border-amber-900/20 hover:border-amber-500/30 transition-colors group">
                                    <span className="text-xs text-amber-100/70 group-hover:text-amber-100">{name}</span>
                                    <div className="flex items-center gap-2">
                                        <div className="flex items-center text-amber-500">
                                            <Coins size={10} className="mr-1" />
                                            <span className="text-xs font-mono">{toCredits(price)}</span>
                                        </div>
                                        <button
                                            onClick={() => {
                                                const currentCredits = toCredits(price);
                                                const newCredits = prompt(`Update unit cost for ${name} (Credits):`, currentCredits);
                                                if (newCredits !== null && !isNaN(newCredits)) {
                                                    updatePrice(name, fromCredits(newCredits));
                                                }
                                            }}
                                            className="p-1 hover:bg-amber-900/50 rounded text-amber-700 hover:text-amber-400 transition-colors"
                                        >
                                            <Settings size={10} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    const ProvisionsView = ({ groceryList, totalGroceryEstimated, totalGrocerySpent, groceryAllocation }) => {
        const [itemName, setItemName] = useState('');
        const [itemPriceCredits, setItemPriceCredits] = useState(''); // Store input as credits string
        const [isDropdownOpen, setIsDropdownOpen] = useState(false);

        const filteredDbItems = Object.keys(priceDatabase).filter(item =>
            item.toLowerCase().includes(itemName.toLowerCase())
        );

        const handleAdd = (e) => {
            e.preventDefault();
            if (!itemName) return;

            // Logic: Use input price (Credits) OR DB price (USD -> convert to Credits for display? No wait.)
            // updatePrice takes USD.
            // addGroceryItem takes name. It internally looks up price from DB.

            // If user entered a price manually, update DB first.
            if (itemPriceCredits) {
                const usdPrice = fromCredits(itemPriceCredits);
                updatePrice(itemName, usdPrice);
            }

            // Note: If item exists in DB but no price input, addGroceryItem uses DB price.
            // If item is new and no price input, DB defaults 0.

            addGroceryItem(itemName);
            setItemName('');
            setItemPriceCredits('');
            setIsDropdownOpen(false);
        };

        const selectFromDb = (name) => {
            setItemName(name);
            // Pre-fill price input with Credits equivalent
            if (priceDatabase[name]) {
                setItemPriceCredits(toCredits(priceDatabase[name]));
            } else {
                setItemPriceCredits('');
            }
            setIsDropdownOpen(false);
        };


        return (
            <div className="flex-1 flex flex-col h-full overflow-hidden relative">
                {/* INPUT BAR (Moved to Top) */}
                <div className="shrink-0 p-3 bg-black/90 border-b border-amber-900/50 backdrop-blur-xl z-30 shadow-[0_10px_40px_rgba(0,0,0,0.8)]">
                    <form onSubmit={handleAdd} className="flex gap-2 items-center">
                        <div className="flex-1 relative">
                            <input
                                type="text"
                                placeholder="PROVISION"
                                value={itemName}
                                onChange={(e) => {
                                    setItemName(e.target.value);
                                    setIsDropdownOpen(true);
                                }}
                                className="w-full bg-slate-900/80 border border-amber-900/50 rounded px-3 py-3 text-sm text-amber-100 placeholder-amber-900/30 focus:border-amber-500/50 outline-none uppercase font-mono tracking-wide"
                            />
                            {/* Autocomplete Dropdown */}
                            {isDropdownOpen && filteredDbItems.length > 0 && itemName && (
                                <div className="absolute top-full left-0 right-0 mt-2 bg-black border border-amber-900 rounded-lg shadow-2xl overflow-hidden max-h-32 overflow-y-auto z-50">
                                    {filteredDbItems.map(item => (
                                        <button
                                            key={item}
                                            type="button"
                                            onClick={() => selectFromDb(item)}
                                            className="w-full text-left px-3 py-2 hover:bg-amber-900/30 text-xs text-amber-100/80 flex justify-between items-center border-b border-amber-900/20 last:border-0"
                                        >
                                            <span>{item}</span>
                                            <span className="font-mono text-amber-500 flex items-center gap-1">
                                                <Coins size={10} />
                                                {toCredits(priceDatabase[item])}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="w-24 relative">
                            <input
                                type="number"
                                placeholder="0"
                                value={itemPriceCredits}
                                onChange={(e) => setItemPriceCredits(e.target.value)}
                                className="w-full bg-slate-900/80 border border-amber-900/50 rounded px-2 py-3 text-sm text-amber-400 placeholder-amber-900/30 focus:border-amber-500/50 outline-none text-right font-mono"
                            />
                            <Coins size={12} className="absolute left-2 top-4 text-amber-600/50" />
                        </div>
                        <button
                            type="submit"
                            className="bg-amber-600 hover:bg-amber-500 text-black py-3 px-4 rounded transition-colors shadow-[0_0_10px_rgba(245,158,11,0.2)] font-bold"
                        >
                            <Plus size={20} />
                        </button>
                    </form>
                </div>

                {/* STATUS BAR */}
                <div className="shrink-0 px-4 py-2 flex items-center justify-between text-[10px] font-game text-amber-500/60 uppercase tracking-widest border-b border-white/5 bg-black/20">
                    <div className="flex gap-4">
                        <span>Cycle: {groceryPeriod}</span>
                        <span>Items: {groceryList.length}</span>
                    </div>
                    <div className={clsx(totalGroceryEstimated > groceryAllocation ? "text-red-500 animate-pulse" : "text-amber-500")}>
                        {((totalGroceryEstimated / groceryAllocation) * 100).toFixed(0)}% Utilized
                    </div>
                </div>

                {/* SCROLLABLE LIST AREA */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1 pb-48 touch-pan-y overscroll-none">
                    {groceryList.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-48 text-amber-900/40 border-2 border-dashed border-amber-900/20 rounded-xl m-4">
                            <ShoppingCart size={32} className="mb-2 opacity-50" />
                            <span className="font-game text-xs tracking-widest uppercase">Manifest Empty</span>
                        </div>
                    ) : (
                        <AnimatePresence>
                            {groceryList.map(item => (
                                <motion.div
                                    key={item.id}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className={clsx(
                                        "group flex items-center justify-between p-3 rounded border transition-all relative overflow-hidden",
                                        item.completed
                                            ? "bg-slate-900/30 border-slate-800 text-slate-600"
                                            : "bg-amber-950/20 border-amber-500/20 text-amber-100 hover:bg-amber-900/20"
                                    )}
                                >
                                    <div className="flex items-center gap-3 relative z-10">
                                        <button
                                            onClick={() => toggleGroceryItem(item.id)}
                                            className={clsx(
                                                "transition-all duration-300",
                                                item.completed ? "text-amber-900" : "text-amber-500 hover:text-amber-300"
                                            )}
                                        >
                                            {item.completed ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                                        </button>
                                        <div className="flex flex-col">
                                            <span className={clsx("text-sm font-bold leading-none", item.completed && "line-through opacity-50")}>{item.name}</span>
                                            {!item.completed && <span className="text-[9px] font-mono text-amber-500/50 mt-1 uppercase tracking-wider">est. {toCredits(item.price)} C</span>}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 relative z-10">
                                        <div className={clsx("font-mono text-sm flex items-center gap-1", item.completed ? "text-xs text-slate-700" : "text-amber-400 font-bold")}>
                                            <Coins size={12} />
                                            {toCredits(item.price)}
                                        </div>
                                        <button
                                            onClick={() => removeGroceryItem(item.id)}
                                            className="text-amber-900 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>

                                    {/* Holographic Scanline Effect */}
                                    {!item.completed && (
                                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-500/5 to-transparent skew-x-12 translate-x-[-150%] group-hover:animate-holoscan pointer-events-none" />
                                    )}
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    )}
                </div>
            </div>
        );
    };

    const LedgerView = () => {
        const { spendCoins, coinHistory, stats } = useGame();
        const [desc, setDesc] = useState('');
        const [amount, setAmount] = useState('');

        const handleSpend = (e) => {
            e.preventDefault();
            if (!desc || !amount) return;
            // Amount is in CREDITS (Coins). spendCoins takes amount and deducts from stats.gold.
            // stats.gold is already in Credits/Gold units.
            // So NO conversion needed here. 
            spendCoins(parseInt(amount), desc);
            setDesc('');
            setAmount('');
        };

        const recentSpending = coinHistory
            .filter(t => t.type === 'spent')
            .sort((a, b) => new Date(b.date) - new Date(a.date));

        return (
            <div className="flex-1 flex flex-col h-full overflow-hidden min-h-0">
                {/* TRANSFER TERMINAL (Top) */}
                <div className="shrink-0 p-4 border-b border-amber-900/30 bg-black/20">
                    <div className="mb-3 flex items-center gap-2 text-amber-500/70">
                        <ArrowRightLeft size={14} />
                        <span className="text-[10px] font-game uppercase tracking-widest">Execute Transaction</span>
                    </div>

                    <form onSubmit={handleSpend} className="flex flex-col gap-3">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                placeholder="PAYMENT REFERENCE..."
                                value={desc}
                                onChange={(e) => setDesc(e.target.value)}
                                className="flex-1 bg-slate-900/50 border border-amber-900/50 rounded px-3 py-3 text-amber-100 placeholder-amber-900/50 focus:border-amber-500/50 outline-none font-mono text-sm uppercase"
                            />
                            <div className="w-32 relative">
                                <input
                                    type="number"
                                    placeholder="0"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    className="w-full bg-slate-900/50 border border-amber-900/50 rounded px-3 py-3 text-amber-400 placeholder-amber-900/50 focus:border-amber-500/50 outline-none font-mono text-right text-sm"
                                />
                                <span className="absolute left-2 top-3.5 text-[10px] text-amber-600 font-bold uppercase flex items-center gap-1">
                                    <Coins size={10} /> CREDITS
                                </span>
                            </div>
                        </div>
                        <button
                            disabled={!amount} // Allow negative balance
                            type="submit"
                            className="w-full py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded uppercase font-bold text-xs tracking-widest transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Authorize Transfer <ArrowRightLeft size={14} />
                        </button>
                    </form>
                </div>

                {/* TRANSACTION LOG (Bottom) */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-2 pb-48 touch-pan-y overscroll-none">
                    <div className="px-2 py-2 text-[10px] font-mono text-amber-500/40 uppercase border-b border-white/5 mb-1">Recent Activity Log</div>
                    <div className="space-y-1">
                        {recentSpending.length === 0 ? (
                            <div className="text-center py-8 text-amber-900/30 italic text-xs">No transactions recorded.</div>
                        ) : (
                            recentSpending.map(tx => (
                                <div key={tx.id} className="flex items-center justify-between p-2 rounded hover:bg-white/5 border border-transparent hover:border-white/5 transition-colors group">
                                    <div className="flex flex-col">
                                        <span className="text-xs font-bold text-amber-100/80">{tx.description}</span>
                                        <span className="text-[9px] font-mono text-gray-600">{new Date(tx.date).toLocaleDateString()} • {new Date(tx.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                    <div className="font-mono text-red-400 text-xs font-bold bg-red-900/10 px-2 py-1 rounded border border-red-900/20 group-hover:border-red-500/30 flex items-center gap-1">
                                        <Coins size={10} /> -{tx.amount}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        );
    };

    // --- MAIN RENDER ---

    return (
        <div className="fixed inset-0 w-full h-full overflow-hidden bg-slate-950 flex flex-col">
            {/* Ambient Background & Grid */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-amber-900/10 via-transparent to-transparent z-0" />
                <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent z-0" />
            </div>

            {/* 1. VAULT HEADER (Fixed) */}
            <VaultHeader />



            {/* 3. SETTINGS TOGGLE (Float) */}
            <button
                onClick={() => setShowSettings(true)}
                className="absolute top-3 right-3 z-30 p-2 text-amber-500/50 hover:text-amber-400 hover:bg-amber-500/10 rounded-full transition-colors"
                title="Vault Configuration"
            >
                <Settings size={18} />
            </button>


            {/* 4. MAIN VIEWPORT (Swappable) */}
            <div className="flex-1 overflow-hidden relative">
                <AnimatePresence mode="wait" initial={false}>
                    {activeTab === TAB_PROVISIONS ? (
                        <motion.div
                            key="provisions"
                            className="w-full h-full"
                            initial={{ opacity: 0, x: -50, rotateY: -10 }}
                            animate={{ opacity: 1, x: 0, rotateY: 0 }}
                            exit={{ opacity: 0, x: 50, rotateY: 10 }}
                            transition={{ duration: 0.4, ease: "backOut" }}
                            style={{ perspective: 1000 }}
                        >
                            <ProvisionsView
                                groceryList={groceryList}
                                totalGroceryEstimated={totalGroceryEstimated}
                                totalGrocerySpent={totalGrocerySpent}
                                groceryAllocation={groceryAllocation}
                            />
                        </motion.div>
                    ) : (
                        <motion.div
                            key="ledger"
                            className="w-full h-full"
                            initial={{ opacity: 0, x: 50, rotateY: 10 }}
                            animate={{ opacity: 1, x: 0, rotateY: 0 }}
                            exit={{ opacity: 0, x: -50, rotateY: -10 }}
                            transition={{ duration: 0.4, ease: "backOut" }}
                            style={{ perspective: 1000 }}
                        >
                            <LedgerView />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* 6. BOTTOM DOCK (Background Anchor) */}
            <div className="shrink-0 z-50 relative flex justify-center pb-32 pt-12 bg-gradient-to-t from-black via-slate-950/90 to-transparent -mt-10 pointer-events-none" />

            {/* 7. COIN SWITCH (Decoupled & Fixed) */}
            <div className="fixed bottom-52 left-1/2 -translate-x-1/2 z-[100] pointer-events-auto filter drop-shadow-2xl">
                <CoinSwitch
                    onClick={(e) => {
                        if (e) e.stopPropagation();
                        setActiveTab(prev => prev === TAB_PROVISIONS ? TAB_LEDGER : TAB_PROVISIONS);
                    }}
                />
            </div>

            {/* Modals */}
            {showSettings && <SettingsModal />}
        </div>
    );
};

export default BudgetView;
