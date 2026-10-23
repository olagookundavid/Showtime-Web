import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { toast } from "react-hot-toast";
import {
  TrophyIcon,
  ShieldCheckIcon,
  ClockIcon,
  LockClosedIcon,
  PencilSquareIcon,
  UserGroupIcon,
  ArrowRightIcon,
  SparklesIcon,
  ChartBarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
  MapPinIcon,
  BanknotesIcon,
} from "@heroicons/react/24/outline";
import {
  fantasySeasonApi,
  fantasySquadApi,
  fantasyWalletApi,
  formatFantasyPrice,
  formatKobo,
} from "../../services/api";
import type {
  DashboardLeagueRow,
  FantasyLineupPick,
  LeaderboardEntry,
} from "../../types";
import { Loader, FantasyPitch, FantasyTeamModal, Spinner, Button, IconButton, FantasyNewsCarousel, ButtonLink, Modal, Field, Input } from "../../components";
import { formatStatDecimal } from "../../utils";
import { useAuth } from "../../contexts";
import { useFantasyLeaderboard, rankBadgeClass } from "../../hooks";
import { OVERALL } from "../../constants";

function getDefaultTeamName(userName?: string | null): string {
  const clean = (userName || "").trim();
  return clean ? `${clean} Team` : "Showtime Team";
}

/** Everything off the wire is treated as possibly-missing: a brand new season
 *  legitimately has no team, no lineup, no leagues and no managers. */
const num = (v: number | null | undefined): number =>
  typeof v === "number" && Number.isFinite(v) ? v : 0;

function formatDeadline(deadline?: string | null): string {
  if (!deadline) return "To be announced";
  const d = new Date(deadline);
  if (Number.isNaN(d.getTime())) return "To be announced";
  return d.toLocaleString();
}

interface CountdownParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

/** Cheap live countdown, broken into D/H/M/S for a clock-style readout.
 *  Returns null when there is nothing sensible to count to. */
