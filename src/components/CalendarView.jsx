import React, { useState } from 'react';
import {
    format,
    addMonths,
    subMonths,
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    isSameMonth,
    isSameDay,
    addDays,
    eachDayOfInterval,
    isToday,
    parseISO
} from 'date-fns';
import { useGame } from '../context/GameContext';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Plus, Sword } from 'lucide-react';
import clsx from 'clsx';

const CalendarView = () => {
    const { quests, addQuest } = useGame();
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [newQuestTitle, setNewQuestTitle] = useState('');

    const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
    const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

    const renderHeader = () => {
        return (
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h2 className="text-3xl font-game font-bold text-white tracking-widest uppercase text-glow">
                        Chronos Log
                    </h2>
                    <p className="text-sm text-gray-500">{format(currentMonth, 'MMMM yyyy')}</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={prevMonth}
                        className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-game-accent transition-colors"
                    >
                        <ChevronLeft size={24} />
                    </button>
                    <button
                        onClick={nextMonth}
                        className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-game-accent transition-colors"
                    >
                        <ChevronRight size={24} />
                    </button>
                </div>
            </div>
        );
    };

    const renderDays = () => {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        return (
            <div className="grid grid-cols-7 mb-2">
                {days.map(day => (
                    <div key={day} className="text-center text-[10px] font-bold uppercase tracking-widest text-slate-500 py-2">
                        {day}
                    </div>
                ))}
            </div>
        );
    };

    const renderCells = () => {
        const monthStart = startOfMonth(currentMonth);
        const monthEnd = endOfMonth(monthStart);
        const startDate = startOfWeek(monthStart);
        const endDate = endOfWeek(monthEnd);

        const days = eachDayOfInterval({
            start: startDate,
            end: endDate,
        });

        return (
            <div className="grid grid-cols-7 gap-2">
                {days.map((day, i) => {
                    const dayQuests = quests.filter(q => q.dueDate && isSameDay(parseISO(q.dueDate), day));
                    const isSelected = isSameDay(day, selectedDate);
                    const isCurrentMonth = isSameMonth(day, monthStart);

                    return (
                        <motion.div
                            key={day.toString()}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => {
                                setSelectedDate(day);
                                setIsAddModalOpen(true);
                            }}
                            className={clsx(
                                "relative aspect-square md:h-24 p-2 rounded-xl border transition-all cursor-pointer group flex flex-col items-center justify-center gap-1",
                                !isCurrentMonth ? "bg-slate-900/20 border-slate-800/50 opacity-30" : "bg-slate-900/50 border-slate-800 hover:border-game-accent/50",
                                isToday(day) && "border-game-gold/50 bg-game-gold/5",
                                isSelected && isCurrentMonth && "border-game-accent bg-game-accent/10 shadow-[0_0_15px_rgba(56,189,248,0.2)]"
                            )}
                        >
                            <span className={clsx(
                                "text-sm font-bold",
                                isToday(day) ? "text-game-gold" : (isCurrentMonth ? "text-gray-400" : "text-gray-600")
                            )}>
                                {format(day, 'd')}
                            </span>

                            <div className="flex flex-wrap gap-1 justify-center">
                                {dayQuests.slice(0, 3).map(q => (
                                    <div
                                        key={q.id}
                                        className={clsx(
                                            "w-1.5 h-1.5 rounded-full",
                                            q.completed ? "bg-game-muted" : "bg-game-accent shadow-[0_0_5px_rgba(56,189,248,0.5)]"
                                        )}
                                    />
                                ))}
                                {dayQuests.length > 3 && (
                                    <div className="text-[8px] text-game-accent font-bold">+{dayQuests.length - 3}</div>
                                )}
                            </div>

                            {/* Hover info */}
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity bg-slate-950/80 rounded-xl">
                                <Plus size={20} className="text-game-accent" />
                            </div>
                        </motion.div>
                    );
                })}
            </div>
        );
    };

    const handleAddQuest = (e) => {
        e.preventDefault();
        if (!newQuestTitle.trim()) return;
        addQuest(newQuestTitle, 'medium', format(selectedDate, 'yyyy-MM-dd'));
        setNewQuestTitle('');
        setIsAddModalOpen(false);
    };

    return (
        <div className="pb-24 md:pb-0">
            {renderHeader()}
            <div className="bg-slate-950/50 p-4 md:p-6 rounded-2xl border border-slate-800 backdrop-blur-sm">
                {renderDays()}
                {renderCells()}
            </div>

            {/* Quick Stats / Timeline */}
            <div className="mt-8">
                <h3 className="text-xs font-bold text-gray-500 uppercase mb-4 tracking-widest">Selected Date: {format(selectedDate, 'PPP')}</h3>
                <div className="space-y-3">
                    {quests.filter(q => q.dueDate && isSameDay(parseISO(q.dueDate), selectedDate)).length === 0 ? (
                        <div className="text-center py-8 text-gray-600 italic border border-dashed border-slate-800 rounded-xl">
                            No objectives allocated for this chronos cycle.
                        </div>
                    ) : (
                        quests
                            .filter(q => q.dueDate && isSameDay(parseISO(q.dueDate), selectedDate))
                            .map(q => (
                                <div key={q.id} className="flex items-center gap-4 bg-slate-900/40 p-3 rounded-lg border-l-2 border-game-accent">
                                    <div className={clsx(
                                        "w-2 h-2 rounded-full",
                                        q.completed ? "bg-game-muted" : "bg-game-accent"
                                    )} />
                                    <span className={clsx("flex-1 text-sm font-medium", q.completed && "text-gray-500 line-through")}>
                                        {q.title}
                                    </span>
                                    <div className="text-[10px] text-gray-500 uppercase font-bold px-2 py-0.5 bg-slate-800 rounded">
                                        {q.difficulty}
                                    </div>
                                </div>
                            ))
                    )}
                </div>
            </div>

            <AnimatePresence>
                {isAddModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                            onClick={() => setIsAddModalOpen(false)}
                        />
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            className="relative w-full max-w-md bg-slate-900 border border-slate-700 p-6 rounded-2xl shadow-2xl"
                        >
                            <h3 className="text-xl font-game font-bold text-white mb-1">New Objective</h3>
                            <p className="text-sm text-gray-500 mb-6 uppercase tracking-wider">Allocating to {format(selectedDate, 'PPP')}</p>

                            <form onSubmit={handleAddQuest}>
                                <input
                                    autoFocus
                                    type="text"
                                    value={newQuestTitle}
                                    onChange={(e) => setNewQuestTitle(e.target.value)}
                                    placeholder="Enter quest directive..."
                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-game-accent mb-6"
                                />
                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setIsAddModalOpen(false)}
                                        className="flex-1 px-4 py-2 rounded-lg bg-slate-800 text-gray-400 font-bold hover:bg-slate-700 transition-colors"
                                    >
                                        CANCEL
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 px-4 py-2 rounded-lg bg-game-accent text-slate-900 font-bold hover:bg-cyan-400 transition-colors shadow-neon"
                                    >
                                        ALLOCATE
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default CalendarView;
