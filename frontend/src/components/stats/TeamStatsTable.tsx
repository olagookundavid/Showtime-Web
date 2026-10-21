import { useMemo, useState } from "react";
import type { TeamStat } from "../../types";
import { Link } from "react-router-dom";
import { LightboxImage, Spinner, DataTable, type Column } from "../ui";
import type { Shape } from "../ui/buttonStyles";
import { formatStatNumber, sortStatRows } from "../../utils";
import { STAT_COLS, dividerClass } from "../../constants";

interface TeamStatsTableProps {
  stats: TeamStat[];
  sortBy?: string;
  onSortChange?: (key: string) => void;
  isLoading?: boolean;
  /** `square` for sharp corners (the Stats pages use this). */
  shape?: Shape;
}

// Teams have no position concept, so every non-player-only stat (including
// the team-only ones: plays, drives, first downs, turnovers, punts, penalties)
// is always shown — no column filtering beyond dropping `apps`.
const VISIBLE_STAT_COLS = STAT_COLS.filter((c) => !c.playerOnly);

export const TeamStatsTable = ({
  stats,
  sortBy = "",
  onSortChange,
  isLoading = false,
  shape = "round",
}: TeamStatsTableProps) => {
  const square = shape === "square";

  const [localSortBy, setLocalSortBy] = useState<string>("");
  const activeSortBy = sortBy || localSortBy;

  const handleHeaderClick = (key: string) => {
    const nextSort = activeSortBy === key ? "" : key;
    if (onSortChange) {
      onSortChange(nextSort);
    }
    setLocalSortBy(nextSort);
  };

  const sortedData = useMemo(
    () => sortStatRows(stats, activeSortBy),
    [stats, activeSortBy],
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

  const rankBadge = (row: TeamStat) => (
    <span className="w-5 md:w-6 shrink-0 text-center text-[10px] font-bold text-gray-400 dark:text-gray-500">
      {rows.indexOf(row) + 1}
    </span>
  );

  // The rank sits in the frozen name cell, so it is the first thing a reader sees.
  const nameColumn: Column<TeamStat> = {
    header: "Team",
    className:
      "px-2 py-2 md:px-4 md:py-4 font-bold text-sffl-navy dark:text-white whitespace-nowrap text-left min-w-43.75 md:min-w-57.5",
    cell: (row) => (
      // Logo stays outside the Link so its built-in lightbox (preventDefault) doesn't swallow
      // navigation; the name alone is the click target for the team page.
      <div className="flex items-center gap-2 md:gap-3 min-w-0">
        {rankBadge(row)}
        <LightboxImage
          src={row.team_logo || "/images/default_football.webp"}
          alt={row.team_name}
          thumbnailClassName={`w-6 h-6 md:w-8 md:h-8 object-contain ${square ? "rounded-none" : "rounded-md"} shadow-sm shrink-0`}
        />
        <Link
          to={`/teams/${row.team_id}`}
          className="uppercase text-xs md:text-sm tracking-tight truncate hover:text-sffl-red transition-colors"
        >
          {row.team_name}
        </Link>
      </div>
    ),
  };

  const statColumns: Column<TeamStat>[] = VISIBLE_STAT_COLS.map((col) => {
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
        const rawVal = (row as unknown as Record<string, number>)[col.key] ?? 0;
        return typeof rawVal === "number" ? formatStatNumber(rawVal) : rawVal;
      },
    };
  });

  return (
    <div className={`overflow-hidden ${square ? "rounded-none" : "rounded-lg md:rounded-xl"} shadow-lg`}>
      <div className="px-3 py-2.5 md:px-6 md:py-4 bg-sffl-navy text-white font-bold text-sm md:text-lg">
        Team Statistics
      </div>
      <DataTable
        compact
        searchable={false}
        paginated={false}
        stickyHeader
        maxHeight="max-h-[70dvh]"
        data={rows}
        getRowId={(row) => row.team_id}
        rowClassName={() => "bg-white dark:bg-gray-900"}
        columns={[nameColumn, ...statColumns]}
        shape={shape}
      />
    </div>
  );
};
