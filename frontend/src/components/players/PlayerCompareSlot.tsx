import type { Player } from "../../types";
import { IconButton } from "../ui";
import type { Shape } from "../ui/buttonStyles";
import { getInitials } from "../../utils";
import {
  ArrowsRightLeftIcon,
  UserPlusIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

interface PlayerCompareSlotProps {
  /** 0-based slot position, used only to alternate the accent bar colour. */
  index: number;
  player?: Player;
  /** Opens the player picker for this slot — adding when empty, replacing when filled. */
  onPick: () => void;
  onRemove: () => void;
  /** `square` for sharp corners (the comparison page uses this). */
  shape?: Shape;
}

const ACCENT_CLASSES = ["bg-sffl-red", "bg-sffl-navy"];

/** One of the up-to-4 comparison slots: an "Add Player" tile when empty, or the picked player's card. */
export const PlayerCompareSlot = ({
  index,
  player,
  onPick,
  onRemove,
  shape = "round",
}: PlayerCompareSlotProps) => {
  const radius = shape === "square" ? "rounded-none" : "rounded-xl";
  const accent = ACCENT_CLASSES[index % ACCENT_CLASSES.length];

  if (!player) {
    return (
      <button
        type="button"
        onClick={onPick}
        className={`flex flex-col items-center justify-center gap-2 h-full min-h-56 w-full ${radius} border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500 hover:border-sffl-red hover:text-sffl-red dark:hover:text-sffl-red transition-colors cursor-pointer`}
      >
        <UserPlusIcon className="w-7 h-7" aria-hidden="true" />
        <span className="text-xs font-bold uppercase tracking-wide">
          Add Player
        </span>
      </button>
    );
  }

  const [firstName, ...restName] = player.name.split(" ");
  const lastName = restName.join(" ");

  return (
    <div
      className={`relative h-full flex flex-col ${radius} border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden shadow-sm`}
    >
      <span
        className={`absolute left-0 top-0 bottom-0 w-1 ${accent}`}
        aria-hidden="true"
      />

      <IconButton
        icon={XMarkIcon}
        label={`Remove ${player.name}`}
        variant="ghost"
        className="absolute top-1.5 right-1.5 z-10 bg-white/70 dark:bg-gray-800/70"
        onClick={onRemove}
      />

      <div className="flex flex-1 min-h-44 md:min-h-52">
        {player.image ? (
          <img
            src={player.image}
            alt=""
            className="w-2/5 shrink-0 h-full object-cover"
          />
        ) : (
          <div className="w-2/5 shrink-0 h-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-2xl font-black text-gray-400 dark:text-gray-500">
            {getInitials(player.name)}
          </div>
        )}

        <div className="flex-1 min-w-0 p-3 md:p-4 flex flex-col justify-center gap-1.5 md:gap-2">
          <div className="min-w-0">
            <p className="text-sm text-gray-500 dark:text-gray-400 leading-tight truncate">
              {firstName}
            </p>
            <p className="text-lg md:text-xl font-black text-sffl-navy dark:text-white leading-tight truncate">
              {lastName || firstName}
            </p>
          </div>

          <img
            src={player.team?.logo || "/images/default_football.webp"}
            alt=""
            className="w-7 h-7 md:w-8 md:h-8 object-contain"
          />

          <p className="text-xs font-black uppercase tracking-wide text-gray-700 dark:text-gray-300 truncate">
            {player.team?.name || "Free Agent"}
          </p>

          <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
            <span>#{player.jersey_number || "?"}</span>
            <span className="text-gray-300 dark:text-gray-600" aria-hidden="true">
              |
            </span>
            <span>{player.position}</span>
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={onPick}
        className="flex items-center justify-center gap-2 min-h-11 w-full border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/60 transition-colors cursor-pointer"
      >
        <ArrowsRightLeftIcon className="w-3.5 h-3.5" aria-hidden="true" />
        Replace player
      </button>
    </div>
  );
};
