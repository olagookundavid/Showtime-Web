import type { ReactNode } from 'react';
import { CheckIcon } from '@heroicons/react/24/outline';
import type { TicketProductResponse } from '../../types';
import { naira, perksOf, taglineOf } from './ticketFormat';

interface TicketProductCardProps {
    product: TicketProductResponse;
    /** Its 1-based position among the products shown, for the corner badge. */
    position: number;
    /** The most expensive ticket gets the navy card. */
    highlight?: boolean;
    /** The CTA button and whatever else the page needs to choose days. */
    children: ReactNode;
}

/** A ticket you can buy: its name, price from, perks, then whatever the page needs to choose days. */
export const TicketProductCard = ({ product, position, highlight = false, children }: TicketProductCardProps) => {
    const tagline = taglineOf(product.description);
    const perks = perksOf(product.description);
    const prices = product.days.map((d) => d.price);
    const from = prices.length > 0 ? Math.min(...prices) : product.base_price;
    const varies = prices.length > 0 && Math.max(...prices) !== from;

    return (
        <article
            className={`flex flex-col border ${
                highlight
                    ? 'border-sffl-navy bg-sffl-navy text-white'
                    : 'border-gray-200 bg-white text-sffl-navy dark:border-gray-700 dark:bg-gray-900 dark:text-white'
            }`}
        >
            <div className="flex min-h-72 flex-1 flex-col gap-4 p-6 sm:p-8">
                <div className="flex items-center justify-between gap-2">
                    <p
                        className={`text-[11px] font-black uppercase tracking-[0.2em] ${
                            highlight ? 'text-sffl-gold' : 'text-sffl-red'
                        }`}
                    >
                        {product.name}
                    </p>
                    <span
                        aria-hidden="true"
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${
                            highlight ? 'border-sffl-gold/50 text-sffl-gold' : 'border-gray-300 text-gray-400 dark:border-gray-600'
                        }`}
                    >
                        {String(position).padStart(2, '0')}
                    </span>
                </div>

                <div>
                    <p className="text-4xl font-black leading-none sm:text-5xl">
                        {from === 0 ? 'Free' : naira(from)}
                        {varies && (
                            <span
                                className={`ml-2 text-xs font-bold ${
                                    highlight ? 'text-white/70' : 'text-gray-500 dark:text-gray-400'
                                }`}
                            >
                                and up
                            </span>
                        )}
                    </p>
                    <p className={`mt-1 text-xs ${highlight ? 'text-white/60' : 'text-gray-500 dark:text-gray-400'}`}>
                        per match day
                    </p>
                </div>

                {tagline && (
                    <p className={`text-sm ${highlight ? 'text-white/85' : 'text-gray-600 dark:text-gray-300'}`}>{tagline}</p>
                )}

                {perks.length > 0 && (
                    <ul className="flex-1 space-y-3">
                        {perks.map((perk) => (
                            <li
                                key={perk}
                                className={`flex items-start gap-2 text-sm ${
                                    highlight ? 'text-white/85' : 'text-gray-600 dark:text-gray-300'
                                }`}
                            >
                                <CheckIcon
                                    className={`mt-0.5 h-4 w-4 shrink-0 ${
                                        highlight ? 'text-sffl-gold' : 'text-sffl-red'
                                    }`}
                                    aria-hidden="true"
                                />
                                <span className="min-w-0 wrap-break-word">{perk}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <div
                className={`space-y-3 p-5 sm:p-6 ${
                    highlight
                        ? 'border-t border-white/10 bg-sffl-navy text-white'
                        : 'bg-white text-sffl-navy dark:bg-gray-800 dark:text-white'
                }`}
            >
                {children}
            </div>
        </article>
    );
};
