import React from "react";
import { Link } from "react-router-dom";
import { ArrowRightIcon, TrophyIcon } from "@heroicons/react/24/outline";
import type { Standing } from "../../types/matches";
import { formatStatNumber } from "../../utils/formatters";
import { ButtonLink } from "../ui";
import { DataTable, type Column } from "../ui/DataTable";

interface MatchStandingsTableProps {
  standings: Standing[];
  isCompleted?: boolean;
  viewAllLink?: string;
  isPlayoffs?: boolean;
}

export const MatchStandingsTable: React.FC<MatchStandingsTableProps> = ({
  standings,
  isCompleted,
  viewAllLink,
  isPlayoffs,
}) => {
  const championIcon = isPlayoffs
    ? "/images/branding/showtime-bowl-trophy.png"
    : "/images/branding/showtime-community-cup-shield.png";
  if (standings.length === 0) {
    return (
      <div className="text-center p-8 text-gray-500 dark:text-gray-400">
        No standings available yet.
      </div>
    );
  }

  const indexOf = new Map(standings.map((s, i) => [s.id, i]));
  const isGold = (s: Standing) => !!isCompleted && indexOf.get(s.id) === 0;
  const isWildcard = (s: Standing) => {
    const index = indexOf.get(s.id) ?? -1;
    return index >= 1 && index < 7;
  };

  const columns: Column<Standing>[] = [
    {
      header: "Team",
      className: "px-2 py-2 md:px-4 md:py-4 font-semibold text-sffl-navy dark:text-white whitespace-nowrap",
      cell: (s) => {
        const index = indexOf.get(s.id) ?? 0;
        const name = s.team?.short_name || s.team?.name || "Unknown";
        const logo = (
          <img
            src={s.team?.logo || "/images/default_football.png"}
            alt={s.team?.name || "Team"}
            className="w-5 h-5 md:w-8 md:h-8 object-contain rounded-md shrink-0"
            title={s.team?.name || "Team"}
          />
        );
        const trophy = isGold(s) ? (
          <img
            src={championIcon}
            alt="Champion Trophy"
            className="w-5 h-5 md:w-7 md:h-7 object-contain shrink-0 animate-bounce drop-shadow-xl"
            title="Champion"
          />
        ) : null;
        return (
          <div className="relative flex items-center gap-2 min-w-0">
            {isWildcard(s) && (
              <span aria-hidden="true" className="absolute -left-2 inset-y-0 w-1 rounded-full bg-emerald-500 dark:bg-emerald-400" />
            )}
            {isGold(s) && <span aria-hidden="true" className="absolute -left-2 inset-y-0 w-1 bg-amber-500" />}
            <span className="w-4 shrink-0 text-center text-xs font-bold text-gray-500 dark:text-gray-400">
              {index + 1}
            </span>
            {s.team?.id ? (
              <Link to={`/teams/${s.team.id}`} className="shrink-0 hover:opacity-80 transition-opacity">
                {logo}
              </Link>
            ) : (
              logo
            )}
            {s.team?.id ? (
              <Link
                to={`/teams/${s.team.id}`}
                className="flex items-center gap-1 min-w-0 uppercase hover:text-sffl-red transition-colors"
                title={s.team?.name || name}
              >
                <span className="truncate max-w-15 md:max-w-none">{name}</span>
                {trophy}
              </Link>
            ) : (
              <span className="flex items-center gap-1 min-w-0 uppercase" title={s.team?.name || name}>
                <span className="truncate max-w-15 md:max-w-none">{name}</span>
                {trophy}
              </span>
            )}
          </div>
        );
      },
    },
    {
      header: "P",
      align: "center",
      className: "px-1 py-2 md:px-4 md:py-4 text-gray-700 dark:text-gray-200",
      cell: (s) => formatStatNumber(s.played),
    },
    {
      header: "PD",
      align: "center",
      className: "px-1 py-2 md:px-4 md:py-4 font-bold text-gray-800 dark:text-gray-100",
      cell: (s) => (s.goal_diff > 0 ? `+${formatStatNumber(s.goal_diff)}` : formatStatNumber(s.goal_diff)),
    },
    {
      header: "PCT",
      align: "center",
      className: "px-1 py-2 md:px-4 md:py-4 font-semibold text-gray-800 dark:text-gray-100",
      cell: (s) => (s.pct != null ? `${s.pct}%` : "-"),
    },
  ];

  return (
    <div className="space-y-0">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-t-lg md:rounded-t-xl bg-sffl-navy px-3 py-2 md:px-6 md:py-3 text-white font-bold text-sm md:text-lg">
        <div className="flex items-center gap-2">
          <TrophyIcon className="w-5 h-5 text-yellow-500" aria-hidden="true" />
          <span>Team Standings</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-white/90">
            <div className="w-1.5 h-3.5 bg-emerald-400 rounded-full shadow-sm" />
            <span className="text-[11px] font-bold">Wildcard spot</span>
          </div>
          {viewAllLink && (
            <ButtonLink
              to={viewAllLink}
              variant="secondary"
              tone="dark"
              size="sm"
              icon={ArrowRightIcon}
              iconPosition="right"
            >
              View All
            </ButtonLink>
          )}
        </div>
      </div>
      <DataTable
        data={standings}
        columns={columns}
        searchable={false}
        paginated={false}
        compact
        getRowId={(s) => s.id}
        rowClassName={(s) =>
          isGold(s)
            ? "bg-amber-100 dark:bg-amber-950 font-bold text-amber-950 dark:text-amber-100"
            : "bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800"
        }
      />
    </div>
  );
};
