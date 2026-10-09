import { forwardRef, useImperativeHandle, useState } from 'react';
import type { HeroIcon } from '../../ui';
import { Spinner } from '../../ui';

// The pop-up list shared by the "@" mention picker and the "/" insert menu.
// Arrow keys move, Enter or Tab picks, Escape closes; tapping a row picks it.

export interface MenuItem {
    key: string;
    label: string;
    hint?: string;
    icon?: HeroIcon;
    image?: string;
}

export interface SuggestionListProps {
    items: MenuItem[];
    command: (item: MenuItem) => void;
    loading: boolean;
    emptyLabel: string;
    heading: string;
}

export interface SuggestionListHandle {
    onKeyDown: (event: KeyboardEvent) => boolean;
}

export const SuggestionList = forwardRef<SuggestionListHandle, SuggestionListProps>(
    ({ items, command, loading, emptyLabel, heading }, ref) => {
        // The highlight resets whenever a new result list arrives.
        const [highlight, setHighlight] = useState({ items, index: 0 });
        const index = highlight.items === items ? highlight.index : 0;
        const move = (delta: number) =>
            setHighlight({ items, index: (index + delta + items.length) % items.length });

        useImperativeHandle(ref, () => ({
            onKeyDown: event => {
                if (event.key === 'Escape') {
                    // Close only the menu, not a Modal the editor sits in.
                    event.stopPropagation();
                    return false;
                }
                if (!items.length) return false;
                if (event.key === 'ArrowDown') { move(1); return true; }
                if (event.key === 'ArrowUp') { move(-1); return true; }
                if (event.key === 'Enter' || event.key === 'Tab') {
                    command(items[index]);
                    return true;
                }
                return false;
            },
        }));

        return (
            <div className="w-72 max-w-[calc(100vw-2rem)] max-h-72 overflow-y-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl p-1">
                <p className="px-2 pt-1 pb-1.5 text-xs font-bold text-gray-500 dark:text-gray-400">{heading}</p>
                {loading && !items.length && <Spinner label="Searching" size="sm" className="py-3" />}
                {!loading && !items.length && (
                    <p className="px-2 py-2 text-sm text-gray-500 dark:text-gray-400">{emptyLabel}</p>
                )}
                {items.map((item, i) => {
                    const Icon = item.icon;
                    return (
                        // Picker row: stays raw (see frontend/CLAUDE.md §7).
                        <button
                            key={item.key}
                            type="button"
                            // Keep focus in the editor so the pick lands at the cursor.
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => command(item)}
                            className={`w-full min-h-11 flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-left transition ${i === index ? 'bg-gray-100 dark:bg-gray-700' : 'hover:bg-gray-50 dark:hover:bg-gray-700/60'}`}
                        >
                            {item.image ? (
                                <img src={item.image} alt="" className="w-6 h-6 rounded-full object-cover shrink-0" />
                            ) : Icon ? (
                                <Icon className="w-5 h-5 shrink-0 text-gray-500 dark:text-gray-400" aria-hidden="true" />
                            ) : null}
                            <span className="min-w-0">
                                <span className="block text-sm font-semibold text-gray-900 dark:text-white truncate">{item.label}</span>
                                {item.hint && (
                                    <span className="block text-xs text-gray-500 dark:text-gray-400 truncate">{item.hint}</span>
                                )}
                            </span>
                        </button>
                    );
                })}
            </div>
        );
    },
);
SuggestionList.displayName = 'SuggestionList';
