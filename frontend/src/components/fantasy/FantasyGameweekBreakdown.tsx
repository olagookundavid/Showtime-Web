import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import { fantasyApi } from "../../services/api";
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
  { label: "Your Points", value: row.points.toFixed(1) },
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

  const { data: lineup, isLoading: lineupLoading } = useQuery({
    queryKey: ["fantasyLineup", seasonId, row.gameweek_id],
    queryFn: () => fantasyApi.getMyLineup(seasonId, row.gameweek_id),
  });

  return (
    <div className="bg-sffl-navy shadow-sm p-5 md:p-6">
      <div className="flex items-center justify-between gap-3 mb-5">
        <IconButton
          variant="secondary"
          tone="dark"
          icon={ChevronLeftIcon}
          label="Previous gameweek"
          disabled={clampedIndex <= 0}
          onClick={() => setIndex(clampedIndex - 1)}
        />
        <h2 className="text-xl font-black uppercase tracking-tight text-white">
          Gameweek {row.gameweek_number}
        </h2>
        <IconButton
          variant="secondary"
          tone="dark"
          icon={ChevronRightIcon}
          label="Next gameweek"
          disabled={clampedIndex >= rows.length - 1}
          onClick={() => setIndex(clampedIndex + 1)}
        />
      </div>

      {/* Every tile the same — no one stat singled out in a different color. */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {statTiles(row).map((tile) => (
          <div
            key={tile.label}
            className="p-3 text-center bg-white/5 border border-white/10"
          >
            <span className="block text-[10px] uppercase font-black tracking-wider text-[#aebdd0]">
              {tile.label}
            </span>
            <span className="block text-xl font-black text-white">
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
          hideHeader
          hideDetailStrip
          playerModalPosition="right"
        />
      ) : (
        <p className="text-sm text-[#aebdd0] text-center py-6">
          No lineup on file for this gameweek.
        </p>
      )}
    </div>
  );
}
