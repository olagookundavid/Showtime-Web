import type { SiteTicketFunnel } from '../../types';

const fullNumber = new Intl.NumberFormat('en-NG');
const percent = new Intl.NumberFormat('en-NG', { style: 'percent', maximumFractionDigits: 1 });

interface TicketFunnelProps {
    funnel: SiteTicketFunnel;
}

/** Steps from visiting the site to a paid ticket order, each bar sized against the first step. */
export const TicketFunnel = ({ funnel }: TicketFunnelProps) => {
    const steps = [
        { label: 'Visited the site', hint: 'Unique visitors', value: funnel.visitors },
        { label: 'Opened a ticket page', hint: 'Tickets or Game Pass', value: funnel.ticket_page_visitors },
        { label: 'Started checkout', hint: 'Sent to payment', value: funnel.checkout_starters },
        { label: 'Paid', hint: 'Online orders, from ticket records', value: funnel.paid_orders },
    ];
    const top = Math.max(1, funnel.visitors);

    if (funnel.visitors === 0) {
        return <p className="text-sm text-gray-500 dark:text-gray-400">No visits in this period yet.</p>;
    }

    return (
        <ol className="space-y-4">
            {steps.map((step, i) => {
                const prev = i > 0 ? steps[i - 1].value : 0;
                return (
                    <li key={step.label} className="min-w-0">
                        <div className="flex items-baseline justify-between gap-3 text-sm">
                            <span className="min-w-0">
                                <span className="block font-bold text-gray-800 dark:text-gray-100">
                                    {i + 1}. {step.label}
                                </span>
                                <span className="block text-xs text-gray-500 dark:text-gray-400">{step.hint}</span>
                            </span>
                            <span className="shrink-0 text-right">
                                <strong className="block text-lg font-black text-gray-900 dark:text-white">{fullNumber.format(step.value)}</strong>
                                {i > 0 && (
                                    <span className="block text-xs text-gray-500 dark:text-gray-400">
                                        {prev > 0 ? `${percent.format(step.value / prev)} of previous step` : '—'}
                                    </span>
                                )}
                            </span>
                        </div>
                        <div className="mt-1.5 h-2.5 rounded-full bg-gray-100 dark:bg-gray-700" aria-hidden="true">
                            <div
                                className="h-full rounded-full bg-[#2a78d6] dark:bg-[#3987e5]"
                                style={{ width: `${step.value > 0 ? Math.max(1.5, (step.value / top) * 100) : 0}%` }}
                            />
                        </div>
                    </li>
                );
            })}
        </ol>
    );
};
