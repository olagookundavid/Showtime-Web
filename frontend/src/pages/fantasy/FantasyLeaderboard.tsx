import { useMemo, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  TrophyIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
  MapPinIcon,
  UserGroupIcon,
  ArrowRightStartOnRectangleIcon,
  ExclamationTriangleIcon,
  ChartBarIcon,
  EyeIcon,
} from "@heroicons/react/24/outline";
import {
  fantasyApi,
  fantasySeasonApi,
  formatKobo,
} from "../../services/api";
import type { LeaderboardEntry } from "../../types";
import { useAuth } from "../../contexts";
import { useFantasyLeaderboard, num, rankBadgeClass } from "../../hooks";
import { OVERALL } from "../../constants";
import { FantasyTeamModal, BackButton, Button, ButtonLink, IconButton, Select, ConfirmDialog, DataTable, Spinner } from "../../components";
import { formatStatDecimal } from "../../utils";

const pts = (v: number | null | undefined): string =>
  formatStatDecimal(num(v), 2);

export function FantasyLeaderboard() {
  const { user } = useAuth();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const urlIsOverall = searchParams.get("type") === "overall";

  // 'overall' or a league id. Seeded from the route, then driven by the filter.
  const [scope, setScope] = useState<string>(
    urlIsOverall || !id ? OVERALL : id,
  );
  const [selectedGWId, setSelectedGWId] = useState<string>("");
  const [inspectingTeamId, setInspectingTeamId] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const queryClient = useQueryClient();

  const { data: season } = useQuery({
    queryKey: ["fantasySeason"],
    queryFn: fantasyApi.getActiveSeason,
  });

  // When the route is the overall table, its :id IS the season id.
  const seasonId = urlIsOverall && id ? id : season?.id;

  const { data: gameweeks } = useQuery({
    queryKey: ["fantasyGameweeks", season?.id],
    queryFn: () =>
      season?.id ? fantasyApi.getGameweeks(season.id) : Promise.resolve([]),
    enabled: !!season?.id,
  });

  // Powers the league filter. Signed-out visitors simply get no leagues.
  const { data: myLeagues } = useQuery({
    queryKey: ["myFantasyLeagues", season?.id],
    queryFn: () =>
      season?.id ? fantasyApi.listMyLeagues(season.id) : Promise.resolve([]),
    enabled: !!season?.id,
    retry: false,
  });

  const leagueOptions = useMemo(() => {
    const opts = (myLeagues ?? [])
      .filter((l) => !!l?.id && l.type !== "OVERALL")
      .map((l) => ({ id: l.id, name: l.name || "Unnamed league" }));
    // Viewing a league you are not a member of: keep it selectable.
    if (scope !== OVERALL && !opts.some((o) => o.id === scope)) {
      opts.unshift({ id: scope, name: "This League" });
    }
    return opts;
  }, [myLeagues, scope]);

  const { data: dashboard } = useQuery({
    queryKey: ["fantasyDashboard", seasonId],
    queryFn: () => fantasySeasonApi.getDashboard(seasonId),
    enabled: !!seasonId && !!user?.id,
  });

  const isLiveMatchDay = useMemo(() => {
    return (gameweeks ?? []).some(
      (gw) => gw.status === "LOCKED" || gw.status === "LIVE",
    );
  }, [gameweeks]);

  const {
    isLoading,
    isEmpty,
    rows,
    myEntry: hookMyEntry,
    total,
    totalPages,
    page: safePage,
    myRank,
    canJumpToMe,
    goToPage,
    jumpToMe,
    resetPaging,
    fallbackRankAt,
  } = useFantasyLeaderboard({
    seasonId,
    scope,
    gameweekId: selectedGWId,
    queryPrefix: "fantasyLeaderboard",
    limit: 10,
    defaultToPage1: true,
    refetchInterval: isLiveMatchDay ? 30_000 : false,
  });

  const showGWColumn = !!selectedGWId;

  const selectScope = (next: string) => {
    setScope(next);
    resetPaging();
  };

  // Only a mini-league you are actually in can be left; the overall table is
  // the season itself, and a league you are merely browsing has nothing to leave.
  const leavableLeague = useMemo(
    () =>
      (myLeagues ?? []).find((l) => l?.id === scope && l.type !== "OVERALL"),
    [myLeagues, scope],
  );
  const leaveEntryFeeKobo = num(leavableLeague?.entry_fee);

  const leaveMutation = useMutation({
    mutationFn: () => fantasyApi.leaveLeague(scope),
    onSuccess: () => {
      toast.success(`You have left ${leavableLeague?.name || "the league"}.`);
      setConfirmLeave(false);
      queryClient.invalidateQueries({ queryKey: ["myFantasyLeagues"] });
      queryClient.invalidateQueries({ queryKey: ["fantasyDashboard"] });
      queryClient.invalidateQueries({ queryKey: ["fantasyLeaderboard"] });
      // Their old table is no longer theirs to sit in.
      selectScope(OVERALL);
    },
    onError: (err: {
      response?: { data?: { error?: string } };
    }) =>
      toast.error(
        err?.response?.data?.error || "Could not leave this league. Try again.",
      ),
  });

  const isRowMe = (entry: LeaderboardEntry | undefined) => {
    if (!entry) return false;
    if (user?.id && entry.user_id && entry.user_id === user.id) return true;
    if (
      dashboard?.team?.id &&
      entry.team_id &&
      entry.team_id === dashboard.team.id
    )
      return true;
    return false;
  };

  const myEntry: LeaderboardEntry | null = useMemo(() => {
    if (hookMyEntry) return hookMyEntry;
    const fromRows = (rows ?? []).find((entry) => {
      if (user?.id && entry.user_id && entry.user_id === user.id) return true;
      if (
        dashboard?.team?.id &&
        entry.team_id &&
        entry.team_id === dashboard.team.id
      )
        return true;
      return false;
    });
    if (fromRows) return fromRows;
    if (dashboard?.team && myRank > 0) {
      return {
        rank: myRank,
        team_id: dashboard.team.id,
        team_name: dashboard.team.name,
        user_id: user?.id || "",
        user_name: user?.name || "You",
        gw_points: dashboard.team.gameweek_points,
        total_points: dashboard.team.total_points,
      };
    }
    return null;
  }, [hookMyEntry, rows, dashboard, myRank, user]);

  const effectiveRank = myEntry?.rank ? num(myEntry.rank) : myRank;

  const activeLeagueName =
    scope === OVERALL
      ? null
      : (leagueOptions.find((o) => o.id === scope)?.name ?? "League");

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Header Showtime Navy Banner */}
      <div className="bg-sffl-navy text-white rounded-2xl md:rounded-3xl shadow-xl p-4 sm:p-6 md:p-8">
        <div className="mb-1">
          <BackButton
            fallback="/fantasy/leagues"
            className="inline-flex items-center gap-1.5 min-h-11 text-xs text-gray-300 hover:text-white font-semibold transition cursor-pointer"
          >
            Back to Leagues
          </BackButton>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 border border-white/20 text-yellow-400 text-xs font-black uppercase tracking-wider mb-2">
              <TrophyIcon className="w-3 h-3 text-yellow-400" /> Official
              Standings
            </div>
            <h1 className="text-2xl sm:text-4xl font-black italic uppercase tracking-tight text-white wrap-break-word">
              {scope === OVERALL
                ? "Global Showtime Leaderboard"
                : activeLeagueName || "League Standings"}
            </h1>
            <p className="text-xs md:text-sm text-gray-300 mt-1 font-medium">
              {effectiveRank > 0
                ? `You are ranked #${effectiveRank.toLocaleString()} in this table.`
                : "Rankings appear here once points are scored."}
            </p>
          </div>

          {/* Gameweek Filter */}
          <div className="flex flex-wrap items-center gap-2">
            {leavableLeague && (
              <Button
                tone="dark"
                variant="secondary"
                size="sm"
                icon={ArrowRightStartOnRectangleIcon}
                onClick={() => setConfirmLeave(true)}
              >
                Leave League
              </Button>
            )}
            <label
              htmlFor="leaderboard-gw-filter"
              className="text-xs text-gray-300 font-bold uppercase"
            >
              Filter:
            </label>
            <Select
              id="leaderboard-gw-filter"
              tone="dark"
              value={selectedGWId}
              onChange={(e) => {
                setSelectedGWId(e.target.value);
                resetPaging();
              }}
              className="min-w-0"
            >
              <option value="" className="text-gray-900 bg-white">
                Season Overall
              </option>
              {(gameweeks ?? []).map((gw) => (
                <option
                  key={gw.id}
                  value={gw.id}
                  className="text-gray-900 bg-white"
                >
                  Gameweek {gw.number}
                </option>
              ))}
            </Select>
            <ButtonLink
              to={`/fantasy/analytics${selectedGWId ? `?gw=${selectedGWId}` : ""}`}
              size="sm"
              icon={ChartBarIcon}
            >
              Weekly Report
            </ButtonLink>
          </div>
        </div>
      </div>

      {/* League filter */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 md:p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <UserGroupIcon className="w-4 h-4 text-sffl-red" />
          <h2 className="text-xs font-black uppercase tracking-wider text-sffl-navy dark:text-white">
            Table
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={scope === OVERALL ? "navy" : "secondary"}
            aria-pressed={scope === OVERALL}
            onClick={() => selectScope(OVERALL)}
          >
            Overall
          </Button>
          {leagueOptions.map((o) => (
            <Button
              key={o.id}
              size="sm"
              variant={scope === o.id ? "navy" : "secondary"}
              aria-pressed={scope === o.id}
              onClick={() => selectScope(o.id)}
            >
              {o.name}
            </Button>
          ))}
        </div>
        {leagueOptions.length === 0 && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
            You're not in any mini-leagues yet — the overall table is the one to
            climb.{" "}
            <Link
              to="/fantasy/leagues"
              className="text-sffl-red hover:text-[#A52323] font-bold"
            >
              Browse leagues
            </Link>
          </p>
        )}
      </div>

      {/* Unified Standings Table Card */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex flex-wrap items-center justify-between gap-3 bg-gray-50/50 dark:bg-gray-700/30">
          <div>
            <h2 className="text-xs font-black uppercase tracking-wider text-sffl-navy dark:text-white flex items-center gap-1.5">
              <TrophyIcon className="w-4 h-4 text-yellow-500" />
              Standings
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {total > 0
                ? `${total.toLocaleString()} manager${total === 1 ? "" : "s"} ranked`
                : "No managers ranked yet"}
            </p>
          </div>
          {canJumpToMe && (
            <Button size="sm" variant="secondary" icon={MapPinIcon} onClick={jumpToMe}>
              Jump to my rank {effectiveRank > 0 ? `(#${effectiveRank})` : ""}
            </Button>
          )}
        </div>

        {isLoading ? (
          <Spinner label="Loading standings…" className="py-16" />
        ) : isEmpty ? (
          <div className="py-16 text-center text-gray-500 dark:text-gray-400 text-sm">
            No team rankings available for this selection yet.
          </div>
        ) : rows.length === 0 ? (
          <div className="py-12 text-center text-gray-500 dark:text-gray-400 text-sm">
            Nothing more to show on this page.
          </div>
        ) : (
          <>
            {myEntry && effectiveRank > 0 && (
              <p className="px-4 py-1.5 bg-gray-100/70 dark:bg-gray-700/50 text-[10px] font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Table Rankings • Page {safePage}
              </p>
            )}
            <DataTable
              compact
              searchable={false}
              paginated={false}
              getRowId={(r) => r.key}
              onRowClick={(r) => {
                if (r.teamId) setInspectingTeamId(r.teamId);
              }}
              data={[
                // Your own squad is pinned above the page, whatever its rank.
                ...(myEntry && effectiveRank > 0
                  ? [
                      {
                        key: "pinned",
                        pinned: true,
                        isMe: true,
                        rank: effectiveRank,
                        teamId: myEntry.team_id ?? null,
                        teamName: myEntry.team_name || "My Squad",
                        manager: myEntry.user_name || user?.name || "You",
                        gwPoints: myEntry.gw_points,
                        totalPoints: myEntry.total_points,
                      },
                    ]
                  : []),
                ...rows.map((entry, idx) => ({
                  key: entry?.team_id ?? `row-${idx}`,
                  pinned: false,
                  isMe: isRowMe(entry),
                  rank: num(entry?.rank) > 0 ? num(entry.rank) : fallbackRankAt(idx),
                  teamId: entry?.team_id ?? null,
                  teamName: entry?.team_name || "Unnamed squad",
                  manager: entry?.user_name || "—",
                  gwPoints: entry?.gw_points,
                  totalPoints: entry?.total_points,
                })),
              ]}
              rowClassName={(r) =>
                r.pinned
                  ? "bg-emerald-50/90 dark:bg-emerald-950/40 hover:bg-emerald-100/70 dark:hover:bg-emerald-900/50"
                  : r.isMe
                    ? "bg-emerald-50/70 dark:bg-emerald-950/30 hover:bg-emerald-100/60 dark:hover:bg-emerald-950/50"
                    : "bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50"
              }
              columns={[
                {
                  header: "Team & Manager",
                  className: "py-3.5 px-4",
                  cell: (r) => (
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-black shrink-0 ${rankBadgeClass(r.rank)}${r.pinned ? " ring-2 ring-emerald-500/40 shadow-xs" : ""}`}
                      >
                        {r.rank > 0 ? r.rank : "—"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-gray-900 dark:text-white text-sm flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                          <span className="wrap-break-word">{r.teamName}</span>
                          {r.pinned ? (
                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-600 text-white tracking-wider shadow-xs">
                              Your Position
                            </span>
                          ) : (
                            r.isMe && (
                              <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300">
                                You
                              </span>
                            )
                          )}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{r.manager}</p>
                      </div>
                      {r.teamId && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="shrink-0"
                          icon={EyeIcon}
                          aria-label={r.pinned ? "View your lineup" : `View ${r.teamName}'s squad`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setInspectingTeamId(r.teamId!);
                          }}
                        >
                          <span className="hidden sm:inline">{r.pinned ? "View Lineup" : "View Team"}</span>
                        </Button>
                      )}
                    </div>
                  ),
                },
                ...(showGWColumn
                  ? [
                      {
                        header: "GW Points",
                        align: "right" as const,
                        className: "py-3.5 px-4 font-mono font-bold text-gray-700 dark:text-gray-300",
                        cell: (r: { gwPoints?: number | null }) => pts(r.gwPoints),
                      },
                    ]
                  : []),
                {
                  header: "Total Points",
                  align: "right",
                  className: "py-3.5 px-4 font-mono font-black text-sffl-red text-base",
                  cell: (r) => (r.pinned ? `${pts(r.totalPoints)} pts` : pts(r.totalPoints)),
                },
              ]}
            />
          </>
        )}

        {/* Pagination */}
        {!isEmpty && (
          <div className="p-4 border-t border-gray-100 dark:border-gray-700 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-500 dark:text-gray-400">
            <span className="font-bold">
              Page {safePage} of {totalPages}
              {total > 0 ? ` • ${total.toLocaleString()} total managers` : ""}
            </span>
            <div className="flex items-center gap-2">
              <IconButton
                variant="secondary"
                icon={ChevronDoubleLeftIcon}
                label="First page"
                disabled={safePage === 1}
                onClick={() => goToPage(1)}
              />
              <IconButton
                variant="secondary"
                icon={ChevronLeftIcon}
                label="Previous page"
                disabled={safePage === 1}
                onClick={() => goToPage(safePage - 1)}
              />
              <IconButton
                variant="secondary"
                icon={ChevronRightIcon}
                label="Next page"
                disabled={safePage >= totalPages}
                onClick={() => goToPage(safePage + 1)}
              />
              <IconButton
                variant="secondary"
                icon={ChevronDoubleRightIcon}
                label="Last page"
                disabled={safePage >= totalPages}
                onClick={() => goToPage(totalPages)}
              />
            </div>
          </div>
        )}
      </div>

      {/* Leave confirmation. What leaving costs differs sharply between a
                free league and a paid one, so each is spelled out rather than
                hidden behind one generic "are you sure". */}
      <ConfirmDialog
        open={confirmLeave && !!leavableLeague}
        title={`Leave ${leavableLeague?.name || "this league"}?`}
        description="You'll come out of this league's table straight away. Your squad and your points in the overall table are untouched."
        confirmLabel="Yes, leave"
        tone="warning"
        icon={ArrowRightStartOnRectangleIcon}
        pending={leaveMutation.isPending}
        onConfirm={() => leaveMutation.mutate()}
        onCancel={() => setConfirmLeave(false)}
        body={
            <div>

              {leaveEntryFeeKobo > 0 ? (
                <div className="p-3 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 flex items-start gap-2">
                  <ExclamationTriangleIcon className="w-5 h-5 shrink-0 text-red-600 dark:text-red-400" aria-hidden="true" />
                  <div>
                    <p className="text-xs font-black uppercase tracking-wider text-red-700 dark:text-red-300">
                      You forfeit your {formatKobo(leaveEntryFeeKobo)} entry
                    </p>
                    <p className="text-xs text-red-700 dark:text-red-300 mt-0.5">
                      The money stays in the prize pool for whoever finishes on
                      top, and it cannot be refunded. You will not be able to
                      rejoin this league.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-2xl bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600">
                  <p className="text-xs text-gray-700 dark:text-gray-200">
                    This league is free, so nothing is lost — you can join it
                    again whenever you like.
                  </p>
                </div>
              )}
            </div>
        }
      />

      {/* Team Inspector Modal */}
      <FantasyTeamModal
        isOpen={Boolean(inspectingTeamId)}
        onClose={() => setInspectingTeamId(null)}
        teamId={inspectingTeamId}
        gameweeks={gameweeks || []}
        initialGameweekId={selectedGWId}
      />
    </div>
  );
}
