import type { HeroIcon } from '../ui';

interface TicketFeatureStripProps {
    items: { icon: HeroIcon; label: string }[];
    className?: string;
}

/** Three short feature callouts under a ticket/Game Pass page's hero, specific to that page. */
export const TicketFeatureStrip = ({ items, className = "" }: TicketFeatureStripProps) => (
    <div className={`flex flex-col gap-4 border-b border-gray-200 pb-6 sm:flex-row sm:items-center sm:justify-between sm:gap-6 dark:border-gray-700 ${className}`}>
        {items.map(({ icon: Icon, label }) => (
            <p key={label} className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <Icon className="h-5 w-5 shrink-0 text-gray-400 dark:text-gray-500" aria-hidden="true" />
                <span className="min-w-0">{label}</span>
            </p>
        ))}
    </div>
);
