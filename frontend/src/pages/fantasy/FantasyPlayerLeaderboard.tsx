import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  ArrowTrendingDownIcon,
  ArrowTrendingUpIcon,
  ChartBarIcon,
  FireIcon,
  StarIcon,
  TrophyIcon,
  UserGroupIcon,
  ArrowsRightLeftIcon,
  BanknotesIcon,
  InformationCircleIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import type { ComponentType, SVGProps } from "react";
import {
  Button,
  DataTable,
  Field,
  FantasyBackLink,
  FantasyPlayerModal,
  PlayerAvatar,
  PlayerLeaderboardLegend,
  FantasyPlayerLink,
  Select,
  playerLeaderboardGuide,
  type Column,
} from "../../components";
import { fantasyApi, formatFantasyPrice } from "../../services/api";
import type {
  FantasyPlayerModalData,
  PlayerLeaderboardHighlight,
  PlayerLeaderboardItem,
  PlayerLeaderboardSort,
} from "../../types";
import { formatStatDecimal } from "../../utils";
import { rankBadgeClass } from "../../hooks";

const PAGE_SIZE = 25;
// A stable empty list, so DataTable does not see new data on every render.
const NO_ROWS: PlayerLeaderboardItem[] = [];

const SORT_OPTIONS: { value: PlayerLeaderboardSort; label: string }[] = [
  { value: "points", label: "Total points" },
  { value: "form", label: "Form" },
  { value: "ppg", label: "Points per game" },
  { value: "value", label: "Value (pts per ₦1m)" },
  { value: "selected", label: "Selected by %" },
  { value: "started", label: "Started by %" },
  { value: "transfers_in", label: "Transfers in" },
  { value: "transfers_out", label: "Transfers out" },
  { value: "price", label: "Price" },
  { value: "price_change", label: "Price rise" },
  { value: "appearances", label: "Appearances" },
  { value: "name", label: "Name (A–Z)" },
];

const HIGHLIGHT_ICONS: Record<string, ComponentType<SVGProps<SVGSVGElement>>> = {
  top_scorer: TrophyIcon,
  in_form: FireIcon,
  most_selected: UserGroupIcon,
  most_transferred_in: ArrowsRightLeftIcon,
  best_value: BanknotesIcon,
};

const pts = (v: number) => formatStatDecimal(v, 1);
const pct = (v: number) => `${formatStatDecimal(v, 1)}%`;

function highlightValue(h: PlayerLeaderboardHighlight): string {
  switch (h.key) {
    case "most_selected":
      return `${pct(h.value)} selected`;
    case "most_transferred_in":
      return `${h.value.toLocaleString()} in`;
    case "best_value":
      return `${pts(h.value)} pts / ₦1m`;
    case "in_form":
      return `${pts(h.value)} avg`;
    default:
      return `${pts(h.value)} pts`;
  }
}

/**
 * Every player in the season, ranked by fantasy points — scored from their
 * own match stats, so a player nobody picked still shows what they earned.
 * Alongside the points sit the figures managers pick on: form, value, how
 * widely they are owned and started, and which way the transfer market is
 * moving on them.
 */
