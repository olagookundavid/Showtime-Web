import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import { fantasyApi, getMatches } from "../../services/api";
import type { TeamPointsHistoryRow } from "../../types";
import { IconButton, Spinner } from "../ui";
import { FantasyPitch } from "./FantasyPitch";

interface FantasyGameweekBreakdownProps {
  seasonId: string;
  /** Played gameweeks only, oldest first — the same rows the season table uses. */
  rows: TeamPointsHistoryRow[];
}

const statTiles = (row: TeamPointsHistoryRow) => [
  { label: "Average", value: row.average_points.toFixed(1) },
  { label: "Highest", value: row.highest_points.toFixed(1) },
  { label: "Your Points", value: row.points.toFixed(1), highlight: true },
  { label: "GW Rank", value: `#${row.gameweek_rank.toLocaleString()}` },
];

/** A single gameweek's own pitch — who played, what each of them scored —
 *  stepped through with prev/next arrows, mirroring the Premier League
 *  Fantasy "Points" tab. Showtime has no matchday bench/auto-substitutions
 *  concept (a lineup is exactly the 14 who play, full stop), so there is no
 *  bench section here — only what Showtime's own data actually supports. */
export function FantasyGameweekBreakdown({ seasonId, rows }: FantasyGameweekBreakdownProps) {
  // Most recently completed gameweek first, like the PL page defaults to
  // "right now" rather than the start of the season. Clamped on every render
  // rather than synced via an effect, so a shrinking/growing `rows` (a
  // refetch) never leaves the pointer out of range.
  const [index, setIndex] = useState(rows.length - 1);
  const clampedIndex = Math.min(index, rows.length - 1);
  const row = rows[clampedIndex];

  const { data: gameweeks } = useQuery({
    queryKey: ["fantasyGameweeks", seasonId],
    queryFn: () => fantasyApi.getGameweeks(seasonId),
  });
  const gameweek = gameweeks?.find((gw) => gw.id === row.gameweek_id);

  const { data: lineup, isLoading: lineupLoading } = useQuery({
    queryKey: ["fantasyLineup", seasonId, row.gameweek_id],
    queryFn: () => fantasyApi.getMyLineup(seasonId, row.gameweek_id),
  });

  const { data: fixtures } = useQuery({
    queryKey: ["fantasyGwFixtures", gameweek?.event_day_id],
    queryFn: () =>
      getMatches(undefined, 1, 20, undefined, undefined, undefined, gameweek?.event_day_id),
    enabled: !!gameweek?.event_day_id,
  });

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm p-5 md:p-6">
      <div className="flex items-center justify-between gap-3 mb-5">
        <IconButton
          variant="secondary"
          icon={ChevronLeftIcon}
          label="Previous gameweek"
          disabled={clampedIndex <= 0}
          onClick={() => setIndex(clampedIndex - 1)}
        />
        <h2 className="text-xl font-black uppercase tracking-tight text-sffl-navy dark:text-white">
          Gameweek {row.gameweek_number}
        </h2>
        <IconButton
          variant="secondary"
          icon={ChevronRightIcon}
          label="Next gameweek"
          disabled={clampedIndex >= rows.length - 1}
          onClick={() => setIndex(clampedIndex + 1)}
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {statTiles(row).map((tile) => (
          <div
            key={tile.label}
            className={`p-3 text-center ${
              tile.highlight
                ? "bg-sffl-red/10 dark:bg-sffl-red/20 ring-1 ring-inset ring-sffl-red/30"
                : "bg-gray-50 dark:bg-gray-700/40"
            }`}
          >
            <span className="block text-[10px] uppercase font-black tracking-wider text-gray-500 dark:text-gray-400">
              {tile.label}
            </span>
            <span
              className={`block text-xl font-black ${
                tile.highlight ? "text-sffl-red" : "text-sffl-navy dark:text-white"
              }`}
            >
              {tile.value}
            </span>
          </div>
        ))}
      </div>

      {lineupLoading ? (
        <Spinner label="Loading this gameweek's squad…" className="py-10" />
      ) : lineup?.picks && lineup.picks.length > 0 ? (
        <FantasyPitch
          picks={lineup.picks}
          gameweekLabel={`Gameweek ${row.gameweek_number}`}
          gameweekId={row.gameweek_id}
          showPoints
        />
      ) : (
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-6">
          No lineup on file for this gameweek.
        </p>
      )}

      {fixtures && fixtures.data.length > 0 && (
        <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-700">
          <h3 className="text-xs font-black uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
            Fixtures This Gameweek
          </h3>
          <div className="space-y-1">
            {fixtures.data.map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-3 text-sm py-2 border-b border-gray-50 dark:border-gray-700/50 last:border-b-0"
              >
                <span className="flex-1 min-w-0 truncate text-gray-900 dark:text-white font-medium text-right">
                  {m.home_team?.short_name || m.home_team?.name}
                </span>
                <span className="shrink-0 font-black text-sffl-navy dark:text-white tabular-nums px-1">
                  {m.status === "FINISHED" ? `${m.home_score} - ${m.away_score}` : "vs"}
                </span>
                <span className="flex-1 min-w-0 truncate text-gray-900 dark:text-white font-medium">
                  {m.away_team?.short_name || m.away_team?.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
