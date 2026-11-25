import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { DataTable, type Column } from '../../components';
import type { ArenaStandingRow } from '../../types';
import { Crest } from './Crest';
import { FormBadges } from './FormBadges';

interface StandingsTableProps {
  rows: ArenaStandingRow[];
  /** The short version for the overview: no W, D, L, GF, GA or form. */
  brief?: boolean;
  /** How many clubs reach the playoffs; those rows get a marker. */
  playoffSpots?: number;
  /** The visitor's followed club, highlighted. */
  highlightClubId?: string;
}

const NO_ROWS: ArenaStandingRow[] = [];

/** A division's league table. */
export const StandingsTable = ({ rows, brief = false, playoffSpots = 0, highlightClubId }: StandingsTableProps) => {
  const columns = useMemo<Column<ArenaStandingRow>[]>(() => {
    const num = (header: string, pick: (r: ArenaStandingRow) => number, extra = ''): Column<ArenaStandingRow> => ({
      header,
      align: 'right',
      className: `tabular ${extra}`,
      cell: (r) => pick(r),
    });
    const cols: Column<ArenaStandingRow>[] = [
      {
        // Rank folds into the name cell so the frozen first column names the row.
        header: 'Club',
        cell: (r) => (
          <Link to={`/clubs/${r.club.slug}`} className="inline-flex items-center gap-3 min-h-11 font-bold text-sffl-navy hover:underline dark:text-white">
            <span className="tabular w-5 text-right text-gray-500 dark:text-gray-400">{r.rank}</span>
            <Crest club={r.club} size="sm" />
            <span className="whitespace-nowrap">{r.club.name}</span>
          </Link>
        ),
      },
      num('P', (r) => r.played),
    ];
    if (!brief) {
      cols.push(num('W', (r) => r.won), num('D', (r) => r.drawn), num('L', (r) => r.lost), num('GF', (r) => r.gf), num('GA', (r) => r.ga));
    }
    cols.push({
      header: 'GD',
      align: 'right',
      className: 'tabular',
      cell: (r) => (r.gd > 0 ? `+${r.gd}` : r.gd),
    });
    cols.push({ header: 'Pts', align: 'right', className: 'tabular font-black', cell: (r) => r.points });
    if (!brief) cols.push({ header: 'Last 5', cell: (r) => <FormBadges form={r.form} /> });
    return cols;
  }, [brief]);

  return (
    <DataTable
      data={rows.length ? rows : NO_ROWS}
      columns={columns}
      searchable={false}
      paginated={false}
      compact={brief}
      getRowId={(r) => r.club.id}
      emptyMessage="No clubs in this division yet."
      rowClassName={(r) =>
        r.club.id === highlightClubId
          ? 'bg-red-50 dark:bg-sffl-red/10'
          : playoffSpots > 0 && r.rank <= playoffSpots
            ? 'bg-emerald-50/60 dark:bg-emerald-500/5'
            : 'bg-white dark:bg-transparent'
      }
    />
  );
};
