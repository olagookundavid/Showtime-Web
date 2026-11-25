import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MagnifyingGlassIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import { DashboardPageHeader, Field, Input, Select } from '../../../components';
import { DivisionGate, EmptyState, PlayerFace } from '../../components';
import { useDivisionClubs, usePlayerStats } from '../../hooks';
import type { ArenaPlayerSeasonStats } from '../../../types';

type Sort = 'goals' | 'assists' | 'rating' | 'apps';

const sorters: Record<Sort, (a: ArenaPlayerSeasonStats, b: ArenaPlayerSeasonStats) => number> = {
  goals: (a, b) => b.goals - a.goals || b.assists - a.assists,
  assists: (a, b) => b.assists - a.assists || b.goals - a.goals,
  rating: (a, b) => (b.avg_rating ?? -1) - (a.avg_rating ?? -1),
  apps: (a, b) => b.apps - a.apps,
};

/** Every player in the division with their numbers, as cards to browse. */
export const ArenaPlayers = () => {
  const [search, setSearch] = useState('');
  const [clubId, setClubId] = useState('');
  const [sort, setSort] = useState<Sort>('goals');
  // The server filters by club and name; sorting is instant in the browser.
  const query = usePlayerStats(clubId || undefined, search.trim() || undefined);
  const clubs = useDivisionClubs();
  const players = useMemo(() => [...(query.data?.players ?? [])].sort(sorters[sort]), [query.data, sort]);

  return (
    <div className="space-y-6">
      <DashboardPageHeader title="Player Stats" subtitle="The numbers behind the names. Find the standout performers." />
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_14rem_12rem]">
        <Field label="Search players" htmlFor="player-search">
          <Input shape="square" id="player-search" icon={MagnifyingGlassIcon} placeholder="Gamertag or club" value={search} onChange={(e) => setSearch(e.target.value)} />
        </Field>
        <Field label="Club" htmlFor="player-club">
          <Select shape="square" id="player-club" value={clubId} onChange={(e) => setClubId(e.target.value)}>
            <option value="">All clubs</option>
            {(clubs.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Sort by" htmlFor="player-sort">
          <Select shape="square" id="player-sort" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="goals">Most goals</option>
            <option value="assists">Most assists</option>
            <option value="rating">Highest rating</option>
            <option value="apps">Most appearances</option>
          </Select>
        </Field>
      </div>
      <DivisionGate query={query}>
        {players.length === 0 ? (
          <EmptyState
            icon={UserGroupIcon}
            title="No players found"
            description={search || clubId ? 'Try another name or club.' : 'Players appear here once clubs have registered their squads.'}
          />
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {players.map((p) => (
              <li key={`${p.player_id}-${p.club_id}`}>
                <Link
                  to={`/players/${p.player_id}`}
                  className="block h-full border border-gray-200 bg-white p-4 transition-colors hover:border-sffl-red focus-visible:outline-2 focus-visible:outline-sffl-red dark:border-white/10 dark:bg-white/5"
                >
                  <div className="flex items-center gap-3">
                    <PlayerFace name={p.gamertag} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-extrabold text-sffl-navy dark:text-white">{p.gamertag}</p>
                      <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                        {p.shirt_number ? `#${p.shirt_number} · ` : ''}
                        {p.club_name}
                      </p>
                    </div>
                    <span className="rounded bg-sffl-navy px-2 py-1 text-xs font-black text-sffl-red">{p.position}</span>
                  </div>
                  <dl className="mt-4 grid grid-cols-4 gap-2 text-center">
                    {[
                      ['Apps', p.apps],
                      ['Goals', p.goals],
                      ['Assists', p.assists],
                      ['Rating', p.avg_rating === null ? '-' : p.avg_rating.toFixed(1)],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <dd className="tabular text-lg font-black text-sffl-navy dark:text-white">{value}</dd>
                        <dt className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{label}</dt>
                      </div>
                    ))}
                  </dl>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </DivisionGate>
    </div>
  );
};
