import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChartBarIcon, ExclamationTriangleIcon, FlagIcon, StarIcon, TrophyIcon } from '@heroicons/react/24/outline';
import { DashboardPageHeader, DataTable, Spinner, type Column } from '../../../components';
import { arenaApi } from '../../../services';
import type { ArenaPlayerMatchLine } from '../../../types';
import { Crest, EmptyState, Panel, PlayerFace, StatTile } from '../../components';
import { formatMatchDate, squadRoleLabel } from '../../utils';

const NO_LINES: ArenaPlayerMatchLine[] = [];

export const ArenaPlayerProfile = () => {
  const { id = '' } = useParams();
  const query = useQuery({ queryKey: ['arena', 'player', id], queryFn: () => arenaApi.player(id), enabled: Boolean(id) });

  const columns = useMemo<Column<ArenaPlayerMatchLine>[]>(
    () => [
      {
        header: 'Opponent',
        cell: (l) => (
          <Link to={`/matches/${l.match_id}`} className="inline-flex min-h-11 items-center font-bold text-sffl-navy hover:underline dark:text-white">
            {l.home_away === 'home' ? 'v' : 'at'} {l.opponent}
          </Link>
        ),
      },
      { header: 'Date', cell: (l) => formatMatchDate(l.kickoff_at) },
      { header: 'Score', align: 'right', className: 'tabular', cell: (l) => `${l.goals_for} : ${l.goals_against}` },
      { header: 'Goals', align: 'right', className: 'tabular', cell: (l) => l.goals },
      { header: 'Assists', align: 'right', className: 'tabular', cell: (l) => l.assists },
      { header: 'Rating', align: 'right', className: 'tabular', cell: (l) => (l.rating === null ? '' : l.rating.toFixed(1)) },
    ],
    [],
  );

  if (query.isLoading) return <Spinner label="Loading player" className="py-16" />;
  const data = query.data;
  if (query.isError || !data) {
    return (
      <EmptyState
        icon={ExclamationTriangleIcon}
        title="We couldn't find that player"
        action={<Link to="/players" className="font-bold text-sffl-red underline">Back to player stats</Link>}
      />
    );
  }
  const { player, season } = data;

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title={player.gamertag}
        subtitle={player.club_id ? `${player.primary_position} at ${player.club_name}${player.shirt_number ? `, number ${player.shirt_number}` : ''}` : `${player.primary_position}, currently a free agent`}
        back={{ to: '/players', label: 'Player stats' }}
      />
      <section className="flex flex-wrap items-center gap-4 border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
        <PlayerFace name={player.gamertag} src={player.avatar_url} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="text-xl font-extrabold text-sffl-navy dark:text-white">{player.gamertag}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {player.primary_position} · {player.platform === 'PS' ? 'PlayStation' : player.platform === 'XBOX' ? 'Xbox' : 'PC'}
            {player.squad_role ? ` · ${squadRoleLabel(player.squad_role)}` : ''}
          </p>
        </div>
        {player.club_id && (
          <Link to={`/clubs/${player.club_slug}`} className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-sffl-navy hover:underline dark:text-white">
            <Crest club={{ name: player.club_name ?? '', short: player.club_short ?? '', color: player.club_color ?? '#4e7050', crest_url: '' }} size="sm" />
            {player.club_name}
          </Link>
        )}
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatTile label="Appearances" value={season?.apps ?? 0} icon={FlagIcon} />
        <StatTile label="Goals" value={season?.goals ?? 0} icon={TrophyIcon} />
        <StatTile label="Assists" value={season?.assists ?? 0} icon={ChartBarIcon} />
        <StatTile label="Avg rating" value={season?.avg_rating == null ? '-' : season.avg_rating.toFixed(1)} icon={StarIcon} />
        <StatTile label="Man of the match" value={season?.motms ?? 0} icon={TrophyIcon} />
      </div>

      <Panel title="Recent matches" flush>
        <DataTable data={data.recent.length ? data.recent : NO_LINES} columns={columns} searchable={false} paginated={false} getRowId={(l) => l.match_id} emptyMessage="No matches played yet." />
      </Panel>
    </div>
  );
};
