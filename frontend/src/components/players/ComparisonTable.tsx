import { PlayerLink } from "../domain";
import { PlayerAvatar } from "../fantasy";
import { DataTable, Spinner, type Column } from "../ui";
import type { Shape } from "../ui/buttonStyles";
import { ALL_STAT_DEFINITIONS, POSITION_STAT_KEYS } from "../../constants";
import { formatStatNumber } from "../../utils";
import type { NormalizedPosition, Player, PlayerStat } from "../../types";

export interface ComparisonPlayer {
  player: Player;
  /** Undefined when the player has no recorded stats for the selected competition. */
  stat?: PlayerStat;
}

interface ComparisonTableProps {
  position: NormalizedPosition;
  players: ComparisonPlayer[];
  isLoading?: boolean;
  /** `perGame` divides every stat (except Appearances) by that player's apps. */
  mode?: "total" | "perGame";
  /** "all" or one of the categories `categoriesForPosition(position)` returns — filters which rows render. */
  statCategory?: string;
  /** Hides rows with nothing to compare (a tie, or fewer than two players with data). */
  onlyDifferences?: boolean;
  /** `square` for sharp corners (the comparison page uses this). */
  shape?: Shape;
}

interface StatRow {
  key: string;
  label: string;
  category: string;
  values: (number | null)[];
  bestValue: number | null;
  worstValue: number | null;
}

/**
 * The stat-ranking table (StatsTable) transposed: one row per stat instead of one column
 * per stat, with a column per compared player. Reuses the same POSITION_STAT_KEYS /
 * ALL_STAT_DEFINITIONS lookup StatsTable already uses to pick which stats are relevant.
 */
export const ComparisonTable = ({
  position,
  players,
  isLoading = false,
  mode = "total",
  statCategory = "all",
  onlyDifferences = false,
  shape = "round",
}: ComparisonTableProps) => {
  const square = shape === "square";

  if (isLoading) {
    return (
      <div className={`${square ? "rounded-none" : "rounded-lg md:rounded-xl"} shadow-lg bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700`}>
        <Spinner label="Loading stats…" className="py-16" />
      </div>
    );
  }

  const keys = POSITION_STAT_KEYS[position] ?? [];
  const rows: StatRow[] = keys.map((key) => {
    const def = ALL_STAT_DEFINITIONS.find((d) => d.key === key);
    const values = players.map(({ stat }) => {
      if (!stat) return null;
      const raw = (stat as unknown as Record<string, number>)[key];
      if (typeof raw !== "number") return null;
      if (mode === "perGame" && key !== "apps") {
        if (!stat.apps) return null;
        return Math.round((raw / stat.apps) * 10) / 10;
      }
      return raw;
    });
    const defined = values.filter((v): v is number => v !== null);
    // A row highlights nothing when every defined value ties, or fewer than two players have data.
    const hasSpread = defined.length >= 2 && new Set(defined).size > 1;
    return {
      key,
      label: def?.label ?? key,
      category: def?.category ?? "General",
      values,
      bestValue: hasSpread ? Math.max(...defined) : null,
      worstValue: hasSpread ? Math.min(...defined) : null,
    };
  });

  const visibleRows = rows.filter((row) => {
    if (statCategory !== "all" && row.category !== "General" && row.category !== statCategory)
      return false;
    if (onlyDifferences && row.bestValue === null) return false;
    return true;
  });

  const nameColumn: Column<StatRow> = {
    header: "Statistic",
    className:
      "px-3 py-3 md:px-4 font-bold text-sffl-navy dark:text-white whitespace-nowrap text-left min-w-32 md:min-w-45",
    cell: (row) => row.label,
  };

  const playerColumns: Column<StatRow>[] = players.map(({ player }, i) => ({
    header: (
      <div className="flex flex-col items-center gap-1.5 py-1 normal-case tracking-normal">
        <PlayerAvatar name={player.name} image={player.image} size="sm" shape={shape} />
        <PlayerLink
          id={player.id}
          className="text-xs font-black text-sffl-navy dark:text-white truncate max-w-24"
        >
          {player.name}
        </PlayerLink>
        <span className="text-[10px] text-gray-400 dark:text-gray-500 truncate max-w-24">
          #{player.jersey_number || "?"}
          {player.team?.short_name || player.team?.name
            ? ` · ${player.team.short_name || player.team.name}`
            : ""}
        </span>
      </div>
    ),
    align: "center",
    headerClassName: "px-2 py-2",
    className: "px-2 py-3 md:px-4 min-w-28",
    cell: (row) => {
      const v = row.values[i];
      if (v === null)
        return (
          <span className="text-gray-300 dark:text-gray-600">—</span>
        );
      const isBest = row.bestValue !== null && v === row.bestValue;
      const isWorst = row.worstValue !== null && v === row.worstValue;
      return (
        <span
          className={`inline-block ${square ? "rounded-none" : "rounded-lg"} px-2.5 py-1 font-bold ${
            isBest
              ? "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300"
              : isWorst
                ? "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                : "text-gray-700 dark:text-gray-300"
          }`}
        >
          {formatStatNumber(v)}
        </span>
      );
    },
  }));

  return (
    <div className="space-y-3">
      <DataTable
        compact
        searchable={false}
        paginated={false}
        stickyHeader
        maxHeight="max-h-[70dvh]"
        data={visibleRows}
        getRowId={(row) => row.key}
        columns={[nameColumn, ...playerColumns]}
        emptyMessage="No stats match these filters."
        shape={shape}
      />
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
        <span className="flex items-center gap-1.5">
          <span
            className={`inline-block w-3 h-3 ${square ? "rounded-none" : "rounded-sm"} bg-green-100 dark:bg-green-900/40 border border-green-300 dark:border-green-700`}
            aria-hidden="true"
          />
          Higher value
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className={`inline-block w-3 h-3 ${square ? "rounded-none" : "rounded-sm"} bg-red-100 dark:bg-red-900/40 border border-red-300 dark:border-red-700`}
            aria-hidden="true"
          />
          Lower value
        </span>
      </p>
    </div>
  );
};
