import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
    ArrowDownTrayIcon,
    ChartBarSquareIcon,
    DocumentTextIcon,
    ListBulletIcon,
    PresentationChartLineIcon,
    TableCellsIcon,
    UsersIcon,
} from '@heroicons/react/24/outline';
import {
    Button,
    CalendarPicker,
    Checkbox,
    DashboardPageHeader,
    DataTable,
    Field,
    Input,
    Loader,
    MatchDayTable,
    MatchReachTable,
    MetricCard,
    RankedBarList,
    Select,
    Tabs,
    TicketFunnel,
    TrafficChart,
    TrafficHeatmap,
    type Column,
} from '../../components';
import { downloadSiteTrafficExport, getSiteEvents, getSiteMatchDays, getSiteTrafficSummary } from '../../services/api';
import { getApiErrorMessage, lagosToday } from '../../utils';
import type { SiteBreakdownRow, SiteDailyPoint, SiteEvent, SiteHeatCell, SiteMatchDay, SiteMatchReach, SiteMonthlyPoint, SiteRange, SiteTrafficSummary } from '../../types';

type RangePreset = '7d' | '30d' | '90d' | 'all' | 'custom';
type TrafficTab = 'overview' | 'audience' | 'content' | 'events';

const PRESETS: { value: RangePreset; label: string; comparison: string }[] = [
    { value: '7d', label: 'Last 7 days', comparison: 'vs previous 7 days' },
    { value: '30d', label: 'Last 30 days', comparison: 'vs previous 30 days' },
    { value: '90d', label: 'Last 90 days', comparison: 'vs previous 90 days' },
    { value: 'all', label: 'All time', comparison: '' },
    { value: 'custom', label: 'Custom range', comparison: 'vs previous period' },
];

const TABS = [
    { value: 'overview' as const, label: 'Overview', icon: PresentationChartLineIcon },
    { value: 'audience' as const, label: 'Audience', icon: UsersIcon },
    { value: 'content' as const, label: 'Content & sources', icon: DocumentTextIcon },
    { value: 'events' as const, label: 'Every event', icon: ListBulletIcon },
];

const EVENT_LABELS: Record<string, string> = {
    page_view: 'Page view',
    login: 'Login',
    signup: 'Sign-up',
    ticket_checkout_started: 'Ticket checkout started',
    store_checkout_started: 'Store checkout started',
    newsletter_signup: 'Newsletter sign-up',
    add_to_cart: 'Add to cart',
    outbound_click: 'Outbound click',
    share: 'Share',
};
const eventLabel = (type: string) => EVENT_LABELS[type] ?? type;

const EVENTS_PAGE_SIZE = 25;
const NO_EVENTS: SiteEvent[] = [];
const NO_DAYS: SiteDailyPoint[] = [];
const NO_MONTHS: SiteMonthlyPoint[] = [];
const NO_ROWS: SiteBreakdownRow[] = [];
const NO_CELLS: SiteHeatCell[] = [];
const NO_MATCHES: SiteMatchReach[] = [];
const NO_MATCH_DAYS: SiteMatchDay[] = [];

const fullNumber = new Intl.NumberFormat('en-NG');
const oneDecimal = new Intl.NumberFormat('en-NG', { maximumFractionDigits: 1 });
const percent = new Intl.NumberFormat('en-NG', { style: 'percent', maximumFractionDigits: 0 });
const naira = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 });
const countryNames = new Intl.DisplayNames(['en'], { type: 'region' });

const countryLabel = (code: string) => {
    if (code.length !== 2) return code;
    try {
        return countryNames.of(code) ?? code;
    } catch {
        return code;
    }
};

