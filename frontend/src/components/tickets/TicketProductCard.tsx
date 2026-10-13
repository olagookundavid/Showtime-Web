import type { ReactNode } from 'react';
import { CheckIcon } from '@heroicons/react/24/outline';
import type { TicketProductResponse } from '../../types';
import { naira, perksOf } from './ticketFormat';

interface TicketProductCardProps {
    product: TicketProductResponse;
    /** The most expensive ticket gets the navy card. */
    highlight?: boolean;
    /** The day picker and the buy button. */
    children: ReactNode;
}

/** A ticket you can buy: its name, price from, perks, then whatever the page needs to choose days. */
export const TicketProductCard = ({ product, highlight = false, children }: TicketProductCardProps) => {
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
            <div className="flex flex-1 flex-col gap-4 p-5 sm:p-6">
                <p
                    className={`text-[11px] font-black uppercase tracking-[0.2em] ${
                        highlight ? 'text-amber-300' : 'text-sffl-red'
                    }`}
                >
                    {product.name}
                </p>
                <p className="text-3xl font-black leading-none sm:text-4xl">
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

                {perks.length > 0 && (
                    <ul className="space-y-2">
                        {perks.map((perk) => (
                            <li
                                key={perk}
                                className={`flex items-start gap-2 text-sm ${
                                    highlight ? 'text-white/85' : 'text-gray-600 dark:text-gray-300'
                                }`}
                            >
                                <CheckIcon
                                    className={`mt-0.5 h-4 w-4 shrink-0 ${
                                        highlight ? 'text-amber-300' : 'text-sffl-red'
                                    }`}
                                    aria-hidden="true"
                                />
                                <span className="min-w-0 wrap-break-word">{perk}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {/* The day picker sits on a light panel so it reads the same on the navy card. */}
            <div className="space-y-3 bg-white p-4 text-sffl-navy sm:p-5 dark:bg-gray-800 dark:text-white">{children}</div>
        </article>
    );
};
