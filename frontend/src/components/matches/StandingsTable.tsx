import React from "react";
import { Link } from "react-router-dom";
import type { Standing } from "../../services/api";
import { LightboxImage } from "../ui";
import { DataTable, type Column } from "../ui/DataTable";
import { formatStatNumber } from "../../utils/formatters";
import { CUP_ELIMINATED_ROW, CUP_ZONE_BAR, CUP_ZONE_LEGEND, cupZoneOf } from "./cupZones";

interface StandingsTableProps {
  standings: Standing[];
  isCompleted?: boolean;
  highlightTeamId?: string;
  isPlayoffs?: boolean;
  /** Cup Swiss table: colour each row by where it sends the team (cupZones.ts). */
  isCup?: boolean;
}

const L5Badge: React.FC<{ result: string }> = ({ result }) => {
  const colors: Record<string, string> = {
    W: "bg-green-500 text-white",
    D: "bg-yellow-400 text-gray-900",
    L: "bg-red-500 text-white",
  };
  return (
    <span
      className={`inline-flex items-center justify-center w-3 h-3 md:w-5 md:h-5 rounded text-[6.5px] md:text-[10px] font-black ${colors[result] || "bg-gray-300 text-gray-600"}`}
    >
      {result}
    </span>
  );
};

export const StandingsTable: React.FC<StandingsTableProps> = ({
  standings,
  isCompleted,
  highlightTeamId,
  isPlayoffs,
  isCup,
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
  // A cup's champion is decided by its bracket, not this table.
  const isGold = (s: Standing) => !isCup && !!isCompleted && indexOf.get(s.id) === 0;
  const isHighlighted = (s: Standing) => !!highlightTeamId && s.team?.id === highlightTeamId;
  const isWildcard = (s: Standing) => {
    if (isCup) return false;
    const index = indexOf.get(s.id) ?? -1;
    return index >= 1 && index < 7;
  };
  const cupZone = (s: Standing) => (isCup ? cupZoneOf(indexOf.get(s.id) ?? 0) : undefined);

  const numberColumn = (header: string, value: (s: Standing) => React.ReactNode, className = ""): Column<Standing> => ({
    header,
    align: "center",
    className: `px-2.5 py-3 md:px-4 md:py-4 text-gray-700 dark:text-gray-200 ${className}`,
    cell: value,
  });

  const columns: Column<Standing>[] = [
    {
      header: "Team",
      className: "px-2.5 py-3 md:px-4 md:py-4 font-semibold text-sffl-navy dark:text-white whitespace-nowrap",
      cell: (s) => {
        const name = s.team?.name || s.team?.short_name || "Unknown";
        const logo = (
          <LightboxImage
            src={s.team?.logo || "/images/default_football.png"}
            alt={s.team?.name || "Team"}
            thumbnailClassName="w-5 h-5 md:w-8 md:h-8 object-contain rounded-md shrink-0"
          />
        );
        const trophy = isGold(s) ? (
          <img
            src={championIcon}
            alt="Champion Trophy"
            className="w-6 h-6 md:w-8 md:h-8 object-contain shrink-0 animate-bounce drop-shadow-xl"
            title="Champion"
          />
        ) : null;
        return (
          <div className="relative flex items-center gap-1.5 md:gap-3 min-w-0">
            {isWildcard(s) && (
              <span aria-hidden="true" className="absolute -left-2.5 inset-y-0 w-1 rounded-full bg-emerald-500 dark:bg-emerald-400" />
            )}
            {cupZone(s) && (
              <span aria-hidden="true" className={`absolute -left-2.5 inset-y-0 w-1 rounded-full ${CUP_ZONE_BAR[cupZone(s)!]}`} />
            )}
            {isGold(s) && <span aria-hidden="true" className="absolute -left-2.5 inset-y-0 w-1 bg-amber-500" />}
            <span className="w-4 shrink-0 text-center text-xs font-bold text-gray-500 dark:text-gray-300">
              {s.position}
            </span>
            {logo}
            {s.team?.id ? (
              <Link
                to={`/teams/${s.team.id}`}
                className="flex items-center gap-1 uppercase hover:text-sffl-red transition-colors min-w-0"
              >
                <span className="truncate">{name}</span>
                {trophy}
              </Link>
            ) : (
              <span className="flex items-center gap-1 uppercase min-w-0">
                <span className="truncate">{name}</span>
                {trophy}
              </span>
            )}
          </div>
        );
      },
    },
    numberColumn("P", (s) => formatStatNumber(s.played)),
    numberColumn("W", (s) => formatStatNumber(s.won)),
    numberColumn("D", (s) => formatStatNumber(s.drawn)),
    numberColumn("L", (s) => formatStatNumber(s.lost)),
    numberColumn("PF", (s) => formatStatNumber(s.goals_for)),
    numberColumn("PA", (s) => formatStatNumber(s.goals_against)),
    numberColumn(
      "PD",
      (s) => (s.goal_diff > 0 ? `+${formatStatNumber(s.goal_diff)}` : formatStatNumber(s.goal_diff)),
      "font-bold text-gray-800 dark:text-gray-100",
    ),
    numberColumn(
      "PCT",
      (s) => (s.pct != null ? `${s.pct}%` : "-"),
      "font-semibold text-gray-800 dark:text-gray-100",
    ),
    {
      header: "L5",
      align: "center",
      className: "px-2.5 py-3 md:px-4 md:py-4",
      cell: (s) =>
        s.l5 ? (
          <div className="flex gap-0.5 justify-center">
            {s.l5
              .split("")
              .filter((c) => c !== "-")
              .map((r, i) => (
                <L5Badge key={i} result={r} />
              ))}
          </div>
        ) : (
          <span className="text-gray-400 dark:text-gray-500">-</span>
        ),
    },
  ];

  return (
    <>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400 mb-2 px-1 font-semibold">
        {isCup ? (
          CUP_ZONE_LEGEND.map(({ zone, label }) => (
            <div key={zone} className="flex items-center gap-1.5">
              <div className={`w-1.5 h-3.5 rounded-full shadow-sm ${CUP_ZONE_BAR[zone]}`} />
              <span className="text-gray-700 dark:text-gray-300 font-bold">{label}</span>
            </div>
          ))
        ) : (
          <>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-3.5 bg-emerald-500 dark:bg-emerald-400 rounded-full shadow-sm" />
              <span className="text-gray-700 dark:text-gray-300 font-bold">Wildcard spot</span>
            </div>
            <div className="flex items-center gap-1.5">
              <img src={championIcon} alt="Champion" className="w-4 h-4 object-contain" />
              <span className="text-gray-700 dark:text-gray-300 font-bold">Champion</span>
            </div>
          </>
        )}
      </div>
      <div className="overflow-hidden rounded-lg md:rounded-xl shadow-lg">
        <div className="flex items-center justify-between px-3 py-2.5 md:px-6 md:py-4 bg-sffl-navy text-white font-bold text-sm md:text-lg">
          <span>{isCup ? "Cup Standings" : "Team Standings"}</span>
          {isCompleted && (
            <span className="text-xs bg-amber-500 text-sffl-navy px-2 py-0.5 rounded-full font-black uppercase tracking-wider">
              Season Completed
            </span>
          )}
        </div>
        <DataTable
          data={standings}
          columns={columns}
          searchable={false}
          paginated={false}
          getRowId={(s) => s.id}
          rowClassName={(s) =>
            isGold(s)
              ? "bg-amber-100 dark:bg-amber-950 font-bold text-amber-950 dark:text-amber-100"
              : isHighlighted(s)
                ? "bg-sffl-red/15 dark:bg-sffl-red/30"
                : cupZone(s) === "out"
                  ? CUP_ELIMINATED_ROW
                  : "bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800"
          }
        />
      </div>
    </>
  );
};
