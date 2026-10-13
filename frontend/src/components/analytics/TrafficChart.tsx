import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useTheme } from '../../contexts';
import type { SiteDailyPoint } from '../../types';

// Two counts on one shared axis, so the lines are directly comparable. The
// pair is validated for colour-blind separation and contrast in both themes
// (blue/orange, categorical slots 1-2 of the dataviz reference palette).
const THEME = {
    light: { views: '#2a78d6', visitors: '#eb6834', grid: '#e5e7eb', axis: '#6b7280', surface: '#ffffff' },
    dark: { views: '#3987e5', visitors: '#d95926', grid: '#374151', axis: '#9ca3af', surface: '#1f2937' },
} as const;

const compact = new Intl.NumberFormat('en-NG', { notation: 'compact' });
const fullNumber = new Intl.NumberFormat('en-NG');

// Parsed at midday so a viewer's timezone can never push the label onto a neighbouring day.
const parseDay = (iso: string) => new Date(`${iso}T12:00:00`);
const shortDay = (iso: string) => parseDay(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const longDay = (iso: string) =>
    parseDay(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

interface TooltipRow {
    name?: string | number;
    value?: number | string;
    color?: string;
    payload?: SiteDailyPoint;
}

interface TrafficTooltipProps {
    active?: boolean;
    payload?: readonly TooltipRow[];
    label?: string | number;
}

// Values lead and series names follow; each row is keyed by a short stroke of its series colour.
const TrafficTooltip = ({ active, payload, label }: TrafficTooltipProps) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-lg dark:border-gray-600 dark:bg-gray-800">
            <p className="mb-1 text-xs font-bold text-gray-500 dark:text-gray-400">
                {longDay(String(label))}
                {payload[0]?.payload?.match_day && <span className="ml-2 text-gray-700 dark:text-gray-200">Match day</span>}
            </p>
            {payload.map((row) => (
                <p key={String(row.name)} className="flex items-center gap-2 text-sm">
                    <span aria-hidden="true" className="h-0.5 w-4 rounded-full" style={{ backgroundColor: row.color }} />
                    <span className="font-black text-gray-900 dark:text-white">{fullNumber.format(Number(row.value))}</span>
                    <span className="text-gray-600 dark:text-gray-300">{row.name}</span>
                </p>
            ))}
        </div>
    );
};

interface TrafficChartProps {
    data: SiteDailyPoint[];
}

export const TrafficChart = ({ data }: TrafficChartProps) => {
    const { isDarkMode } = useTheme();
    const c = isDarkMode ? THEME.dark : THEME.light;
    const hasMatchDays = data.some((d) => d.match_day);

    // Match days get a ringed dot on the page-views line, so traffic spikes can
    // be read against the fixture calendar at a glance.
    const matchDayDot = (props: { cx?: number; cy?: number; index?: number; payload?: SiteDailyPoint }) =>
        props.payload?.match_day && props.cx !== undefined && props.cy !== undefined ? (
            <circle key={`md-${props.index}`} cx={props.cx} cy={props.cy} r={4.5} fill={c.views} stroke={c.surface} strokeWidth={2} />
        ) : (
            <g key={`md-${props.index}`} />
        );

    return (
        <div>
            <ul className="mb-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-gray-700 dark:text-gray-200">
                <li className="flex items-center gap-2">
                    <span aria-hidden="true" className="h-0.5 w-5 rounded-full" style={{ backgroundColor: c.views }} />
                    Page views
                </li>
                <li className="flex items-center gap-2">
                    <span
                        aria-hidden="true"
                        className="h-0.5 w-5"
                        style={{ backgroundImage: `linear-gradient(to right, ${c.visitors} 60%, transparent 60%)`, backgroundSize: '8px 100%' }}
                    />
                    Unique visitors
                </li>
                {hasMatchDays && (
                    <li className="flex items-center gap-2">
                        <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-gray-800" style={{ backgroundColor: c.views }} />
                        Match day
                    </li>
                )}
            </ul>
            <div className="h-72" role="img" aria-label="Line chart of daily page views and unique visitors">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                        <CartesianGrid vertical={false} stroke={c.grid} strokeWidth={1} />
                        <XAxis
                            dataKey="date"
                            tickFormatter={shortDay}
                            tick={{ fill: c.axis, fontSize: 12 }}
                            tickLine={false}
                            axisLine={{ stroke: c.grid }}
                            minTickGap={28}
                        />
                        <YAxis
                            width={40}
                            allowDecimals={false}
                            tickFormatter={(v: number) => compact.format(v)}
                            tick={{ fill: c.axis, fontSize: 12 }}
                            tickLine={false}
                            axisLine={false}
                        />
                        <Tooltip content={<TrafficTooltip />} cursor={{ stroke: c.axis, strokeWidth: 1 }} />
                        <Line
                            type="monotone"
                            dataKey="page_views"
                            name="Page views"
                            stroke={c.views}
                            strokeWidth={2}
                            dot={data.length < 2 ? true : matchDayDot}
                            activeDot={{ r: 4, stroke: c.surface, strokeWidth: 2 }}
                            isAnimationActive={false}
                        />
                        <Line
                            type="monotone"
                            dataKey="visitors"
                            name="Unique visitors"
                            stroke={c.visitors}
                            strokeWidth={2}
                            strokeDasharray="6 4"
                            dot={data.length < 2}
                            activeDot={{ r: 4, stroke: c.surface, strokeWidth: 2 }}
                            isAnimationActive={false}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};
