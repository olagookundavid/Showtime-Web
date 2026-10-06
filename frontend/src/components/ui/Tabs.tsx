import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { type HeroIcon, type Tone } from './Button';

export type TabItem<T extends string> = {
    value: T;
    label: ReactNode;
    icon?: HeroIcon;
};

interface TabsProps<T extends string> {
    items: TabItem<T>[];
    value: T;
    onChange: (value: T) => void;
    /** Names the tab list for screen readers, e.g. "Claim status". */
    'aria-label': string;
    /** Layout of the bar (margins). The page renders the panel for `value`. */
    className?: string;
    /** `dark` for a tab bar on a dark surface. */
    tone?: Tone;
}

/** An underline tab bar. Arrow keys move between tabs, and the selected tab is the only one in the tab order. */
export const Tabs = <T extends string>({ items, value, onChange, 'aria-label': ariaLabel, className = '', tone = 'light' }: TabsProps<T>) => {
    const dark = tone === 'dark';

    const buttons = useRef<(HTMLButtonElement | null)[]>([]);

    const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
        const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (!step) return;
        e.preventDefault();
        const next = (index + step + items.length) % items.length;
        onChange(items[next].value);
        buttons.current[next]?.focus();
    };

    return (
        <div
            role="tablist"
            aria-label={ariaLabel}
            className={`flex overflow-x-auto whitespace-nowrap border-b ${dark ? 'border-white/15' : 'border-gray-200 dark:border-gray-700'} ${className}`}
        >
            {items.map((item, index) => {
                const active = item.value === value;
                const Icon = item.icon;
                return (
                    <button
                        key={item.value}
                        ref={(el) => { buttons.current[index] = el; }}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        tabIndex={active ? 0 : -1}
                        onClick={() => onChange(item.value)}
                        onKeyDown={(e) => onKeyDown(e, index)}
                        className={`inline-flex items-center gap-2 min-h-11 px-4 sm:px-6 text-sm font-bold border-b-2 whitespace-nowrap transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sffl-red ${
                            active
                                ? 'border-sffl-red text-sffl-red'
                                : dark
                                  ? 'border-transparent text-white/60 hover:text-white'
                                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                        }`}
                    >
                        {Icon && <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />}
                        {item.label}
                    </button>
                );
            })}
        </div>
    );
};
