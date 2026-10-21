import { useState } from "react";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  InformationCircleIcon,
} from "@heroicons/react/24/outline";

interface StatsLegendProps {
  /** Adds a 5th "Team" category explaining the team-only columns (Team Stats only). */
  showTeamCategory?: boolean;
}

/** Collapsible "Statistical Key" panel explaining the stat-column abbreviations. */
export const StatsLegend = ({ showTeamCategory = false }: StatsLegendProps) => {
  const [showLegend, setShowLegend] = useState(false);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-none border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
      <button
        type="button"
        aria-expanded={showLegend}
        className="w-full min-h-11 p-4 flex items-center justify-between gap-3 text-left cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
        onClick={() => setShowLegend(!showLegend)}
      >
        <span className="flex items-center gap-2">
          <InformationCircleIcon
            className="w-5 h-5 text-sffl-red"
            aria-hidden="true"
          />
          <span className="font-black text-xs md:text-sm text-sffl-navy dark:text-white uppercase tracking-wider">
            Statistical Key
          </span>
        </span>
        <span className="inline-flex items-center gap-1 shrink-0 text-[11px] font-black uppercase tracking-tight text-sffl-red">
          {showLegend ? "Close Info" : "See Info"}
          {showLegend ? (
            <ChevronUpIcon className="w-3.5 h-3.5" aria-hidden="true" />
          ) : (
            <ChevronDownIcon className="w-3.5 h-3.5" aria-hidden="true" />
          )}
        </span>
      </button>

      {showLegend && (
        <div className="p-4 sm:p-6 pt-0 sm:pt-0 border-t border-gray-50 dark:border-gray-700">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 py-4">
            {/* Category: General */}
            <div className="space-y-2">
              <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-l-2 border-gray-200 pl-2">
                General
              </h4>
              <div className="flex flex-wrap gap-2 text-[10px] font-bold">
                <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-700/50 px-2 py-1 rounded-none border border-gray-100 dark:border-gray-600">
                  <span className="text-sffl-red">APPS:</span>{" "}
                  <span className="text-gray-600 dark:text-gray-300">
                    Appearances
                  </span>
                </div>
              </div>
            </div>

            {/* Category: Passing */}
            <div className="space-y-2">
              <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-widest border-l-2 border-blue-200 pl-2">
                Passing
              </h4>
              <div className="flex flex-wrap gap-2 text-[10px] font-bold">
                {[
                  { a: "Passing ATT", f: "Pass Attempts" },
                  { a: "Passing COMP", f: "Pass Completions" },
                  { a: "Passing TDs", f: "Passing Touchdowns" },
                  { a: "Passing INT", f: "Interceptions Thrown" },
                  { a: "QB Sacks", f: "QB Sacks Accounted" },
                ].map((s) => (
                  <div
                    key={s.a}
                    className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded-none border border-blue-100 dark:border-blue-800"
                  >
                    <span className="text-blue-600"> {s.a}:</span>{" "}
                    <span className="text-blue-800/80 dark:text-blue-300/80">
                      {s.f}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Category: Rushing & Receiving */}
            <div className="space-y-2">
              <h4 className="text-[10px] font-black text-green-400 uppercase tracking-widest border-l-2 border-green-200 pl-2">
                Offense
              </h4>
              <div className="flex flex-wrap gap-2 text-[10px] font-bold">
                {[
                  { a: "Rush ATT", f: "Rush Attempts", c: "green" },
                  { a: "Rush TDs", f: "Rushing Touchdowns", c: "green" },
                  { a: "Rec", f: "Receptions", c: "yellow" },
                  { a: "RC TDs", f: "Receiving Touchdowns", c: "yellow" },
                  { a: "Drops", f: "Drops", c: "yellow" },
                  {
                    a: "X-Pts TDs",
                    f: "Extra Point Touchdowns",
                    c: "purple",
                  },
                ].map((s) => (
                  <div
                    key={s.a}
                    className={`flex items-center gap-1.5 bg-${s.c}-50 dark:bg-${s.c}-900/20 px-2 py-1 rounded-none border border-${s.c}-100 dark:border-${s.c}-800`}
                  >
                    <span className={`text-${s.c}-600`}> {s.a}:</span>{" "}
                    <span
                      className={`text-${s.c}-800/80 dark:text-${s.c}-300/80`}
                    >
                      {s.f}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Category: Defense */}
            <div className="space-y-2">
              <h4 className="text-[10px] font-black text-red-400 uppercase tracking-widest border-l-2 border-red-200 pl-2">
                Defense
              </h4>
              <div className="flex flex-wrap gap-2 text-[10px] font-bold">
                {[
                  { a: "Flag Pulls", f: "Flag Pulls (Tackles)" },
                  { a: "Pass Defl", f: "Pass Deflections" },
                  { a: "Def INT", f: "Interceptions Caught" },
                  { a: "Def Sacks", f: "Defensive Sacks" },
                  { a: "Def TDs", f: "Defensive Touchdowns" },
                  {
                    a: "Def XP TDs",
                    f: "Defensive Extra-Point TDs (INT returned on an extra point)",
                  },
                  { a: "Safety", f: "Safeties" },
                ].map((s) => (
                  <div
                    key={s.a}
                    className="flex items-center gap-1.5 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded-none border border-red-100 dark:border-red-800"
                  >
                    <span className="text-red-600"> {s.a}:</span>{" "}
                    <span className="text-red-800/80 dark:text-red-300/80">
                      {s.f}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Category: Team (team-only columns) */}
            {showTeamCategory && (
              <div className="space-y-2">
                <h4 className="text-[10px] font-black text-amber-500 uppercase tracking-widest border-l-2 border-amber-200 pl-2">
                  Team
                </h4>
                <div className="flex flex-wrap gap-2 text-[10px] font-bold">
                  {[
                    { a: "Plays", f: "Total Plays (from scrimmage)" },
                    { a: "Drives", f: "Offensive Drives" },
                    { a: "1st Dn", f: "First Downs" },
                    { a: "TO", f: "Turnovers" },
                    { a: "Punts", f: "Punts" },
                    { a: "Pen", f: "Penalties" },
                    { a: "Pen YDS", f: "Penalty Yards" },
                  ].map((s) => (
                    <div
                      key={s.a}
                      className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded-none border border-amber-100 dark:border-amber-800"
                    >
                      <span className="text-amber-600"> {s.a}:</span>{" "}
                      <span className="text-amber-800/80 dark:text-amber-300/80">
                        {s.f}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
