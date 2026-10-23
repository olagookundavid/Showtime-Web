import { useMemo } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  ArrowTrendingDownIcon,
  ArrowTrendingUpIcon,
  LightBulbIcon,
  UserIcon,
} from "@heroicons/react/24/outline";
import {
  ButtonLink,
  DataTable,
  FantasyBackLink,
  Field,
  Loader,
  PlayerAvatar,
  Select,
  type Column,
} from "../../components";
import { fantasyApi, formatFantasyPrice } from "../../services/api";
import type {
  FantasyDetailFact,
  FantasyDetailGameweek,
  FantasyDetailMatch,
  FantasyPlayerPriceHistoryItem,
} from "../../types";
import { formatStatDecimal } from "../../utils";
import { rankBadgeClass } from "../../hooks";

const NO_GAMES: FantasyDetailMatch[] = [];
const NO_GAMEWEEKS: FantasyDetailGameweek[] = [];
const NO_PRICES: FantasyPlayerPriceHistoryItem[] = [];
const NO_FACTS: FantasyDetailFact[] = [];

const pts = (v: number) => formatStatDecimal(v, 1);
const signed = (v: number) => `${v > 0 ? "+" : ""}${formatStatDecimal(v, 1)}`;
const shortDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};

// Both tables share one set of cell and heading paddings so every figure sits
// directly under its label, as on the player leaderboard.
const CELL = "px-2 py-3 text-center text-xs sm:text-sm font-bold tabular-nums text-gray-700 dark:text-gray-200 whitespace-nowrap";
const HEAD = "px-2 py-2";

function Tile({
  label,
  value,
  sub,
  accent = false,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-xl bg-white/10 p-3 sm:p-4">
      <p className="text-[10px] font-black uppercase tracking-wider text-gray-300">{label}</p>
      <p className={`mt-1 text-2xl sm:text-3xl font-black tabular-nums leading-tight break-words ${accent ? "text-yellow-400" : "text-white"}`}>
        {value}
      </p>
      {sub && <p className="mt-0.5 text-[11px] font-bold text-gray-300">{sub}</p>}
    </div>
  );
}

function PriceMove({ change }: { change: number }) {
  if (change === 0) return <span className="text-gray-400">0.0</span>;
  const up = change > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 font-black ${up ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
      {up ? (
        <ArrowTrendingUpIcon className="w-3.5 h-3.5" aria-hidden="true" />
      ) : (
        <ArrowTrendingDownIcon className="w-3.5 h-3.5" aria-hidden="true" />
      )}
      {signed(change)}
    </span>
  );
}

/**
 * A player's whole fantasy season in one place: where they rank, what they
 * scored in each game and gameweek, how their price moved, and a few notable
 * facts. Pick a gameweek to narrow the headline figures and the game list to it.
 */
