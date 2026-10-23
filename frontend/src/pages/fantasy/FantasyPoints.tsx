import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ChartBarIcon,
  TrophyIcon,
  FaceFrownIcon,
  UserGroupIcon,
} from "@heroicons/react/24/outline";
import { fantasySeasonApi } from "../../services/api";
import type { TeamPointsHistoryRow } from "../../types";
import {
  Loader,
  ButtonLink,
  DataTable,
  FantasyPointsChart,
  FantasyGameweekBreakdown,
} from "../../components";
import type { Column } from "../../components";

export function FantasyPoints() {
  const { data: dashboard, isLoading: dashboardLoading } = useQuery({
    queryKey: ["fantasyDashboard"],
    queryFn: () => fantasySeasonApi.getDashboard(),
  });

  const seasonId = dashboard?.season?.id;
  const hasJoined = dashboard ? dashboard.entered : undefined;

  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ["fantasyPointsHistory", seasonId],
    queryFn: () => (seasonId ? fantasySeasonApi.getPointsHistory(seasonId) : Promise.resolve(null)),
    enabled: !!seasonId && hasJoined === true,
  });

  const rows = useMemo<TeamPointsHistoryRow[]>(() => history?.history ?? [], [history]);

  const { best, worst } = useMemo(() => {
    if (rows.length === 0) return { best: null, worst: null };
    let bestRow = rows[0];
    let worstRow = rows[0];
    for (const row of rows) {
      if (row.points > bestRow.points) bestRow = row;
      if (row.points < worstRow.points) worstRow = row;
    }
    return { best: bestRow, worst: worstRow };
  }, [rows]);

  const columns = useMemo<Column<TeamPointsHistoryRow>[]>(
    () => [
      {
        header: "Gameweek",
        cell: (row) => `GW ${row.gameweek_number}`,
        sortValue: (row) => row.gameweek_number,
        sortable: true,
      },
      {
        header: "Your Points",
        cell: (row) => row.points.toFixed(1),
        sortValue: (row) => row.points,
        sortable: true,
        align: "right",
      },
      {
        header: "Rank",
        cell: (row) => `#${row.rank.toLocaleString()} of ${row.total_teams.toLocaleString()}`,
        sortValue: (row) => row.rank,
        sortable: true,
        align: "right",
      },
      {
        header: "Average",
        cell: (row) => row.average_points.toFixed(1),
        sortValue: (row) => row.average_points,
        sortable: true,
        align: "right",
      },
      {
        header: "Highest",
        cell: (row) => row.highest_points.toFixed(1),
        sortValue: (row) => row.highest_points,
        sortable: true,
        align: "right",
      },
      {
        header: "Running Total",
        cell: (row) => row.running_total.toFixed(1),
        sortValue: (row) => row.running_total,
        sortable: true,
        align: "right",
      },
    ],
    [],
  );

  if (dashboardLoading) {
    return <Loader />;
  }

  if (!dashboard || !dashboard.season) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm p-8 md:p-12">
        <div className="w-16 h-16 bg-sffl-red/10 dark:bg-sffl-red/20 flex items-center justify-center text-sffl-red mb-4">
          <ChartBarIcon className="w-10 h-10" />
        </div>
        <h1 className="text-2xl font-black uppercase tracking-tight text-sffl-navy dark:text-white mb-2">
          No Active Season
        </h1>
        <p className="text-gray-600 dark:text-gray-300 max-w-md mb-6 text-sm">
          There is no fantasy season running right now, so there is no points
          history to show yet.
        </p>
        <ButtonLink to="/" variant="primary" shape="square">
          Return to Homepage
        </ButtonLink>
      </div>
    );
  }

  if (!hasJoined) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm p-8 md:p-12">
        <div className="w-16 h-16 bg-amber-500/10 dark:bg-amber-500/20 flex items-center justify-center text-amber-500 mb-4">
          <UserGroupIcon className="w-10 h-10" />
        </div>
        <h1 className="text-2xl font-black uppercase tracking-tight text-sffl-navy dark:text-white mb-2">
          You Haven't Joined This Season
        </h1>
        <p className="text-gray-600 dark:text-gray-300 max-w-md mb-6 text-sm">
          Join {dashboard.season.name} to start building a points history.
        </p>
        <ButtonLink to="/fantasy/dashboard" variant="primary" shape="square">
          Go To My Dashboard
        </ButtonLink>
      </div>
    );
  }

  if (historyLoading) {
    return <Loader />;
  }

  return (
    <div className="space-y-6 md:space-y-8">
      {rows.length === 0 ? (
        <div className="p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-center shadow-sm">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            No gameweeks have finished yet this season. Your points history
            will appear here once your first lineup locks and scores.
          </p>
        </div>
      ) : (
        <>
          <FantasyGameweekBreakdown seasonId={seasonId!} rows={rows} />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {best && (
              <div className="bg-white dark:bg-gray-800 border border-emerald-200 dark:border-emerald-800 shadow-sm p-5 flex items-center gap-4">
                <div className="w-11 h-11 shrink-0 bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <TrophyIcon className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    Best Gameweek
                  </p>
                  <p className="text-xl font-black text-sffl-navy dark:text-white">
                    GW {best.gameweek_number} — {best.points.toFixed(1)} pts
                  </p>
                </div>
              </div>
            )}
            {worst && (
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm p-5 flex items-center gap-4">
                <div className="w-11 h-11 shrink-0 bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-400">
                  <FaceFrownIcon className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Worst Gameweek
                  </p>
                  <p className="text-xl font-black text-sffl-navy dark:text-white">
                    GW {worst.gameweek_number} — {worst.points.toFixed(1)} pts
                  </p>
                </div>
              </div>
            )}
          </div>

          <DataTable
            data={rows}
            columns={columns}
            getRowId={(row) => row.gameweek_id}
            searchable={false}
            paginated={false}
            emptyMessage="No gameweeks have finished yet this season."
          />

          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm p-5 md:p-6">
            <h2 className="text-xl font-black uppercase tracking-tight text-sffl-navy dark:text-white flex items-center gap-2 mb-4">
              <ChartBarIcon className="w-5 h-5 text-sffl-red" /> Points Per Gameweek
            </h2>
            <FantasyPointsChart data={rows} />
          </div>
        </>
      )}
    </div>
  );
}
