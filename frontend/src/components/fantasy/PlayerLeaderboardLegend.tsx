import {
  InformationCircleIcon,
  CursorArrowRaysIcon,
} from "@heroicons/react/24/outline";
import { playerLeaderboardGuide, type LeaderboardGuideKey } from "./playerLeaderboardGuide";

/** The headline cards at the top of the page, explained. */
const HIGHLIGHT_GUIDE: { label: string; detail: string }[] = [
  { label: "Top scorer", detail: "The player with the most points in the view you are on." },
  { label: "In form", detail: "The best Form: the highest average over the last three played gameweeks." },
  { label: "Most selected", detail: "The player owned by the largest share of squads." },
  { label: "Most transferred in", detail: "The player signed the most times this season." },
  { label: "Best value", detail: "The most season points for every ₦1m of price." },
];

// The order the columns appear in the table, so the legend reads left to right.
const ORDER: LeaderboardGuideKey[] = [
  "rank",
  "player",
  "points",
  "gameweekPoints",
  "form",
  "ppg",
  "apps",
  "value",
  "price",
  "selected",
  "started",
  "in",
  "out",
];

interface PlayerLeaderboardLegendProps {
  gwLabel: string;
  isGameweekView: boolean;
}

/**
 * The legend under the player leaderboard: how to use the table, then what each
 * column means, in the order the columns appear.
 */
export function PlayerLeaderboardLegend({ gwLabel, isGameweekView }: PlayerLeaderboardLegendProps) {
  const guide = playerLeaderboardGuide(gwLabel, isGameweekView);
  // "GW4 pts" only has its own column in the season view; in a gameweek view
  // the main points column already is that gameweek.
  const keys = ORDER.filter((k) => !(k === "gameweekPoints" && isGameweekView));

  return (
    <section
      id="plb-legend"
      aria-labelledby="plb-legend-title"
      className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm scroll-mt-24"
    >
      <div className="p-4 sm:p-6 border-b border-gray-100 dark:border-gray-700">
        <h2
          id="plb-legend-title"
          className="inline-flex items-center gap-2 text-lg font-black text-sffl-navy dark:text-white"
        >
          <InformationCircleIcon className="w-5 h-5 text-sffl-red" aria-hidden="true" />
          Legend: what each column means
        </h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
          Every figure here is worked out from real match stats, with the same scoring rules as your
          own lineup. The tag on each entry says which stretch of the season it covers.
        </p>

        <div className="mt-4 flex items-start gap-2 rounded-xl bg-gray-50 dark:bg-gray-900/40 p-3 text-xs sm:text-sm text-gray-700 dark:text-gray-200">
          <CursorArrowRaysIcon className="w-4 h-4 shrink-0 mt-0.5 text-sffl-red" aria-hidden="true" />
          <p>
            <strong>Using the table:</strong> click a column heading to sort by it, and click it
            again to go back to points. Use the filters to narrow by position, club or gender, pick
            a gameweek at the top to see just that week, and search by player or club name. The rows
            you see are always ranked against every player.
          </p>
        </div>
      </div>

      <dl className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-px bg-gray-100 dark:bg-gray-700">
        {keys.map((key) => {
          const entry = guide[key];
          return (
            <div key={key} className="bg-white dark:bg-gray-800 p-4 sm:p-5 min-w-0">
              <dt className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-black uppercase tracking-wider text-sffl-navy dark:text-white">
                  {entry.label}
                </span>
                <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-[10px] font-black uppercase tracking-wider text-gray-600 dark:text-gray-300">
                  {entry.scope}
                </span>
              </dt>
              <dd className="mt-1.5 text-xs sm:text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                {entry.detail}
              </dd>
            </div>
          );
        })}
      </dl>

      <div className="p-4 sm:p-6 border-t border-gray-100 dark:border-gray-700">
        <h3 className="text-sm font-black uppercase tracking-wider text-sffl-navy dark:text-white">
          Highlight cards
        </h3>
        <p className="mt-1 text-xs sm:text-sm text-gray-600 dark:text-gray-300">
          The cards at the top pick out one player each, from the whole pool. A card is left out
          when nobody has a figure above zero for it yet.
        </p>
        <dl className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2">
          {HIGHLIGHT_GUIDE.map((h) => (
            <div key={h.label} className="text-xs sm:text-sm min-w-0">
              <dt className="inline font-black text-gray-900 dark:text-white">{h.label}: </dt>
              <dd className="inline text-gray-600 dark:text-gray-300">{h.detail}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