export function FantasyPlayerLeaderboard() {
  const [params, setParams] = useSearchParams();
  const gameweekId = params.get("gw") || "";
  const position = params.get("pos") || "";
  const teamId = params.get("club") || "";
  const gender = (params.get("gender") || "") as "" | "M" | "F";
  const sort = (params.get("sort") || "points") as PlayerLeaderboardSort;
  const search = params.get("q") || "";
  const page = Math.max(1, Number(params.get("page")) || 1);

  const [showGuide, setShowGuide] = useState(false);
  const [inspecting, setInspecting] = useState<FantasyPlayerModalData | null>(
    null,
  );

  // Changing any filter returns to page 1; paging keeps the filters.
  const update = (changes: Record<string, string>, keepPage = false) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    if (!keepPage) next.delete("page");
    setParams(next, { replace: true });
  };

  const { data: season, isLoading: seasonLoading } = useQuery({
    queryKey: ["fantasySeason"],
    queryFn: fantasyApi.getActiveSeason,
  });

  const { data, isLoading, isFetching, isError } = useQuery({
    queryKey: [
      "fantasyPlayerLeaderboard",
      season?.id,
      gameweekId,
      position,
      teamId,
      gender,
      sort,
      search,
      page,
    ],
    queryFn: () =>
      fantasyApi.getPlayerLeaderboard(season!.id, {
        gameweek_id: gameweekId || undefined,
        position: position || undefined,
        team_id: teamId || undefined,
        gender: gender || undefined,
        sort,
        search: search || undefined,
        page,
        limit: PAGE_SIZE,
      }),
    enabled: !!season?.id,
    placeholderData: keepPreviousData,
  });

  const isGameweekView = !!gameweekId;
  const focusGw = data?.gameweek;
  const gwLabel = focusGw ? `GW${focusGw.number}` : "GW";

  const openPlayer = (p: PlayerLeaderboardItem) =>
    setInspecting({
      playerId: p.player_id,
      playerName: p.player_name,
      playerImage: p.player_image,
      position: p.position,
      gender: p.gender,
      teamName: p.team_name,
      teamShortName: p.team_short_name,
      teamLogo: p.team_logo,
      price: p.price,
      currentPrice: p.price,
      points: p.points,
      totalPoints: p.season_points,
      ownedByPct: p.selected_by_pct,
      gameweekId: focusGw?.id,
      gameweekNumber: focusGw?.number,
    });

  const columns = useMemo<Column<PlayerLeaderboardItem>[]>(() => {
    // A header that sorts the server-side list. Clicking the active column
    // goes back to the default (points).
    const sortable = (key: PlayerLeaderboardSort) => ({
      sortActive: sort === key,
      onSort: () => update({ sort: sort === key ? "" : key }),
    });
    // Every figure column uses the same padding as its heading (headerClassName), a
    // fixed minimum width and centred text, so each number sits directly under its
    // label. `wide` is for the two long headings.
    const num = (wide = false) =>
      `px-2 py-3 text-center text-xs sm:text-sm font-bold tabular-nums text-gray-700 dark:text-gray-200 whitespace-nowrap ${wide ? "min-w-32" : "min-w-24"}`;
    const HEADER_PADDING = "px-2 py-2";
    // A heading with the legend's one-line summary as its hover hint. The table adds
    // a sort arrow after the label, so a spacer of the same width goes before it:
    // that keeps the label itself, not label plus arrow, centred over the numbers.
    const guide = playerLeaderboardGuide(gwLabel, isGameweekView);
    const head = (key: keyof typeof guide, label: string, sorts = true) => (
      <span title={guide[key].summary} className="flex items-center gap-1.5">
        {sorts && <span className="w-4 shrink-0" aria-hidden="true" />}
        <span>{label}</span>
      </span>
    );

    const cols: Column<PlayerLeaderboardItem>[] = [
      {
        header: head("player", "Player", false),
        headerClassName: "px-2 py-2 sm:px-4",
        className: "px-2 py-3 sm:px-4 min-w-56",
        cell: (p) => (
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-black shrink-0 tabular-nums ${rankBadgeClass(p.rank)}`}
              title={`Rank ${p.rank} by ${isGameweekView ? `${gwLabel} ` : ""}points`}
            >
              {p.rank}
            </span>
            <PlayerAvatar
              name={p.player_name}
              image={p.player_image}
              gender={p.gender}
              size="sm"
              zoomable
            />
            <div className="min-w-0">
              <FantasyPlayerLink
                id={p.player_id}
                className="block text-sm font-black text-gray-900 dark:text-white truncate"
                title={`View ${p.player_name}'s profile`}
              >
                {p.player_name}
              </FantasyPlayerLink>
              <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-gray-500 dark:text-gray-400">
                <span className="font-bold text-gray-700 dark:text-gray-300">
                  {p.position}
                </span>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1">
                  {p.team_logo && (
                    <img
                      src={p.team_logo}
                      alt=""
                      className="w-3.5 h-3.5 object-contain"
                    />
                  )}
                  {p.team_short_name || p.team_name || "No club"}
                </span>
                {!p.available && (
                  <span
                    className="px-1.5 py-px rounded text-[9px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
                    title="Still ranks on what they scored, but cannot be started"
                  >
                    {p.unavailable_reason}
                  </span>
                )}
              </div>
            </div>
          </div>
        ),
      },
      {
        header: head("points", isGameweekView ? `${gwLabel} pts` : "Pts"),
        align: "center",
        headerClassName: HEADER_PADDING,
        className: `${num()} text-gray-900! dark:text-white! font-black`,
        ...sortable("points"),
        cell: (p) => pts(p.points),
      },
    ];

    if (!isGameweekView) {
      cols.push({
        header: head("gameweekPoints", `${gwLabel} pts`),
        align: "center",
        headerClassName: HEADER_PADDING,
        className: num(),
        ...sortable("gameweek_points"),
        cell: (p) => pts(p.gameweek_points),
      });
    }

    cols.push(
      {
        header: head("form", "Form"),
        align: "center",
        headerClassName: HEADER_PADDING,
        className: num(),
        ...sortable("form"),
        cell: (p) => pts(p.form),
      },
      {
        header: head("ppg", "PPG"),
        align: "center",
        headerClassName: HEADER_PADDING,
        className: num(),
        ...sortable("ppg"),
        cell: (p) => pts(p.points_per_game),
      },
      {
        header: head("apps", "Apps"),
        align: "center",
        headerClassName: HEADER_PADDING,
        className: num(),
        ...sortable("appearances"),
        cell: (p) => p.appearances,
      },
      {
        header: head("value", "Value"),
        align: "center",
        headerClassName: HEADER_PADDING,
        className: num(),
        ...sortable("value"),
        cell: (p) => pts(p.value),
      },
      {
        header: head("price", "Price"),
        align: "center",
        headerClassName: HEADER_PADDING,
        className: num(),
        ...sortable("price"),
        cell: (p) => (
          <span className="inline-flex flex-col items-center leading-tight">
            <span>{formatFantasyPrice(p.price)}</span>
            {p.price_change !== 0 && (
              <span
                className={`inline-flex items-center gap-0.5 text-[10px] font-black ${
                  p.price_change > 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {p.price_change > 0 ? (
                  <ArrowTrendingUpIcon className="w-3 h-3" aria-hidden="true" />
                ) : (
                  <ArrowTrendingDownIcon className="w-3 h-3" aria-hidden="true" />
                )}
                {p.price_change > 0 ? "+" : ""}
                {formatFantasyPrice(p.price_change)}
              </span>
            )}
          </span>
        ),
      },
      {
        header: head("selected", "Selected"),
        align: "center",
        headerClassName: HEADER_PADDING,
        className: num(true),
        ...sortable("selected"),
        cell: (p) => (
          <span title={`In ${p.owned_by} of ${data?.squad_count ?? 0} squads`}>
            {pct(p.selected_by_pct)}
          </span>
        ),
      },
      {
        header: head("started", `Started ${gwLabel}`),
        align: "center",
        headerClassName: HEADER_PADDING,
        className: num(true),
        ...sortable("started"),
        cell: (p) => (
          <span
            title={`Started by ${p.started_by} lineups in ${gwLabel} · ${p.season_starts} starts this season`}
          >
            {pct(p.started_by_pct)}
          </span>
        ),
      },
      {
        header: head("in", "In"),
        align: "center",
        headerClassName: HEADER_PADDING,
        className: `${num()} text-emerald-700! dark:text-emerald-400!`,
        ...sortable("transfers_in"),
        cell: (p) => p.transfers_in.toLocaleString(),
      },
      {
        header: head("out", "Out"),
        align: "center",
        headerClassName: HEADER_PADDING,
        className: `${num()} text-red-700! dark:text-red-400!`,
        ...sortable("transfers_out"),
        cell: (p) => p.transfers_out.toLocaleString(),
      },
    );
    return cols;
    // update is recreated each render but only reads params, which is a dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort, isGameweekView, gwLabel, data?.squad_count, params]);

  const activeFilters = [position, teamId, gender, search].filter(Boolean).length;

  return (
    <div className="space-y-6">
      <FantasyBackLink to="/fantasy" label="Back to Fantasy Hub" />

      {/* Hero */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end bg-sffl-navy text-white p-4 sm:p-6 md:p-8 rounded-2xl shadow-xl gap-4">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 border border-white/20 text-yellow-400 text-xs font-black uppercase tracking-wider mb-2">
            <StarIcon className="w-3.5 h-3.5" aria-hidden="true" /> Player
            Leaderboard
          </div>
          <h1 className="text-2xl sm:text-4xl font-black italic tracking-tighter text-white">
            PLAYER STATS &amp; RANKINGS
          </h1>
          <p className="text-gray-300 mt-1 text-xs sm:text-sm max-w-2xl">
            Every player ranked by fantasy points, picked or not — with form,
            value, how many managers own and start them, and who the market is
            buying and selling.
          </p>
        </div>
        <div className="w-full md:w-56 shrink-0">
          <Field label="Showing" htmlFor="plb-gw" tone="dark">
            <Select
              id="plb-gw"
              tone="dark"
              value={gameweekId}
              onChange={(e) => update({ gw: e.target.value })}
              className="w-full"
            >
              <option value="" className="text-gray-900 bg-white">
                Whole season
              </option>
              {(data?.played_gameweeks ?? [])
                .slice()
                .reverse()
                .map((gw) => (
                  <option
                    key={gw.id}
                    value={gw.id}
                    className="text-gray-900 bg-white"
                  >
                    Gameweek {gw.number}
                  </option>
                ))}
            </Select>
          </Field>
        </div>
      </div>

      {/* Highlights */}
      {data && data.highlights.length > 0 && (
        <section aria-label="Highlights">
          <div className="grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-5 gap-3">
            {data.highlights.map((h) => {
              const Icon = HIGHLIGHT_ICONS[h.key] ?? ChartBarIcon;
              const p = h.player;
              if (!p) return null;
              return (
                <button
                  key={h.key}
                  type="button"
                  onClick={() => openPlayer(p)}
                  className="text-left bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 shadow-sm hover:border-sffl-red/40 hover:shadow-md transition min-w-0"
                >
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    <Icon className="w-4 h-4 text-sffl-red" aria-hidden="true" />
                    {h.label}
                  </span>
                  <div className="mt-2 flex items-center gap-2.5 min-w-0">
                    <PlayerAvatar
                      name={p.player_name}
                      image={p.player_image}
                      gender={p.gender}
                      size="md"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-black text-gray-900 dark:text-white truncate">
                        {p.player_name}
                      </p>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                        {p.position} · {p.team_short_name || p.team_name}
                      </p>
                    </div>
                  </div>
                  <p className="mt-2 text-lg font-black tabular-nums text-sffl-navy dark:text-yellow-400">
                    {highlightValue(h)}
                  </p>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Filters */}
      <section
        aria-label="Filters"
        className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 shadow-sm"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Field label="Position" htmlFor="plb-pos">
            <Select
              id="plb-pos"
              value={position}
              onChange={(e) => update({ pos: e.target.value })}
              className="w-full"
            >
              <option value="">All positions</option>
              {(data?.positions ?? []).map((pos) => (
                <option key={pos} value={pos}>
                  {pos}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Club" htmlFor="plb-club">
            <Select
              id="plb-club"
              value={teamId}
              onChange={(e) => update({ club: e.target.value })}
              className="w-full"
            >
              <option value="">All clubs</option>
              {(data?.teams ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.short_name ? `${t.short_name} — ${t.name}` : t.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Gender" htmlFor="plb-gender">
            <Select
              id="plb-gender"
              value={gender}
              onChange={(e) => update({ gender: e.target.value })}
              className="w-full"
            >
              <option value="">Men and women</option>
              <option value="M">Men</option>
              <option value="F">Women</option>
            </Select>
          </Field>
          <Field label="Sort by" htmlFor="plb-sort">
            <Select
              id="plb-sort"
              value={sort}
              onChange={(e) =>
                update({ sort: e.target.value === "points" ? "" : e.target.value })
              }
              className="w-full"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.value === "points" && isGameweekView
                    ? `${gwLabel} points`
                    : o.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        {activeFilters > 0 && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span>
              {data ? `${data.total.toLocaleString()} players match` : "Filtering…"}
              {search && (
                <>
                  {" "}
                  for “<strong className="text-gray-800 dark:text-gray-200">{search}</strong>”
                </>
              )}
            </span>
            <Button
              variant="link"
              size="sm"
              icon={XMarkIcon}
              onClick={() => update({ pos: "", club: "", gender: "", q: "" })}
            >
              Clear filters
            </Button>
          </div>
        )}
      </section>

      {/* Table */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-black text-sffl-navy dark:text-white">
          All players
          {data && (
            <span className="ml-2 text-sm font-bold text-gray-500 dark:text-gray-400">
              {data.total.toLocaleString()}
            </span>
          )}
        </h2>
        <Button
          variant="secondary"
          size="sm"
          icon={InformationCircleIcon}
          onClick={() => setShowGuide(true)}
        >
          Column guide
        </Button>
      </div>
      {isError ? (
        <div className="rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 p-6 text-sm text-red-800 dark:text-red-200">
          The player leaderboard could not be loaded. Try again in a moment.
        </div>
      ) : !seasonLoading && !season ? (
        <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-8 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            There's no fantasy season running right now, so there's nothing to
            rank yet.
          </p>
          <Link
            to="/fantasy"
            className="mt-3 inline-block font-bold text-sffl-red hover:underline"
          >
            Go to the Fantasy Hub
          </Link>
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden shadow-sm">
          <DataTable
            data={data?.data ?? NO_ROWS}
            columns={columns}
            getRowId={(p) => p.player_id}
            loading={isLoading || (isFetching && !data)}
            searchPlaceholder="Search players or clubs"
            itemsPerPage={PAGE_SIZE}
            serverPage={page}
            totalServerPages={data?.total_pages ?? 1}
            onPageChange={(n) => update({ page: n > 1 ? String(n) : "" }, true)}
            onSearchSubmit={(term) => update({ q: term.trim() })}
            onRowClick={openPlayer}
            // Every row needs an opaque background: the frozen Player column takes it,
            // and without one the other columns show through it while sliding.
            rowClassName={(p) =>
              p.available
                ? "bg-white dark:bg-gray-800"
                : "bg-amber-50 dark:bg-[color-mix(in_oklab,var(--color-amber-950)_30%,var(--color-gray-800))]"
            }
            scrollHint
            emptyMessage={
              activeFilters > 0
                ? "No players match these filters."
                : "No player has a fantasy price or a match stat this season yet."
            }
            stickyHeader
            maxHeight="max-h-[75dvh]"
          />
        </div>
      )}

      <PlayerLeaderboardLegend
        open={showGuide}
        onClose={() => setShowGuide(false)}
        gwLabel={gwLabel}
        isGameweekView={isGameweekView}
      />

      <FantasyPlayerModal
        isOpen={!!inspecting}
        onClose={() => setInspecting(null)}
        player={inspecting}
      />
    </div>
  );
}
