import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  ArrowTopRightOnSquareIcon,
  SparklesIcon,
  UserIcon,
  ArrowTrendingUpIcon,
  ScaleIcon,
  BoltIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
import { FemaleIcon } from "../icons/FemaleIcon";
import { MaleIcon } from "../icons/MaleIcon";
import { Button, Modal } from "../ui";
import { DataTable, type Column } from "../ui/DataTable";
import {
  fantasyApi,
  formatFantasyPrice,
} from "../../services/api";
import type { PlayerPriceHistoryItem, FantasyPlayerModalData } from "../../types";
import { formatStatDecimal, formatStatNumber } from "../../utils";

interface FantasyPlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  player: FantasyPlayerModalData | null;
}

function normalizePosition(pos?: string): string {
  const p = (pos || "").trim();
  switch (p.toUpperCase()) {
    case "ALLROUNDER":
    case "ALL-ROUNDER":
    case "ALL ROUNDER":
    case "AR":
      return "All-Rounder";
    case "CENTRE":
      return "Center";
    default:
      return p || "Player";
  }
}

function unitOfPosition(pos?: string): "Offense" | "Defense" {
  const p = (pos || "").toUpperCase();
  if (
    p.includes("DEF") ||
    p.includes("RUSH") ||
    p.includes("SAFETY") ||
    p.includes("CORNER")
  ) {
    return "Defense";
  }
  return "Offense";
}

const POSITION_STYLES: Record<string, { bg: string; text: string }> = {
  QB: { bg: "bg-sffl-red", text: "text-white" },
  Receiver: { bg: "bg-amber-400", text: "text-amber-950" },
  Center: { bg: "bg-violet-400", text: "text-violet-950" },
  Rusher: { bg: "bg-emerald-400", text: "text-emerald-950" },
  Defender: { bg: "bg-[#7fbbfa]", text: "text-[#0d2440]" },
  "All-Rounder": { bg: "bg-cyan-400", text: "text-cyan-950" },
};

// The price history table on the profile. Module-level, so it is not rebuilt on each render.
const HISTORY_COLUMNS: Column<PlayerPriceHistoryItem>[] = [
  {
    header: "Event",
    cell: (row) => <span className="font-bold text-gray-900 dark:text-white">{row.gameweek_label}</span>,
    className: "px-3 py-2 text-[11px] whitespace-nowrap",
  },
  {
    header: "Price",
    sortable: true,
    sortValue: (row) => row.price,
    cell: (row) => <span className="font-black text-gray-900 dark:text-white">{formatFantasyPrice(row.price)}</span>,
    className: "px-3 py-2 text-[11px] whitespace-nowrap",
  },
  {
    header: "Change",
    sortable: true,
    sortValue: (row) => row.change,
    cell: (row) => {
      if (row.gameweek_number === 0) return <span className="text-gray-400 text-[10px]">Base</span>;
      if (row.change > 0)
        return <span className="text-emerald-600 dark:text-emerald-400 font-bold">+{formatFantasyPrice(row.change)}</span>;
      if (row.change < 0)
        return <span className="text-red-600 dark:text-red-400 font-bold">{formatFantasyPrice(row.change)}</span>;
      return <span className="text-gray-400">0.0m</span>;
    },
    className: "px-3 py-2 text-[11px] whitespace-nowrap",
  },
  {
    header: "Method",
    align: "right",
    cell: (row) =>
      row.is_overridden ? (
        <span className="inline-flex items-center gap-0.5 text-[9px] font-bold uppercase text-amber-600 dark:text-amber-400">
          <ScaleIcon className="w-3 h-3" aria-hidden="true" /> Committee
        </span>
      ) : (
        <span className="inline-flex items-center gap-0.5 text-[9px] font-bold uppercase text-gray-500 dark:text-gray-400">
          <BoltIcon className="w-3 h-3 text-yellow-500" aria-hidden="true" /> Form
        </span>
      ),
    className: "px-3 py-2 text-[11px] whitespace-nowrap",
  },
];

