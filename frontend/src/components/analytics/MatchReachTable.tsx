import { Link } from 'react-router-dom';
import { DataTable, type Column } from '../ui';
import type { SiteMatchReach } from '../../types';

const fullNumber = new Intl.NumberFormat('en-NG');

// Validated categorical slots 1-3 (blue, orange, aqua) in both themes. The
// exact counts sit beside every bar, so the colours are never the only cue.
const SPLIT = [
    { key: 'build_up', label: 'Before match day', className: 'bg-[#2a78d6] dark:bg-[#3987e5]' },
    { key: 'match_day', label: 'On match day', className: 'bg-[#eb6834] dark:bg-[#d95926]' },
    { key: 'after', label: 'After', className: 'bg-[#1baf7a] dark:bg-[#199e70]' },
] as const;

const matchDate = (iso: string) =>
    new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

const SplitBar = ({ m }: { m: SiteMatchReach }) => (
    <div className="flex h-2.5 w-36 gap-0.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700" aria-hidden="true">
        {SPLIT.map((s) =>
            m[s.key] > 0 ? <div key={s.key} className={s.className} style={{ width: `${(m[s.key] / m.views) * 100}%` }} /> : null,
        )}
    </div>
);

const COLUMNS: Column<SiteMatchReach>[] = [
    {
        header: 'Match',
        cell: (m) => (
            <div className="min-w-0">
                <Link to={`/matches/${m.match_id}`} className="font-bold text-sffl-navy hover:underline dark:text-white">
                    {m.label}
                </Link>
                <p className="text-xs text-gray-500 dark:text-gray-400">{matchDate(m.date)}</p>
            </div>
        ),
    },
    { header: 'Page views', align: 'right', sortable: true, sortValue: (m) => m.views, cell: (m) => <strong>{fullNumber.format(m.views)}</strong> },
    { header: 'Unique visitors', align: 'right', sortable: true, sortValue: (m) => m.visitors, cell: (m) => fullNumber.format(m.visitors) },
    { header: 'When they looked', cell: (m) => <SplitBar m={m} /> },
    { header: 'Before', align: 'right', sortable: true, sortValue: (m) => m.build_up, cell: (m) => fullNumber.format(m.build_up) },
    { header: 'On the day', align: 'right', sortable: true, sortValue: (m) => m.match_day, cell: (m) => fullNumber.format(m.match_day) },
    { header: 'After', align: 'right', sortable: true, sortValue: (m) => m.after, cell: (m) => fullNumber.format(m.after) },
];

interface MatchReachTableProps {
    matches: SiteMatchReach[];
}

/** The most viewed match pages, with how their views split across build-up, match day and after. */
export const MatchReachTable = ({ matches }: MatchReachTableProps) => (
    <div>
        <ul className="mb-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-gray-700 dark:text-gray-200">
            {SPLIT.map((s) => (
                <li key={s.key} className="flex items-center gap-2">
                    <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-sm ${s.className}`} />
                    {s.label}
                </li>
            ))}
        </ul>
        <DataTable
            data={matches}
            columns={COLUMNS}
            searchable={false}
            paginated={false}
            getRowId={(m) => m.match_id}
            emptyMessage="No match pages were viewed in this period."
        />
    </div>
);
