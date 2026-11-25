import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CheckIcon, ChartBarIcon, ExclamationTriangleIcon, ShieldCheckIcon, StarIcon, TrophyIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import { Button, DashboardPageHeader, DataTable, Spinner, type Column } from '../../../components';
import { arenaApi } from '../../../services';
import type { ArenaPlayerSeasonStats } from '../../../types';
import { Crest, EmptyState, FormBadges, MatchRow, Panel, PitchBoard, PlayerFace, StatTile, type PitchSlot } from '../../components';
import { useFollowedClub, useFormations } from '../../hooks';
import { ordinal } from '../../utils';

const NO_SQUAD: ArenaPlayerSeasonStats[] = [];

export const ArenaClubProfile = () => {
  const { slug = '' } = useParams();
  const query = useQuery({ queryKey: ['arena', 'club', slug], queryFn: () => arenaApi.club(slug), enabled: Boolean(slug) });
  const formations = useFormations();
  const { clubId, choose, clear, pending } = useFollowedClub();

  const columns = useMemo<Column<ArenaPlayerSeasonStats>[]>(
    () => [
      {
        header: 'Player',
        cell: (p) => (
          <Link to={`/players/${p.player_id}`} className="inline-flex min-h-11 items-center gap-2 font-bold text-sffl-navy hover:underline dark:text-white">
            <PlayerFace name={p.gamertag} size="sm" />
            <span className="whitespace-nowrap">{p.gamertag}</span>
          </Link>
        ),
      },
      { header: 'No.', align: 'right', className: 'tabular', cell: (p) => p.shirt_number ?? '' },
      { header: 'Pos', cell: (p) => p.position },
      { header: 'Apps', align: 'right', className: 'tabular', cell: (p) => p.apps },
      { header: 'Goals', align: 'right', className: 'tabular', cell: (p) => p.goals },
      { header: 'Assists', align: 'right', className: 'tabular', cell: (p) => p.assists },
      { header: 'Rating', align: 'right', className: 'tabular', cell: (p) => (p.avg_rating === null ? '' : p.avg_rating.toFixed(1)) },
    ],
    [],
  );

  if (query.isLoading) return <Spinner label="Loading club" className="py-16" />;
  const data = query.data;
  if (query.isError || !data) {
    return (
      <EmptyState
        icon={ExclamationTriangleIcon}
        title="We couldn't find that club"
        action={<Link to="/clubs" className="font-bold text-sffl-red underline">Back to clubs</Link>}
      />
    );
  }
  const { club, standing, squad, starting_xi: xi } = data;
  const following = clubId === club.id;
  const formation = formations.data?.find((f) => f.name === xi?.formation);
  const slots: PitchSlot[] = formation && xi ? xi.starters.map((s) => ({ index: s.index, label: s.gamertag, number: s.shirt_number, captain: s.player_id === xi.captain_player_id })) : [];

  return (
    <div className="space-y-6">
      <DashboardPageHeader title={club.name} subtitle="The squad, the form, and everything the club plays for." back={{ to: '/clubs', label: 'All clubs' }} />

      <section className="flex flex-wrap items-center gap-4 bg-sffl-navy p-5 text-white sm:p-8">
        <Crest club={club} size="xl" />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/80">
            <span className="h-px w-6 bg-sffl-red" aria-hidden="true" />
            Pro Clubs · {club.division_name || 'No division yet'}
          </p>
          <h2 className="mt-1 break-words text-3xl font-extrabold uppercase sm:text-5xl">{club.name}</h2>
          <p className="mt-1 text-sm text-white/75">
            {club.squad_size} {club.squad_size === 1 ? 'player' : 'players'}
            {club.founded_year ? ` · Est. ${club.founded_year}` : ''}
          </p>
        </div>
        <Button shape="square"
          variant={following ? 'secondary' : 'primary'}
          tone="dark"
          icon={following ? CheckIcon : ShieldCheckIcon}
          loading={pending}
          onClick={() => (following ? clear() : choose(club.id))}
          aria-pressed={following}
        >
          {following ? 'Following as my club' : 'Follow as my club'}
        </Button>
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="League position" value={standing ? ordinal(standing.rank) : '-'} note={club.division_name} icon={TrophyIcon} />
        <StatTile label="Points" value={standing?.points ?? 0} note={standing ? `${standing.won} wins, ${standing.drawn} draws, ${standing.lost} losses` : undefined} icon={StarIcon} />
        <StatTile label="Goals scored" value={standing?.gf ?? 0} note={standing ? `${standing.gd > 0 ? '+' : ''}${standing.gd} goal difference` : undefined} icon={ChartBarIcon} />
        <StatTile label="Squad size" value={club.squad_size} note="Registered players" icon={UserGroupIcon} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Starting XI" className="min-w-0">
          {xi && formation ? (
            <>
              <p className="mb-3 text-center text-xs font-bold uppercase tracking-wider text-gray-500">Formation {xi.formation}, from the latest team sheet</p>
              <PitchBoard formation={formation} slots={slots} label={`${club.name} starting XI`} />
            </>
          ) : (
            <EmptyState icon={UserGroupIcon} title="No team sheet yet" description="The starting XI appears here once the manager submits a team sheet." />
          )}
        </Panel>
        <div className="min-w-0 space-y-6">
          <Panel title="Recent form" flush>
            {standing && (
              <div className="px-4 pb-3 sm:px-5">
                <FormBadges form={standing.form} />
              </div>
            )}
            {data.recent.length ? data.recent.map((m) => <MatchRow key={m.id} match={m} />) : <p className="px-4 pb-4 text-sm text-gray-600 sm:px-5 dark:text-gray-400">No results yet.</p>}
          </Panel>
          <Panel title="Next fixtures" flush>
            {data.upcoming.length ? data.upcoming.slice(0, 3).map((m) => <MatchRow key={m.id} match={m} />) : <p className="px-4 pb-4 text-sm text-gray-600 sm:px-5 dark:text-gray-400">No fixtures scheduled.</p>}
          </Panel>
        </div>
      </div>

      <Panel title="Squad statistics" flush>
        <DataTable data={squad.length ? squad : NO_SQUAD} columns={columns} searchable={false} paginated={false} getRowId={(p) => p.player_id} emptyMessage="No players registered yet." />
      </Panel>
    </div>
  );
};
