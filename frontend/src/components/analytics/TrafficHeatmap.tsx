import { useMemo, useState } from 'react';
import { useTheme } from '../../contexts';
import type { SiteHeatCell } from '../../types';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const HOURS = Array.from({ length: 24 }, (_, h) => h);

// One blue, light to dark, from the dataviz reference ramp. On the dark surface
// the order flips so quiet slots recede into the background either way.
const RAMP_LIGHT = ['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95', '#0d366b'];
const RAMP_DARK = ['#0d366b', '#184f95', '#256abf', '#3987e5', '#6da7ec', '#9ec5f4', '#cde2fb'];

const fullNumber = new Intl.NumberFormat('en-NG');

const hourLabel = (h: number) => `${((h + 11) % 12) + 1}${h < 12 ? 'am' : 'pm'}`;
const slotLabel = (weekday: number, hour: number) =>
    `${DAYS[weekday - 1]} ${hourLabel(hour)}–${hourLabel((hour + 1) % 24)}`;

interface TrafficHeatmapProps {
    cells: SiteHeatCell[];
}

/** Page views by weekday and hour (Lagos time): when the audience is online. */
export const TrafficHeatmap = ({ cells }: TrafficHeatmapProps) => {
    const { isDarkMode } = useTheme();
    const ramp = isDarkMode ? RAMP_DARK : RAMP_LIGHT;
    const [active, setActive] = useState<SiteHeatCell | null>(null);

    const { grid, max, busiest } = useMemo(() => {
        const g = DAYS.map(() => HOURS.map(() => 0));
        for (const c of cells) g[c.weekday - 1][c.hour] = c.page_views;
        const top = [...cells].sort((a, b) => b.page_views - a.page_views).slice(0, 3);
        return { grid: g, max: Math.max(1, ...cells.map((c) => c.page_views)), busiest: top };
    }, [cells]);

    const colorFor = (v: number) => ramp[Math.min(ramp.length - 1, Math.ceil((v / max) * ramp.length) - 1)];

    if (cells.length === 0) {
        return (
            <p className="rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500 dark:border-gray-600 dark:bg-gray-700/50 dark:text-gray-400">
                Not enough visits yet to show when people are online.
            </p>
        );
    }

    return (
        <div>
            <p className="mb-3 text-sm text-gray-700 dark:text-gray-200">
                <span className="font-bold">Busiest: </span>
                {busiest.map((c) => slotLabel(c.weekday, c.hour)).join(', ')}
            </p>

            <p className="mb-2 min-h-5 text-sm text-gray-600 dark:text-gray-300" aria-live="polite">
                {active ? (
                    <>
                        <strong className="font-black text-gray-900 dark:text-white">{fullNumber.format(active.page_views)}</strong>{' '}
                        page views on {slotLabel(active.weekday, active.hour)}
                    </>
                ) : (
                    'Point at or tab to a square to see its number.'
                )}
            </p>

            <div className="overflow-x-auto pb-2">
                <div className="grid grid-cols-[2.25rem_repeat(24,minmax(0,1fr))] gap-px sm:min-w-[560px] sm:grid-cols-[2.75rem_repeat(24,minmax(0,1fr))] sm:gap-0.5" role="grid" aria-label="Page views by weekday and hour, Lagos time">
                    {grid.map((row, d) => (
                        <div key={DAYS[d]} role="row" className="contents">
                            <div role="rowheader" className="flex items-center text-xs font-bold text-gray-600 dark:text-gray-300">
                                {DAYS[d].slice(0, 3)}
                            </div>
                            {row.map((v, h) => {
                                const cell = { weekday: d + 1, hour: h, page_views: v };
                                return (
                                    <div
                                        key={h}
                                        role="gridcell"
                                        tabIndex={0}
                                        aria-label={`${slotLabel(d + 1, h)}: ${fullNumber.format(v)} page views`}
                                        onPointerEnter={() => setActive(cell)}
                                        onPointerLeave={() => setActive(null)}
                                        onFocus={() => setActive(cell)}
                                        onBlur={() => setActive(null)}
                                        className={`aspect-square rounded-sm outline-none transition-shadow hover:ring-2 hover:ring-gray-900 focus-visible:ring-2 focus-visible:ring-gray-900 dark:hover:ring-white dark:focus-visible:ring-white ${
                                            v === 0 ? 'bg-gray-100 dark:bg-gray-700/50' : ''
                                        }`}
                                        style={v > 0 ? { backgroundColor: colorFor(v) } : undefined}
                                    />
                                );
                            })}
                        </div>
                    ))}
                    <div />
                    {HOURS.map((h) => (
                        <div key={h} className="pt-1 text-center text-[10px] text-gray-500 dark:text-gray-400">
                            {h % 3 === 0 ? hourLabel(h) : ''}
                        </div>
                    ))}
                </div>
            </div>

            <div className="mt-2 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400" aria-hidden="true">
                Fewer
                <span className="flex gap-0.5">
                    {ramp.map((c) => (
                        <span key={c} className="h-3 w-4 rounded-sm" style={{ backgroundColor: c }} />
                    ))}
                </span>
                More
            </div>
        </div>
    );
};