// Pure calendar arithmetic on YYYY-MM-DD strings, so no timezone can shift the result.
const shiftDays = (iso: string, days: number) => {
    const d = new Date(`${iso}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
};

const formatLagos = (iso: string) =>
    new Date(iso).toLocaleString('en-GB', { timeZone: 'Africa/Lagos', dateStyle: 'medium', timeStyle: 'short' });

const fullDate = (iso: string) =>
    new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

const monthLabel = (ym: string) =>
    new Date(`${ym}-01T12:00:00Z`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });

const DAILY_COLUMNS: Column<SiteDailyPoint>[] = [
    {
        header: 'Date',
        accessor: 'date',
        sortable: true,
        className: 'whitespace-nowrap',
        cell: (d) => (
            <span className="text-gray-900 dark:text-white">
                {d.date}
                {d.match_day && <span className="ml-2 text-xs font-bold text-gray-500 dark:text-gray-400">Match day</span>}
            </span>
        ),
    },
    { header: 'Page views', align: 'right', sortable: true, sortValue: (d) => d.page_views, cell: (d) => fullNumber.format(d.page_views) },
    { header: 'Unique visitors', align: 'right', sortable: true, sortValue: (d) => d.visitors, cell: (d) => fullNumber.format(d.visitors) },
];

const MONTHLY_COLUMNS: Column<SiteMonthlyPoint>[] = [
    { header: 'Month', className: 'whitespace-nowrap', cell: (m) => <span className="font-bold text-sffl-navy dark:text-white">{monthLabel(m.month)}</span> },
    { header: 'Unique visitors', align: 'right', cell: (m) => fullNumber.format(m.visitors) },
    { header: 'Page views', align: 'right', cell: (m) => fullNumber.format(m.page_views) },
    { header: 'Sessions', align: 'right', cell: (m) => fullNumber.format(m.sessions) },
];

const EVENT_COLUMNS: Column<SiteEvent>[] = [
    {
        header: 'Event',
        cell: (e) => (
            <div className="min-w-0">
                <p className="font-bold text-sffl-navy dark:text-white">{eventLabel(e.event_type)}</p>
                {e.path && <p className="max-w-xs truncate text-xs text-gray-500 dark:text-gray-400" title={e.path}>{e.path}</p>}
            </div>
        ),
    },
    { header: 'Time (Lagos)', cell: (e) => <span className="whitespace-nowrap text-xs text-gray-600 dark:text-gray-300">{formatLagos(e.created_at)}</span> },
    { header: 'IP address', cell: (e) => <span className="font-mono text-xs text-gray-700 dark:text-gray-300">{e.ip || '—'}</span> },
    { header: 'Country', cell: (e) => (e.country ? countryLabel(e.country) : '—') },
    { header: 'Device', cell: (e) => <span className="capitalize">{e.device_type || '—'}</span> },
    { header: 'Browser', cell: (e) => e.browser || '—' },
    { header: 'Came from', cell: (e) => e.utm_source || e.referrer_host || (e.is_entry ? 'Direct' : '—') },
];

interface PanelProps {
    title: string;
    description?: string;
    actions?: ReactNode;
    children: ReactNode;
}

const Panel = ({ title, description, actions, children }: PanelProps) => (
    <section className="min-w-0 rounded-xl border border-gray-200 bg-white p-4 shadow-md dark:border-gray-700 dark:bg-gray-800 sm:p-6">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
                <h2 className="text-xl font-black text-sffl-navy dark:text-white">{title}</h2>
                {description && <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{description}</p>}
            </div>
            {actions}
        </div>
        {children}
    </section>
);

interface SectionHeadingProps {
    title: string;
    description?: string;
}

const SectionHeading = ({ title, description }: SectionHeadingProps) => (
    <div>
        <h2 className="text-xl font-black text-sffl-navy dark:text-white">{title}</h2>
        {description && <p className="text-sm text-gray-600 dark:text-gray-400">{description}</p>}
    </div>
);

interface VisitorMixProps {
    newVisitors: number;
    returningVisitors: number;
}

// One stacked bar: new (blue) and returning (orange), the validated categorical pair.
const VisitorMix = ({ newVisitors, returningVisitors }: VisitorMixProps) => {
    const total = newVisitors + returningVisitors;
    if (total === 0) {
        return <p className="text-sm text-gray-500 dark:text-gray-400">No visitors in this period yet.</p>;
    }
    const share = returningVisitors / total;
    const rows = [
        { name: 'New visitors', value: newVisitors, color: 'bg-[#2a78d6] dark:bg-[#3987e5]', hint: 'First visit we have on record' },
        { name: 'Returning visitors', value: returningVisitors, color: 'bg-[#eb6834] dark:bg-[#d95926]', hint: 'Visited before this period too' },
    ];
    return (
        <div>
            <p className="text-3xl font-black text-sffl-navy dark:text-white">{percent.format(share)}</p>
            <p className="mb-4 text-sm text-gray-600 dark:text-gray-300">of visitors had been here before</p>
            <div className="flex h-3 gap-0.5 overflow-hidden rounded-full" aria-hidden="true">
                {rows.map((r) =>
                    r.value > 0 ? <div key={r.name} className={r.color} style={{ width: `${(r.value / total) * 100}%` }} /> : null,
                )}
            </div>
            <ul className="mt-4 space-y-2">
                {rows.map((r) => (
                    <li key={r.name} className="flex items-start justify-between gap-3 text-sm">
                        <span className="flex min-w-0 items-start gap-2">
                            <span aria-hidden="true" className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-sm ${r.color}`} />
                            <span className="min-w-0">
                                <span className="block font-medium text-gray-800 dark:text-gray-100">{r.name}</span>
                                <span className="block text-xs text-gray-500 dark:text-gray-400">{r.hint}</span>
                            </span>
                        </span>
                        <strong className="shrink-0 font-black text-gray-900 dark:text-white">{fullNumber.format(r.value)}</strong>
                    </li>
                ))}
            </ul>
        </div>
    );
};

