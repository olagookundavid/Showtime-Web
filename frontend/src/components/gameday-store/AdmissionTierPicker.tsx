import { ArrowRightIcon, CheckIcon } from "@heroicons/react/24/outline";
import { Button } from "../ui";
import type { RepresentativeTierRate } from "../../utils";
import { parseTierPerks } from "../../utils";

type Props = {
  rates: RepresentativeTierRate[];
  selectedTierName: string | null;
  onSelect: (tierName: string) => void;
};

/**
 * Tier pricing-card grid shared by the Tickets and Game Pass builders. The
 * highest-rate tier always gets the navy+gold treatment, regardless of
 * whether it's selected — other tiers stay white-carded like the reference
 * design, showing selection via a ring border and the CTA button filling in.
 * Selecting a tier happens through the "Choose {tier}" button, not the card.
 */
export const AdmissionTierPicker = ({ rates, selectedTierName, onSelect }: Props) => {
  if (rates.length === 0) {
    return (
      <div className="border border-gray-200 bg-white px-4 py-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
        No admission tiers are available yet. Check back soon.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {rates.map((tier, index) => {
        const isGold = tier.isTop;
        const isSelected = selectedTierName === tier.name;
        const perks = parseTierPerks(tier.description);
        const accent = isGold ? "text-sffl-gold" : "text-sffl-red";
        const badgeNumber = String(index + 1).padStart(2, "0");

        return (
          <div
            key={tier.name}
            className={`relative flex flex-col border p-5 text-left transition-colors sm:p-6 ${
              isGold
                ? "border-sffl-navy bg-sffl-navy text-white"
                : "border-gray-200 bg-white text-sffl-navy dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            } ${
              isSelected
                ? isGold
                  ? "ring-2 ring-sffl-gold ring-offset-2 ring-offset-white dark:ring-offset-gray-900"
                  : "ring-2 ring-sffl-red ring-offset-2 ring-offset-white dark:ring-offset-gray-900"
                : ""
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <span className={`text-[11px] font-black uppercase tracking-[0.2em] ${accent}`}>
                {tier.name}
              </span>
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${
                  isGold ? "border-white/30 text-white/70" : "border-gray-300 text-gray-400"
                }`}
                aria-hidden="true"
              >
                {badgeNumber}
              </span>
            </div>

            <span className="mt-3 text-3xl font-black leading-none sm:text-4xl">
              ₦{tier.rate.toLocaleString()}
            </span>
            <span
              className={`mt-1 text-xs ${isGold ? "text-white/60" : "text-gray-500 dark:text-gray-400"}`}
            >
              per gameday
            </span>

            {perks.length > 0 && (
              <ul className="mt-5 flex-1 space-y-2">
                {perks.map((perk) => (
                  <li
                    key={perk}
                    className={`flex items-start gap-2 text-sm ${
                      isGold ? "text-white/85" : "text-gray-600 dark:text-gray-300"
                    }`}
                  >
                    <CheckIcon
                      className={`mt-0.5 h-4 w-4 shrink-0 ${accent}`}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 wrap-break-word">{perk}</span>
                  </li>
                ))}
              </ul>
            )}

            <Button
              fullWidth
              shape="square"
              className="mt-6"
              variant={isGold ? "gold" : isSelected ? "navy" : "outline"}
              icon={isSelected ? CheckIcon : ArrowRightIcon}
              iconPosition="right"
              onClick={() => onSelect(tier.name)}
            >
              {isSelected ? "Selected" : `Choose ${tier.name}`}
            </Button>
          </div>
        );
      })}
    </div>
  );
};
