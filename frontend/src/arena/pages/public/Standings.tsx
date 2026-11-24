import { Link } from 'react-router-dom';
import { CalendarDaysIcon, ShieldCheckIcon, TrophyIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import { DashboardPageHeader } from '../../../components';
import { DivisionGate, Panel, StandingsTable, StatTile } from '../../components';
import { useFollowedClub, useStandings } from '../../hooks';

export const ArenaStandings = () => {
  const query = useStandings();
  const { clubId } = useFollowedClub();
  const data = query.data;
  const leader = data?.rows[0];

  return (
    <div className="space-y-6">
      <DashboardPageHeader title="Standings" subtitle="The league table. The road to the championship starts here." />
      <DivisionGate query={query}>
        {data && (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatTile label="Current leaders" value={leader && leader.played > 0 ? leader.club.name : 'To be decided'} note={leader ? `${leader.points} points from ${leader.played} matches` : undefined} icon={TrophyIcon} />
              <StatTile label="Matchweek" value={data.metrics.total_matchweeks ? `${data.metrics.last_matchweek} / ${data.metrics.total_matchweeks}` : 'None yet'} note="Matchweeks played" icon={CalendarDaysIcon} />
              <StatTile label="Playoff places" value={data.playoff_spots || 'None'} note={data.playoff_spots ? `Top ${data.playoff_spots} qualify` : 'Table only, no playoffs'} icon={UserGroupIcon} />
              <StatTile label="Clubs" value={data.rows.length} note="One takes the crown" icon={ShieldCheckIcon} />
            </div>
            <Panel title={data.scope.division?.name ?? 'League table'} flush>
              <StandingsTable rows={data.rows} playoffSpots={data.playoff_spots} highlightClubId={clubId} />
              <p className="px-4 py-3 text-xs text-gray-500 sm:px-5 dark:text-gray-400">
                A win earns 3 points and a draw 1. Ranked by points, then goal difference, then goals scored.
                {data.playoff_spots > 0 && ' The shaded clubs are in the playoff places.'}
              </p>
            </Panel>
            {data.playoff_spots > 0 && (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                See how the playoffs work on the{' '}
                <Link to="/tournament" className="font-bold text-sffl-red hover:underline dark:text-arena-lime">
                  Tournament page
                </Link>
                .
              </p>
            )}
          </>
        )}
      </DivisionGate>
    </div>
  );
};