interface MatchDayCardProps {
    summary: SiteTrafficSummary;
}

const MatchDayCard = ({ summary }: MatchDayCardProps) => {
    const md = summary.match_days;
    const uplift = md.match_days > 0 && md.avg_visitors_other_day > 0 ? md.avg_visitors_match_day / md.avg_visitors_other_day : null;

    return (
        <Panel title="Match days" description="How fixtures move the audience. A strong line for sponsors.">
            {md.match_days === 0 ? (
                <p className="text-sm text-gray-600 dark:text-gray-300">No fixtures were played in this period, so there is nothing to compare yet.</p>
            ) : (
                <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                        <p className="text-3xl font-black text-sffl-navy dark:text-white">{uplift ? `${oneDecimal.format(uplift)}×` : '—'}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-300">visitors on a match day compared with other days</p>
                    </div>
                    <div>
                        <p className="text-2xl font-black text-gray-900 dark:text-white">{fullNumber.format(Math.round(md.avg_visitors_match_day))}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                            average visitors on each of {md.match_days} match {md.match_days === 1 ? 'day' : 'days'}
                        </p>
                    </div>
                    <div>
                        <p className="text-2xl font-black text-gray-900 dark:text-white">{fullNumber.format(Math.round(md.avg_visitors_other_day))}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                            average visitors on the other {md.other_days} {md.other_days === 1 ? 'day' : 'days'}
                        </p>
                    </div>
                </div>
            )}
        </Panel>
    );
};

