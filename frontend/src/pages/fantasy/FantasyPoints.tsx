import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import {
  ChartBarIcon,
  TrophyIcon,
  FaceFrownIcon,
  UserGroupIcon,
  PencilSquareIcon,
} from "@heroicons/react/24/outline";
import { fantasyCoreApi, fantasySeasonApi } from "../../services";
import type { TeamPointsHistoryRow } from "../../types";
import {
  Loader,
  Button,
  ButtonLink,
  Field,
  Input,
  Modal,
  FantasyPointsChart,
  FantasyGameweekBreakdown,
  FantasyStandingRow,
} from "../../components";
import { getApiErrorMessage, getDefaultTeamName, formatStatNumber } from "../../utils";
import { useAuth } from "../../contexts";

/** Everything off the wire is treated as possibly-missing: a brand new
 *  season legitimately has no team, no points and no managers yet. */
const num = (v: number | null | undefined): number =>
  typeof v === "number" && Number.isFinite(v) ? v : 0;

export function FantasyPoints() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: dashboard, isLoading: dashboardLoading } = useQuery({
    queryKey: ["fantasyDashboard"],
    queryFn: () => fantasySeasonApi.getDashboard(),
  });

  const seasonId = dashboard?.season?.id;
  const hasJoined = dashboard ? dashboard.entered : undefined;

  // Same sidebar shape as Pick Team and Transfers — team identity, points &
  // rankings, leagues — minus anything money-related, which belongs on
  // Transfers, not a points-history page.
  const { data: gameweeks = [] } = useQuery({
    queryKey: ["fantasyGameweeks", seasonId],
    queryFn: () => (seasonId ? fantasyCoreApi.getGameweeks(seasonId) : Promise.resolve([])),
    enabled: !!seasonId,
  });
  const seasonHasStarted = gameweeks.some((gw) => gw.status !== "SCHEDULED");

  const [showEditNameModal, setShowEditNameModal] = useState(false);
  const [editModalNameInput, setEditModalNameInput] = useState("");
  // Once the manager dismisses the legacy-name auto-prompt without
  // renaming, it stays dismissed for the rest of the session.
  const [renameDismissed, setRenameDismissed] = useState(false);

  const needsLegacyRename =
    !seasonHasStarted &&
    !renameDismissed &&
    !!hasJoined &&
    dashboard?.team?.name === "My Showtime Stars";

  const closeEditNameModal = () => {
    setShowEditNameModal(false);
    setRenameDismissed(true);
  };

  const renameMutation = useMutation({
    mutationFn: async (newName: string) => {
      if (!seasonId) throw new Error("Season not loaded");
      const clean = newName.trim();
      if (clean.length < 3 || clean.length > 40) {
        throw new Error("Team name must be between 3 and 40 characters.");
      }
      return fantasySeasonApi.enterSeason(seasonId, clean);
    },
    onSuccess: () => {
      closeEditNameModal();
      toast.success("Team name updated!");
      queryClient.invalidateQueries({ queryKey: ["fantasyDashboard"] });
    },
    onError: (err: unknown) => {
      toast.error(getApiErrorMessage(err, "Failed to update team name"));
    },
  });

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
    <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        {/* ────────────────────────────────────────────────────────────────
                    STICKY SIDEBAR — identity, points/rank, finance, leagues.
                    Same block as Pick Team and Transfers, so a manager sees
                    the same summary wherever they are in Fantasy.
                ──────────────────────────────────────────────────────────────── */}
        <div className="lg:col-span-1 min-w-0">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm divide-y divide-gray-200 dark:divide-gray-700">
            {/* Team identity */}
            <div className="p-5">
              <h2 className="text-[10px] font-black uppercase tracking-wider text-gray-400 dark:text-gray-500">
                Team
              </h2>
              <p className="text-lg font-black italic uppercase tracking-tight text-sffl-navy dark:text-white truncate mt-1">
                {dashboard.team?.name || getDefaultTeamName(user?.name)}
              </p>
              {!seasonHasStarted && (
                <div className="mt-4">
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={PencilSquareIcon}
                    onClick={() => {
                      setEditModalNameInput(
                        dashboard.team?.name || getDefaultTeamName(user?.name),
                      );
                      setShowEditNameModal(true);
                    }}
                  >
                    Edit Name
                  </Button>
                </div>
              )}
            </div>

            {/* Points & Rankings */}
            <div className="p-5">
              <h2 className="text-[10px] font-black uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">
                Points & Rankings
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="min-w-0">
                  <span className="text-[10px] uppercase font-black tracking-wider text-gray-500 dark:text-gray-400 block">
                    Season Total
                  </span>
                  <span className="text-xl font-black text-sffl-navy dark:text-white tabular-nums">
                    {formatStatNumber(num(dashboard?.team?.total_points))}
                  </span>
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] uppercase font-black tracking-wider text-gray-500 dark:text-gray-400 block">
                    Overall Rank
                  </span>
                  <span className="text-xl font-black text-sffl-navy dark:text-white tabular-nums">
                    {dashboard?.team?.overall_rank
                      ? `#${formatStatNumber(num(dashboard.team.overall_rank))}`
                      : "—"}
                  </span>
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] uppercase font-black tracking-wider text-gray-500 dark:text-gray-400 block">
                    Gameweek Points
                  </span>
                  <span className="text-xl font-black text-sffl-navy dark:text-white tabular-nums">
                    {formatStatNumber(num(dashboard?.team?.gameweek_points))}
                  </span>
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] uppercase font-black tracking-wider text-gray-500 dark:text-gray-400 block">
                    Total Players
                  </span>
                  <span className="text-xl font-black text-sffl-navy dark:text-white tabular-nums">
                    {formatStatNumber(num(dashboard?.team?.total_managers))}
                  </span>
                </div>
              </div>
            </div>

            {/* Best / Worst Gameweek */}
            {(best || worst) && (
              <div className="p-5 space-y-3">
                <h2 className="text-[10px] font-black uppercase tracking-wider text-gray-400 dark:text-gray-500">
                  Gameweek Extremes
                </h2>
                {best && (
                  <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 p-3 flex items-center gap-3">
                    <div className="w-9 h-9 shrink-0 bg-white dark:bg-gray-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                      <TrophyIcon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[9px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                        Best Gameweek
                      </p>
                      <p className="text-sm font-black text-sffl-navy dark:text-white truncate">
                        GW {best.gameweek_number} — {best.points.toFixed(1)}{" "}
                        pts
                      </p>
                    </div>
                  </div>
                )}
                {worst && (
                  <div className="bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 p-3 flex items-center gap-3">
                    <div className="w-9 h-9 shrink-0 bg-white dark:bg-gray-800 flex items-center justify-center text-gray-500 dark:text-gray-400">
                      <FaceFrownIcon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[9px] font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        Worst Gameweek
                      </p>
                      <p className="text-sm font-black text-sffl-navy dark:text-white truncate">
                        GW {worst.gameweek_number} —{" "}
                        {worst.points.toFixed(1)} pts
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* My Leagues */}
            <div className="p-5">
              <h2 className="text-[10px] font-black uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1">
                My Leagues
              </h2>
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                <FantasyStandingRow
                  to={`/fantasy/leaderboard/${seasonId}?type=overall`}
                  name="Overall"
                  rank={dashboard?.team?.overall_rank ?? 0}
                  movement={dashboard?.team?.rank_movement}
                  isOverall
                />
                {(dashboard?.leagues ?? [])
                  .filter((l) => l.type !== "OVERALL" && l.league_id)
                  .map((l) => (
                    <FantasyStandingRow
                      key={l.league_id}
                      to={`/fantasy/leaderboard/${l.league_id}`}
                      name={l.name || "Unnamed league"}
                      rank={l.my_rank ?? 0}
                      movement={l.rank_movement}
                      isOverall={false}
                    />
                  ))}
              </div>
            </div>
          </div>
        </div>

        {/* ────────────────────────────────────────────────────────────────
                    MAIN COLUMN — gameweek breakdown, best/worst, history
                ──────────────────────────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-6 md:space-y-8 min-w-0">
          {rows.length === 0 ? (
            <div className="p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-center shadow-sm">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                No gameweeks have finished yet this season. Your points
                history will appear here once your first lineup locks and
                scores.
              </p>
            </div>
          ) : (
            <>
              <FantasyGameweekBreakdown seasonId={seasonId!} rows={rows} />

              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm p-5 md:p-6">
                <h2 className="text-xl font-black uppercase tracking-tight text-sffl-navy dark:text-white flex items-center gap-2 mb-4">
                  <ChartBarIcon className="w-5 h-5 text-sffl-red" /> Points Per
                  Gameweek
                </h2>
                <FantasyPointsChart data={rows} />
              </div>
            </>
          )}
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────────────
                EDIT TEAM NAME MODAL
            ────────────────────────────────────────────────────────────────── */}
      {(() => {
        const editNameValue =
          editModalNameInput || getDefaultTeamName(user?.name);
        const trimmedEditName = editNameValue.trim();
        const editNameValid =
          trimmedEditName.length >= 3 && trimmedEditName.length <= 40;

        return (
          <Modal
            open={(showEditNameModal && !seasonHasStarted) || needsLegacyRename}
            shape="square"
            onClose={closeEditNameModal}
            title="Edit Team Name"
            maxWidth="md"
          >
            <div>
              <p className="text-xs text-gray-600 dark:text-gray-300 mb-4 leading-relaxed">
                Personalize your fantasy squad name. Team names must be unique
                within the season and appear across all leaderboards and
                match day summaries.
              </p>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (editNameValid && !renameMutation.isPending) {
                    renameMutation.mutate(trimmedEditName);
                  }
                }}
                className="space-y-4"
              >
                <Field
                  label="Team Name (3–40 characters)"
                  htmlFor="edit-team-name-modal-input"
                  hint={
                    editNameValid
                      ? `${trimmedEditName.length}/40 characters • Must be unique in this season`
                      : "Must be between 3 and 40 characters."
                  }
                >
                  <Input
                    id="edit-team-name-modal-input"
                    type="text"
                    shape="square"
                    value={editNameValue}
                    onChange={(e) => setEditModalNameInput(e.target.value)}
                    placeholder="Enter unique team name..."
                    maxLength={40}
                    autoFocus
                  />
                </Field>

                <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
                  <Button
                    variant="secondary"
                    shape="square"
                    className="flex-1"
                    onClick={closeEditNameModal}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    shape="square"
                    className="flex-1"
                    loading={renameMutation.isPending}
                    disabled={!editNameValid}
                  >
                    {renameMutation.isPending ? "Saving…" : "Save Name"}
                  </Button>
                </div>
              </form>
            </div>
          </Modal>
        );
      })()}
    </>
  );
}
