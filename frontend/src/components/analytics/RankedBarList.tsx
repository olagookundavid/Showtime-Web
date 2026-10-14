import type { SiteBreakdownRow } from '../../types';

const fullNumber = new Intl.NumberFormat('en-NG');

interface RankedBarListProps {
    title: string;
    /** What the bold number counts, e.g. "views" or "visits". */
    countLabel: string;
    rows: SiteBreakdownRow[];
    /** Turns a stored value (a country code, an event type) into reader-friendly text. */
    formatName?: (name: string) => string;
    emptyMessage?: string;
}

/** A ranked list with a thin bar per row. The bar compares rows within the list; the numbers carry the exact values. */
export const RankedBarList = ({
    title,
    countLabel,
    rows,
    formatName = (n) => n,
    emptyMessage = 'Nothing recorded in this period yet.',
}: RankedBarListProps) => {
    const max = Math.max(1, ...rows.map((r) => r.count));

    return (
        <section className="min-w-0 rounded-xl border border-gray-200 bg-white p-4 shadow-md dark:border-gray-700 dark:bg-gray-800 sm:p-6">
            <h2 className="mb-4 text-lg font-black text-sffl-navy dark:text-white">{title}</h2>
            {rows.length === 0 ? (
                <p className="rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 p-4 text-center text-sm text-gray-500 dark:border-gray-600 dark:bg-gray-700/50 dark:text-gray-400">
                    {emptyMessage}
                </p>
            ) : (
                <ol className="space-y-3">
                    {rows.map((row) => {
                        const name = row.label || formatName(row.name);
                        return (
                            <li key={row.name} className="min-w-0">
                                <div className="flex items-baseline justify-between gap-3 text-sm">
                                    <span className="min-w-0 truncate font-medium text-gray-800 dark:text-gray-100" title={row.label ? row.name : name}>
                                        {name}
                                    </span>
                                    <span className="shrink-0 text-gray-600 dark:text-gray-300">
                                        <strong className="font-black text-gray-900 dark:text-white">
                                            {fullNumber.format(row.count)}
                                        </strong>{' '}
                                        {row.count === 1 ? countLabel.replace(/s$/, '') : countLabel}
                                        <span className="text-gray-400 dark:text-gray-500">
                                            {' '}
                                            · {fullNumber.format(row.visitors)} {row.visitors === 1 ? 'visitor' : 'visitors'}
                                        </span>
                                    </span>
                                </div>
                                <div className="mt-1 h-1.5 rounded-full bg-gray-100 dark:bg-gray-700" aria-hidden="true">
                                    <div
                                        className="h-full rounded-r-full rounded-l-sm bg-[#2a78d6] dark:bg-[#3987e5]"
                                        style={{ width: `${Math.max(2, (row.count / max) * 100)}%` }}
                                    />
                                </div>
                            </li>
                        );
                    })}
                </ol>
            )}
        </section>
    );
};
