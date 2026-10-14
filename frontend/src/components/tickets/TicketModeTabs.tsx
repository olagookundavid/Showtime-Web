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

/**
 * The "Season Pass / Game Pass / Gameday Tickets" picker nested under the Tickets tab.
 * The active tile borrows TicketProductCard's navy/gold "highest tier" look.
 */
export const TicketModeTabs = () => {
    const { pathname } = useLocation();
    const navigate = useNavigate();
    const active: Mode = pathname.startsWith('/tickets/game-pass') ? 'game-pass' : 'tickets';

    return (
        <div className="grid grid-cols-3 gap-2 sm:gap-3" role="tablist" aria-label="Ticket type">
            {MODES.map((mode) => {
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
                        className={`flex min-h-11 flex-col items-start gap-1.5 border p-3 text-left transition-colors sm:p-4 disabled:cursor-not-allowed disabled:opacity-60 ${
                            isActive
                                ? 'border-sffl-navy bg-sffl-navy text-white'
                                : 'border-gray-200 bg-white text-sffl-navy hover:border-sffl-navy/40 dark:border-gray-700 dark:bg-gray-900 dark:text-white'
                        }`}
                    >
                        <span className="flex w-full items-center justify-between gap-2">
                            <Icon
                                className={`h-5 w-5 shrink-0 ${isActive ? 'text-amber-300' : 'text-sffl-red'}`}
                                aria-hidden="true"
                            />
                            {mode.disabled && (
                                <span className="shrink-0 bg-gray-100 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-gray-500 dark:bg-gray-700 dark:text-gray-300">
                                    Coming soon
                                </span>
                            )}
                        </span>
                        <span className="text-xs font-black uppercase tracking-wide sm:text-sm">
                            {mode.label}
                        </span>
                        <span
                            className={`text-[11px] leading-snug ${
                                isActive ? 'text-white/70' : 'text-gray-500 dark:text-gray-400'
                            }`}
                        >
                            {mode.description}
                        </span>
                    </button>
                );
            })}
        </div>
    );
};
