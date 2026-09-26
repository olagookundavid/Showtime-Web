import { useEffect, useState } from "react";

// Created once: "09:24:17 am" and "Sat, 26 Sept 2026".
const timeFormat = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: true,
});
const dateFormat = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
});

/**
 * The top bar's live clock. Kept in its own component so the one-second tick
 * re-renders only this, not the layout and the page inside it. No live region:
 * a screen reader should not announce every second.
 */
export const DashboardClock = ({ className = "" }: { className?: string }) => {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <time
      dateTime={now.toISOString()}
      className={`flex-col items-end leading-tight ${className}`}
    >
      <span className="text-sm font-bold tabular-nums text-sffl-navy dark:text-white transition-colors">
        {timeFormat.format(now)}
      </span>
      <span className="text-xs text-gray-500 dark:text-gray-400 transition-colors">
        {dateFormat.format(now)}
      </span>
    </time>
  );
};
