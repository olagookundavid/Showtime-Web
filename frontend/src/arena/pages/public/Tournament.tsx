import { useQuery } from '@tanstack/react-query';
import { CalendarDaysIcon, FlagIcon, TrophyIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import { DashboardPageHeader, DataTable, type Column } from '../../../components';
import { arenaApi } from '../../../services';
import type { ArenaSeason } from '../../../types';
import { Crest, DivisionGate, EmptyState, MatchRow, Panel, StatusBadge } from '../../components';
import { useArenaScope } from '../../useArenaScope';
import { useBracket, useOverview } from '../../hooks';
import { formatDateOnly, WEEKDAYS } from '../../utils';

const NO_SEASONS: ArenaSeason[] = [];
const STATUS_LABEL = { setup: 'Being set up', active: 'In progress', playoffs: 'Playoffs', completed: 'Completed' } as const;

const seasonColumns: Column<ArenaSeason>[] = [
  { header: 'Season', cell: (s) => <span className="font-bold text-sffl-navy dark:text-white">{s.name}</span> },
  { header: 'Dates', cell: (s) => (s.starts_on ? `${formatDateOnly(s.starts_on)}${s.ends_on ? ` to ${formatDateOnly(s.ends_on)}` : ''}` : '') },
  { header: 'Status', cell: (s) => <StatusBadge tone={s.status === 'completed' ? 'neutral' : s.status === 'setup' ? 'pending' : 'success'}>{STATUS_LABEL[s.status]}</StatusBadge> },
];

/** How the competition works, the divisions, and the playoff bracket. */
export const ArenaTournament = () => {
  const { season, division, divisions, setDivisionId } = useArenaScope();
  const overview = useOverview();
  const bracket = useBracket();
  const seasons = useQuery({ queryKey: ['arena', 'seasons'], queryFn: arenaApi.seasons });
  const metrics = overview.data?.metrics;

  return (
    <div className="space-y-6">
      <DashboardPageHeader title="Tournament" subtitle="How the competition works, who is in it, and the road to the final." />
      <DivisionGate query={overview}>
        {season && division && (
          <>
            <section className="rounded-2xl bg-sffl-navy p-6 text-white sm:p-8">
              <p className="text-xs font-bold uppercase tracking-widest text-arena-lime">{season.name}</p>
              <h2 className="mt-1 text-3xl font-extrabold uppercase sm:text-5xl">Build the competition. <span className="text-arena-lime">Win the Arena.</span></h2>
              <p className="mt-2 text-white/75">
                {season.starts_on ? `${formatDateOnly(season.starts_on)}${season.ends_on ? ` to ${formatDateOnly(season.ends_on)}` : ''}` : 'Dates to be announced'}
              </p>
            </section>

            <div className="grid gap-3 md:grid-cols-3">
              {[
                {
                  icon: UserGroupIcon,
                  label: 'Format',
                  title: `${metrics?.clubs ?? division.club_count} clubs. ${metrics?.total_matchweeks ? `${metrics.total_matchweeks} matchweeks.` : 'Fixtures to come.'}`,
                  text: 'Each club plays every other club home and away. A win earns 3 points and a draw 1, ranked by goal difference, then goals scored.',
                },
                {
                  icon: CalendarDaysIcon,
                  label: 'Match night',
                  title: `${WEEKDAYS[division.kickoff_day]}s, ${division.kickoff_slots.join(' and ')}`,
                  text: 'All times are West Africa Time (WAT). Fixtures and confirmed scores live in the match centre.',
                },
                {
                  icon: TrophyIcon,
                  label: 'Playoffs',
                  title: division.playoff_spots === 4 ? 'The final four' : division.playoff_spots === 2 ? 'The final two' : 'League only',
                  text:
                    division.playoff_spots === 4
                      ? 'Semi-finals pair 1st against 4th and 2nd against 3rd. The winners meet in the final.'
                      : division.playoff_spots === 2
                        ? 'The top two clubs meet in a single final.'
                        : 'This division is decided by the league table alone.',
                },
              ].map(({ icon: Icon, label, title, text }) => (
                <div key={label} className="rounded-xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
                  <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-500">
                    <Icon className="h-4 w-4 text-sffl-red dark:text-arena-lime" aria-hidden="true" />
                    {label}
                  </p>
                  <p className="mt-2 text-xl font-extrabold text-sffl-navy dark:text-white">{title}</p>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{text}</p>
                </div>
              ))}
            </div>

            {divisions.length > 1 && (
              <Panel title="Divisions">
                <ul className="grid gap-3 sm:grid-cols-2">
                  {divisions.map((d) => (
                    <li key={d.id}>
                      <button
                        type="button"
                        onClick={() => setDivisionId(d.id)}
                        aria-pressed={d.id === division.id}
                        className={`w-full min-h-11 rounded-xl border p-4 text-left transition-colors ${d.id === division.id ? 'border-sffl-red bg-lime-50 dark:border-arena-lime dark:bg-arena-lime/10' : 'border-gray-200 hover:border-sffl-red dark:border-white/10'}`}
                      >
                        <span className="block font-extrabold text-sffl-navy dark:text-white">{d.name}</span>
                        <span className="block text-sm text-gray-600 dark:text-gray-400">{d.description || `${d.club_count} clubs`}</span>
                        <span className="mt-1 block text-xs font-bold text-gray-500">{d.club_count} clubs{d.id === division.id ? ' · Showing' : ''}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </Panel>
            )}

            {division.playoff_spots > 0 && (
              <Panel title="The playoffs" flush>
                {bracket.data && (bracket.data.semis.length > 0 || bracket.data.final) ? (
                  <>
                    {bracket.data.champion && (
                      <p className="mx-4 mb-3 inline-flex items-center gap-2 rounded-lg bg-arena-lime px-3 py-2 font-bold text-sffl-navy sm:mx-5">
                        <TrophyIcon className="h-5 w-5" aria-hidden="true" />
                        <Crest club={bracket.data.champion} size="sm" />
                        {bracket.data.champion.name} are the champions
                      </p>
                    )}
                    {bracket.data.semis.map((m) => <MatchRow key={m.id} match={m} />)}
                    {bracket.data.final && <MatchRow match={bracket.data.final} />}
                  </>
                ) : (
                  <EmptyState icon={FlagIcon} title="The bracket isn't set yet" description="Once every league match has a result, the top clubs go into the playoffs and the bracket appears here." />
                )}
              </Panel>
            )}
          </>
        )}
      </DivisionGate>

      <Panel title="All seasons" flush>
        <DataTable data={seasons.data ?? NO_SEASONS} columns={seasonColumns} searchable={false} paginated={false} loading={seasons.isLoading} getRowId={(s) => s.id} emptyMessage="No seasons yet." compact />
      </Panel>
    </div>
  );
};
