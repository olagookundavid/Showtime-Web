import { ArrowTrendingDownIcon, ArrowTrendingUpIcon, MinusIcon } from '@heroicons/react/24/outline';

interface MetricCardProps {
    label: string;
    value: string;
    hint?: string;
    /** Raw numbers for the change chip. Leave `previous` out to hide the chip (e.g. "All time"). */
    current?: number;
    previous?: number | null;
    /** e.g. "vs previous 30 days". */
    comparisonLabel?: string;
    /** false for metrics where a fall is good news, like bounce rate. */
    higherIsBetter?: boolean;
    /** 'points' for rates (0-1): a move from 40% to 44% reads "+4 pts", not "+10%". */
    changeAs?: 'percent' | 'points';
}

const Change = ({
    current,
    previous,
    comparisonLabel,
    higherIsBetter,
    changeAs,
}: Required<Pick<MetricCardProps, 'current' | 'comparisonLabel' | 'higherIsBetter' | 'changeAs'>> & { previous: number }) => {
    if (changeAs === 'points') {
        const pts = (current - previous) * 100;
        if (Math.abs(pts) < 0.5) {
            return (
                <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                    <MinusIcon className="h-4 w-4" aria-hidden="true" />
                    No change {comparisonLabel}
                </p>
            );
        }
        return <ChangeChip up={pts > 0} good={pts > 0 === higherIsBetter} text={`${pts > 0 ? '+' : ''}${pts.toFixed(0)} pts`} comparisonLabel={comparisonLabel} />;
    }
    if (previous === 0) {
        return current > 0 ? (
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">No data for the previous period</p>
        ) : null;
    }

    const change = (current - previous) / previous;
    const percent = `${change > 0 ? '+' : ''}${(change * 100).toFixed(Math.abs(change) < 0.1 ? 1 : 0)}%`;

    if (Math.abs(change) < 0.005) {
        return (
            <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                <MinusIcon className="h-4 w-4" aria-hidden="true" />
                No change {comparisonLabel}
            </p>
        );
    }

    return <ChangeChip up={change > 0} good={change > 0 === higherIsBetter} text={percent} comparisonLabel={comparisonLabel} />;
};

interface ChangeChipProps {
    up: boolean;
    good: boolean;
    text: string;
    comparisonLabel: string;
}

// Colour says good or bad; the arrow and the signed number say which way, so
// the meaning never rests on colour alone.
const ChangeChip = ({ up, good, text, comparisonLabel }: ChangeChipProps) => {
    const Icon = up ? ArrowTrendingUpIcon : ArrowTrendingDownIcon;
    return (
        <p
            className={`mt-2 inline-flex items-center gap-1.5 text-xs font-bold ${
                good ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'
            }`}
        >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {text} <span className="font-normal text-gray-500 dark:text-gray-400">{comparisonLabel}</span>
        </p>
    );
};

/** A headline number with an optional "vs previous period" change. */
export const MetricCard = ({
    label,
    value,
    hint,
    current,
    previous,
    comparisonLabel = 'vs previous period',
    higherIsBetter = true,
    changeAs = 'percent',
}: MetricCardProps) => (
    <div className="min-w-0 rounded-xl border border-gray-200 bg-white p-4 shadow-md dark:border-gray-700 dark:bg-gray-800 sm:p-5">
        <p className="text-xs font-bold text-gray-500 dark:text-gray-400">{label}</p>
        <p className="mt-1 text-2xl font-black text-sffl-navy dark:text-white sm:text-3xl">{value}</p>
        {hint && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{hint}</p>}
        {current !== undefined && previous !== undefined && previous !== null && (
            <Change current={current} previous={previous} comparisonLabel={comparisonLabel} higherIsBetter={higherIsBetter} changeAs={changeAs} />
        )}
    </div>
);
