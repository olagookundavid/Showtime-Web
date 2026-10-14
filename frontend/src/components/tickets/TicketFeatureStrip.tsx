import type { HeroIcon } from '../ui';

interface TicketFeatureStripProps {
    items: { icon: HeroIcon; label: string }[];
    className?: string;
}

/** Three short feature callouts under a ticket/Game Pass page's hero, styled to match the Store's trust strip. */
export const TicketFeatureStrip = ({ items, className = "" }: TicketFeatureStripProps) => (
    <ul
        className={`grid grid-cols-1 divide-y divide-gray-200 border-b border-gray-200 text-xs font-bold text-sffl-navy sm:grid-cols-3 sm:divide-x sm:divide-y-0 dark:divide-gray-700 dark:border-gray-700 dark:text-white ${className}`}
    >
        {items.map(({ icon: Icon, label }) => (
            <li key={label} className="flex items-center justify-center gap-2 px-4 py-4 sm:px-6">
                <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                {label}
            </li>
        ))}
    </ul>
);
