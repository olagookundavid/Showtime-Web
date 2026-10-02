import { useMemo, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQueries, useQuery } from "@tanstack/react-query";
import {
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
  ExclamationTriangleIcon,
  EyeIcon,
  EyeSlashIcon,
  PencilSquareIcon,
  ShieldCheckIcon,
  TrashIcon,
  UserGroupIcon,
  UserPlusIcon,
} from "@heroicons/react/24/outline";
import {
  getAdminTeams,
  getCompetitions,
  getMatches,
  getPlayers,
  getTeamManagers,
  getTeamsByCompetition,
  sortCompetitionsBySeason,
  type Competition,
  type Match,
  type Player,
  type Team,
} from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";
import { usePermissions } from "../../hooks/usePermissions";
import { adminSectionsFor } from "../../components/admin/adminNav";
import {
  MAX_MAIN_SQUAD,
  teamManagersKey,
  useTeamActions,
} from "../../components/admin/useTeamActions";
import { TeamActionDialogs } from "../../components/admin/TeamActionDialogs";
import { TeamStatusBadge } from "../../components/admin/TeamStatusBadge";
import { DashboardPageHeader } from "../../components/dashboard/DashboardPageHeader";
import { DataTable, type Column } from "../../components/ui/DataTable";
import { Loader } from "../../components/ui/Loader";
import { Spinner } from "../../components/ui/Spinner";
import { LightboxImage } from "../../components/ui";
import {
  DeletedPlayerName,
  deletedRowClass,
  isDeletedPlayer,
} from "../../components/common/DeletedPlayer";
import { formatMatchDate, formatMatchTime } from "../../utils/dateUtils";

type Result = "W" | "D" | "L";

type Tally = {
  played: number;
  won: number;
  drawn: number;
  lost: number;
  scored: number;
  conceded: number;
  form: Result[]; // the last five, oldest first
};

type CompetitionRow = Competition & Tally;

const NO_PLAYERS: Player[] = [];
const NO_MATCHES: Match[] = [];
const NO_COMPETITIONS: Competition[] = [];

const FORMAT_LABEL: Record<string, string> = {
  PRESEASON: "Preseason",
  SEASON: "Regular season",
  PLAYOFFS: "Playoffs",
  CUP: "Cup",
};

const cardClass =
  "bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6 min-w-0";
const primaryButton =
  "inline-flex items-center justify-center gap-1.5 w-full sm:w-auto px-4 py-2 min-h-11 bg-sffl-red text-white text-sm font-bold rounded-lg shadow-sm hover:shadow-md hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none";
const secondaryButton =
  "inline-flex items-center justify-center gap-1.5 w-full sm:w-auto px-4 py-2 min-h-11 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm font-bold rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
const textLink =
  "inline-flex items-center gap-1 min-h-11 text-sm font-bold text-sffl-red hover:underline";

const formatDay = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

// Same rule as the backend standings: only finished matches with both scores count.
const resultFor = (m: Match, teamId: string) => {
  if (m.status !== "FINISHED" || m.home_score == null || m.away_score == null) return null;
  const home = m.home_team?.id === teamId;
  const scored = home ? m.home_score : m.away_score;
  const conceded = home ? m.away_score : m.home_score;
  const result: Result = scored > conceded ? "W" : scored < conceded ? "L" : "D";
  return { result, scored, conceded };
};

// `matches` must be in date order, as the matches endpoint returns them.
const tally = (matches: Match[], teamId: string): Tally => {
  const t: Tally = { played: 0, won: 0, drawn: 0, lost: 0, scored: 0, conceded: 0, form: [] };
  for (const m of matches) {
    const r = resultFor(m, teamId);
    if (!r) continue;
    t.played++;
    if (r.result === "W") t.won++;
    else if (r.result === "D") t.drawn++;
    else t.lost++;
    t.scored += r.scored;
    t.conceded += r.conceded;
    t.form.push(r.result);
  }
  t.form = t.form.slice(-5);
  return t;
};

// Win % as the standings table works it out: a draw counts as half a win.
const winPct = (t: Tally) =>
  t.played ? `${(((t.won + 0.5 * t.drawn) / t.played) * 100).toFixed(1)}%` : "—";

