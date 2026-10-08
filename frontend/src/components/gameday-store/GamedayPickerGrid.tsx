import { CalendarDaysIcon, CheckIcon, MapPinIcon } from "@heroicons/react/24/outline";
import type { EventDayResponse } from "../../types";
import { getGamedaySelectionStatus } from "../../utils";

type Props = {
  eventDays: EventDayResponse[];
  tierName: string;
  representativeRate: number;
  /** Visual only — selection semantics (replace vs. toggle) are the caller's. */
  mode: "single" | "multi";
  selectedIds: string[];
  onToggle: (eventDayId: string) => void;
};

const STATUS_COPY: Record<string, string> = {
  "not-offered": "Not offered on this date",
  "sold-out": "Sold out",
};

/** Gameday card grid, built from real event-day data. A card is disabled whenever
 *  the currently chosen tier isn't available on it at the representative rate. */
export const GamedayPickerGrid = ({
  eventDays,
  tierName,
  representativeRate,
  mode,
  selectedIds,
  onToggle,
}: Props) => {
  if (eventDays.length === 0) {
    return (
      <div className="border border-gray-200 bg-white px-4 py-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
        No gamedays are scheduled yet. Check back soon.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {eventDays.map((eventDay) => {
        const { status, tier } = getGamedaySelectionStatus(eventDay, tierName, representativeRate);
        const isSelectable = status === "match";
        const isSelected = selectedIds.includes(eventDay.id);
        const reason =
          status === "price-mismatch" && tier
            ? `Priced differently on this date (₦${tier.price.toLocaleString()})`
            : status !== "match"
              ? STATUS_COPY[status]
              : undefined;

        return (
          <button
            key={eventDay.id}
            type="button"
            aria-pressed={isSelected}
            disabled={!isSelectable}
            title={reason}
            aria-label={reason ? `${eventDay.title}, ${reason}` : eventDay.title}
            onClick={() => isSelectable && onToggle(eventDay.id)}
            className={`flex items-start justify-between gap-3 border p-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              isSelected
                ? "border-sffl-navy bg-sffl-navy text-white"
                : "border-gray-200 bg-white text-sffl-navy hover:border-sffl-navy/40 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            }`}
          >
            <span className="min-w-0 space-y-1">
              <span className="block truncate text-sm font-black uppercase tracking-tight">
                {eventDay.title}
              </span>
              <span
                className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-xs ${
                  isSelected ? "text-white/80" : "text-gray-500 dark:text-gray-400"
                }`}
              >
                <span className="inline-flex items-center gap-1">
                  <CalendarDaysIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  {new Date(eventDay.date + "T00:00:00").toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
                {eventDay.venue && (
                  <span className="inline-flex min-w-0 items-center gap-1">
                    <MapPinIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span className="truncate">{eventDay.venue}</span>
                  </span>
                )}
              </span>
              {reason && (
                <span
                  className={`block text-[11px] font-bold ${
                    isSelected ? "text-white/70" : "text-gray-400"
                  }`}
                >
                  {reason}
                </span>
              )}
            </span>

            <span
              aria-hidden="true"
              className={`flex h-6 w-6 shrink-0 items-center justify-center border ${
                mode === "single" ? "rounded-full" : ""
              } ${
                isSelected
                  ? "border-white bg-white text-sffl-navy"
                  : "border-gray-300 text-transparent dark:border-gray-600"
              }`}
            >
              <CheckIcon className="h-4 w-4" aria-hidden="true" />
            </span>
          </button>
        );
      })}
    </div>
  );
};
