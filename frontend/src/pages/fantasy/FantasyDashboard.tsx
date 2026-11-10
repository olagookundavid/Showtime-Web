import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { toast } from "react-hot-toast";
import {
  ShieldCheckIcon,
  ClockIcon,
  LockClosedIcon,
  PencilSquareIcon,
  UserGroupIcon,
  ArrowRightIcon,
  SparklesIcon,
  ChartBarIcon,
  CalendarDaysIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  BanknotesIcon,
} from "@heroicons/react/24/outline";
import {
  fantasyApi,
  fantasySeasonApi,
  fantasySquadApi,
  fantasyWalletApi,
  formatFantasyPrice,
  formatKobo,
  getMatches,
} from "../../services/api";
import type {
  DashboardLeagueRow,
  FantasyLineupPick,
  Match,
  RankMovement,
} from "../../types";
import { Loader, FantasyPitch, Button, IconButton, Spinner, FantasyNewsCarousel, FantasyStandingRow, ButtonLink, Modal, Field, Input } from "../../components";
import { formatStatDecimal, formatMatchTime } from "../../utils";
import { useAuth } from "../../contexts";

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

interface StandingRow {
  key: string;
  to: string;
  name: string;
  rank: number;
  movement?: RankMovement;
  isOverall: boolean;
}

/**
 * Standings panel: the manager's own position in Overall and in every
 * mini-league they're in, each a link straight to that table's full page.
 */
