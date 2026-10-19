import { useState, useRef, useEffect } from "react";
import {
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";
import { Button } from "./Button";
import { IconButton } from "./IconButton";

interface CalendarPickerProps {
  value: string; // YYYY-MM-DD
  onChange: (date: string) => void;
  label?: string;
  /** Dates (YYYY-MM-DD) to mark, each with a short name shown on hover and read by screen readers, e.g. match days. Replaces the Sunday tint. */
  highlightedDates?: Record<string, string>;
  /** Legend text for the highlighted dates, e.g. "Match day". */
  highlightLabel?: string;
  /** Last pickable date (YYYY-MM-DD). Later days are disabled. */
  max?: string;
}

// "YYYY-MM-DD" as a local date. new Date("2026-10-03") would be UTC midnight,
// which reads as the day before for viewers west of UTC.
const parseLocalDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};

const toIso = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

export const CalendarPicker = ({
  value,
  onChange,
  label,
  highlightedDates,
  highlightLabel = "Highlighted",
  max,
}: CalendarPickerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Initial view is based on current value or today
  const initialDate = value ? parseLocalDate(value) : new Date();
  const [viewDate, setViewDate] = useState(
    new Date(initialDate.getFullYear(), initialDate.getMonth(), 1),
  );

  // Follow the value when it changes from outside (e.g. "see this day only").
  useEffect(() => {
    if (!value) return;
    const d = parseLocalDate(value);
    setViewDate(new Date(d.getFullYear(), d.getMonth(), 1));
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const daysInMonth = (year: number, month: number) =>
    new Date(year, month + 1, 0).getDate();
  const startDayOfMonth = (year: number, month: number) =>
    new Date(year, month, 1).getDay();

  const handleMonthChange = (offset: number) => {
    setViewDate(
      new Date(viewDate.getFullYear(), viewDate.getMonth() + offset, 1),
    );
  };

  const handleDateSelect = (day: number) => {
    onChange(toIso(new Date(viewDate.getFullYear(), viewDate.getMonth(), day)));
    setIsOpen(false);
  };

  const isSelected = (day: number) => {
    if (!value) return false;
    const d = parseLocalDate(value);
    return (
      d.getFullYear() === viewDate.getFullYear() &&
      d.getMonth() === viewDate.getMonth() &&
      d.getDate() === day
    );
  };

  const isToday = (day: number) => {
    const today = new Date();
    return (
      today.getFullYear() === viewDate.getFullYear() &&
      today.getMonth() === viewDate.getMonth() &&
      today.getDate() === day
    );
  };

  const isSunday = (day: number) => {
    const date = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
    return date.getDay() === 0; // 0 is Sunday
  };

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
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
    const iso = toIso(new Date(viewDate.getFullYear(), viewDate.getMonth(), d));
    const highlightName = highlightedDates?.[iso];
    const highlighted = highlightName !== undefined;
    const sunday = !highlightedDates && isSunday(d);
    const disabled = max !== undefined && iso > max;

    grid.push(
      <button
        key={d}
        type="button"
        disabled={disabled}
        aria-pressed={selected}
        aria-label={`${d} ${monthNames[viewDate.getMonth()]} ${viewDate.getFullYear()}${highlighted ? `, ${highlightLabel.toLowerCase()}${highlightName ? `: ${highlightName}` : ""}` : ""}`}
        title={highlighted ? highlightName || highlightLabel : undefined}
        onClick={() => handleDateSelect(d)}
        className={`
                    relative h-10 w-full rounded-lg flex items-center justify-center font-bold text-sm transition-all
                    ${
                      disabled
                        ? "text-gray-300 dark:text-gray-600 cursor-not-allowed"
                        : selected
                          ? "bg-sffl-red text-white shadow-md shadow-red-500/20"
                          : highlighted
                            ? "bg-sffl-navy/10 text-sffl-navy ring-1 ring-sffl-navy/40 hover:bg-sffl-navy/20 dark:bg-white/15 dark:text-white dark:ring-white/40 dark:hover:bg-white/25"
                            : sunday
                              ? "bg-red-50 dark:bg-red-900/20 text-sffl-red hover:bg-red-100 dark:hover:bg-red-900/40"
                              : "hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                    }
                    ${today && !selected ? "border-2 border-sffl-navy dark:border-white" : ""}
                `}
      >
        {d}
        {highlighted && (
          <span
            aria-hidden="true"
            className="absolute bottom-1 h-1 w-1 rounded-full bg-current"
          />
        )}
      </button>,
    );
  }

  return (
    <div className="relative w-full" ref={containerRef}>
      {label && (
        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
          {label}
        </label>
      )}
      <Button
        variant="secondary"
        fullWidth
        icon={CalendarIcon}
        iconPosition="right"
        className="justify-between"
        onClick={() => setIsOpen(!isOpen)}
      >
        {value || "Select Date"}
      </Button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-72 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl z-60 p-4">
          <div className="flex items-center justify-between mb-4">
            <IconButton
              icon={ChevronLeftIcon}
              label="Previous month"
              onClick={() => handleMonthChange(-1)}
            />
            <h3 className="font-black text-sffl-navy dark:text-white uppercase tracking-wider text-sm">
              {monthNames[viewDate.getMonth()]} {viewDate.getFullYear()}
            </h3>
            <IconButton
              icon={ChevronRightIcon}
              label="Next month"
              onClick={() => handleMonthChange(1)}
            />
          </div>

          <div className="grid grid-cols-7 gap-1 mb-2">
            {["S", "M", "T", "W", "T", "F", "S"].map((day, i) => (
              <div
                key={i}
                className={`text-center text-[10px] font-black ${i === 0 ? "text-sffl-red" : "text-gray-400"}`}
              >
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">{grid}</div>

          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center">
            <div className="flex items-center gap-2">
              {highlightedDates ? (
                <div
                  aria-hidden="true"
                  className="relative flex h-5 w-5 items-end justify-center rounded-md bg-sffl-navy/10 pb-0.5 text-sffl-navy ring-1 ring-sffl-navy/40 dark:bg-white/15 dark:text-white dark:ring-white/40"
                >
                  <span className="h-1 w-1 rounded-full bg-current" />
                </div>
              ) : (
                <div className="w-3 h-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/40 rounded shadow-sm"></div>
              )}
              <span className="text-[10px] font-bold text-gray-500 uppercase">
                {highlightedDates ? highlightLabel : "Sunday"}
              </span>
            </div>
            <Button
              variant="link"
              size="sm"
              className="uppercase tracking-wider"
              onClick={() => {
                const today = toIso(new Date());
                onChange(max !== undefined && today > max ? max : today);
                setIsOpen(false);
              }}
            >
              Today
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
