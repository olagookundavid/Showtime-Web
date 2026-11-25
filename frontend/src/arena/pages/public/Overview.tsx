import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRightIcon, CalendarDaysIcon, ChartBarIcon, FlagIcon, ShieldCheckIcon, TrophyIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import { ButtonLink, DashboardPageHeader, Tabs } from '../../../components';
import { Crest, DivisionGate, EmptyState, HeroPitchArt, MatchRow, Panel, PlayerFace, StandingsTable, StatTile } from '../../components';
import { useFollowedClub, useOverview } from '../../hooks';
import type { ArenaStandingRow } from '../../../types';
import { ordinal } from '../../utils';

type MatchTab = 'results' | 'upcoming';

/** The season at a glance: headline numbers, latest results, the top of the table. */
export const ArenaOverview = () => {
  const overview = useOverview();
  const { clubId } = useFollowedClub();
  const [tab, setTab] = useState<MatchTab>('results');
  const data = overview.data;
  const mine = data?.standings.find((r) => r.club.id === clubId);
  const matches = tab === 'results' ? data?.latest : data?.upcoming;

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title="Welcome to the Arena"
        subtitle={data?.scope.division ? `${data.scope.season.name} · ${data.scope.division.name}. Your competition, all in one place.` : 'Your competition, all in one place.'}
      />
      <DivisionGate query={overview}>
        {data && (
          <>
            <section className="relative overflow-hidden bg-sffl-navy p-6 text-white sm:p-10">
              <HeroPitchArt className="pointer-events-none absolute -right-10 top-0 hidden h-full w-2/3 text-white/20 sm:block" />
              <div className="relative max-w-xl">
                <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/80">
                  <span className="h-px w-8 bg-sffl-red" aria-hidden="true" />
                  {data.scope.division?.name}
                </p>
                <h2 className="mt-4 text-4xl font-extrabold uppercase leading-none sm:text-6xl">
                  Your club. Your game. <span className="text-sffl-gold">Your glory.</span>
                </h2>
                <p className="mt-3 text-white/80">The competition never stops. Stay ahead of every match.</p>
                {data.champion ? (
                  <p className="mt-5 inline-flex items-center gap-2 bg-sffl-gold px-4 py-2 font-bold text-sffl-navy">
                    <TrophyIcon className="h-5 w-5" aria-hidden="true" />
                    {data.champion.name} are the champions
                  </p>
                ) : (
                  <ButtonLink shape="square" to="/matches" tone="dark" variant="secondary" icon={ArrowUpRightIcon} iconPosition="right" className="mt-5">
                    Explore matches
                  </ButtonLink>
                )}
              </div>
            </section>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatTile label="Clubs competing" value={data.metrics.clubs} note="One league. One champion." icon={ShieldCheckIcon} />
              <StatTile label="Registered players" value={data.metrics.players} note="Across all clubs" icon={UserGroupIcon} />
              <StatTile
                label="Matches played"
                value={data.metrics.matches_played}
                note={data.metrics.total_matchweeks ? `Matchweek ${data.metrics.last_matchweek} of ${data.metrics.total_matchweeks}` : 'No fixtures yet'}
                icon={CalendarDaysIcon}
              />
              <StatTile label="Goals this season" value={data.metrics.goals} note={`${data.metrics.goals_per_match.toFixed(2)} per match`} icon={ChartBarIcon} />
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
              <div className="min-w-0 space-y-6">
                <Panel title="Match centre" link={{ to: '/matches', label: 'All matches' }} flush>
                  <div className="px-4 sm:px-5">
                    <Tabs
                      aria-label="Match centre"
                      value={tab}
                      onChange={setTab}
                      items={[
                        { value: 'results', label: 'Latest results' },
                        { value: 'upcoming', label: 'Upcoming' },
                      ]}
                    />
                  </div>
                  {matches && matches.length > 0 ? (
                    matches.slice(0, 5).map((m) => <MatchRow key={m.id} match={m} />)
                  ) : (
                    <EmptyState
                      icon={FlagIcon}
                      title={tab === 'results' ? 'No results yet' : 'No fixtures scheduled'}
                      description={tab === 'results' ? 'Results appear here as soon as each match is confirmed.' : 'The organisers will publish the fixtures soon.'}
                    />
                  )}
                </Panel>
                <Panel title="League standings" link={{ to: '/standings', label: 'Full table' }} flush>
                  <StandingsTable rows={data.standings} brief playoffSpots={data.scope.division?.playoff_spots} highlightClubId={clubId} />
                  <p className="px-4 py-3 text-xs text-gray-500 sm:px-5 dark:text-gray-400">
                    Your club is highlighted
                    {data.scope.division && data.scope.division.playoff_spots > 0 ? ` · Top ${data.scope.division.playoff_spots} qualify for the playoffs` : ''}
                  </p>
                </Panel>
              </div>

              <div className="min-w-0 space-y-6">
                <Panel title="My club">
                  {clubId ? (
                    <MyClubCard clubId={clubId} standing={mine} />
                  ) : (
                    <EmptyState
                      icon={ShieldCheckIcon}
                      title="Pick your club"
                      description="Follow a club to see its position and form here every time you visit."
                      action={<ButtonLink shape="square" to="/clubs" variant="navy" size="sm">Choose a club</ButtonLink>}
                    />
                  )}
                </Panel>
                <Panel title="The goal getters" link={{ to: '/players', label: 'Player stats' }}>
                  {data.top_scorers.length === 0 ? (
                    <p className="py-4 text-sm text-gray-600 dark:text-gray-400">Goalscorers will appear here once results with player stats are in.</p>
                  ) : (
                    <ol className="-my-1">
                      {data.top_scorers.map((p, i) => (
                        <li key={`${p.player_id}-${p.club_id}`}>
                          <Link to={`/players/${p.player_id}`} className="flex min-h-14 items-center gap-3 px-1 py-2 hover:bg-gray-50 dark:hover:bg-white/5">
                            <span className="tabular w-5 text-center text-sm font-black text-gray-500">{i + 1}</span>
                            <PlayerFace name={p.gamertag} size="sm" />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-bold text-sffl-navy dark:text-white">{p.gamertag}</span>
                              <span className="block truncate text-xs text-gray-500 dark:text-gray-400">{p.club_name} · {p.position}</span>
                            </span>
                            <span className="tabular text-right text-xl font-black text-sffl-navy dark:text-white">
                              {p.goals}
                              <span className="block text-[10px] font-bold uppercase tracking-wider text-gray-500">Goals</span>
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ol>
                  )}
                </Panel>
              </div>
            </div>

            {data.upcoming.length > 0 && (
              <Panel title="Next up on the pitch" link={{ to: '/matches', label: 'View schedule' }} flush>
                {data.upcoming.slice(0, 3).map((m) => (
                  <MatchRow key={m.id} match={m} />
                ))}
              </Panel>
            )}
          </>
        )}
      </DivisionGate>
    </div>
  );
};

/** The followed club's position, points and wins. */
const MyClubCard = ({ clubId, standing }: { clubId: string; standing: ArenaStandingRow | undefined }) => {
  const { clear, pending } = useFollowedClub();
  if (!standing) {
    return (
      <p className="py-2 text-sm text-gray-600 dark:text-gray-400">
        Your followed club isn't in this division.{' '}
        <button type="button" onClick={clear} disabled={pending} className="font-bold text-sffl-red underline">
          Stop following
        </button>
        <span className="sr-only">{clubId}</span>
      </p>
    );
  }
  return (
    <div>
      <Link to={`/clubs/${standing.club.slug}`} className="flex items-center gap-3">
        <Crest club={standing.club} size="lg" />
        <span className="min-w-0">
          <span className="block truncate text-lg font-extrabold text-sffl-navy dark:text-white">{standing.club.name}</span>
          <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Your club</span>
        </span>
      </Link>
      <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
        {[
          ['Position', ordinal(standing.rank)],
          ['Points', standing.points],
          ['Wins', standing.won],
        ].map(([label, value]) => (
          <div key={label} className="bg-gray-50 p-2 dark:bg-white/5">
            <dd className="tabular text-xl font-black text-sffl-navy dark:text-white">{value}</dd>
            <dt className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{label}</dt>
          </div>
        ))}
      </dl>
      <ButtonLink shape="square" to={`/clubs/${standing.club.slug}`} variant="outline" size="sm" fullWidth className="mt-4">
        View club
      </ButtonLink>
    </div>
  );
};
