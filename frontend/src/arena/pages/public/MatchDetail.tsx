import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { DashboardPageHeader, DataTable, Spinner, type Column } from '../../../components';
import { arenaApi } from '../../../services';
import type { ArenaClubRef, ArenaMatch, ArenaPlayerStat, ArenaSheetView } from '../../../types';
import { Crest, EmptyState, Panel, StatusBadge } from '../../components';
import { formatKickoffTime, formatLongDate, matchRound } from '../../utils';

const TeamBlock = ({ club }: { club: ArenaClubRef | null }) =>
  club ? (
    <Link to={`/clubs/${club.slug}`} className="flex min-w-0 flex-col items-center gap-2 text-center">
      <Crest club={club} size="xl" />
      <span className="max-w-full break-words text-lg font-extrabold text-sffl-navy dark:text-white">{club.name}</span>
    </Link>
  ) : (
    <div className="flex flex-col items-center gap-2 text-center text-gray-500">
      <span className="h-20 w-20 rounded-lg border-2 border-dashed border-gray-300" aria-hidden="true" />
      <span className="font-bold">To be decided</span>
    </div>
  );

const LineupList = ({ sheet, club }: { sheet: ArenaSheetView | undefined; club: ArenaClubRef | null }) => (
  <div className="min-w-0">
    <p className="mb-2 font-extrabold text-sffl-navy dark:text-white">{club?.name}</p>
    {sheet ? (
      <>
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500">Formation {sheet.formation}</p>
        <ol className="space-y-1">
          {sheet.starters.map((p) => (
            <li key={p.player_id} className="flex items-center gap-2 text-sm">
              <span className="tabular w-6 text-right font-bold text-gray-500">{p.shirt_number ?? ''}</span>
              <Link to={`/players/${p.player_id}`} className="min-w-0 truncate font-semibold text-sffl-navy hover:underline dark:text-white">
                {p.gamertag}
                {p.player_id === sheet.captain_player_id && ' (C)'}
              </Link>
              <span className="ml-auto text-xs text-gray-500">{p.position}</span>
            </li>
          ))}
        </ol>
        {sheet.bench.length > 0 && (
          <p className="mt-3 text-xs text-gray-600 dark:text-gray-400">
            <span className="font-bold">Substitutes:</span> {sheet.bench.map((b) => b.gamertag).join(', ')}
          </p>
        )}
      </>
    ) : (
      <p className="text-sm text-gray-500">No team sheet was submitted.</p>
    )}
  </div>
);

const statColumns = (clubs: Record<string, string>): Column<ArenaPlayerStat>[] => [
  {
    header: 'Player',
    cell: (s) => (
      <Link to={`/players/${s.player_id}`} className="inline-flex min-h-11 items-center font-bold text-sffl-navy hover:underline dark:text-white">
        {s.gamertag}
      </Link>
    ),
  },
  { header: 'Club', cell: (s) => clubs[s.club_id] ?? '' },
  { header: 'Goals', align: 'right', className: 'tabular', cell: (s) => s.goals },
  { header: 'Assists', align: 'right', className: 'tabular', cell: (s) => s.assists },
  { header: 'Rating', align: 'right', className: 'tabular', cell: (s) => (s.rating === null ? '' : s.rating.toFixed(1)) },
  { header: 'Award', cell: (s) => (s.motm ? <StatusBadge tone="success">Man of the match</StatusBadge> : '') },
];

const NO_STATS: ArenaPlayerStat[] = [];

export const ArenaMatchDetail = () => {
  const { id = '' } = useParams();
  const query = useQuery({ queryKey: ['arena', 'match', id], queryFn: () => arenaApi.match(id), enabled: Boolean(id) });
  const match: ArenaMatch | undefined = query.data?.match;
  const clubNames = useMemo(() => {
    const m: Record<string, string> = {};
    if (match?.home) m[match.home.id] = match.home.name;
    if (match?.away) m[match.away.id] = match.away.name;
    return m;
  }, [match]);
  const columns = useMemo(() => statColumns(clubNames), [clubNames]);

  if (query.isLoading) return <Spinner label="Loading match" className="py-16" />;
  if (query.isError || !match) {
    return (
      <EmptyState
        icon={ExclamationTriangleIcon}
        title="We couldn't find that match"
        description="It may have been removed, or the link is wrong."
        action={<Link to="/matches" className="font-bold text-sffl-red underline dark:text-arena-lime">Back to matches</Link>}
      />
    );
  }

  const played = (match.status === 'completed' || match.status === 'forfeit') && match.home_score !== null && match.away_score !== null;
  const sheets = query.data?.sheets ?? [];
  const homeSheet = sheets.find((s) => s.club_id === match.home_club_id);
  const awaySheet = sheets.find((s) => s.club_id === match.away_club_id);
  const winner = match.penalty_winner === 'home' ? match.home?.name : match.penalty_winner === 'away' ? match.away?.name : null;

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title={`${match.home?.name ?? 'To be decided'} v ${match.away?.name ?? 'To be decided'}`}
        subtitle={`${match.division_name ?? ''} · ${matchRound(match)}`}
        back={{ to: '/matches', label: 'All matches' }}
      />

      <section className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-8 dark:border-white/10 dark:bg-white/5">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-8">
          <TeamBlock club={match.home} />
          <div className="text-center">
            <p className="tabular text-4xl font-black text-sffl-navy sm:text-6xl dark:text-white">
              {played ? `${match.home_score} : ${match.away_score}` : 'VS'}
            </p>
            <p className="mt-1 text-xs font-bold uppercase tracking-widest text-gray-500">
              {match.status === 'forfeit' ? 'Forfeit' : played ? 'Full time' : match.status === 'postponed' ? 'Postponed' : 'Upcoming'}
            </p>
            {winner && <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">{winner} won on penalties</p>}
          </div>
          <TeamBlock club={match.away} />
        </div>
      </section>

      <Panel title="Match facts">
        <dl className="divide-y divide-gray-100 text-sm dark:divide-white/10">
          {[
            ['Date', formatLongDate(match.kickoff_at)],
            ['Kick-off', match.kickoff_at ? `${formatKickoffTime(match.kickoff_at)} WAT` : 'To be confirmed'],
            ['Competition', match.division_name ?? ''],
            ['Round', matchRound(match)],
            ...(played ? [['Result', match.home_score === match.away_score && !winner ? 'Draw' : `${(match.home_score ?? 0) > (match.away_score ?? 0) ? match.home?.name : (match.home_score ?? 0) < (match.away_score ?? 0) ? match.away?.name : winner} win`]] : []),
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 py-3">
              <dt className="text-gray-500 dark:text-gray-400">{k}</dt>
              <dd className="text-right font-bold text-sffl-navy dark:text-white">{v}</dd>
            </div>
          ))}
        </dl>
        {!played && <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">The score and match report will appear here after the result is confirmed.</p>}
      </Panel>

      {(homeSheet || awaySheet) && (
        <Panel title="Team sheets">
          <div className="grid gap-6 sm:grid-cols-2">
            <LineupList sheet={homeSheet} club={match.home} />
            <LineupList sheet={awaySheet} club={match.away} />
          </div>
        </Panel>
      )}

      {played && (query.data?.stats.length ?? 0) > 0 && (
        <Panel title="Player stats" flush>
          <DataTable data={query.data?.stats ?? NO_STATS} columns={columns} searchable={false} paginated={false} getRowId={(s) => `${s.player_id}`} compact />
        </Panel>
      )}
    </div>
  );
};