export function FantasyPlayerModal({
  isOpen,
  onClose,
  player,
}: FantasyPlayerModalProps) {

  const { data: breakdownData, isLoading: loadingBreakdown } = useQuery({
    queryKey: ["playerFantasyBreakdown", player?.playerId, player?.gameweekId],
    queryFn: () =>
      player?.playerId
        ? fantasyApi.getPlayerBreakdown(
            player.playerId,
            player.gameweekId || "current",
          )
        : null,
    enabled: isOpen && Boolean(player?.playerId),
    staleTime: 30000,
  });

  const { data: priceHistoryData, isLoading: loadingPriceHistory } = useQuery({
    queryKey: ["playerPriceHistory", player?.playerId],
    queryFn: () =>
      player?.playerId
        ? fantasyApi.getPlayerPriceHistory(player.playerId)
        : null,
    enabled: isOpen && Boolean(player?.playerId),
    staleTime: 30000,
  });

  if (!isOpen || !player) return null;

  const isFemale = (player.gender || "").toUpperCase().startsWith("F");
  const posLabel = normalizePosition(player.position);
  const unit = unitOfPosition(player.position);
  const posStyle = POSITION_STYLES[posLabel] || {
    bg: "bg-gray-700",
    text: "text-white",
  };
  const price =
    player.currentPrice ?? player.price ?? player.purchasePrice ?? 0;
  const breakdown = breakdownData?.breakdown;

  const displayedGwPoints =
    typeof player.points === "number" ? player.points : breakdownData?.points;
  const displayedTotalPoints =
    typeof player.totalPoints === "number"
      ? player.totalPoints
      : (breakdownData?.total_points ?? priceHistoryData?.total_points);
  const displayedOwnership =
    typeof player.ownedByPct === "number"
      ? player.ownedByPct
      : (breakdownData?.selected_by_pct ?? priceHistoryData?.selected_by_pct);

  return (
    <Modal
      open
      onClose={onClose}
      title={player.playerName}
      subtitle={`Fantasy Player Profile • ${player.teamName || player.teamShortName || "Independent"}`}
      maxWidth="md"
      footer={
        <>
          <Link
            to={`/players/${player.playerId}`}
            className="inline-flex items-center gap-1.5 min-h-11 text-xs font-bold text-sffl-navy dark:text-gray-200 hover:text-sffl-red transition sm:mr-auto"
          >
            View Full Season Stats{" "}
            <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>
          <Button variant="secondary" className="uppercase tracking-wider" onClick={onClose}>
            Close
          </Button>
        </>
      }
    >

        {/* Hero / Avatar Card */}
        <div className="p-5 md:p-6 border-b border-gray-100 dark:border-gray-700/60 bg-gray-50/70 dark:bg-gray-800/40 flex items-center gap-4">
          <div className="relative shrink-0">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden border-2 border-white dark:border-gray-700 shadow-md bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
              {player.playerImage ? (
                <img
                  src={player.playerImage}
                  alt={player.playerName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <UserIcon className="w-10 h-10 text-gray-400 dark:text-gray-500" />
              )}
            </div>
            {/* Gender pip outside the photo */}
            <span
              aria-label={isFemale ? "Female athlete" : "Male athlete"}
              role="img"
              className={`absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full border-2 border-white dark:border-gray-800 flex items-center justify-center text-white shadow ${
                isFemale ? "bg-pink-500" : "bg-blue-500"
              }`}
            >
              {isFemale ? (
                <FemaleIcon
                  className="w-3.5 h-3.5"
                  strokeWidth={2.5}
                  aria-hidden="true"
                />
              ) : (
                <MaleIcon
                  className="w-3.5 h-3.5"
                  strokeWidth={2.5}
                  aria-hidden="true"
                />
              )}
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span
                className={`px-2.5 py-0.5 rounded text-[11px] font-black uppercase tracking-wider ${posStyle.bg} ${posStyle.text}`}
              >
                {posLabel}
              </span>
              <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200">
                {unit}
              </span>
            </div>

            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-gray-500 dark:text-gray-400 block">
                Fantasy Price
              </span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
                  {formatFantasyPrice(price)}
                </span>
                {priceHistoryData && priceHistoryData.total_change !== 0 && (
                  <span
                    className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                      priceHistoryData.total_change > 0
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                        : "bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800"
                    }`}
                  >
                    {priceHistoryData.total_change > 0 ? "+" : ""}
                    {formatFantasyPrice(priceHistoryData.total_change)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* KPI Metrics Strip */}
        <div className="p-5 md:p-6 overflow-y-auto space-y-5 flex-1">
          <div className="grid grid-cols-3 gap-2.5 text-center">
            <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-700">
              <span className="text-[10px] font-black uppercase tracking-wider text-gray-500 dark:text-gray-400 block">
                GW Points
              </span>
              <span className="text-lg font-black text-sffl-red mt-0.5 block">
                {typeof displayedGwPoints === "number"
                  ? `${formatStatDecimal(displayedGwPoints, 1)} pts`
                  : "—"}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-700">
              <span className="text-[10px] font-black uppercase tracking-wider text-gray-500 dark:text-gray-400 block">
                Total Points
              </span>
              <span className="text-lg font-black text-gray-900 dark:text-white mt-0.5 block">
                {typeof displayedTotalPoints === "number"
                  ? `${formatStatDecimal(displayedTotalPoints, 1)} pts`
                  : "—"}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-700">
              <span className="text-[10px] font-black uppercase tracking-wider text-gray-500 dark:text-gray-400 block">
                Ownership
              </span>
              <span className="text-lg font-black text-gray-900 dark:text-white mt-0.5 block">
                {typeof displayedOwnership === "number"
                  ? `${displayedOwnership.toFixed(1)}%`
                  : "—"}
              </span>
            </div>
          </div>

          {/* Gameweek Scoring Breakdown (if available) */}
          {(player.gameweekId || breakdownData) && (
            <div className="rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden bg-gray-50 dark:bg-gray-800/60 p-4">
              <div className="flex items-center justify-between mb-3 border-b border-gray-200 dark:border-gray-700 pb-2 gap-2 flex-wrap">
                <h4 className="text-xs font-black uppercase tracking-wider text-sffl-navy dark:text-white flex items-center gap-1.5">
                  <SparklesIcon className="w-4 h-4 text-sffl-red" />
                  Gameweek Scoring Breakdown
                </h4>
                <div className="flex items-center gap-1.5">
                  {breakdownData?.is_nearest_week && (
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                      Latest Played
                      {breakdownData.gameweek_number
                        ? ` (GW ${breakdownData.gameweek_number})`
                        : ""}
                    </span>
                  )}
                  {breakdownData?.match_label && (
                    <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400">
                      {breakdownData.match_label}
                    </span>
                  )}
                </div>
              </div>

              {loadingBreakdown ? (
                <p className="flex items-center justify-center gap-2 text-xs text-gray-500 py-3">
                  <ArrowPathIcon
                    className="w-4 h-4 animate-spin"
                    aria-hidden="true"
                  />
                  Loading gameweek stats…
                </p>
              ) : breakdown &&
                (breakdown.net_total !== 0 ||
                  breakdown.offensive_total !== 0 ||
                  breakdown.defensive_total !== 0) ? (
                <div className="space-y-3 text-xs">
                  {/* Offensive stats */}
                  {breakdown.offensive_total !== 0 && (
                    <div>
                      <span className="text-[10px] font-black uppercase text-sffl-red block mb-1">
                        Offense (+
                        {formatStatDecimal(breakdown.offensive_total, 1)} pts)
                      </span>
                      <div className="grid grid-cols-2 gap-1.5 text-[11px] text-gray-600 dark:text-gray-300">
                        {breakdown.passing_tds_pts > 0 && (
                          <div>
                            Passing TDs: +
                            {formatStatNumber(breakdown.passing_tds_pts)}
                          </div>
                        )}
                        {breakdown.passing_yards_pts > 0 && (
                          <div>
                            Passing Yds: +
                            {formatStatDecimal(breakdown.passing_yards_pts, 1)}
                          </div>
                        )}
                        {breakdown.rushing_tds_pts > 0 && (
                          <div>
                            Rushing TDs: +
                            {formatStatNumber(breakdown.rushing_tds_pts)}
                          </div>
                        )}
                        {breakdown.receiving_tds_pts > 0 && (
                          <div>
                            Receiving TDs: +
                            {formatStatNumber(breakdown.receiving_tds_pts)}
                          </div>
                        )}
                        {breakdown.receptions_pts > 0 && (
                          <div>
                            Receptions: +
                            {formatStatNumber(breakdown.receptions_pts)}
                          </div>
                        )}
                        {breakdown.xp_good_pts > 0 && (
                          <div>
                            Extra Points: +
                            {formatStatNumber(breakdown.xp_good_pts)}
                          </div>
                        )}
                        {breakdown.interceptions_thrown_pts < 0 && (
                          <div className="text-red-500">
                            INT Thrown:{" "}
                            {formatStatNumber(
                              breakdown.interceptions_thrown_pts,
                            )}
                          </div>
                        )}
                        {breakdown.qb_sacks_pts < 0 && (
                          <div className="text-red-500">
                            QB Sacks: {formatStatNumber(breakdown.qb_sacks_pts)}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Defensive stats */}
                  {breakdown.defensive_total !== 0 && (
                    <div>
                      <span className="text-[10px] font-black uppercase text-[#7fbbfa] block mb-1">
                        Defense (+
                        {formatStatDecimal(breakdown.defensive_total, 1)} pts)
                      </span>
                      <div className="grid grid-cols-2 gap-1.5 text-[11px] text-gray-600 dark:text-gray-300">
                        {breakdown.flag_pulls_pts > 0 && (
                          <div>
                            Flag Pulls: +
                            {formatStatDecimal(breakdown.flag_pulls_pts, 1)}
                          </div>
                        )}
                        {breakdown.def_sacks_pts > 0 && (
                          <div>
                            Sacks: +{formatStatNumber(breakdown.def_sacks_pts)}
                          </div>
                        )}
                        {breakdown.interceptions_pts > 0 && (
                          <div>
                            Interceptions: +
                            {formatStatNumber(breakdown.interceptions_pts)}
                          </div>
                        )}
                        {breakdown.pass_deflections_pts > 0 && (
                          <div>
                            Deflections: +
                            {formatStatDecimal(
                              breakdown.pass_deflections_pts,
                              1,
                            )}
                          </div>
                        )}
                        {breakdown.defensive_tds_pts > 0 && (
                          <div>
                            Defensive TDs: +
                            {formatStatNumber(breakdown.defensive_tds_pts)}
                          </div>
                        )}
                        {breakdown.safety_pts > 0 && (
                          <div>
                            Safeties: +{formatStatNumber(breakdown.safety_pts)}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="pt-2 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center font-black">
                    <span>Net Match Score</span>
                    <span className="text-sffl-red text-sm">
                      {formatStatDecimal(breakdown.net_total, 1)} pts
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-gray-500 py-2 text-center">
                  No match stats recorded for this player yet.
                </p>
              )}
            </div>
          )}

          {/* Price History Section */}
          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden bg-gray-50 dark:bg-gray-800/60 p-4">
            <div className="flex items-center justify-between mb-3 border-b border-gray-200 dark:border-gray-700 pb-2">
              <h4 className="text-xs font-black uppercase tracking-wider text-sffl-navy dark:text-white flex items-center gap-1.5">
                <ArrowTrendingUpIcon className="w-4 h-4 text-emerald-500" />
                Price Movement History
              </h4>
              {priceHistoryData && priceHistoryData.total_change !== 0 && (
                <span
                  className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                    priceHistoryData.total_change > 0
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                      : "bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800"
                  }`}
                >
                  {priceHistoryData.total_change > 0 ? "+" : ""}
                  {formatFantasyPrice(priceHistoryData.total_change)} overall
                </span>
              )}
            </div>

            {loadingPriceHistory ? (
              <p className="flex items-center justify-center gap-2 text-xs text-gray-500 py-3">
                <ArrowPathIcon
                  className="w-4 h-4 animate-spin"
                  aria-hidden="true"
                />
                Loading price history…
              </p>
            ) : priceHistoryData?.history &&
              priceHistoryData.history.length > 0 ? (
              <div className="space-y-2">
                <DataTable
                  data={priceHistoryData.history}
                  columns={HISTORY_COLUMNS}
                  searchable={false}
                  paginated={false}
                  compact
                  getRowId={(row) => String(row.gameweek_id || row.gameweek_label)}
                />
              </div>
            ) : (
              <p className="text-xs text-gray-500 py-2 text-center">
                Initial price set. No weekly adjustments yet.
              </p>
            )}
          </div>
        </div>

    </Modal>
  );
}