export function FantasyPlayerDetail() {
  const { id } = useParams<{ id: string }>();
  const [params, setParams] = useSearchParams();
  const gameweekId = params.get("gw") || "";

  const setGameweek = (next: string) => {
    const p = new URLSearchParams(params);
    if (next) p.set("gw", next);
    else p.delete("gw");
    setParams(p, { replace: true });
  };

  const { data: season, isLoading: seasonLoading } = useQuery({
    queryKey: ["fantasySeason"],
    queryFn: fantasyApi.getActiveSeason,
  });

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["fantasyPlayerDetail", season?.id, id, gameweekId],
    queryFn: () => fantasyApi.getFantasyPlayerDetail(season!.id, id!, gameweekId || undefined),
    enabled: !!season?.id && !!id,
    placeholderData: keepPreviousData,
    retry: false,
  });

  const isGameweekView = !!data?.gameweek;
  const gwLabel = data?.gameweek ? `GW${data.gameweek.number}` : "";
  const notFound =
    isError && (error as { response?: { status?: number } })?.response?.status === 404;

  const gameColumns = useMemo<Column<FantasyDetailMatch>[]>(
    () => [
      {
        header: "Game",
        headerClassName: "px-2 py-2 sm:px-4",
        className: "px-2 py-3 sm:px-4 min-w-32",
        cell: (m) => (
          <div>
            <p className="text-sm font-black text-gray-900 dark:text-white">Game {m.game_number}</p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              GW{m.gameweek_number}
              {shortDate(m.date) && ` · ${shortDate(m.date)}`}
            </p>
          </div>
        ),
      },
      {
        header: "Opponent",
        headerClassName: HEAD,
        className: "px-2 py-3 min-w-36 text-xs sm:text-sm font-bold text-gray-700 dark:text-gray-200 whitespace-nowrap",
        cell: (m) => (
          <span className="inline-flex items-center gap-2">
            {m.opponent.logo && <img src={m.opponent.logo} alt="" className="w-5 h-5 object-contain" />}
            <span className="text-[10px] font-black uppercase text-gray-400">{m.home ? "vs" : "at"}</span>
            {m.opponent.id ? (
              <Link to={`/teams/${m.opponent.id}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>
                {m.opponent.short_name || m.opponent.name}
              </Link>
            ) : (
              m.opponent.short_name || m.opponent.name || "TBC"
            )}
          </span>
        ),
      },
      {
        header: "Result",
        align: "center",
        headerClassName: HEAD,
        className: `${CELL} min-w-24`,
        cell: (m) => {
          if (!m.result) return <span className="text-gray-400">—</span>;
          const tone = m.result.startsWith("W")
            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
            : m.result.startsWith("L")
              ? "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300"
              : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200";
          return <span className={`px-2 py-0.5 rounded font-black ${tone}`}>{m.result}</span>;
        },
      },
      {
        header: "Points",
        align: "center",
        headerClassName: HEAD,
        className: `${CELL} min-w-24 text-gray-900! dark:text-white! font-black`,
        cell: (m) => pts(m.points),
      },
      {
        header: "What scored",
        headerClassName: HEAD,
        className: "px-2 py-3 min-w-72",
        cell: (m) =>
          m.scoring.length === 0 ? (
            <span className="text-xs text-gray-400">Nothing scored</span>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {m.scoring.map((l) => (
                <span
                  key={l.label}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold ${l.points >= 0 ? "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200" : "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"}`}
                >
                  {l.label} {signed(l.points)}
                </span>
              ))}
            </div>
          ),
      },
    ],
    [],
  );

  const maxGwPoints = Math.max(1, ...(data?.gameweeks ?? NO_GAMEWEEKS).map((g) => g.points));
  const gameweekColumns = useMemo<Column<FantasyDetailGameweek>[]>(
    () => [
      {
        header: "Gameweek",
        headerClassName: "px-2 py-2 sm:px-4",
        className: "px-2 py-3 sm:px-4 min-w-32",
        cell: (g) => (
          <div className="flex items-center gap-2">
            <span className="text-sm font-black text-gray-900 dark:text-white">GW{g.number}</span>
            {g.id === gameweekId && (
              <span className="px-1.5 py-0.5 rounded bg-sffl-red text-white text-[9px] font-black uppercase tracking-wider">
                Showing
              </span>
            )}
          </div>
        ),
      },
      {
        header: "Points",
        headerClassName: HEAD,
        className: "px-2 py-3 min-w-44",
        cell: (g) => (
          <div className="flex items-center gap-2">
            <div className="h-2 flex-1 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden" aria-hidden="true">
              <div className="h-full rounded-full bg-sffl-red" style={{ width: `${Math.max(0, (g.points / maxGwPoints) * 100)}%` }} />
            </div>
            <span className="w-12 text-right text-sm font-black tabular-nums text-gray-900 dark:text-white">{pts(g.points)}</span>
          </div>
        ),
      },
      {
        header: "Games",
        align: "center",
        headerClassName: HEAD,
        className: `${CELL} min-w-20`,
        cell: (g) => (g.games === 0 ? <span className="text-gray-400">Did not play</span> : g.games),
      },
      {
        header: "Started by",
        align: "center",
        headerClassName: HEAD,
        className: `${CELL} min-w-28`,
        cell: (g) => (
          <span title={`Started in ${g.started_by} locked lineups`}>{pts(g.started_by_pct)}%</span>
        ),
      },
      {
        header: "Price",
        align: "center",
        headerClassName: HEAD,
        className: `${CELL} min-w-28`,
        cell: (g) =>
          g.price > 0 ? (
            <span className="inline-flex flex-col items-center leading-tight">
              <span>{formatFantasyPrice(g.price)}</span>
              {g.price_change !== 0 && <PriceMove change={g.price_change} />}
            </span>
          ) : (
            <span className="text-gray-400">—</span>
          ),
      },
    ],
    [gameweekId, maxGwPoints],
  );

  const priceColumns = useMemo<Column<FantasyPlayerPriceHistoryItem>[]>(
    () => [
      {
        header: "Event",
        headerClassName: "px-2 py-2 sm:px-4",
        className: "px-2 py-3 sm:px-4 min-w-36 text-sm font-black text-gray-900 dark:text-white whitespace-nowrap",
        cell: (h) => h.gameweek_label,
      },
      {
        header: "Price",
        align: "center",
        headerClassName: HEAD,
        className: `${CELL} min-w-24 text-gray-900! dark:text-white! font-black`,
        cell: (h) => formatFantasyPrice(h.price),
      },
      {
        header: "Change",
        align: "center",
        headerClassName: HEAD,
        className: `${CELL} min-w-28`,
        cell: (h) =>
          h.gameweek_number === 0 ? (
            <span className="text-[11px] text-gray-400">Opening</span>
          ) : (
            <span className="inline-flex items-center gap-1">
              <PriceMove change={h.change} />
              {h.percentage_change !== 0 && (
                <span className="text-[10px] text-gray-400">({signed(h.percentage_change)}%)</span>
              )}
            </span>
          ),
      },
      {
        header: "Set by",
        align: "center",
        headerClassName: HEAD,
        className: `${CELL} min-w-28`,
        cell: (h) =>
          h.is_overridden ? (
            <span className="text-[11px] font-black uppercase text-amber-600 dark:text-amber-400">Committee</span>
          ) : (
            <span className="text-[11px] text-gray-400">Performance</span>
          ),
      },
    ],
    [],
  );

  if (seasonLoading || (isLoading && !data)) return <Loader />;

  if (!season) {
    return (
      <div className="space-y-4">
        <FantasyBackLink to="/fantasy" label="Back to Fantasy Hub" />
        <p className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-8 text-center text-sm text-gray-600 dark:text-gray-300">
          There's no fantasy season running right now, so there are no fantasy stats to show.
        </p>
      </div>
    );
  }

  if (notFound || isError || !data) {
    return (
      <div className="space-y-4">
        <FantasyBackLink to="/fantasy/players" label="Back to Player Leaderboard" />
        <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-8 text-center">
          <p className="font-bold text-gray-800 dark:text-gray-100">
            {notFound ? "This player isn't in the fantasy game." : "Couldn't load this player."}
          </p>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
            {notFound
              ? "Players appear once they have a fantasy price or have played a match this season."
              : "Try again in a moment."}
          </p>
          <ButtonLink to="/fantasy/players" variant="primary" className="mt-4">
            See all players
          </ButtonLink>
        </div>
      </div>
    );
  }

  const { player, summary } = data;
  const games = data.matches ?? NO_GAMES;
  const gameweeks = data.gameweeks ?? NO_GAMEWEEKS;
  const prices = data.price_history ?? NO_PRICES;
  const facts = data.facts ?? NO_FACTS;
  const seasonOnly = isGameweekView ? "whole season" : undefined;

  const priceValues = prices.map((p) => p.price);
  const peak = priceValues.length ? Math.max(...priceValues) : 0;
  const low = priceValues.length ? Math.min(...priceValues) : 0;
  // The opening price is the earliest entry, whichever way the list is ordered.
  const opening = prices.length
    ? prices.reduce((a, b) => (b.gameweek_number < a.gameweek_number ? b : a)).price
    : 0;

  return (
    <div className="space-y-6 md:space-y-8">
      <FantasyBackLink to="/fantasy/players" label="Back to Player Leaderboard" />

      {/* Header */}
      <div className="bg-sffl-navy text-white rounded-2xl shadow-xl p-4 sm:p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-5">
          <div className="flex items-center gap-4 sm:gap-5 min-w-0">
            <PlayerAvatar name={player.name} image={player.image} gender={player.gender} size="xl" zoomable />
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-wider text-yellow-400">
                Fantasy player · {season.name}
              </p>
              <h1 className="mt-1 text-2xl sm:text-4xl font-black tracking-tight break-words">{player.name}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-bold text-gray-200">
                <span className="px-2 py-0.5 rounded bg-white/15">{player.position}</span>
                <span className="inline-flex items-center gap-1.5">
                  {player.club.logo && <img src={player.club.logo} alt="" className="w-4 h-4 object-contain" />}
                  {player.club.id ? (
                    <Link to={`/teams/${player.club.id}`} className="hover:underline">
                      {player.club.short_name || player.club.name}
                    </Link>
                  ) : (
                    player.club.short_name || player.club.name || "No club"
                  )}
                </span>
                <span className={`px-2 py-0.5 rounded font-black ${rankBadgeClass(summary.rank)}`}>
                  Rank #{summary.rank} of {data.pool_size}
                </span>
                {!player.available && (
                  <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-black uppercase tracking-wider text-[10px]" title="Still ranks on what they scored, but cannot be started">
                    {player.unavailable_reason}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 w-full md:w-64 shrink-0">
            <ButtonLink to={`/players/${player.id}`} variant="secondary" tone="dark" icon={UserIcon} fullWidth>
              View real player profile
            </ButtonLink>
            <Field label="Showing" htmlFor="fpd-gw" tone="dark">
              <Select id="fpd-gw" tone="dark" value={gameweekId} onChange={(e) => setGameweek(e.target.value)} className="w-full">
                <option value="" className="text-gray-900 bg-white">Whole season</option>
                {[...gameweeks].reverse().map((g) => (
                  <option key={g.id} value={g.id} className="text-gray-900 bg-white">
                    Gameweek {g.number}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-white/10 grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Tile
            label={isGameweekView ? `${gwLabel} points` : "Season points"}
            value={pts(summary.points)}
            sub={`#${summary.rank} of ${data.pool_size} players`}
            accent
          />
          <Tile label="Form" value={pts(summary.form)} sub="avg of last 3 gameweeks" />
          <Tile label="Points per game" value={pts(summary.points_per_game)} sub={seasonOnly ?? `over ${summary.appearances} ${summary.appearances === 1 ? "game" : "games"}`} />
          <Tile
            label={isGameweekView ? `Games in ${gwLabel}` : "Games played"}
            value={String(isGameweekView ? games.length : summary.appearances)}
            sub={isGameweekView ? `${summary.appearances} this season` : `best week ${pts(summary.best_gameweek_points)} pts`}
          />
          <Tile
            label="Price"
            value={formatFantasyPrice(summary.price)}
            sub={summary.price_change === 0 ? "unchanged since opening" : `${signed(summary.price_change)}m since opening`}
          />
          <Tile label="Value" value={pts(summary.value)} sub={`pts per ₦1m${isGameweekView ? " · whole season" : ""}`} />
          <Tile
            label="Selected by"
            value={`${pts(summary.selected_by_pct)}%`}
            sub={`${summary.owned_by} of ${data.squad_count} squads · ${summary.transfers_in} in, ${summary.transfers_out} out`}
          />
          <Tile
            label={isGameweekView ? `Started in ${gwLabel}` : "Started in latest GW"}
            value={`${pts(summary.started_by_pct)}%`}
            sub={`${summary.season_starts} starts this season`}
          />
        </div>
      </div>

      {/* Facts */}
      {facts.length > 0 && (
        <section aria-labelledby="fpd-facts" className="space-y-3">
          <h2 id="fpd-facts" className="inline-flex items-center gap-2 text-lg font-black text-sffl-navy dark:text-white">
            <LightBulbIcon className="w-5 h-5 text-sffl-red" aria-hidden="true" />
            Worth knowing
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {facts.map((f) => (
              <div key={f.key} className="min-w-0 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">{f.label}</p>
                <p className="mt-1 text-base font-black text-gray-900 dark:text-white break-words">{f.value}</p>
                {f.detail && <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{f.detail}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Points by game */}
      <section aria-labelledby="fpd-games" className="space-y-3">
        <div>
          <h2 id="fpd-games" className="text-lg font-black text-sffl-navy dark:text-white">
            Points by game{isGameweekView ? ` · ${gwLabel}` : ""}
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            What {player.name.split(" ")[0]} scored in each game, and where the points came from.
          </p>
        </div>
        {games.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-8 text-center text-sm text-gray-600 dark:text-gray-300">
            {isGameweekView
              ? `${player.name} didn't play in ${gwLabel}. Pick another gameweek, or choose Whole season.`
              : `${player.name} hasn't played a game this season yet, so there are no points to show.`}
          </p>
        ) : (
          <div className="rounded-2xl overflow-hidden shadow-sm">
            <DataTable
              data={games}
              columns={gameColumns}
              getRowId={(m) => m.match_id}
              searchable={false}
              paginated={false}
              scrollHint
              rowClassName={() => "bg-white dark:bg-gray-800"}
            />
          </div>
        )}
      </section>

      {/* Points by gameweek */}
      <section aria-labelledby="fpd-gws" className="space-y-3">
        <div>
          <h2 id="fpd-gws" className="text-lg font-black text-sffl-navy dark:text-white">Points by gameweek</h2>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Tap a gameweek to see just that week. Tap it again to go back to the whole season.
          </p>
        </div>
        {gameweeks.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-8 text-center text-sm text-gray-600 dark:text-gray-300">
            No gameweek has been played yet.
          </p>
        ) : (
          <div className="rounded-2xl overflow-hidden shadow-sm">
            <DataTable
              data={gameweeks}
              columns={gameweekColumns}
              getRowId={(g) => g.id}
              searchable={false}
              paginated={false}
              scrollHint
              onRowClick={(g) => setGameweek(g.id === gameweekId ? "" : g.id)}
              rowClassName={(g) =>
                g.id === gameweekId
                  ? "bg-red-50 dark:bg-[color-mix(in_oklab,var(--color-red-950)_35%,var(--color-gray-800))]"
                  : "bg-white dark:bg-gray-800"
              }
            />
          </div>
        )}
      </section>

      {/* Price history */}
      <section aria-labelledby="fpd-price" className="space-y-3">
        <div>
          <h2 id="fpd-price" className="text-lg font-black text-sffl-navy dark:text-white">Price history</h2>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            What {player.name.split(" ")[0]} has cost this season, newest first. Prices are recalculated after each gameweek from performance.
          </p>
        </div>
        {prices.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              ["Now", formatFantasyPrice(summary.price)],
              ["Opening", formatFantasyPrice(opening)],
              ["Peak", formatFantasyPrice(peak)],
              ["Low", formatFantasyPrice(low)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">{label}</p>
                <p className="mt-0.5 text-lg font-black tabular-nums text-gray-900 dark:text-white">{value}</p>
              </div>
            ))}
          </div>
        )}
        {prices.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-8 text-center text-sm text-gray-600 dark:text-gray-300">
            No price has been recorded for this player yet.
          </p>
        ) : (
          <div className="rounded-2xl overflow-hidden shadow-sm">
            <DataTable
              data={prices}
              columns={priceColumns}
              getRowId={(h) => `${h.gameweek_id ?? "opening"}-${h.created_at}`}
              searchable={false}
              paginated={false}
              scrollHint
              rowClassName={() => "bg-white dark:bg-gray-800"}
            />
          </div>
        )}
      </section>
    </div>
  );
}