export const AdminTraffic = () => {
    const [preset, setPreset] = useState<RangePreset>('30d');
    const [singleDay, setSingleDay] = useState(false);
    const [day, setDay] = useState('');
    const [customFrom, setCustomFrom] = useState(() => shiftDays(lagosToday(), -29));
    const [customTo, setCustomTo] = useState(() => lagosToday());
    const [tab, setTab] = useState<TrafficTab>('overview');
    const [showTable, setShowTable] = useState(false);
    const [eventType, setEventType] = useState('');
    const [includeBots, setIncludeBots] = useState(false);
    const [eventsPage, setEventsPage] = useState(1);
    const [exporting, setExporting] = useState<'summary' | 'events' | null>(null);

    const today = lagosToday();
    const includesToday = singleDay ? day >= today : preset !== 'custom' || customTo >= today;
    const customInvalid = singleDay ? !day : preset === 'custom' && (!customFrom || !customTo || customFrom > customTo);
    const comparisonLabel = PRESETS.find((p) => p.value === preset)?.comparison ?? '';

    const range = useMemo<SiteRange>(() => {
        if (singleDay) return { from: day, to: day };
        const t = lagosToday();
        switch (preset) {
            case '7d': return { from: shiftDays(t, -6), to: t };
            case '30d': return { from: shiftDays(t, -29), to: t };
            case '90d': return { from: shiftDays(t, -89), to: t };
            case 'all': return {};
            case 'custom': return { from: customFrom, to: customTo };
        }
    }, [singleDay, day, preset, customFrom, customTo]);

    // Every match day to date, for highlighting on the calendar.
    const matchDaysQuery = useQuery({
        queryKey: ['siteMatchDays'],
        queryFn: async () => (await getSiteMatchDays()).data,
    });
    const matchDayNames = useMemo(() => {
        const names: Record<string, string> = {};
        for (const d of matchDaysQuery.data ?? NO_MATCH_DAYS) names[d.date] = d.title || d.games || 'Match day';
        return names;
    }, [matchDaysQuery.data]);

    const summaryQuery = useQuery({
        queryKey: ['siteTraffic', range],
        queryFn: async () => (await getSiteTrafficSummary(range)).data,
        enabled: !customInvalid,
        placeholderData: keepPreviousData,
    });

    const eventsQuery = useQuery({
        queryKey: ['siteEvents', range, eventType, includeBots, eventsPage],
        queryFn: async () =>
            (await getSiteEvents({ ...range, page: eventsPage, limit: EVENTS_PAGE_SIZE, type: eventType || undefined, include_bots: includeBots })).data,
        enabled: !customInvalid && tab === 'events',
        placeholderData: keepPreviousData,
    });

    const changeRange = (next: RangePreset) => {
        setPreset(next);
        setEventsPage(1);
    };

    // Ticking "Single day" starts on the latest match day so far (the day most
    // worth looking at), or today when there has been none.
    const toggleSingleDay = (on: boolean) => {
        setSingleDay(on);
        setEventsPage(1);
        if (on && !day) {
            const past = (matchDaysQuery.data ?? NO_MATCH_DAYS).filter((d) => d.date <= lagosToday());
            setDay(past.length > 0 ? past[past.length - 1].date : lagosToday());
        }
    };

    // Drill into one match day from the list: the whole page narrows to that date.
    const showDay = useCallback((date: string) => {
        setSingleDay(true);
        setDay(date);
        setEventsPage(1);
        setTab('overview');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, []);

    const handleExport = async (kind: 'summary' | 'events') => {
        setExporting(kind);
        try {
            await downloadSiteTrafficExport(kind, range);
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Could not download the report'));
        } finally {
            setExporting(null);
        }
    };

    if (summaryQuery.isLoading && !customInvalid) return <Loader />;

    const summary = summaryQuery.data;
    const totals = summary?.totals;
    // A single day has no fair comparison (the day before is rarely a match day).
    const prev = singleDay ? null : (summary?.previous?.totals ?? null);
    const conv = summary?.conversions;
    const prevConv = singleDay ? null : (summary?.previous?.conversions ?? null);
    const dayInfo = singleDay ? summary?.match_day_list?.find((d) => d.date === day) : undefined;
    const hasTraffic = (totals?.page_views ?? 0) > 0 || (totals?.action_events ?? 0) > 0;
    const refreshing = summaryQuery.isFetching && !summaryQuery.isLoading;
    const totalEventPages = Math.max(1, Math.ceil((eventsQuery.data?.total ?? 0) / EVENTS_PAGE_SIZE));
    const returningShare = totals && totals.unique_visitors > 0 ? totals.returning_visitors / totals.unique_visitors : 0;

    return (
        <div className="space-y-6 sm:space-y-8 animate-fade-in">
            <DashboardPageHeader
                title="Traffic"
                subtitle="Who visits the site, where they come from and what they do. Download the audience report for sponsorship decks or to share with the team."
                actions={
                    <>
                        <Button
                            variant="outline"
                            icon={ArrowDownTrayIcon}
                            loading={exporting === 'events'}
                            disabled={customInvalid || exporting !== null}
                            onClick={() => handleExport('events')}
                        >
                            Raw events (CSV)
                        </Button>
                        <Button
                            icon={ArrowDownTrayIcon}
                            loading={exporting === 'summary'}
                            disabled={customInvalid || exporting !== null}
                            onClick={() => handleExport('summary')}
                        >
                            Audience report (CSV)
                        </Button>
                    </>
                }
            />

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
                {singleDay ? (
                    <div className="sm:w-52">
                        <CalendarPicker
                            label="Day"
                            value={day}
                            onChange={(d) => { setDay(d); setEventsPage(1); }}
                            highlightedDates={matchDayNames}
                            highlightLabel="Match day"
                            max={today}
                        />
                    </div>
                ) : (
                    <>
                        <Field label="Period" htmlFor="traffic-period" className="sm:w-52">
                            <Select id="traffic-period" value={preset} onChange={(e) => changeRange(e.target.value as RangePreset)}>
                                {PRESETS.map((p) => (
                                    <option key={p.value} value={p.value}>{p.label}</option>
                                ))}
                            </Select>
                        </Field>
                        {preset === 'custom' && (
                            <>
                                <Field label="From" htmlFor="traffic-from" className="sm:w-44">
                                    <Input id="traffic-from" type="date" value={customFrom} max={customTo || undefined} onChange={(e) => { setCustomFrom(e.target.value); setEventsPage(1); }} />
                                </Field>
                                <Field
                                    label="To"
                                    htmlFor="traffic-to"
                                    className="sm:w-44"
                                    error={customInvalid ? 'Pick a start date on or before the end date.' : undefined}
                                >
                                    <Input id="traffic-to" type="date" value={customTo} min={customFrom || undefined} invalid={customInvalid} onChange={(e) => { setCustomTo(e.target.value); setEventsPage(1); }} />
                                </Field>
                            </>
                        )}
                    </>
                )}
                <Checkbox label="Single day" checked={singleDay} onChange={(e) => toggleSingleDay(e.target.checked)} className="sm:pb-0" />
                {summary && !singleDay && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 sm:pb-3">
                        Showing {summary.from} to {summary.to}
                        {' '}· {summary.match_day_list?.length ?? 0} match {summary.match_day_list?.length === 1 ? 'day' : 'days'} in range
                        {summary.previous && <> · compared with {summary.previous.from} to {summary.previous.to}</>}
                    </p>
                )}
            </div>

            {singleDay && day && (
                <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-md dark:border-gray-700 dark:bg-gray-800 sm:p-5">
                    <p className="text-lg font-black text-sffl-navy dark:text-white">{fullDate(day)}</p>
                    {matchDayNames[day] !== undefined ? (
                        <>
                            <p className="mt-0.5 text-sm font-bold text-gray-800 dark:text-gray-100">Match day: {matchDayNames[day]}</p>
                            {dayInfo?.games && dayInfo.title && <p className="text-sm text-gray-600 dark:text-gray-300">{dayInfo.games}</p>}
                        </>
                    ) : (
                        <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-300">Not a match day. Match days are highlighted in the calendar.</p>
                    )}
                </div>
            )}

            <Tabs items={TABS} value={tab} onChange={setTab} aria-label="Traffic sections" />

            {summaryQuery.isError && (
                <div className="rounded-lg bg-red-50 p-4 text-red-600 dark:bg-red-900/20 dark:text-red-300">
                    <strong>Error:</strong> {getApiErrorMessage(summaryQuery.error, 'Failed to load traffic data')}
                </div>
            )}

            {summary && !hasTraffic && tab !== 'events' && (
                <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 p-6 text-center dark:border-gray-600 dark:bg-gray-700/50">
                    <p className="font-bold text-gray-800 dark:text-gray-100">No visits recorded for this period yet.</p>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                        Tracking runs on the live site only and counts visits from when it was switched on. New visits appear
                        here within about 30 seconds. Try "All time", or check back later.
                    </p>
                </div>
            )}

            <div className={`transition-opacity ${refreshing ? 'opacity-60' : ''}`} aria-busy={refreshing}>
                {summary && totals && conv && tab === 'overview' && (
                    <div className="space-y-6 sm:space-y-8">
                        <section aria-label="Audience reach" className="space-y-3">
                            <SectionHeading title="Audience reach" description="How many people the site reaches. Visitors are counted by IP address." />
                            <div className={`grid grid-cols-2 gap-3 sm:gap-4 ${singleDay ? 'lg:grid-cols-3' : 'lg:grid-cols-4'}`}>
                                <MetricCard label="Unique visitors" value={fullNumber.format(totals.unique_visitors)} current={totals.unique_visitors} previous={prev?.unique_visitors} comparisonLabel={comparisonLabel} />
                                {!singleDay && (
                                  <MetricCard label="Average daily visitors" value={fullNumber.format(Math.round(totals.avg_daily_visitors))} current={totals.avg_daily_visitors} previous={prev?.avg_daily_visitors} comparisonLabel={comparisonLabel} />
                                )}
                                <MetricCard label="Page views" value={fullNumber.format(totals.page_views)} current={totals.page_views} previous={prev?.page_views} comparisonLabel={comparisonLabel} />
                                <MetricCard label="Visits (sessions)" value={fullNumber.format(totals.sessions)} current={totals.sessions} previous={prev?.sessions} comparisonLabel={comparisonLabel} />
                            </div>
                        </section>

                        <section aria-label="Engagement" className="space-y-3">
                            <SectionHeading title="Engagement" description="How much each visit is worth." />
                            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                                <MetricCard label="Pages per visit" value={oneDecimal.format(totals.pages_per_session)} current={totals.pages_per_session} previous={prev?.pages_per_session} comparisonLabel={comparisonLabel} />
                                <MetricCard
                                    label="Bounce rate"
                                    value={percent.format(totals.bounce_rate)}
                                    hint="Visits that saw a single page"
                                    current={totals.bounce_rate}
                                    previous={prev?.bounce_rate}
                                    comparisonLabel={comparisonLabel}
                                    higherIsBetter={false}
                                    changeAs="points"
                                />
                                <MetricCard
                                    label="Returning visitors"
                                    value={percent.format(returningShare)}
                                    hint={`${fullNumber.format(totals.returning_visitors)} had visited before`}
                                    current={totals.returning_visitors}
                                    previous={prev?.returning_visitors}
                                    comparisonLabel={comparisonLabel}
                                />
                                <MetricCard label="Tracked actions" value={fullNumber.format(totals.action_events)} hint="Logins, sign-ups, checkouts" current={totals.action_events} previous={prev?.action_events} comparisonLabel={comparisonLabel} />
                            </div>
                        </section>

                        {!singleDay && (
                            <Panel
                                title="Visits over time"
                                description={includesToday ? "Today's numbers are still filling in." : undefined}
                                actions={
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        icon={showTable ? ChartBarSquareIcon : TableCellsIcon}
                                        onClick={() => setShowTable((v) => !v)}
                                    >
                                        {showTable ? 'Show chart' : 'Show as table'}
                                    </Button>
                                }
                            >
                                {showTable ? (
                                    <DataTable
                                        data={summary.daily ?? NO_DAYS}
                                        columns={DAILY_COLUMNS}
                                        searchable={false}
                                        itemsPerPage={10}
                                        compact
                                        getRowId={(d) => d.date}
                                        emptyMessage="No days in this period."
                                    />
                                ) : (summary.daily ?? NO_DAYS).length === 0 ? (
                                    <p className="rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 p-8 text-center text-sm text-gray-500 dark:border-gray-600 dark:bg-gray-700/50 dark:text-gray-400">
                                        No page views to chart in this period.
                                    </p>
                                ) : (
                                    <TrafficChart data={summary.daily} />
                                )}
                            </Panel>
                        )}

                        {!singleDay && <MatchDayCard summary={summary} />}

                        {!singleDay && (
                            <Panel
                                title="Match days in this period"
                                description="Every match day (from Match Days and fixtures), numbered as on the chart. Use the row menu to see one day on its own."
                            >
                                <MatchDayTable
                                    days={summary.match_day_list ?? NO_MATCH_DAYS}
                                    typicalVisitors={summary.match_days?.avg_visitors_other_day}
                                    onSelectDay={showDay}
                                />
                            </Panel>
                        )}

                        <section aria-label="Results" className="space-y-3">
                            <SectionHeading
                                title="What visitors did"
                                description="Accounts, tickets and store orders come straight from the platform's records, so they are exact and count paid orders only."
                            />
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
                                <MetricCard label="New accounts" value={fullNumber.format(conv.new_users)} current={conv.new_users} previous={prevConv?.new_users} comparisonLabel={comparisonLabel} />
                                <MetricCard
                                    label="Tickets sold"
                                    value={fullNumber.format(conv.tickets_sold)}
                                    hint={`${fullNumber.format(conv.ticket_orders)} orders · ${naira.format(conv.ticket_revenue)}`}
                                    current={conv.tickets_sold}
                                    previous={prevConv?.tickets_sold}
                                    comparisonLabel={comparisonLabel}
                                />
                                <MetricCard
                                    label="Store orders"
                                    value={fullNumber.format(conv.store_orders)}
                                    hint={naira.format(conv.store_revenue)}
                                    current={conv.store_orders}
                                    previous={prevConv?.store_orders}
                                    comparisonLabel={comparisonLabel}
                                />
                            </div>
                        </section>

                        {summary.ticket_funnel && (
                            <Panel
                                title="Ticket funnel"
                                description="How many visitors move toward a ticket, and where they drop off. Use it to judge ticket campaigns and checkout changes."
                            >
                                <TicketFunnel funnel={summary.ticket_funnel} />
                            </Panel>
                        )}

                        {!singleDay && (
                            <Panel title="Month by month" description="Monthly reach, ready to quote. The current month is still in progress.">
                                <DataTable
                                    data={summary.monthly ?? NO_MONTHS}
                                    columns={MONTHLY_COLUMNS}
                                    searchable={false}
                                    paginated={false}
                                    compact
                                    getRowId={(m) => m.month}
                                    emptyMessage="No months with visits in this period."
                                />
                            </Panel>
                        )}

                        {totals.bot_events_excluded > 0 && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                {fullNumber.format(totals.bot_events_excluded)} automated visits (search crawlers and monitors) are left out of every number on this page.
                            </p>
                        )}
                    </div>
                )}

                {summary && totals && tab === 'audience' && (
                    <div className="space-y-6 lg:space-y-8">
                        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-8">
                            <Panel title="New and returning">
                                <VisitorMix newVisitors={totals.new_visitors} returningVisitors={totals.returning_visitors} />
                            </Panel>
                            <div className="min-w-0 lg:col-span-2">
                                <Panel title="When people visit" description="Page views by day and hour, Lagos time. Useful for timing posts and sponsor activations.">
                                    <TrafficHeatmap cells={summary.heatmap ?? NO_CELLS} />
                                </Panel>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8">
                            <RankedBarList title="Countries" countLabel="views" rows={summary.countries ?? NO_ROWS} formatName={countryLabel} />
                            <RankedBarList title="Devices" countLabel="views" rows={summary.devices ?? NO_ROWS} formatName={(n) => n.charAt(0).toUpperCase() + n.slice(1)} />
                            <RankedBarList title="Browsers" countLabel="views" rows={summary.browsers ?? NO_ROWS} />
                            <RankedBarList title="Operating systems" countLabel="views" rows={summary.oses ?? NO_ROWS} />
                        </div>
                    </div>
                )}

                {summary && tab === 'content' && (
                    <div className="space-y-6 lg:space-y-8">
                        <Panel
                            title="Most viewed matches"
                            description="Each match page's audience, split into the build-up, match day and after. The figure sponsors ask for first."
                        >
                            <MatchReachTable matches={summary.top_matches ?? NO_MATCHES} />
                        </Panel>
                        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8">
                            <RankedBarList title="Most read news" countLabel="views" rows={summary.top_news ?? NO_ROWS} emptyMessage="No news stories were read in this period." />
                            <RankedBarList title="Site sections" countLabel="views" rows={summary.sections ?? NO_ROWS} />
                            <RankedBarList title="Most viewed players" countLabel="views" rows={summary.top_players ?? NO_ROWS} emptyMessage="No player profiles were viewed in this period." />
                            <RankedBarList title="Most viewed teams" countLabel="views" rows={summary.top_teams ?? NO_ROWS} emptyMessage="No team pages were viewed in this period." />
                            <RankedBarList title="Where visits come from" countLabel="visits" rows={summary.sources ?? NO_ROWS} emptyMessage="No visits with a known source yet." />
                            <RankedBarList title="Campaigns" countLabel="visits" rows={summary.campaigns ?? NO_ROWS} emptyMessage="No campaign links used yet. Add ?utm_campaign=name to a shared link to see it here." />
                            <RankedBarList title="Actions taken" countLabel="times" rows={summary.actions ?? NO_ROWS} formatName={eventLabel} emptyMessage="No logins, sign-ups or checkouts recorded yet." />
                        </div>
                    </div>
                )}
            </div>

            {tab === 'events' && (
                <Panel title="Every event" description='The raw records behind the numbers, newest first. Use "Raw events (CSV)" at the top to download the whole period.'>
                    <DataTable
                        data={eventsQuery.data?.events ?? NO_EVENTS}
                        columns={EVENT_COLUMNS}
                        searchable={false}
                        loading={eventsQuery.isLoading}
                        serverPage={eventsPage}
                        totalServerPages={totalEventPages}
                        onPageChange={setEventsPage}
                        getRowId={(e) => String(e.id)}
                        emptyMessage="No events match these filters."
                        headerActions={
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                <Select
                                    aria-label="Event type"
                                    value={eventType}
                                    onChange={(e) => { setEventType(e.target.value); setEventsPage(1); }}
                                    className="sm:w-60"
                                >
                                    <option value="">All events</option>
                                    {Object.entries(EVENT_LABELS).map(([value, label]) => (
                                        <option key={value} value={value}>{label}</option>
                                    ))}
                                </Select>
                                <Checkbox
                                    label="Include automated visits"
                                    checked={includeBots}
                                    onChange={(e) => { setIncludeBots(e.target.checked); setEventsPage(1); }}
                                />
                            </div>
                        }
                    />
                </Panel>
            )}
        </div>
    );
};