function useCountdown(deadline?: string | null): CountdownParts | null {
  const [countdown, setCountdown] = useState<{
    deadline: string;
    parts: CountdownParts | null;
  } | null>(null);

  useEffect(() => {
    if (!deadline) return;
    const target = new Date(deadline).getTime();
    if (Number.isNaN(target)) return;

    const tick = () => {
      const ms = target - Date.now();
      if (ms <= 0) {
        setCountdown((previous) =>
          previous?.deadline === deadline && previous.parts === null
            ? previous
            : { deadline, parts: null },
        );
        return;
      }
      const totalSecs = Math.floor(ms / 1000);
      setCountdown({
        deadline,
        parts: {
          days: Math.floor(totalSecs / 86400),
          hours: Math.floor((totalSecs % 86400) / 3600),
          minutes: Math.floor((totalSecs % 3600) / 60),
          seconds: totalSecs % 60,
        },
      });
    };

    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [deadline]);

  return countdown && countdown.deadline === deadline ? countdown.parts : null;
}

/** One leaderboard row, shared by the pinned podium and the paged window. */
function LeaderboardRow({
  entry,
  fallbackRank,
  isMe,
  onSelect,
}: {
  entry: LeaderboardEntry;
  fallbackRank: number;
  isMe: boolean;
  onSelect?: (teamId: string) => void;
}) {
  const rank = num(entry?.rank) > 0 ? num(entry.rank) : fallbackRank;
  const canClick = Boolean(onSelect && entry?.team_id);
  return (
    <div
      onClick={canClick ? () => onSelect!(entry.team_id!) : undefined}
      role={canClick ? "button" : undefined}
      tabIndex={canClick ? 0 : undefined}
      onKeyDown={
        canClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect!(entry.team_id!);
              }
            }
          : undefined
      }
      aria-label={
        canClick
          ? `${entry?.team_name || "Unnamed squad"}, rank ${rank > 0 ? rank : "unranked"}. View their squad`
          : undefined
      }
      className={`min-h-11 px-3 py-3 flex items-center justify-between gap-3 rounded-xl transition ${
        isMe
          ? "bg-emerald-50 dark:bg-emerald-950/30 ring-1 ring-inset ring-emerald-500/40"
          : ""
      } ${canClick ? "cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/60 group" : ""}`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${rankBadgeClass(rank)}`}
        >
          {rank > 0 ? rank : "—"}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5 min-w-0">
            <span className="min-w-0 truncate group-hover:text-sffl-red transition-colors">
              {entry?.team_name || "Unnamed squad"}
            </span>
            {isMe && (
              <span className="ml-1 shrink-0 text-[10px] font-black uppercase px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300">
                You
              </span>
            )}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
            {entry?.user_name || "—"}
          </p>
        </div>
      </div>
      <p className="text-sm font-black text-sffl-red shrink-0">
        {formatStatDecimal(num(entry?.total_points), 2)} pts
      </p>
    </div>
  );
}

/**
 * Standings panel: Overall plus every league the manager is in, a pinned top 3
 * and a paged window that opens on the manager's own page.
 */
function DashboardLeaderboard({
  seasonId,
  leagues,
  myTeamId,
  currentGameweekId,
}: {
  seasonId: string;
  leagues: DashboardLeagueRow[];
  myTeamId?: string;
  currentGameweekId?: string;
}) {
  const { user } = useAuth();
  const [scope, setScope] = useState<string>(OVERALL);
  const [inspectingTeamId, setInspectingTeamId] = useState<string | null>(null);

  const leagueOptions = (leagues ?? [])
    .filter((l) => !!l?.league_id && l.type !== "OVERALL")
    .map((l) => ({ id: l.league_id, name: l.name || "Unnamed league" }));

  const {
    isLoading,
    isEmpty,
    topThree,
    windowRows,
    total,
    totalPages,
    page,
    myRank,
    canJumpToMe,
    allOnPodium,
    goToPage,
    jumpToMe,
    resetPaging,
    fallbackRankAt,
  } = useFantasyLeaderboard({
    seasonId,
    scope,
    queryPrefix: "fantasyDashLeaderboard",
  });

  const safePage = page;

  const selectScope = (next: string) => {
    setScope(next);
    resetPaging();
  };

  const isRowMe = (entry: LeaderboardEntry | undefined) => {
    if (!entry) return false;
    if (user?.id && entry.user_id && entry.user_id === user.id) return true;
    if (myTeamId && entry.team_id && entry.team_id === myTeamId) return true;
    return false;
  };

  const myEntry = topThree.find(isRowMe) || windowRows.find(isRowMe);
  const effectiveRank = myEntry?.rank ? num(myEntry.rank) : myRank;

  const fullTableTo =
    scope === OVERALL
      ? `/fantasy/leaderboard/${seasonId}?type=overall`
      : `/fantasy/leaderboard/${scope}`;

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-5 md:p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-base font-black uppercase tracking-wider text-sffl-navy dark:text-white flex items-center gap-2">
            <ChartBarIcon className="w-5 h-5 text-sffl-red" /> Standings
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {effectiveRank > 0
              ? `You are ranked #${effectiveRank.toLocaleString()}${total > 0 ? ` of ${total.toLocaleString()}` : ""} here`
              : "Season leaders across the table you pick"}
          </p>
        </div>
        <Link
          to={fullTableTo}
          className="min-h-11 text-xs text-sffl-red hover:text-[#A52323] font-black uppercase inline-flex items-center gap-1 transition shrink-0"
        >
          Full Table <ArrowRightIcon className="w-3.5 h-3.5" aria-hidden="true" />
        </Link>
      </div>

      {/* League filter */}
      <div className="flex flex-wrap gap-2 pb-4 mb-2 border-b border-gray-100 dark:border-gray-700">
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

      {isLoading ? (
        <Spinner label="Loading the table…" className="py-10" />
      ) : isEmpty ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-6">
          No manager has scored in this table yet. Be the first on the board.
        </p>
      ) : (
        <>
          {/* Pinned top 3 */}
          {topThree.length > 0 && (
            <div className="mb-4">
              <p className="text-[10px] font-black uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5 flex items-center gap-1.5">
                <TrophyIcon className="w-3.5 h-3.5 text-amber-500" /> Top 3
              </p>
              <div className="bg-gray-50 dark:bg-gray-700/40 divide-y divide-gray-100 dark:divide-gray-700">
                {topThree.map((entry, idx) => (
                  <LeaderboardRow
                    key={entry?.team_id ?? `top-${idx}`}
                    entry={entry}
                    fallbackRank={idx + 1}
                    isMe={isRowMe(entry)}
                    onSelect={(id) => setInspectingTeamId(id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Paged window */}
          <div className="flex items-center justify-between gap-3 mb-1.5">
            <p className="text-[10px] font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Rest of the table
            </p>
            {canJumpToMe && (
              <Button size="sm" variant="secondary" icon={MapPinIcon} onClick={jumpToMe}>
                Jump to me
              </Button>
            )}
          </div>

          {windowRows.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-6">
              {allOnPodium
                ? "Everyone in this table is on the podium above."
                : "Nothing more to show on this page."}
            </p>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {windowRows.map((entry, idx) => (
                <LeaderboardRow
                  key={entry?.team_id ?? `row-${idx}`}
                  entry={entry}
                  fallbackRank={fallbackRankAt(idx)}
                  isMe={isRowMe(entry)}
                  onSelect={(id) => setInspectingTeamId(id)}
                />
              ))}
            </div>
          )}

          <div className="pt-4 mt-2 border-t border-gray-100 dark:border-gray-700 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-500 dark:text-gray-400">
            <span className="font-bold">
              Page {safePage} of {totalPages}
              {total > 0
                ? ` • ${total.toLocaleString()} manager${total === 1 ? "" : "s"}`
                : ""}
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
                disabled={safePage <= 1}
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
        </>
      )}

      {/* Team Inspection Modal */}
      <FantasyTeamModal
        isOpen={Boolean(inspectingTeamId)}
        onClose={() => setInspectingTeamId(null)}
        teamId={inspectingTeamId}
        seasonId={seasonId}
        initialGameweekId={currentGameweekId}
      />
    </div>
  );
}

export function FantasyDashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const {
    data: dashboard,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["fantasyDashboard"],
    queryFn: () => fantasySeasonApi.getDashboard(),
    refetchInterval: (query) => {
      const gw = query.state.data?.current_gameweek;
      // Only auto-poll during active match days when gameweek is locked or live
      if (gw && (gw.status === "LOCKED" || gw.status === "LIVE")) {
        return 30_000;
      }
      return false;
    },
  });

  // Prize money is the one thing on this page that a manager can actually lose
  // track of, so the dashboard fetches the wallet and says so outright rather
  // than leaving it a page away.
  const { data: wallet } = useQuery({
    queryKey: ["fantasyWallet"],
    queryFn: fantasyWalletApi.getWallet,
    retry: false,
  });

  // Squad value / bank — same call Build Squad and My Team already make, so
  // this is a cache hit whenever one of those has been visited this session.
  const seasonId = dashboard?.season?.id;
  const { data: squad } = useQuery({
    queryKey: ["fantasySquad", seasonId],
    queryFn: () => (seasonId ? fantasySquadApi.getSquad(seasonId) : Promise.resolve(null)),
    enabled: !!seasonId,
  });

  const gameweek = dashboard?.current_gameweek;
  const countdown = useCountdown(gameweek?.deadline);

  // Join-season modal — this is now the only place a manager can enter the
  // season, since the Fantasy Hub landing page was retired.
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [teamNameInput, setTeamNameInput] = useState("");
  const trimmedTeamName = teamNameInput.trim();
  const teamNameValid = trimmedTeamName.length >= 3 && trimmedTeamName.length <= 40;

  const enterMutation = useMutation({
    mutationFn: async () => {
      const seasonId = dashboard?.season?.id;
      if (!seasonId) throw new Error("Season not loaded");
      if (!teamNameValid) throw new Error("Team name must be 3–40 characters");
      return fantasySeasonApi.enterSeason(seasonId, trimmedTeamName);
    },
    onSuccess: () => {
      toast.success("You're in! Welcome to the season.");
      setShowJoinModal(false);
      setTeamNameInput("");
      queryClient.invalidateQueries({ queryKey: ["fantasyDashboard"] });
    },
    onError: (err: unknown) => {
      const errorMessage = err instanceof Error ? err.message : undefined;
      const apiError =
        typeof err === "object" &&
        err !== null &&
        "response" in err &&
        typeof err.response === "object" &&
        err.response !== null &&
        "data" in err.response &&
        typeof err.response.data === "object" &&
        err.response.data !== null &&
        "error" in err.response.data &&
        typeof err.response.data.error === "string"
          ? err.response.data.error
          : undefined;

      toast.error(apiError || errorMessage || "Failed to join the season");
    },
  });

  if (isLoading) {
    return <Loader />;
  }

  // No live season (or the call failed) — same shape of empty state the hub uses.
  if (isError || !dashboard || !dashboard.season) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4 bg-white dark:bg-gray-800 rounded-2xl md:rounded-3xl border border-gray-200 dark:border-gray-700 shadow-sm p-8 md:p-12">
        <div className="w-16 h-16 rounded-2xl bg-sffl-red/10 dark:bg-sffl-red/20 flex items-center justify-center text-sffl-red mb-4">
          <ShieldCheckIcon className="w-10 h-10" />
        </div>
        <h1 className="text-2xl font-black uppercase tracking-tight text-sffl-navy dark:text-white mb-2">
          No Active Season
        </h1>
        <p className="text-gray-600 dark:text-gray-300 max-w-md mb-6 text-sm">
          There is no fantasy season running right now, so there is nothing to
          track yet. Check back when the next season opens.
        </p>
        <ButtonLink to="/" variant="primary" shape="square">
          Return to Homepage
        </ButtonLink>
      </div>
    );
  }

  const season = dashboard.season;

  // Deliberate entry is required — never pretend a manager is playing.
  if (!dashboard.entered) {
    return (
      <>
        <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4 bg-white dark:bg-gray-800 rounded-2xl md:rounded-3xl border border-gray-200 dark:border-gray-700 shadow-sm p-8 md:p-12">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 flex items-center justify-center text-amber-500 mb-4">
            <SparklesIcon className="w-10 h-10" />
          </div>
          <h1 className="text-2xl font-black uppercase tracking-tight text-sffl-navy dark:text-white mb-2">
            You Haven't Joined This Season
          </h1>
          <p className="text-gray-600 dark:text-gray-300 max-w-md mb-6 text-sm">
            {season.name} is open, but you haven't entered it yet. It only
            takes a team name — nothing happens until you confirm.
          </p>
          <Button
            variant="primary"
            shape="square"
            icon={ArrowRightIcon}
            iconPosition="right"
            onClick={() => {
              setTeamNameInput(getDefaultTeamName(user?.name));
              setShowJoinModal(true);
            }}
          >
            Join {season.name}
          </Button>
        </div>

        <Modal
          open={showJoinModal}
          onClose={() => setShowJoinModal(false)}
          title={`Join ${season.name}`}
          maxWidth="md"
        >
          <div>
            <p className="text-xs text-gray-600 dark:text-gray-300 mb-4 leading-relaxed">
              You are choosing to enter this season. This creates your manager
              team and puts you on the overall rankings — nothing happens until
              you confirm. Joining a mini-league is a separate, optional step.
            </p>

            <Field
              label="Team Name (3–40 characters)"
              htmlFor="fantasy-dashboard-team-name"
              hint={
                trimmedTeamName.length === 0
                  ? "Team names must be unique across the season (3–40 characters)."
                  : teamNameValid
                    ? `${trimmedTeamName.length}/40 characters • Team names must be unique in this season`
                    : undefined
              }
              error={
                trimmedTeamName.length > 0 && !teamNameValid
                  ? "Team name must be between 3 and 40 characters."
                  : undefined
              }
              className="mb-4"
            >
              <Input
                id="fantasy-dashboard-team-name"
                type="text"
                value={teamNameInput}
                onChange={(e) => setTeamNameInput(e.target.value)}
                placeholder="e.g. Lagos Blitz"
                maxLength={40}
                invalid={trimmedTeamName.length > 0 && !teamNameValid}
              />
            </Field>

            <Button
              variant="primary"
              fullWidth
              shape="square"
              className="uppercase tracking-wider"
              loading={enterMutation.isPending}
              disabled={!teamNameValid}
              onClick={() => enterMutation.mutate()}
            >
              {enterMutation.isPending ? "Entering season…" : "Confirm & Enter Season"}
            </Button>
          </div>
        </Modal>
      </>
    );
  }

  const team = dashboard.team;
  const lineup = dashboard.lineup;
  const picks: FantasyLineupPick[] = lineup?.picks ?? [];
  const leagues: DashboardLeagueRow[] = dashboard.leagues ?? [];
  const deadlinePassed = dashboard.deadline_passed === true;

  const rank = num(team?.overall_rank);
  const totalManagers = num(team?.total_managers);

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Fantasy news: the articles chosen on the Fantasy Carousel admin page.
          Renders nothing until one has been added. */}
      <FantasyNewsCarousel />

      {/* Hero: personal progress first */}
      <div className="bg-sffl-navy text-white shadow-xl p-4 sm:p-6 md:p-8">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl md:text-5xl font-black italic uppercase tracking-tight text-white wrap-break-word">
            {team?.name || "My Squad"}
          </h1>
        </div>

        {/* Rank hero + points */}
        <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-4 bg-white/10">
            <span className="text-[10px] uppercase font-black tracking-wider text-gray-300 block">
              Overall Rank
            </span>
            <span className="text-3xl sm:text-4xl md:text-5xl font-black text-yellow-400 leading-tight break-all">
              {rank > 0 ? `#${rank.toLocaleString()}` : "—"}
            </span>
            <span className="block text-xs text-gray-300 font-bold mt-0.5">
              {rank > 0
                ? "Your position this season"
                : "Ranking starts once points are scored"}
            </span>
          </div>

          <div className="p-4 bg-white/10">
            <span className="text-[10px] uppercase font-black tracking-wider text-gray-300 block">
              {gameweek
                ? `Gameweek ${gameweek.number} Points`
                : "Gameweek Points"}
            </span>
            <span className="text-2xl sm:text-3xl md:text-4xl font-black text-white leading-tight break-all">
              {formatStatDecimal(num(team?.gameweek_points), 2)}
            </span>
            <span className="block text-xs text-gray-300 font-bold mt-0.5">
              This match day
            </span>
          </div>

          <div className="p-4 bg-white/10">
            <span className="text-[10px] uppercase font-black tracking-wider text-gray-300 block">
              Season Total
            </span>
            <span className="text-2xl sm:text-3xl md:text-4xl font-black text-emerald-400 leading-tight break-all">
              {formatStatDecimal(num(team?.total_points), 2)}
            </span>
            <span className="block text-xs text-gray-300 font-bold mt-0.5">
              All gameweeks
            </span>
          </div>

          <div className="p-4 bg-white/10">
            <span className="text-[10px] uppercase font-black tracking-wider text-gray-300 block">
              Total Players
            </span>
            <span className="text-2xl sm:text-3xl md:text-4xl font-black text-white leading-tight break-all">
              {totalManagers > 0 ? totalManagers.toLocaleString() : "—"}
            </span>
            <span className="block text-xs text-gray-300 font-bold mt-0.5">
              Managers in this season
            </span>
          </div>
        </div>

        {/* Finance — a lighter, secondary strip under the headline stats,
            same split Build Squad/My Team already track (squad value vs.
            what's left to spend). */}
        {squad && (
          <div className="mt-4 pt-4 border-t border-white/10 flex flex-wrap items-center gap-x-8 gap-y-1.5">
            <div className="flex items-baseline gap-1.5">
              <span className="text-[10px] uppercase font-black tracking-wider text-gray-400">
                Squad Value
              </span>
              <span className="text-sm font-black text-white tabular-nums">
                {formatFantasyPrice(squad.squad_value)}
              </span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-[10px] uppercase font-black tracking-wider text-gray-400">
                In The Bank
              </span>
              <span className="text-sm font-black text-emerald-400 tabular-nums">
                {formatFantasyPrice(squad.bank)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Deadline — what needs doing, right after the headline numbers */}
      <div
        className={`border p-5 md:p-6 shadow-sm ${
          deadlinePassed
            ? "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
            : "bg-white dark:bg-gray-800 border-emerald-500/40 dark:border-emerald-500/30"
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div
              className={`w-11 h-11 flex items-center justify-center shrink-0 ${
                deadlinePassed
                  ? "bg-sffl-red/10 dark:bg-sffl-red/20 text-sffl-red"
                  : "bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
              }`}
            >
              {deadlinePassed ? (
                <LockClosedIcon className="w-6 h-6" />
              ) : (
                <ClockIcon className="w-6 h-6" />
              )}
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-black uppercase tracking-wider text-sffl-navy dark:text-white">
                {gameweek ? `Gameweek ${gameweek.number}` : "Next Gameweek"}
                {deadlinePassed ? " — Locked" : ""}
              </h2>
              {deadlinePassed ? (
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 leading-relaxed max-w-xl">
                  The deadline passed on{" "}
                  <strong>{formatDeadline(gameweek?.deadline)}</strong>. Your
                  squad is fixed for this gameweek and is now scoring live —
                  changes reopen for the next gameweek.
                </p>
              ) : (
                <>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 leading-relaxed max-w-xl">
                    Deadline: <strong>{formatDeadline(gameweek?.deadline)}</strong>.
                    Squads lock{" "}
                    {season.lock_mins_before >= 60
                      ? `${season.lock_mins_before / 60} hours`
                      : `${num(season.lock_mins_before)} minutes`}{" "}
                    before kickoff.
                  </p>
                  {countdown && (
                    <div className="flex items-center gap-1.5 mt-3">
                      {[
                        { label: "Days", value: countdown.days },
                        { label: "Hrs", value: countdown.hours },
                        { label: "Min", value: countdown.minutes },
                        { label: "Sec", value: countdown.seconds },
                      ].map((unit) => (
                        <div
                          key={unit.label}
                          className="flex flex-col items-center justify-center w-12 sm:w-14 py-1.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800"
                        >
                          <span className="text-lg sm:text-xl font-black text-emerald-700 dark:text-emerald-300 tabular-nums leading-none">
                            {String(unit.value).padStart(2, "0")}
                          </span>
                          <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-600/80 dark:text-emerald-400/70 mt-0.5">
                            {unit.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {!deadlinePassed && (
            <ButtonLink
              to="/fantasy/build"
              variant="primary"
              shape="square"
              icon={PencilSquareIcon}
              className="shrink-0"
            >
              Edit Squad
            </ButtonLink>
          )}
        </div>
      </div>

      {/* Squad snapshot — the formation, so the 7v7 shape and any empty
          position read at a glance. FantasyPitch already opens a player's
          profile on click, so nothing more is needed here. */}
      <div>
        <h2 className="text-xl font-black uppercase tracking-tight text-sffl-navy dark:text-white flex items-center gap-2 mb-4">
          <ShieldCheckIcon className="w-5 h-5 text-sffl-red" /> Squad Snapshot
        </h2>

        {picks.length === 0 ? (
          <div className="p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-center shadow-sm">
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
              No squad is set for{" "}
              {gameweek ? `Gameweek ${gameweek.number}` : "this gameweek"} yet.
              Pick your{" "}
              {num(season.squad_size) > 0
                ? `${num(season.squad_size)}-player`
                : ""}{" "}
              squad to start scoring points.
            </p>
            <ButtonLink
              to="/fantasy/build"
              variant="primary"
              shape="square"
              icon={ArrowRightIcon}
              iconPosition="right"
            >
              Build My Squad
            </ButtonLink>
          </div>
        ) : (
          <FantasyPitch
            picks={picks}
            gameweekLabel={gameweek ? `Gameweek ${gameweek.number}` : undefined}
            gameweekId={dashboard?.lineup?.gameweek_id || gameweek?.id}
            showPoints={deadlinePassed}
          />
        )}
      </div>

      {/* Winnings. Shown only when there is money involved — an empty wallet
          is not news, but money sitting unclaimed is. */}
      {wallet &&
        (num(wallet.balance_kobo) > 0 ||
          num(wallet.pending_payout_kobo) > 0) && (
          <div className="bg-white dark:bg-gray-800 border border-emerald-200 dark:border-emerald-800 shadow-sm p-5 md:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-11 h-11 shrink-0 bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <BanknotesIcon className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    You've won prize money
                  </p>
                  <p className="text-2xl md:text-3xl font-black text-sffl-navy dark:text-white leading-tight tabular-nums">
                    {formatKobo(num(wallet.balance_kobo))}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">
                    {num(wallet.balance_kobo) > 0
                      ? "Add your bank account and request a withdrawal — we pay it by transfer."
                      : "Your balance is fully requested."}
                    {num(wallet.pending_payout_kobo) > 0 && (
                      <>
                        {" "}
                        <span className="font-bold text-amber-600 dark:text-amber-400">
                          {formatKobo(num(wallet.pending_payout_kobo))} is
                          already being processed.
                        </span>
                      </>
                    )}
                  </p>
                </div>
              </div>

              <ButtonLink
                to="/fantasy/wallet"
                variant="success"
                shape="square"
                icon={ArrowRightIcon}
                iconPosition="right"
                className="shrink-0"
              >
                {num(wallet.balance_kobo) > 0 ? "Withdraw" : "View Wallet"}
              </ButtonLink>
            </div>
          </div>
        )}

      {/* Standings */}
      <DashboardLeaderboard
        seasonId={season.id}
        leagues={leagues}
        myTeamId={team?.id}
        currentGameweekId={gameweek?.id}
      />

      {/* My leagues */}
      <div>
        <h2 className="text-xl font-black uppercase tracking-tight text-sffl-navy dark:text-white flex items-center gap-2 mb-4">
          <UserGroupIcon className="w-5 h-5 text-sffl-red" /> My Leagues
        </h2>

        {leagues.length === 0 ? (
          <div className="p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm text-center">
            <p className="text-sm text-gray-600 dark:text-gray-300 max-w-lg mx-auto mb-4 leading-relaxed">
              You're not in any mini-leagues — and you don't have to be.{" "}
              <strong>
                Mini-leagues are entirely optional and separate from playing the
                season.
              </strong>{" "}
              Your squad already scores points and climbs the overall rankings
              without one.
            </p>
            <ButtonLink
              to="/fantasy/leagues"
              variant="secondary"
              shape="square"
              icon={ArrowRightIcon}
              iconPosition="right"
            >
              Browse or Create a League
            </ButtonLink>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {leagues.map((l, idx) => (
              <Link
                key={l.league_id ?? idx}
                to={`/fantasy/leaderboard/${l.league_id}`}
                className="relative p-5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-sffl-red/50 shadow-sm flex items-center justify-between gap-3 transition"
              >
                <span
                  className={`absolute left-0 top-0 bottom-0 w-1 z-10 ${
                    idx % 2 === 0 ? "bg-sffl-red" : "bg-sffl-navy"
                  }`}
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200">
                      {l.type || "LEAGUE"}
                    </span>
                    {num(l.entry_fee_kobo) > 0 && (
                      <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                        Entry {formatKobo(num(l.entry_fee_kobo))}
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white mt-1.5 truncate">
                    {l.name || "Unnamed league"}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {num(l.my_rank) > 0
                      ? `Rank ${num(l.my_rank).toLocaleString()} of ${num(l.member_count).toLocaleString()}`
                      : `${num(l.member_count).toLocaleString()} member${num(l.member_count) === 1 ? "" : "s"} • unranked so far`}
                  </p>
                </div>
                <ArrowRightIcon className="w-4 h-4 text-gray-400 shrink-0" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
