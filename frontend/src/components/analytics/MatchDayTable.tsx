import { useMemo } from 'react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { DataTable, RowActions, type Column } from '../ui';
import type { SiteMatchDay } from '../../types';

const fullNumber = new Intl.NumberFormat('en-NG');
const oneDecimal = new Intl.NumberFormat('en-NG', { maximumFractionDigits: 1 });

const dayLabel = (iso: string) =>
    new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

/** What the dashboard calls a match day: its event-day title, else its fixtures. */
const dayName = (d: SiteMatchDay) => d.title || d.games || 'Match day';

type NumberedDay = SiteMatchDay & { n: number };

interface MatchDayTableProps {
    days: SiteMatchDay[];
    /** Average daily visitors on non-match days; shows each day's multiple of it. Leave out to hide that column. */
    typicalVisitors?: number;
    /** Narrows the whole page to one day. */
    onSelectDay: (date: string) => void;
}

/** Every match day in the period, numbered to match the markers on the visits chart. */
export const MatchDayTable = ({ days, typicalVisitors, onSelectDay }: MatchDayTableProps) => {
    const rows = useMemo<NumberedDay[]>(() => days.map((d, i) => ({ ...d, n: i + 1 })), [days]);

    const columns = useMemo<Column<NumberedDay>[]>(() => {
        const cols: Column<NumberedDay>[] = [
            {
                header: 'Match day',
                cell: (d) => (
                    <div className="flex min-w-0 items-start gap-2.5">
                        <span className="mt-0.5 inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 px-1.5 text-xs font-black text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                            {d.n}
                        </span>
                        <div className="min-w-0">
                            <p className="font-bold text-sffl-navy dark:text-white">{dayName(d)}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{dayLabel(d.date)}</p>
                            {d.title && d.games && (
                                <p className="max-w-xs truncate text-xs text-gray-500 dark:text-gray-400" title={d.games}>
                                    {d.games}
                                </p>
                            )}
                        </div>
                    </div>
                ),
            },
            { header: 'Fixtures', align: 'right', cell: (d) => (d.fixtures > 0 ? d.fixtures : '—') },
            {
                header: 'Unique visitors',
                align: 'right',
                sortable: true,
                sortValue: (d) => d.visitors,
                cell: (d) => <strong className="text-gray-900 dark:text-white">{fullNumber.format(d.visitors)}</strong>,
            },
            { header: 'Page views', align: 'right', sortable: true, sortValue: (d) => d.page_views, cell: (d) => fullNumber.format(d.page_views) },
        ];
        if (typicalVisitors && typicalVisitors > 0) {
            cols.push({
                header: 'vs a normal day',
                align: 'right',
                sortable: true,
                sortValue: (d) => d.visitors / typicalVisitors,
                cell: (d) => `${oneDecimal.format(d.visitors / typicalVisitors)}×`,
            });
        }
        cols.push({
            header: 'Actions',
            align: 'right',
            cell: (d) => (
                <RowActions
                    label={`Actions for ${dayName(d)}`}
                    actions={[{ label: 'See this day only', icon: MagnifyingGlassIcon, onSelect: () => onSelectDay(d.date) }]}
                />
            ),
        });
        return cols;
    }, [typicalVisitors, onSelectDay]);

    return (
        <DataTable
            data={rows}
            columns={columns}
            searchable={false}
            paginated={rows.length > 15}
            itemsPerPage={15}
            getRowId={(d) => d.date}
            emptyMessage="No match days in this period. Match days come from Match Days (event days) and fixtures."
        />
    );
};
