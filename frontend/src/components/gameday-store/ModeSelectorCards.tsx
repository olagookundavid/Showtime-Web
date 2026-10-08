import { StarIcon, Square3Stack3DIcon, TicketIcon } from "@heroicons/react/24/outline";
import type { HeroIcon } from "../ui";

export type GamedayStoreMode = "tickets" | "game-pass";

type Props = {
  mode: GamedayStoreMode;
  onSelect: (mode: GamedayStoreMode) => void;
};

const CARDS: {
  value: GamedayStoreMode | "season-pass";
  label: string;
  subtitle: string;
  icon: HeroIcon;
  disabled?: boolean;
}[] = [
  {
    value: "season-pass",
    label: "Season Pass",
    subtitle: "All season. Credits. Lounge benefits.",
    icon: StarIcon,
    disabled: true,
  },
  {
    value: "game-pass",
    label: "Game Pass",
    subtitle: "Pick more gamedays. Pay less.",
    icon: Square3Stack3DIcon,
  },
  {
    value: "tickets",
    label: "Tickets",
    subtitle: "One gameday. Your chosen tier.",
    icon: TicketIcon,
  },
];

/** The "Season Pass / Game Pass / Tickets" mode picker. Season Pass is shown but disabled — it isn't built yet. */
export const ModeSelectorCards = ({ mode, onSelect }: Props) => (
  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
    {CARDS.map((card) => {
      const isActive = card.value === mode;
      const Icon = card.icon;
      return (
        <button
          key={card.value}
          type="button"
          aria-pressed={isActive}
          disabled={card.disabled}
          title={card.disabled ? `${card.label} is coming soon` : undefined}
          onClick={() => !card.disabled && onSelect(card.value as GamedayStoreMode)}
          className={`flex min-h-11 flex-col gap-2 border p-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
            isActive
              ? "border-sffl-navy bg-sffl-navy/5 dark:bg-white/5"
              : "border-gray-200 hover:border-sffl-navy/40 dark:border-gray-700"
          }`}
        >
          <span className="flex items-center justify-between gap-2">
            <Icon
              className={`h-6 w-6 shrink-0 ${isActive ? "text-sffl-red" : "text-sffl-navy dark:text-white"}`}
              aria-hidden="true"
            />
            {card.disabled && (
              <span className="shrink-0 bg-gray-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-gray-500 dark:bg-gray-700 dark:text-gray-300">
                Coming soon
              </span>
            )}
          </span>
          <span className="text-sm font-black uppercase tracking-wide text-sffl-navy dark:text-white">
            {card.label}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">{card.subtitle}</span>
          {isActive && <span className="mt-1 h-0.5 w-8 bg-sffl-red" aria-hidden="true" />}
        </button>
      );
    })}
  </div>
);