const RESULT_STYLE: Record<Result, { label: string; className: string }> = {
  W: { label: "Won", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300" },
  D: { label: "Drawn", className: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300" },
  L: { label: "Lost", className: "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300" },
};

const ResultChip = ({ result }: { result: Result }) => (
  <span
    title={RESULT_STYLE[result].label}
    aria-label={RESULT_STYLE[result].label}
    className={`inline-flex items-center justify-center w-7 h-7 shrink-0 rounded-md text-xs font-black ${RESULT_STYLE[result].className}`}
  >
    {result}
  </span>
);

const LastFive = ({ form }: { form: Result[] }) =>
  form.length ? (
    <span className="inline-flex gap-1">
      {form.map((r, i) => (
        <ResultChip key={i} result={r} />
      ))}
    </span>
  ) : (
    <span className="text-gray-400">—</span>
  );

const Pending = () => (
  <ArrowPathIcon role="img" aria-label="Loading" className="w-6 h-6 animate-spin text-gray-400" />
);

const StatTile = ({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) => (
  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-sm min-w-0">
    <span className="block text-xs font-bold text-gray-500 dark:text-gray-400">{label}</span>
    <span className="block mt-1 text-2xl font-black tabular-nums text-gray-900 dark:text-white wrap-break-word">
      {value}
    </span>
    {hint && <span className="block mt-1 text-xs text-gray-500 dark:text-gray-400">{hint}</span>}
  </div>
);

const SectionHeading = ({
  id,
  title,
  description,
  action,
}: {
  id: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) => (
  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
    <div className="min-w-0">
      <h2 id={id} className="text-lg font-bold text-gray-900 dark:text-white">
        {title}
      </h2>
      {description && (
        <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{description}</p>
      )}
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </div>
);

const EmptyState = ({ children, action }: { children: ReactNode; action?: ReactNode }) => (
  <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-4 sm:p-6 text-center space-y-3">
    <p className="text-sm text-gray-500 dark:text-gray-400">{children}</p>
    {action}
  </div>
);

const MatchItem = ({ match, teamId }: { match: Match; teamId: string }) => {
  const home = match.home_team?.id === teamId;
  const opponent = home ? match.away_team : match.home_team;
  const r = resultFor(match, teamId);
  const time = formatMatchTime(match.start_time);
  return (
    <li className="flex items-center gap-3 py-3 min-w-0">
      {r ? (
        <ResultChip result={r.result} />
      ) : (
        <span className="w-7 h-7 shrink-0 rounded-md bg-sffl-navy/10 dark:bg-sffl-navy/50 flex items-center justify-center">
          <ShieldCheckIcon className="w-4 h-4 text-sffl-navy dark:text-gray-200" aria-hidden="true" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-gray-900 dark:text-white truncate">
          {opponent?.name || "Opponent to be decided"}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
          {home ? "Home" : "Away"} · {formatMatchDate(match.date)}
          {time !== "TBD" && ` · ${time}`}
          {match.competition?.name && ` · ${match.competition.name}`}
        </p>
      </div>
      {r ? (
        <span className="shrink-0 text-sm font-black tabular-nums text-gray-900 dark:text-white">
          {r.scored}–{r.conceded}
        </span>
      ) : match.status === "LIVE" || match.status === "POSTPONED" ? (
        <span
          className={`shrink-0 px-2 py-0.5 rounded-md text-xs font-bold ${
            match.status === "LIVE"
              ? "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300"
              : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
          }`}
        >
          {match.status === "LIVE" ? "Live" : "Postponed"}
        </span>
      ) : null}
    </li>
  );
};

export const AdminTeamDetail = () => {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { canEdit } = usePermissions();
  const canManage = canEdit("teams_standings");
  const actions = useTeamActions({ onDeleted: () => navigate("/admin/teams") });

  // Only link to dashboard pages this role can open.
  const canOpen = useMemo(() => {
    const paths = new Set(adminSectionsFor(user?.role).flatMap((s) => s.links.map((l) => l.path)));
    return (path: string) => paths.has(path);
  }, [user?.role]);

  // There is no single-team endpoint; the admin list includes inactive teams.
  const { data: teamsPage, isLoading: loadingTeam } = useQuery({
    queryKey: ["adminTeamLookup"],
    queryFn: () => getAdminTeams({ page: 1, limit: 200 }),
  });
  const team: Team | undefined = teamsPage?.data?.find((t) => t.id === id);
  const inactive = team?.status === "inactive";

  const { data: managers, isLoading: loadingManagers } = useQuery({
    queryKey: teamManagersKey(id),
    queryFn: () => getTeamManagers(id),
    enabled: !!id,
  });

  // Keyed under adminPlayers so edits on the Players page refresh it.
  const { data: playersPage, isLoading: loadingPlayers } = useQuery({
    queryKey: ["adminPlayers", "team", id],
    queryFn: () => getPlayers(id, 1, 200, undefined, "all"),
    enabled: !!id,
  });
  const players = playersPage?.data ?? NO_PLAYERS;

  const { data: matchesPage, isLoading: loadingMatches } = useQuery({
    queryKey: ["adminTeamMatches", id],
    queryFn: () => getMatches(undefined, 1, 500, undefined, undefined, id),
    enabled: !!id,
  });
  const matches = matchesPage?.data ?? NO_MATCHES;

  // Membership comes from each competition's team list. The keys match the
  // competition's own Teams page, so the two share one cache.
  const { data: competitionsPage } = useQuery({
    queryKey: ["publicCompetitionsList"],
    queryFn: () => getCompetitions(1, 100),
  });
  const allCompetitions = competitionsPage?.data ?? NO_COMPETITIONS;
  const membership = useQueries({
    queries: allCompetitions.map((c) => ({
      queryKey: ["competitionTeams", c.id],
      queryFn: () => getTeamsByCompetition(c.id),
    })),
  });
  const loadingCompetitions = !competitionsPage || membership.some((q) => q.isLoading);
  const memberKey = membership
    .map((q, i) => ((q.data?.data as Team[] | undefined)?.some((t) => t.id === id) ? allCompetitions[i].id : ""))
    .join("|");

  const record = useMemo(() => tally(matches, id), [matches, id]);

  const competitionRows = useMemo<CompetitionRow[]>(() => {
    const entered = new Set(memberKey.split("|").filter(Boolean));
    for (const m of matches) if (m.competition?.id) entered.add(m.competition.id);
    return sortCompetitionsBySeason(allCompetitions.filter((c) => entered.has(c.id))).map((c) => ({
      ...c,
      ...tally(
        matches.filter((m) => m.competition?.id === c.id),
        id,
      ),
    }));
  }, [memberKey, matches, allCompetitions, id]);

  const { upcoming, recent } = useMemo(() => {
    const today = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD
    return {
      upcoming: matches
        .filter(
          (m) =>
            m.status === "LIVE" ||
            (m.status !== "FINISHED" && (m.date ?? "").slice(0, 10) >= today),
        )
        .slice(0, 3),
      recent: matches.filter((m) => resultFor(m, id)).slice(-5).reverse(),
    };
  }, [matches, id]);

  const squad = useMemo(() => {
    const current = players.filter((p) => !isDeletedPlayer(p));
    const main = current.filter((p) => !p.is_reserve).length;
    return { main, reserves: current.length - main };
  }, [players]);

  const competitionColumns = useMemo<Column<CompetitionRow>[]>(
    () => [
      {
        header: "Competition",
        sortable: true,
        sortValue: (c) => c.name,
        cell: (c) => (
          <div className="min-w-0">
            {canOpen("/admin/competitions") ? (
              <Link
                to={`/admin/competitions/${c.id}/teams`}
                className="block font-bold text-sm text-sffl-navy dark:text-white hover:text-sffl-red underline decoration-gray-300 dark:decoration-gray-600 underline-offset-4 hover:decoration-sffl-red wrap-break-word"
              >
                {c.name}
              </Link>
            ) : (
              <span className="block font-bold text-sm text-gray-900 dark:text-white wrap-break-word">
                {c.name}
              </span>
            )}
            <span className="block text-xs text-gray-500 dark:text-gray-400">
              {FORMAT_LABEL[c.format ?? ""] ?? c.format}
              {c.status === "inactive" && " · Inactive"}
            </span>
          </div>
        ),
      },
      { header: "Played", accessor: "played", sortable: true, align: "center" },
      { header: "Won", accessor: "won", sortable: true, align: "center" },
      { header: "Drawn", accessor: "drawn", sortable: true, align: "center" },
      { header: "Lost", accessor: "lost", sortable: true, align: "center" },
      { header: "Scored", accessor: "scored", sortable: true, align: "center" },
      { header: "Conceded", accessor: "conceded", sortable: true, align: "center" },
      {
        header: "Win %",
        sortable: true,
        align: "center",
        sortValue: (c) => (c.played ? (c.won + 0.5 * c.drawn) / c.played : -1),
        cell: (c) => <span className="tabular-nums">{winPct(c)}</span>,
      },
      { header: "Last 5", cell: (c) => <LastFive form={c.form} /> },
    ],
    [canOpen],
  );

  const playerColumns = useMemo<Column<Player>[]>(
    () => [
      {
        header: "Player",
        sortable: true,
        sortValue: (p) => p.name,
        cell: (p) => {
          const deleted = isDeletedPlayer(p);
          return (
            <div className={`flex items-center gap-3 ${deletedRowClass(deleted)}`}>
              {p.image ? (
                <LightboxImage
                  src={p.image}
                  alt={p.name}
                  thumbnailClassName="w-10 h-10 rounded-xl object-cover border border-gray-200 dark:border-gray-700 shrink-0"
                />
              ) : (
                <div className="w-10 h-10 rounded-xl bg-sffl-navy/10 dark:bg-sffl-navy/50 border border-sffl-navy/20 dark:border-gray-700 flex items-center justify-center text-xs font-black text-sffl-navy dark:text-gray-200 shrink-0">
                  #{p.jersey_number || "?"}
                </div>
              )}
              <DeletedPlayerName
                name={p.name}
                deleted={deleted}
                showLabel
                className="font-semibold text-sm text-gray-900 dark:text-white wrap-break-word min-w-0"
              />
            </div>
          );
        },
      },
      {
        header: "#",
        accessor: "jersey_number",
        sortable: true,
        cell: (p) => <span className="font-bold tabular-nums">{p.jersey_number || "—"}</span>,
      },
      {
        header: "Position",
        accessor: "position",
        sortable: true,
        cell: (p) => (
          <div className="flex flex-col gap-1 items-start">
            <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-600 rounded-md text-xs font-bold dark:text-gray-300">
              {p.position || "—"}
            </span>
            {p.secondary_position && (
              <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded text-[10px] font-extrabold whitespace-nowrap">
                Sec: {p.secondary_position}
              </span>
            )}
          </div>
        ),
      },
      {
        header: "Gender",
        sortable: true,
        sortValue: (p) => p.gender || "",
        cell: (p) =>
          p.gender === "F" ? "Female" : p.gender === "M" ? "Male" : <span className="text-gray-400">—</span>,
      },
      {
        header: "Squad",
        sortable: true,
        sortValue: (p) => (p.is_reserve ? "Reserve" : "Main"),
        cell: (p) =>
          p.is_reserve ? (
            <span className="px-2 py-0.5 rounded text-xs font-black bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
              Reserve
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded text-xs font-black bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              Main
            </span>
          ),
      },
    ],
    [],
  );

  if (loadingTeam) return <Loader />;

  if (!team) {
    return (
      <div className="space-y-6">
        <DashboardPageHeader
          title="Team Not Found"
          subtitle="This team doesn't exist any more, or the link is wrong."
          back={{ to: "/admin/teams", label: "Back to Teams" }}
        />
        <EmptyState>
          <ExclamationTriangleIcon className="block w-10 h-10 mx-auto mb-2 text-amber-500" aria-hidden="true" />
          It may have been deleted. Go back to Teams to find the one you need.
        </EmptyState>
      </div>
    );
  }

  const spotsLeft = MAX_MAIN_SQUAD - squad.main;
  const hiddenNote = "This team is inactive, so its players are hidden. Mark it active to see its roster.";

  return (
    <div className="space-y-6 sm:space-y-8">
      <DashboardPageHeader
        title={team.name}
        subtitle="Everything about this team in one place: who runs it, who plays for it and how it's doing."
        back={{ to: "/admin/teams", label: "Back to Teams" }}
        actions={
          <>
            <button type="button" disabled={!canManage} title={canManage ? undefined : "View-only access to Teams"} onClick={() => actions.openEdit(team)} className={primaryButton}>
              <PencilSquareIcon className="w-4 h-4" aria-hidden="true" />
              Edit Team
            </button>
            <button type="button" disabled={!canManage} title={canManage ? undefined : "View-only access to Teams"} onClick={() => actions.openTeamHeads(team)} className={secondaryButton}>
              <UserGroupIcon className="w-4 h-4" aria-hidden="true" />
              Team Heads
            </button>
          </>
        }
      />

      {/* Identity and the numbers at a glance */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className={`${cardClass} flex items-center gap-4`}>
          {team.logo ? (
            <LightboxImage
              src={team.logo}
              alt={team.name}
              thumbnailClassName="w-20 h-20 shrink-0 rounded-xl object-contain bg-gray-50 dark:bg-gray-700/50 p-2 border border-gray-100 dark:border-gray-700"
            />
          ) : (
            <div className="w-20 h-20 shrink-0 rounded-xl bg-sffl-navy/10 dark:bg-sffl-navy/50 flex items-center justify-center text-2xl font-black text-sffl-navy dark:text-gray-200">
              {team.short_name?.slice(0, 3) || <ShieldCheckIcon className="w-10 h-10" aria-hidden="true" />}
            </div>
          )}
          <div className="min-w-0 space-y-1.5">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Short name:{" "}
              <span className="font-bold text-gray-900 dark:text-white">{team.short_name || "—"}</span>
            </p>
            <div>
              <TeamStatusBadge status={team.status} />
            </div>
            {!inactive && (
              <div>
                <a href={`/teams/${team.id}`} target="_blank" rel="noopener noreferrer" className={textLink}>
                  View public page
                  <ArrowTopRightOnSquareIcon className="w-4 h-4" aria-hidden="true" />
                </a>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <StatTile
            label="Main squad"
            value={inactive ? "—" : loadingPlayers ? <Pending /> : `${squad.main}/${MAX_MAIN_SQUAD}`}
            hint={
              inactive
                ? "Hidden while inactive"
                : spotsLeft > 0
                  ? `${spotsLeft} spot${spotsLeft === 1 ? "" : "s"} left`
                  : "Squad is full"
            }
          />
          <StatTile
            label="Reserves"
            value={inactive ? "—" : loadingPlayers ? <Pending /> : squad.reserves}
            hint="Can be promoted to the main squad"
          />
          <StatTile
            label="Competitions"
            value={loadingCompetitions ? <Pending /> : competitionRows.length}
            hint="Entered so far"
          />
          <StatTile
            label="Record (W-D-L)"
            value={loadingMatches ? <Pending /> : `${record.won}-${record.drawn}-${record.lost}`}
            hint={
              record.played
                ? `${record.scored} points scored, ${record.conceded} conceded`
                : "No finished matches yet"
            }
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Team heads */}
        <section aria-labelledby="team-heads-heading" className={`${cardClass} space-y-4`}>
          <SectionHeading
            id="team-heads-heading"
            title="Team Heads"
            description="The people who manage this team's roster, contracts and team sheets."
          />
          {loadingManagers ? (
            <Spinner />
          ) : managers?.length ? (
            <>
              <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                {managers.map((m) => (
                  <li key={m.id} className="py-3 first:pt-0 min-w-0">
                    <p className="text-sm font-bold text-gray-900 dark:text-white wrap-break-word">
                      {m.user_full_name || m.user_email || "Unknown user"}
                    </p>
                    {m.user_full_name && m.user_email && (
                      <a
                        href={`mailto:${m.user_email}`}
                        className="block text-xs text-gray-500 dark:text-gray-400 hover:text-sffl-red truncate"
                      >
                        {m.user_email}
                      </a>
                    )}
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Team head since {formatDay(m.created_at)}
                    </p>
                  </li>
                ))}
              </ul>
              <button type="button" disabled={!canManage} title={canManage ? undefined : "View-only access to Teams"} onClick={() => actions.openTeamHeads(team)} className={secondaryButton}>
                <UserGroupIcon className="w-4 h-4" aria-hidden="true" />
                Manage Team Heads
              </button>
            </>
          ) : (
            <EmptyState
              action={
                <button type="button" disabled={!canManage} title={canManage ? undefined : "View-only access to Teams"} onClick={() => actions.openTeamHeads(team)} className={primaryButton}>
                  <UserPlusIcon className="w-4 h-4" aria-hidden="true" />
                  Assign a Team Head
                </button>
              }
            >
              No team head yet. Until one is assigned, nobody can manage this team's players from the team
              dashboard.
            </EmptyState>
          )}
        </section>

        {/* Matches */}
        <section aria-labelledby="matches-heading" className={`${cardClass} lg:col-span-2 space-y-4`}>
          <SectionHeading
            id="matches-heading"
            title="Matches"
            description="What's coming up next, and how the last few went."
            action={
              canOpen("/admin/matches") && (
                <Link to="/admin/matches" className={textLink}>
                  Open Matches
                </Link>
              )
            }
          />
          {loadingMatches ? (
            <Spinner />
          ) : matches.length === 0 ? (
            <EmptyState>
              No matches yet. Fixtures appear here once this team is scheduled in a competition.
            </EmptyState>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300">Coming up</h3>
                {upcoming.length ? (
                  <ul className="divide-y divide-gray-100 dark:divide-gray-700/60">
                    {upcoming.map((m) => (
                      <MatchItem key={m.id} match={m} teamId={id} />
                    ))}
                  </ul>
                ) : (
                  <p className="py-3 text-sm text-gray-500 dark:text-gray-400">Nothing scheduled.</p>
                )}
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300">Recent results</h3>
                {recent.length ? (
                  <ul className="divide-y divide-gray-100 dark:divide-gray-700/60">
                    {recent.map((m) => (
                      <MatchItem key={m.id} match={m} teamId={id} />
                    ))}
                  </ul>
                ) : (
                  <p className="py-3 text-sm text-gray-500 dark:text-gray-400">No results yet.</p>
                )}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Competitions */}
      <section aria-labelledby="competitions-heading" className="space-y-4">
        <SectionHeading
          id="competitions-heading"
          title="Competitions"
          description="Every competition this team has entered, with its results in each. A draw counts as half a win."
        />
        {!loadingCompetitions && competitionRows.length === 0 ? (
          <div className={cardClass}>
            <EmptyState
              action={
                canOpen("/admin/competitions") && (
                  <Link to="/admin/competitions" className={textLink}>
                    Go to Competitions
                  </Link>
                )
              }
            >
              Not entered in any competition yet. Add the team from a competition's Teams page.
            </EmptyState>
          </div>
        ) : (
          <DataTable
            data={competitionRows}
            columns={competitionColumns}
            loading={loadingCompetitions}
            searchable={false}
            paginated={false}
            getRowId={(c) => c.id}
          />
        )}
      </section>

      {/* Players */}
      <section aria-labelledby="players-heading" className="space-y-4">
        <SectionHeading
          id="players-heading"
          title="Players"
          description={`The main squad holds up to ${MAX_MAIN_SQUAD} players; reserves can be promoted when a spot opens. Deleted players stay listed, greyed out.`}
        />
        {inactive ? (
          <div className={cardClass}>
            <EmptyState
              action={
                <button type="button" disabled={!canManage} title={canManage ? undefined : "View-only access to Teams"} onClick={() => actions.askToggleStatus(team)} className={primaryButton}>
                  <EyeIcon className="w-4 h-4" aria-hidden="true" />
                  Mark Active
                </button>
              }
            >
              {hiddenNote}
            </EmptyState>
          </div>
        ) : (
          <DataTable
            data={players}
            columns={playerColumns}
            loading={loadingPlayers}
            paginated={false}
            searchPlaceholder="Search this team's players"
            getRowId={(p) => p.id}
            emptyMessage="No players on this team yet. Add them from the Players page."
            headerActions={
              canOpen("/admin/players") && (
                <Link to={`/admin/players?team=${team.id}`} className={textLink}>
                  Manage in Players
                </Link>
              )
            }
          />
        )}
      </section>

      {/* Status and deletion, kept apart from everyday actions */}
      <section aria-labelledby="manage-heading" className={`${cardClass} space-y-4`}>
        <SectionHeading id="manage-heading" title="Manage Team" />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-gray-600 dark:text-gray-300 min-w-0">
            {inactive
              ? "This team is inactive: it's hidden from public pages and selection dropdowns. Nothing has been deleted."
              : "This team is active: it appears on public pages and in selection dropdowns. Mark it inactive to hide it without deleting anything."}
          </p>
          <button type="button" disabled={!canManage} title={canManage ? undefined : "View-only access to Teams"} onClick={() => actions.askToggleStatus(team)} className={`${secondaryButton} shrink-0`}>
            {inactive ? (
              <EyeIcon className="w-4 h-4" aria-hidden="true" />
            ) : (
              <EyeSlashIcon className="w-4 h-4" aria-hidden="true" />
            )}
            {inactive ? "Mark Active" : "Mark Inactive"}
          </button>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-600 dark:text-gray-300 min-w-0">
            Deleting removes the team together with its players, matches, standings, contracts and stats. It
            can't be undone.
          </p>
          <button
            type="button"
            disabled={!canManage}
            title={canManage ? undefined : "View-only access to Teams"}
            onClick={() => actions.askDelete(team)}
            className="inline-flex items-center justify-center gap-1.5 w-full sm:w-auto shrink-0 px-4 py-2 min-h-11 border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 text-sm font-bold rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <TrashIcon className="w-4 h-4" aria-hidden="true" />
            Delete Team
          </button>
        </div>
      </section>

      <TeamActionDialogs {...actions.dialogProps} />
    </div>
  );
};
