import { useLocation, useNavigate } from 'react-router-dom';
import { StarIcon, Square3Stack3DIcon, TicketIcon } from '@heroicons/react/24/outline';
import type { HeroIcon } from '../ui';

type Mode = 'season-pass' | 'game-pass' | 'tickets';

const MODES: { value: Mode; label: string; description: string; icon: HeroIcon; to?: string; disabled?: boolean }[] = [
    {
        value: 'season-pass',
        label: 'Season Pass',
        description: 'All season. Credits. Lounge benefits.',
        icon: StarIcon,
        disabled: true,
    },
    {
        value: 'game-pass',
        label: 'Game Pass',
        description: 'Several match days, one code, a discount.',
        icon: Square3Stack3DIcon,
        to: '/tickets/game-pass',
    },
    {
        value: 'tickets',
        label: 'Gameday Tickets',
        description: 'One match day. Your ticket tier of choice.',
        icon: TicketIcon,
        to: '/tickets',
    },
];

interface TicketModeTabsProps {
    /** Condensed icon+label tiles, for when the bar is pinned under a scroll. */
    compact?: boolean;
}

/**
 * The "Season Pass / Game Pass / Gameday Tickets" picker nested under the Tickets tab.
 * The active tile borrows TicketProductCard's navy/gold "highest tier" look.
 */
export const TicketModeTabs = ({ compact = false }: TicketModeTabsProps) => {
    const { pathname } = useLocation();
    const navigate = useNavigate();
    const active: Mode = pathname.startsWith('/tickets/game-pass') ? 'game-pass' : 'tickets';

    return (
        <div className="grid grid-cols-3" role="tablist" aria-label="Ticket type">
            {MODES.map((mode, index) => {
                const isActive = mode.value === active;
                const Icon = mode.icon;
                return (
                    <button
                        key={mode.value}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        disabled={mode.disabled}
                        onClick={() => mode.to && navigate(mode.to)}
                        className={`relative flex min-h-11 flex-col items-start gap-1.5 border text-left transition-all duration-300 ease-out disabled:cursor-not-allowed disabled:opacity-60 ${
                            index > 0 ? '-ml-px' : ''
                        } ${isActive ? 'z-10' : ''} ${compact ? 'p-2 sm:p-2.5' : 'p-3 sm:p-4'} ${
                            isActive
                                ? 'border-sffl-navy bg-sffl-navy text-white'
                                : 'border-gray-200 bg-white text-sffl-navy hover:border-sffl-navy/40 dark:border-gray-700 dark:bg-gray-900 dark:text-white'
                        }`}
                    >
                        <span className="flex w-full items-center justify-between gap-2">
                            <Icon
                                className={`shrink-0 transition-all duration-300 ease-out ${compact ? 'h-4 w-4' : 'h-5 w-5'} ${isActive ? 'text-amber-300' : 'text-sffl-red'}`}
                                aria-hidden="true"
                            />
                            {mode.disabled && (
                                <span
                                    className={`grid overflow-hidden transition-[grid-template-columns,opacity] duration-300 ease-out ${
                                        compact ? 'grid-cols-[0fr] opacity-0' : 'grid-cols-[1fr] opacity-100'
                                    }`}
                                >
                                    <span className="overflow-hidden whitespace-nowrap bg-gray-100 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-gray-500 dark:bg-gray-700 dark:text-gray-300">
                                        Coming soon
                                    </span>
                                </span>
                            )}
                        </span>
                        <span className="text-xs font-black uppercase tracking-wide sm:text-sm">
                            {mode.label}
                        </span>
                        <div
                            className={`grid overflow-hidden transition-[grid-template-rows,opacity] duration-300 ease-out ${
                                compact ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100'
                            }`}
                        >
                            <span
                                className={`min-h-0 overflow-hidden text-[11px] leading-snug ${
                                    isActive ? 'text-white/70' : 'text-gray-500 dark:text-gray-400'
                                }`}
                            >
                                {mode.description}
                            </span>
                        </div>
                    </button>
                );
            })}
        </div>
    );
};
