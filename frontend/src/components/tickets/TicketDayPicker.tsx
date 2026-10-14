import { CalendarDaysIcon, MapPinIcon } from '@heroicons/react/24/outline';
import type { TicketProductDayResponse } from '../../types';
import { Checkbox } from '../ui';
import { formatDayShort, isSoldOut, naira, seatsLabel } from './ticketFormat';

interface TicketDayPickerProps {
    /** The days this ticket is sold on. */
    days: TicketProductDayResponse[];
    /** Selected match day ids. */
    selected: string[];
    onChange: (selected: string[]) => void;
    /** `single` picks one day; `multi` picks any number, for a Game Pass. */
    mode: 'single' | 'multi';
    /** Names the group for screen readers and keeps radio groups apart. */
    name: string;
    /** `dark` reads correctly sitting on the highlighted product card's navy panel. */
    tone?: 'light' | 'dark';
}

/**
 * The match days a ticket can be bought for. A day that is sold out stays on the
 * list but can't be picked, so buyers see it exists rather than wondering where
 * it went.
 */
export const TicketDayPicker = ({ days, selected, onChange, mode, name, tone = 'light' }: TicketDayPickerProps) => {
    const dark = tone === 'dark';

    const toggle = (id: string) => {
        if (mode === 'single') {
            onChange([id]);
            return;
        }
        onChange(selected.includes(id) ? selected.filter((d) => d !== id) : [...selected, id]);
    };

    return (
        <div role={mode === 'single' ? 'radiogroup' : 'group'} aria-label={name} className="space-y-2">
            {days.map((day) => {
                const soldOut = isSoldOut(day);
                const checked = selected.includes(day.event_day_id);
                const seats = seatsLabel(day);
                return (
                    <label
                        key={day.id}
                        className={`flex min-h-11 items-center gap-3 border p-3 transition-colors ${
                            soldOut ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                        } ${
                            checked
                                ? dark
                                    ? 'border-sffl-gold bg-white/10'
                                    : 'border-sffl-red bg-sffl-red/5 dark:bg-sffl-red/10'
                                : dark
                                  ? 'border-white/20 hover:border-white/40'
                                  : 'border-gray-200 hover:border-gray-400 dark:border-gray-700 dark:hover:border-gray-500'
                        }`}
                    >
                        {mode === 'single' ? (
                            <input
                                type="radio"
                                name={name}
                                className={`h-5 w-5 shrink-0 ${dark ? 'accent-sffl-gold' : 'accent-sffl-red'}`}
                                checked={checked}
                                disabled={soldOut}
                                onChange={() => toggle(day.event_day_id)}
                            />
                        ) : (
                            <Checkbox
                                tone={dark ? 'dark' : 'light'}
                                checked={checked}
                                disabled={soldOut}
                                onChange={() => toggle(day.event_day_id)}
                            />
                        )}
                        <span className="min-w-0 flex-1">
                            <span
                                className={`block wrap-break-word text-sm font-bold ${
                                    dark ? 'text-white' : 'text-sffl-navy dark:text-white'
                                }`}
                            >
                                {day.event_title}
                            </span>
                            <span
                                className={`mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs ${
                                    dark ? 'text-white/70' : 'text-gray-500 dark:text-gray-400'
                                }`}
                            >
                                <span className="inline-flex items-center gap-1">
                                    <CalendarDaysIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                    {formatDayShort(day.event_date)}
                                </span>
                                {day.event_venue && (
                                    <span className="inline-flex min-w-0 items-center gap-1">
                                        <MapPinIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                        <span className="truncate">{day.event_venue}</span>
                                    </span>
                                )}
                            </span>
                        </span>
                        <span className="shrink-0 text-right">
                            <span
                                className={`block text-sm font-black ${
                                    dark ? 'text-white' : 'text-sffl-navy dark:text-white'
                                }`}
                            >
                                {day.price === 0 ? 'Free' : naira(day.price)}
                            </span>
                            {seats && (
                                <span
                                    className={`block text-[11px] font-bold ${
                                        soldOut ? (dark ? 'text-red-400' : 'text-red-500') : dark ? 'text-white/70' : 'text-gray-500 dark:text-gray-400'
                                    }`}
                                >
                                    {seats}
                                </span>
                            )}
                        </span>
                    </label>
                );
            })}
        </div>
    );
};
