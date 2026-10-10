import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useOutletContext } from "react-router-dom";
import {
  getActiveGamePassDiscountBands,
  getActiveSeasonAdmissionTiers,
  getEventDays,
} from "../../services/api";
import type { EventDayResponse } from "../../types";
import {
  AdmissionTierPicker,
  DiscountBandTiles,
  Field,
  GamedayPickerGrid,
  IconButton,
  OrderSummarySidebar,
  Spinner,
  StepSectionHeader,
  type GamedayStoreContext,
} from "../../components";
import { MinusIcon, PlusIcon, TicketIcon } from "@heroicons/react/24/outline";
import { calculateGamePassTotals, seasonTiersToRates } from "../../utils";
import { GamePassReviewModal } from "./GamePassReviewModal";

const MIN_GAMEDAYS_FOR_PASS = 2;

export const GamePass = () => {
  const { appliedCode } = useOutletContext<GamedayStoreContext>();

  // A Game Pass bundles multiple gamedays, so it always works off the full
  // schedule — unlike Tickets, it has no use for `?date=` scoping.
  const { data: eventDaysData, isLoading } = useQuery({
    queryKey: ["publicEventDays", appliedCode],
    queryFn: () => getEventDays(appliedCode),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
  const eventDays: EventDayResponse[] = useMemo(() => eventDaysData || [], [eventDaysData]);

  // A Game Pass prices off the season-wide admission tier, not any one
  // gameday's own ticket price — these two public endpoints are the live
  // version of what used to be hardcoded.
  const { data: seasonTiersData } = useQuery({
    queryKey: ["activeSeasonAdmissionTiers"],
    queryFn: getActiveSeasonAdmissionTiers,
    staleTime: 30_000,
  });
  const { data: discountBandsData } = useQuery({
    queryKey: ["activeGamePassDiscountBands"],
    queryFn: getActiveGamePassDiscountBands,
    staleTime: 30_000,
  });
  const discountBands = discountBandsData ?? [];

  const [selectedTierName, setSelectedTierName] = useState<string | null>(null);
  const [selectedGamedayIds, setSelectedGamedayIds] = useState<string[]>([]);
  const [holders, setHolders] = useState(1);
  const [reviewOpen, setReviewOpen] = useState(false);

  const representativeRates = useMemo(
    () => seasonTiersToRates(seasonTiersData ?? []),
    [seasonTiersData],
  );
  const selectedRate =
    representativeRates.find((r) => r.name === selectedTierName) ?? null;

  const handleSelectTier = (tierName: string) => {
    setSelectedTierName(tierName);
    // A different tier can be offered on different gamedays, so the picks reset.
    setSelectedGamedayIds([]);
  };

  const toggleGameday = (eventDayId: string) => {
    setSelectedGamedayIds((prev) =>
      prev.includes(eventDayId)
        ? prev.filter((id) => id !== eventDayId)
        : [...prev, eventDayId],
    );
  };

  const selectedGamedays = eventDays.filter((d) => selectedGamedayIds.includes(d.id));
  const gamedayCount = selectedGamedayIds.length;

  const totals = calculateGamePassTotals({
    gamedayCount,
    holders,
    rate: selectedRate?.rate ?? 0,
    bands: discountBands,
  });

  const canReview = !!selectedRate && gamedayCount >= MIN_GAMEDAYS_FOR_PASS;

  return (
    <div className="space-y-8 md:space-y-12">
      {isLoading ? (
        <Spinner size="lg" className="py-16" label="Loading gamedays…" />
      ) : eventDays.length === 0 ? (
        <div className="border border-gray-200 bg-white px-4 py-16 text-center dark:border-gray-700 dark:bg-gray-800">
          <TicketIcon
            className="mx-auto mb-4 h-16 w-16 text-gray-400"
            aria-hidden="true"
          />
          <h2 className="mb-2 text-2xl font-black uppercase tracking-tight text-sffl-navy dark:text-white">
            No upcoming gamedays
          </h2>
          <p className="text-gray-500 dark:text-gray-400">
            Check back soon for new gameday schedules.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
          <div className="space-y-8 lg:col-span-2">
            <div className="space-y-4">
              <StepSectionHeader step={1} title="Choose your admission tier" />
              <AdmissionTierPicker
                rates={representativeRates}
                selectedTierName={selectedTierName}
                onSelect={handleSelectTier}
              />
            </div>

            {selectedRate && (
              <div className="space-y-4">
                <StepSectionHeader step={2} title="Pick your gamedays" />
                <DiscountBandTiles
                  gamedayCount={gamedayCount}
                  bands={discountBands}
                  nextBandAt={totals.nextBandAt}
                  nextBandPercent={totals.nextBandPercent}
                />
                <GamedayPickerGrid
                  eventDays={eventDays}
                  tierName={selectedRate.name}
                  representativeRate={selectedRate.rate}
                  mode="multi"
                  selectedIds={selectedGamedayIds}
                  onToggle={toggleGameday}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Pick at least {MIN_GAMEDAYS_FOR_PASS} gamedays to bundle them into a Game
                  Pass. The same selected gamedays apply to each pass holder.
                </p>

                <Field label="Pass holders">
                  <div className="flex items-center gap-4">
                    <IconButton
                      variant="secondary"
                      shape="square"
                      icon={MinusIcon}
                      label="Decrease pass holders"
                      onClick={() => setHolders((h) => Math.max(1, h - 1))}
                    />
                    <span
                      className="w-12 text-center text-xl font-bold dark:text-white"
                      aria-live="polite"
                    >
                      {holders}
                    </span>
                    <IconButton
                      variant="secondary"
                      shape="square"
                      icon={PlusIcon}
                      label="Increase pass holders"
                      onClick={() => setHolders((h) => Math.min(10, h + 1))}
                    />
                  </div>
                </Field>
              </div>
            )}
          </div>

          <OrderSummarySidebar
            title="Your Game Pass"
            rows={[
              { label: "Selected gamedays", value: String(gamedayCount) },
              { label: "Pass holders", value: String(holders) },
              {
                label: "Per person, per gameday",
                value: selectedRate ? `₦${selectedRate.rate.toLocaleString()}` : "—",
              },
            ]}
            discount={{
              label: `Bundle discount (${totals.discountPercent}%)`,
              amount: totals.discountAmount,
            }}
            standardTotal={totals.standardTotal}
            total={totals.total}
            ctaLabel="Review Game Pass"
            ctaDisabled={!canReview}
            onCtaClick={() => setReviewOpen(true)}
            smallPrint={[
              "Game Pass savings apply to admission only. Credits and Season Pass privileges are not included.",
              "Illustrative pricing. Any applicable fees or taxes must be disclosed before payment.",
            ]}
          />
        </div>
      )}

      {selectedRate && selectedRate.id && (
        <GamePassReviewModal
          open={reviewOpen}
          onClose={() => setReviewOpen(false)}
          tierId={selectedRate.id}
          tierName={selectedRate.name}
          gamedays={selectedGamedays}
          holders={holders}
          totals={totals}
        />
      )}
    </div>
  );
};
