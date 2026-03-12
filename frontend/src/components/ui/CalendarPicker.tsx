import { useState, useRef, useEffect } from 'react';
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

interface CalendarPickerProps {
    value: string; // YYYY-MM-DD
    onChange: (date: string) => void;
    label?: string;
}

export const CalendarPicker = ({ value, onChange, label }: CalendarPickerProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Initial view is based on current value or today
    const initialDate = value ? new Date(value) : new Date();
    const [viewDate, setViewDate] = useState(new Date(initialDate.getFullYear(), initialDate.getMonth(), 1));

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
    const startDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

    const handleMonthChange = (offset: number) => {
        setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + offset, 1));
    };

    const handleDateSelect = (day: number) => {
        const selected = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
        // Format as YYYY-MM-DD local time
        const y = selected.getFullYear();
        const m = String(selected.getMonth() + 1).padStart(2, '0');
        const d = String(selected.getDate()).padStart(2, '0');
        onChange(`${y}-${m}-${d}`);
        setIsOpen(false);
    };

    const isSelected = (day: number) => {
        if (!value) return false;
        const d = new Date(value);
        return d.getFullYear() === viewDate.getFullYear() &&
            d.getMonth() === viewDate.getMonth() &&
            d.getDate() === day;
    };

    const isToday = (day: number) => {
        const today = new Date();
        return today.getFullYear() === viewDate.getFullYear() &&
            today.getMonth() === viewDate.getMonth() &&
            today.getDate() === day;
    };

    const isSunday = (day: number) => {
        const date = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
        return date.getDay() === 0; // 0 is Sunday
    };

    const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    const grid = [];
    const days = daysInMonth(viewDate.getFullYear(), viewDate.getMonth());
    const offset = startDayOfMonth(viewDate.getFullYear(), viewDate.getMonth());

    for (let i = 0; i < offset; i++) {
        grid.push(<div key={`empty-${i}`} className="h-10" />);
    }

    for (let d = 1; d <= days; d++) {
        const selected = isSelected(d);
        const today = isToday(d);
        const sunday = isSunday(d);

        grid.push(
            <button
                key={d}
                type="button"
                onClick={() => handleDateSelect(d)}
                className={`
                    h-10 w-full rounded-lg flex items-center justify-center font-bold text-sm transition-all
                    ${selected
                        ? 'bg-sffl-red text-white shadow-md shadow-red-500/20'
                        : sunday
                            ? 'bg-red-50 dark:bg-red-900/20 text-sffl-red hover:bg-red-100 dark:hover:bg-red-900/40'
                            : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'}
                    ${today && !selected ? 'border-2 border-sffl-navy dark:border-white' : ''}
                `}
            >
                {d}
            </button>
        );
    }

    return (
        <div className="relative w-full" ref={containerRef}>
            {label && <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">{label}</label>}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
                <span>{value || 'Select Date'}</span>
                <CalendarIcon className="w-4 h-4 text-gray-400" />
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 mt-2 w-72 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl z-[60] p-4">
                    <div className="flex items-center justify-between mb-4">
                        <button type="button" onClick={() => handleMonthChange(-1)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-gray-500 transition-colors">
                            <ChevronLeftIcon className="w-5 h-5" />
                        </button>
                        <h3 className="font-black text-sffl-navy dark:text-white uppercase tracking-wider text-sm">
                            {monthNames[viewDate.getMonth()]} {viewDate.getFullYear()}
                        </h3>
                        <button type="button" onClick={() => handleMonthChange(1)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-gray-500 transition-colors">
                            <ChevronRightIcon className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="grid grid-cols-7 gap-1 mb-2">
                        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                            <div key={i} className={`text-center text-[10px] font-black ${i === 0 ? 'text-sffl-red' : 'text-gray-400'}`}>
                                {day}
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-7 gap-1">
                        {grid}
                    </div>

                    <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/40 rounded shadow-sm"></div>
                            <span className="text-[10px] font-bold text-gray-500 uppercase">Sunday</span>
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                const today = new Date();
                                const y = today.getFullYear();
                                const m = String(today.getMonth() + 1).padStart(2, '0');
                                const d = String(today.getDate()).padStart(2, '0');
                                onChange(`${y}-${m}-${d}`);
                                setIsOpen(false);
                            }}
                            className="text-[10px] font-black text-sffl-red uppercase hover:underline"
                        >
                            Today
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
