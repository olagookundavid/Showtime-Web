import { CursorArrowRaysIcon } from "@heroicons/react/24/outline";
import { Modal } from "../ui";
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
  open: boolean;
  onClose: () => void;
  gwLabel: string;
  isGameweekView: boolean;
}

/**
 * The column guide for the player leaderboard, opened from the info button above
 * the table: a short how-to-use note, then what each column means, in the order
 * the columns appear, scrolling inside the dialog.
 */
export function PlayerLeaderboardLegend({ open, onClose, gwLabel, isGameweekView }: PlayerLeaderboardLegendProps) {
  const guide = playerLeaderboardGuide(gwLabel, isGameweekView);
  // "GW4 pts" only has its own column in the season view; in a gameweek view
  // the main points column already is that gameweek.
  const keys = ORDER.filter((k) => !(k === "gameweekPoints" && isGameweekView));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="What each column means"
      subtitle="Every figure comes from real match stats, scored with the same rules as your lineup."
      maxWidth="2xl"
    >
      <div className="flex items-start gap-2 rounded-xl bg-gray-50 dark:bg-gray-900/40 p-3 text-xs sm:text-sm text-gray-700 dark:text-gray-200">
        <CursorArrowRaysIcon className="w-4 h-4 shrink-0 mt-0.5 text-sffl-red" aria-hidden="true" />
        <p>
          <strong>Using the table:</strong> click a column heading to sort by it, and click it again to
          go back to points. Use the filters to narrow by position, club or gender, pick a gameweek at
          the top to see just that week, and search by player or club name. Ranks are always against
          every player. Swipe the table sideways to see every column.
        </p>
      </div>

      <dl className="mt-4 divide-y divide-gray-100 dark:divide-gray-700">
        {keys.map((key) => {
          const entry = guide[key];
          return (
            <div key={key} className="py-4 first:pt-2">
              <dt className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-black uppercase tracking-wider text-sffl-navy dark:text-white">
                  {entry.label}
                </span>
                <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-[10px] font-black uppercase tracking-wider text-gray-600 dark:text-gray-300">
                  {entry.scope}
                </span>
              </dt>
              <dd className="mt-1.5 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                {entry.detail}
              </dd>
            </div>
          );
        })}
      </dl>

      <div className="mt-2 border-t border-gray-100 dark:border-gray-700 pt-4">
        <h3 className="text-sm font-black uppercase tracking-wider text-sffl-navy dark:text-white">
          Highlight cards
        </h3>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
          The cards above the table pick out one player each, from the whole pool. A card is left out
          when nobody has a figure above zero for it yet.
        </p>
        <dl className="mt-3 space-y-2">
          {HIGHLIGHT_GUIDE.map((h) => (
            <div key={h.label} className="text-sm">
              <dt className="inline font-black text-gray-900 dark:text-white">{h.label}: </dt>
              <dd className="inline text-gray-600 dark:text-gray-300">{h.detail}</dd>
            </div>
          ))}
        </dl>
      </div>
    </Modal>
  );
}