function MyStandings({
  seasonId,
  team,
  leagues,
}: {
  seasonId: string;
  team?: {
    overall_rank: number;
    rank_movement?: RankMovement;
  };
  leagues: DashboardLeagueRow[];
}) {
  const rows: StandingRow[] = [
    {
      key: "overall",
      to: `/fantasy/leaderboard/${seasonId}?type=overall`,
      name: "Overall",
      rank: num(team?.overall_rank),
      movement: team?.rank_movement,
      isOverall: true,
    },
    ...(leagues ?? [])
      .filter((l) => !!l?.league_id && l.type !== "OVERALL")
      .map((l) => ({
        key: l.league_id,
        to: `/fantasy/leaderboard/${l.league_id}`,
        name: l.name || "Unnamed league",
        rank: num(l.my_rank),
        movement: l.rank_movement,
        isOverall: false,
      })),
  ];

  return (
    <div>
      <h2 className="text-xl font-black uppercase tracking-tight text-sffl-navy dark:text-white flex items-center gap-2 mb-4">
        <ChartBarIcon className="w-5 h-5 text-sffl-red" /> Standings
      </h2>
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-5 md:p-6 shadow-sm">
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          Your position in every table you're part of. Tap one for the full standings.
        </p>

        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {rows.map((row) => (
            <FantasyStandingRow
              key={row.key}
              to={row.to}
              name={row.name}
              rank={row.rank}
              movement={row.movement}
              isOverall={row.isOverall}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** "Fri 23 Oct" — the day-first style the fixtures panel groups matches by. */
function formatFixtureDay(dateString: string): string {
  const datePart = dateString.split("T")[0];
  const [year, month, day] = datePart.split("-").map((p) => parseInt(p, 10));
  if (!year || !month || !day) return dateString;
  const d = new Date(year, month - 1, day);
  return `${WEEKDAY_LABELS[d.getDay()]} ${d.getDate()} ${MONTH_LABELS[d.getMonth()]}`;
}

/** "Fri 23 Oct, 18:30" — the gameweek deadline, converted to the viewer's own clock. */
function formatFixtureDeadline(deadline?: string | null): string {
  if (!deadline) return "To be announced";
  const d = new Date(deadline);
  if (Number.isNaN(d.getTime())) return "To be announced";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${WEEKDAY_LABELS[d.getDay()]} ${d.getDate()} ${MONTH_LABELS[d.getMonth()]}, ${hh}:${mm}`;
}

/** One fixture row: home name+crest, kickoff time (or score once underway), away crest+name. */
function FixtureRow({ match }: { match: Match }) {
  const isLiveOrDone = match.status === "FINISHED" || match.status === "LIVE";
  return (
    <Link
      to={`/matches/${match.id}`}
      className="flex items-center justify-center gap-3 py-3 px-2 -mx-2 rounded-lg transition hover:bg-gray-50 dark:hover:bg-gray-700/40"
    >
      <div className="flex-1 min-w-0 flex items-center justify-end gap-2">
        <span className="text-sm font-bold text-gray-900 dark:text-white truncate">
          {match.home_team?.short_name || match.home_team?.name || "TBD"}
        </span>
        <img
          src={match.home_team?.logo || "/images/default_football.webp"}
          alt=""
          aria-hidden="true"
          className="w-6 h-6 object-contain shrink-0"
        />
      </div>
      <span className="shrink-0 w-16 text-center text-sm font-black text-sffl-navy dark:text-white tabular-nums">
        {isLiveOrDone ? `${match.home_score} - ${match.away_score}` : formatMatchTime(match.start_time, match.date)}
      </span>
      <div className="flex-1 min-w-0 flex items-center justify-start gap-2">
        <img
          src={match.away_team?.logo || "/images/default_football.webp"}
          alt=""
          aria-hidden="true"
          className="w-6 h-6 object-contain shrink-0"
        />
        <span className="text-sm font-bold text-gray-900 dark:text-white truncate">
          {match.away_team?.short_name || match.away_team?.name || "TBD"}
        </span>
      </div>
    </Link>
  );
}

/**
 * Fixtures panel: one gameweek's real-world matches at a time, grouped by
 * day, stepped through with Previous/Next. Next is disabled once there's no
 * later gameweek to step to yet.
 */
function FixturesPanel({
  seasonId,
  currentGameweekId,
}: {
  seasonId: string;
  currentGameweekId?: string;
}) {
  const { data: gameweeks = [] } = useQuery({
    queryKey: ["fantasyGameweeks", seasonId],
    queryFn: () => fantasyApi.getGameweeks(seasonId),
    enabled: !!seasonId,
  });

  const sortedGameweeks = useMemo(
    () => [...gameweeks].sort((a, b) => a.number - b.number),
    [gameweeks],
  );

  const [requestedGwId, setRequestedGwId] = useState("");
  // Defaults to the gameweek the dashboard already has open, falling back to
  // the latest one known so far if that's not (yet) in the list.
  const defaultGwId =
    currentGameweekId && sortedGameweeks.some((gw) => gw.id === currentGameweekId)
      ? currentGameweekId
      : sortedGameweeks[sortedGameweeks.length - 1]?.id ?? "";
  const selectedGwId = sortedGameweeks.some((gw) => gw.id === requestedGwId)
    ? requestedGwId
    : defaultGwId;

  const selectedIndex = sortedGameweeks.findIndex((gw) => gw.id === selectedGwId);
  const selectedGameweek = selectedIndex >= 0 ? sortedGameweeks[selectedIndex] : undefined;

  const { data: matchesRes, isLoading: matchesLoading } = useQuery({
    queryKey: ["fantasyFixtures", selectedGameweek?.event_day_id],
    queryFn: () => getMatches(undefined, 1, 100, undefined, undefined, undefined, selectedGameweek?.event_day_id),
    enabled: !!selectedGameweek?.event_day_id,
  });
  const fixtures = useMemo(() => matchesRes?.data ?? [], [matchesRes]);

  const canGoPrev = selectedIndex > 0;
  const canGoNext = selectedIndex >= 0 && selectedIndex < sortedGameweeks.length - 1;

  const dayGroups = useMemo(() => {
    const byDay = new Map<string, Match[]>();
    for (const m of fixtures) {
      const key = (m.date || "").split("T")[0];
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key)!.push(m);
    }
    return Array.from(byDay.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [fixtures]);

  const dateRangeLabel = useMemo(() => {
    if (dayGroups.length === 0) return "";
    const first = dayGroups[0][0];
    const last = dayGroups[dayGroups.length - 1][0];
    return first === last ? formatFixtureDay(first) : `${formatFixtureDay(first)} - ${formatFixtureDay(last)}`;
  }, [dayGroups]);

  return (
    <div>
      <h2 className="text-xl font-black uppercase tracking-tight text-sffl-navy dark:text-white flex items-center gap-2 mb-4">
        <CalendarDaysIcon className="w-5 h-5 text-sffl-red" /> Fixtures
      </h2>
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-5 md:p-6 shadow-sm">
        <div className="flex items-center justify-center gap-4 sm:gap-6 mb-3">
          <IconButton
            variant="secondary"
            icon={ChevronLeftIcon}
            label="Previous gameweek"
            disabled={!canGoPrev}
            onClick={() => setRequestedGwId(sortedGameweeks[selectedIndex - 1].id)}
          />
          <div className="text-center min-w-0">
            <p className="text-base sm:text-lg font-black uppercase tracking-wide text-sffl-navy dark:text-white">
              {selectedGameweek ? `Gameweek ${selectedGameweek.number}` : "No Gameweeks Yet"}
            </p>
            {!matchesLoading && dateRangeLabel && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{dateRangeLabel}</p>
            )}
          </div>
          <IconButton
            variant="secondary"
            icon={ChevronRightIcon}
            label="Next gameweek"
            disabled={!canGoNext}
            onClick={() => setRequestedGwId(sortedGameweeks[selectedIndex + 1].id)}
          />
        </div>

        {selectedGameweek && (
          <div className="text-center mb-5">
            <p className="text-sm font-bold text-sffl-navy dark:text-white">
              Deadline: {formatFixtureDeadline(selectedGameweek.deadline)}
            </p>
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
              Deadline in your local time · kick-offs in West Africa Time (WAT)
            </p>
          </div>
        )}

        {matchesLoading ? (
          <Spinner label="Loading fixtures…" className="py-10" />
        ) : !selectedGameweek ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-6">
            No gameweeks have been scheduled yet.
          </p>
        ) : fixtures.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-6">
            No fixtures found for Gameweek {selectedGameweek.number}.
          </p>
        ) : (
          <div className="space-y-5">
            {dayGroups.map(([dateKey, dayMatches]) => (
              <div key={dateKey} className="flex gap-3 sm:gap-4">
                <div className="shrink-0 pt-3">
                  <p className="text-[11px] sm:text-xs font-black uppercase text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    {formatFixtureDay(dateKey)}
                  </p>
                </div>
                <div className="flex-1 min-w-0 divide-y divide-gray-100 dark:divide-gray-700">
                  {dayMatches.map((match) => (
                    <FixtureRow key={match.id} match={match} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
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
  // Pick Team only arranges players already owned — a manager with no squad
  // yet has nothing to arrange, so these CTAs send them to sign players
  // first instead of to a page with nothing for them to do.
  const needsSquad = !squad || squad.players.length === 0;

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
              Season Total
            </span>
            <span className="text-3xl sm:text-4xl md:text-5xl font-black text-white leading-tight break-all">
              {formatStatDecimal(num(team?.total_points), 2)}
            </span>
            <span className="block text-xs text-gray-300 font-bold mt-0.5">
              All gameweeks
            </span>
          </div>

          <div className="p-4 bg-white/10">
            <span className="text-[10px] uppercase font-black tracking-wider text-gray-300 block">
              Overall Rank
            </span>
            <span className="text-3xl sm:text-4xl md:text-5xl font-black text-white leading-tight break-all">
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
              to={needsSquad ? "/fantasy/transfers" : "/fantasy/build"}
              variant="primary"
              shape="square"
              icon={PencilSquareIcon}
              className="shrink-0"
            >
              {needsSquad ? "Sign Your Squad" : "Edit Squad"}
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
              {needsSquad
                ? " Sign your "
                : " Pick your "}
              {num(season.squad_size) > 0
                ? `${num(season.squad_size)}-player`
                : ""}{" "}
              squad to start scoring points.
            </p>
            <ButtonLink
              to={needsSquad ? "/fantasy/transfers" : "/fantasy/build"}
              variant="primary"
              shape="square"
              icon={ArrowRightIcon}
              iconPosition="right"
            >
              {needsSquad ? "Sign Players To Build Your Squad" : "Set Your Lineup"}
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
      <MyStandings seasonId={season.id} team={team} leagues={leagues} />

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

      {/* Fixtures */}
      <FixturesPanel seasonId={season.id} currentGameweekId={gameweek?.id} />
    </div>
  );
}
