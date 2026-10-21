import { useMemo, useState } from "react";
import {
  isDeletedPlayer,
  DeletedPlayerName,
  DELETED_TITLE,
} from "../domain/DeletedPlayer";
import type { PlayerStat } from "../../types";
import { Link } from "react-router-dom";
import { LightboxImage, Spinner, DataTable, type Column } from "../ui";
import type { Shape } from "../ui/buttonStyles";
import { normalizePosition, formatStatNumber, sortStatRows } from "../../utils";
import { STAT_COLS, dividerClass, POSITION_STAT_KEYS } from "../../constants";
import { StarIcon as StarSolidIcon } from "@heroicons/react/24/solid";

interface PlayerStatsTableProps {
  stats: PlayerStat[];
  sortBy?: string;
  onSortChange?: (key: string) => void;
  isLoading?: boolean;
  positionFilter?: string;
  /** `square` for sharp corners (the Stats pages use this). */
  shape?: Shape;
}

export const PlayerStatsTable = ({
  stats,
  sortBy = "",
  onSortChange,
  isLoading = false,
  positionFilter = "QB",
  shape = "round",
}: PlayerStatsTableProps) => {
  const square = shape === "square";
  const normalizedPos = normalizePosition(positionFilter);

  // If a position filter is active, filter rows by normalized position (matching main or secondary role)
  const filteredStats = useMemo(() => {
    if (normalizedPos === "ALL") return stats;
    return stats.filter((p) => {
      const mainMatch = normalizePosition(p.player_position) === normalizedPos;
      const secMatch = p.player_secondary_position
        ? normalizePosition(p.player_secondary_position) === normalizedPos
        : false;
      return mainMatch || secMatch;
    });
  }, [stats, normalizedPos]);

  const [localSortBy, setLocalSortBy] = useState<string>("");
  const activeSortBy = sortBy || localSortBy;

  const visibleStatCols = useMemo(() => {
    if (normalizedPos === "ALL") return STAT_COLS.filter((c) => !c.teamOnly);
    const allowedKeys = new Set(POSITION_STAT_KEYS[normalizedPos]);
    return STAT_COLS.filter((c) => !c.teamOnly && allowedKeys.has(c.key));
  }, [normalizedPos]);

  // Clicking a stat header ranks leaders first (server-side if callback provided,
  // otherwise client-side sort); clicking it again returns to default order.
  const handleHeaderClick = (key: string) => {
    const nextSort = activeSortBy === key ? "" : key;
    if (onSortChange) {
      onSortChange(nextSort);
    }
    setLocalSortBy(nextSort);
  };

  const sortedData = useMemo(
    () => sortStatRows(filteredStats, activeSortBy),
    [filteredStats, activeSortBy],
  );

  // Loading shows a spinner rather than the empty state, so changing a
  // filter never flashes "No stats" before the new data arrives.
  if (isLoading) {
    return (
      <div className={`${square ? "rounded-none" : "rounded-lg md:rounded-xl"} shadow-lg bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700`}>
        <Spinner label="Loading stats…" className="py-16" />
      </div>
    );
  }

  if (sortedData.length === 0) {
    return (
      <div className="text-center p-8 text-gray-500 dark:text-gray-400">
        No stats available for the selected filters.
      </div>
    );
  }

  const rows = sortedData;

  const isSecondaryMatch = (row: PlayerStat) =>
    Boolean(
      normalizedPos !== "ALL" &&
        row.player_secondary_position &&
        normalizePosition(row.player_secondary_position) === normalizedPos &&
        normalizePosition(row.player_position) !== normalizedPos,
    );

  const isDeleted = (row: PlayerStat) =>
    isDeletedPlayer({
      status: (row as PlayerStat & { player_status?: string }).player_status,
    });

  const rankBadge = (row: PlayerStat) => (
    <span className="w-5 md:w-6 shrink-0 text-center text-[10px] font-bold text-gray-400 dark:text-gray-500">
      {rows.indexOf(row) + 1}
    </span>
  );

  // The rank sits in the frozen name cell, so it is the first thing a reader sees.
  const nameColumn: Column<PlayerStat> = {
    header: "Player",
    className:
      "px-2 py-2 md:px-4 md:py-4 font-bold text-sffl-navy dark:text-white whitespace-nowrap text-left min-w-43.75 md:min-w-57.5",
    cell: (row) => {
      const deleted = isDeleted(row);
      return (
        <div
          className="flex items-center gap-2 md:gap-3 min-w-0"
          title={deleted ? DELETED_TITLE : undefined}
        >
          {rankBadge(row)}
          <Link
            to={`/players/${row.player_id}`}
            className="flex items-center gap-2 md:gap-3 hover:text-sffl-red transition-colors min-w-0"
          >
            {row.player_image ? (
              <LightboxImage
                src={row.player_image}
                alt={row.player_name}
                thumbnailClassName={`w-6 h-6 md:w-8 md:h-8 ${square ? "rounded-none" : "rounded-full"} object-cover shadow-sm border border-gray-100 dark:border-gray-700 shrink-0 ${deleted ? "grayscale" : ""}`}
              />
            ) : (
              <div className={`w-6 h-6 md:w-8 md:h-8 ${square ? "rounded-none" : "rounded-full"} bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-[10px] md:text-xs shrink-0`}>
                #{row.player_jersey_number}
              </div>
            )}
            <div className="flex flex-col min-w-0">
              {deleted ? (
                <DeletedPlayerName
                  name={row.player_name}
                  deleted
                  className="leading-tight text-xs md:text-sm uppercase tracking-tight truncate"
                />
              ) : (
                <span className="leading-tight text-xs md:text-sm uppercase tracking-tight truncate">
                  {row.player_name}
                </span>
              )}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium truncate">
                  {row.player_position}
                  {row.player_secondary_position
                    ? ` • Sec: ${row.player_secondary_position}`
                    : ""}
                </span>
                {isSecondaryMatch(row) && (
                  <span
                    className={`inline-flex items-center gap-1 px-1.5 py-0.2 ${square ? "rounded-none" : "rounded"} text-[9px] font-black uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800 shrink-0`}
                    title={`Appearing via secondary role: ${row.player_secondary_position}`}
                  >
                    <StarSolidIcon className="w-2.5 h-2.5" aria-hidden="true" />
                    Sec Role
                  </span>
                )}
              </div>
            </div>
          </Link>
        </div>
      );
    },
  };

  const teamColumn: Column<PlayerStat> = {
    header: "Team",
    className: "px-2 py-2 md:px-4 md:py-4 text-[10px] md:text-xs font-bold text-gray-600 dark:text-gray-400 whitespace-nowrap text-left",
    cell: (row) => (
      <div className="flex items-center gap-2 min-w-0">
        <LightboxImage
          src={row.team_logo || "/images/default_football.webp"}
          alt=""
          thumbnailClassName={`w-4 h-4 md:w-5 md:h-5 object-contain ${square ? "rounded-none" : "rounded-sm"} opacity-70 shrink-0`}
        />
        <Link
          to={`/teams/${row.team_id}`}
          className="uppercase tracking-tight leading-none truncate hover:text-sffl-red transition-colors"
        >
          {row.team_short_name || row.team_name}
        </Link>
      </div>
    ),
  };

  const statColumns: Column<PlayerStat>[] = visibleStatCols.map((col) => {
    const active = activeSortBy === col.key;
    return {
      header: (
        <span
          className="flex flex-col items-center leading-tight normal-case tracking-normal"
          title={active ? `${col.title} — click to clear sort` : `${col.title} — click to sort by leaders`}
        >
          {col.top && <span className="text-[9px] md:text-[10px] font-semibold opacity-70">{col.top}</span>}
          <span className="font-bold">{col.bottom}</span>
        </span>
      ),
      align: "center",
      className: `px-1 py-4 font-medium text-gray-700 dark:text-gray-200 min-w-15 md:min-w-18 ${col.bg || ""} ${dividerClass(col)}`,
      headerClassName: "px-1 py-2 md:px-2",
      sortActive: active,
      onSort: () => handleHeaderClick(col.key),
      cell: (row) => {
        const rawVal =
          col.key === "apps"
            ? row.apps || "-"
            : ((row as unknown as Record<string, number>)[col.key] ?? 0);
        return typeof rawVal === "number" ? formatStatNumber(rawVal) : rawVal;
      },
    };
  });

  return (
    <div className={`overflow-hidden ${square ? "rounded-none" : "rounded-lg md:rounded-xl"} shadow-lg`}>
      <div className="px-3 py-2.5 md:px-6 md:py-4 bg-sffl-navy text-white font-bold text-sm md:text-lg">
        Player Statistics
      </div>
      <DataTable
        compact
        searchable={false}
        paginated={false}
        stickyHeader
        maxHeight="max-h-[70dvh]"
        data={rows}
        getRowId={(row) => row.player_id}
        rowClassName={(row) => `bg-white dark:bg-gray-900 ${isDeleted(row) ? "opacity-50" : ""}`}
        columns={[nameColumn, teamColumn, ...statColumns]}
        shape={shape}
      />
    </div>
  );
};
