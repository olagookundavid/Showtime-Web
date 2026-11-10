import { Link } from "react-router-dom";
import {
  TrophyIcon,
  UserGroupIcon,
  ArrowRightIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  MinusSmallIcon,
} from "@heroicons/react/24/outline";
import type { RankMovement } from "../../types";

/** Climbed/dropped indicator for a table position, next to the rank itself. */
function RankMovementIndicator({ movement }: { movement?: RankMovement }) {
  if (movement === "UP") {
    return (
      <span className="inline-flex items-center text-emerald-500" title="Climbed the table since last gameweek">
        <ArrowTrendingUpIcon className="w-4 h-4" aria-hidden="true" />
        <span className="sr-only">Climbed the table since last gameweek</span>
      </span>
    );
  }
  if (movement === "DOWN") {
    return (
      <span className="inline-flex items-center text-sffl-red" title="Dropped down the table since last gameweek">
        <ArrowTrendingDownIcon className="w-4 h-4" aria-hidden="true" />
        <span className="sr-only">Dropped down the table since last gameweek</span>
      </span>
    );
  }
  if (movement === "SAME") {
    return (
      <span className="inline-flex items-center text-gray-400" title="No change since last gameweek">
        <MinusSmallIcon className="w-4 h-4" aria-hidden="true" />
        <span className="sr-only">No change since last gameweek</span>
      </span>
    );
  }
  return null;
}

export interface FantasyStandingRowProps {
  /** Router path to the full standings/leaderboard page for this row. */
  to: string;
  /** League name, or "Overall". */
  name: string;
  /** Manager's rank in this table; 0/unranked renders as "—". */
  rank: number;
  /** Climbed/dropped/same since the last scored gameweek. */
  movement?: RankMovement;
  /** True for the single "Overall" row (trophy icon); false for a mini-league (group icon). */
  isOverall: boolean;
}

/** One standings row: icon, name, rank-movement arrow, rank, chevron — links
 *  straight to that table's full page. Shared by Dashboard's "Standings"
 *  panel and the squad-page sidebar's "My Leagues" card. */
export function FantasyStandingRow({ to, name, rank, movement, isOverall }: FantasyStandingRowProps) {
  return (
    <Link
      to={to}
      className="min-h-11 px-3 -mx-3 py-3 flex items-center justify-between gap-3 rounded-xl transition hover:bg-gray-50 dark:hover:bg-gray-700/60 group"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-sffl-red shrink-0">
          {isOverall ? (
            <TrophyIcon className="w-4 h-4" aria-hidden="true" />
          ) : (
            <UserGroupIcon className="w-4 h-4" aria-hidden="true" />
          )}
        </div>
        <p className="text-sm font-bold text-gray-900 dark:text-white truncate group-hover:text-sffl-red transition-colors min-w-0">
          {name}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <RankMovementIndicator movement={movement} />
        <span className="text-sm font-black text-sffl-navy dark:text-white tabular-nums">
          {rank > 0 ? `#${rank.toLocaleString()}` : "—"}
        </span>
        <ArrowRightIcon
          className="w-4 h-4 text-gray-400 group-hover:text-sffl-red transition-colors"
          aria-hidden="true"
        />
      </div>
    </Link>
  );
}
