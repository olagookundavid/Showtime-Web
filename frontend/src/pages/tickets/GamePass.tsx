import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { getGamePassRules, getTicketProducts } from "../../services/api";
import type {
  GamePassRule,
  TicketProductDayResponse,
  TicketProductResponse,
} from "../../types";
import {
  Button,
  ButtonLink,
  Field,
  Select,
  Spinner,
  TicketAccessCodeBox,
  TicketCheckout,
  TicketDayPicker,
  TicketFeatureStrip,
  TicketProductCard,
  gamePassPercentFor,
  isSoldOut,
  naira,
  sortDaysByDate,
} from "../../components";
import {
  ArrowRightIcon,
  CalendarDaysIcon,
  CheckIcon,
  ChevronDownIcon,
  ExclamationTriangleIcon,
  TagIcon,
  TicketIcon,
} from "@heroicons/react/24/outline";

const FAQS = [
  {
    q: "What is a Game Pass?",
    a: "One pass that covers the match days you choose, from one to as many as you like. You pay once and get one code that works on each of them.",
  },
  {
    q: "Why buy more than one match day?",
    a: "The more match days on your pass, the bigger the discount. The savings are shown above the tickets and on your total.",
  },
  {
    q: "Can I pick any days?",
    a: "Yes. Any combination of match days that are on sale, from today onwards. They don't need to be back to back.",
  },
  {
    q: "How do I get in?",
    a: "Show your code at the entrance on each match day. You will also get an email reminder the day before each one.",
  },
  {
    q: "What if one of the days sells out?",
    a: "A sold-out day can't be added. Pick the days that are still open.",
  },
];

interface Checkout {
  product: TicketProductResponse;
  days: TicketProductDayResponse[];
}

/**
 * The next discount a buyer would reach by adding match days, so one day in the
 * basket becomes a nudge to add more. Null when there is nothing better ahead.
 */
const nextSaving = (
  count: number,
  rules: GamePassRule[],
): { moreDays: number; percent: number } | null => {
  const current = gamePassPercentFor(count, rules);
  const ahead = rules
    .filter((r) => r.is_active && r.min_days > count && r.percent_off > current)
    .sort((a, b) => a.min_days - b.min_days)[0];
  return ahead
    ? { moreDays: ahead.min_days - count, percent: ahead.percent_off }
    : null;
};

export const GamePass = () => {
  const [searchParams] = useSearchParams();
  // A match card links here with ?date=, so that day starts picked.
  const dateParam = searchParams.get("date");

  const [appliedCode, setAppliedCode] = useState<string | undefined>(undefined);
  // The tournament the buyer narrowed the list to; "" is every tournament.
  const [tournament, setTournament] = useState("");
  // Step 1: which ticket is picked. Step 2 (the match days for it) only shows
  // once this is set.
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  // The days picked on each ticket, by product id.
  const [picked, setPicked] = useState<Record<string, string[]>>({});
  const [checkout, setCheckout] = useState<Checkout | null>(null);

  // Choosing a tier reveals the day-picker panel below the grid; bring it
  // into view instead of leaving the buyer to notice and scroll themselves.
  const dayPanelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!selectedProductId) return;
    dayPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [selectedProductId]);

  const {
    data: products,
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["publicTicketProducts", appliedCode],
    queryFn: () => getTicketProducts(appliedCode),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
  const { data: rules } = useQuery({
    queryKey: ["gamePassRules"],
    queryFn: getGamePassRules,
    staleTime: 60_000,
  });

  // Every tournament with a match day still open, for the filter. One that
  // has sold out everywhere would only lead to an empty list if picked.
  const tournaments = useMemo(() => {
    const byId = new Map<string, string>();
    for (const p of products ?? []) {
      for (const d of p.days) {
        if (!isSoldOut(d)) byId.set(d.competition_id, d.competition_name);
      }
    }
    return [...byId]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [products]);

  // The unfiltered match days for each ticket, so a day picked under one
  // tournament filter still counts once the view narrows to another.
  const allProductsById = useMemo(() => {
    const map = new Map<string, TicketProductResponse>();
    for (const p of products ?? []) map.set(p.id, p);
    return map;
  }, [products]);

  // Each ticket with the match days still open for the chosen tournament,
  // earliest played first. A ticket with nothing left to pick is not shown. One
  // open day is enough: a Game Pass can be a single match day.
  const list = useMemo(
    () =>
      (products ?? [])
        .map((p) => ({
          ...p,
          days: sortDaysByDate(
            p.days.filter((d) => !tournament || d.competition_id === tournament),
          ),
        }))
        .filter((p) => p.days.some((d) => !isSoldOut(d))),
    [products, tournament],
  );

  // What is picked for a ticket: the buyer's own choice, else the day from the
  // link, else nothing. Resolved against every day the ticket covers, not
  // just the ones the current tournament filter is showing.
  const selectionFor = (productId: string, fullDays: TicketProductDayResponse[]): string[] => {
    const chosen = picked[productId];
    if (chosen) return chosen;
    const fromLink = fullDays.find(
      (d) => d.event_date === dateParam && !isSoldOut(d),
    );
    return fromLink ? [fromLink.event_day_id] : [];
  };

  const ladder = useMemo(
    () =>
      (rules ?? [])
        .filter((r) => r.is_active && r.percent_off > 0)
        .sort((a, b) => a.min_days - b.min_days),
    [rules],
  );

  const topPrice = useMemo(() => {
    if (list.length < 2) return null;
    return Math.max(...list.map((p) => Math.min(...p.days.map((d) => d.price))));
  }, [list]);

  // The cheapest ticket's CTA stays outline, the priciest goes gold, anything
  // in between is solid navy — the same ladder the highest tier's card uses.
  const cheapestPrice = useMemo(() => {
    if (list.length === 0) return null;
    return Math.min(...list.map((p) => Math.min(...p.days.map((d) => d.price))));
  }, [list]);

  // Selects or clears every open day in the current tournament view, without
  // touching a pick made under a different tournament filter.
  const toggleAll = (viewProduct: TicketProductResponse, fullProduct: TicketProductResponse) => {
    const openInView = viewProduct.days.filter((d) => !isSoldOut(d)).map((d) => d.event_day_id);
    const current = selectionFor(viewProduct.id, fullProduct.days);
    const allSelected = openInView.length > 0 && openInView.every((id) => current.includes(id));
    const outsideView = current.filter((id) => !openInView.includes(id));
    setPicked((prev) => ({
      ...prev,
      [viewProduct.id]: allSelected ? outsideView : [...outsideView, ...openInView],
    }));
  };

  return (
    <div className="space-y-8 md:space-y-12">
      <div>
        <section className="bg-sffl-navy text-white">
          <div className="flex flex-col gap-8 px-5 py-10 sm:px-8 sm:py-14 lg:flex-row lg:items-end lg:justify-between lg:px-12 lg:py-16">
            <div className="min-w-0 space-y-5">
              <p className="flex items-center gap-3 text-[11px] font-black uppercase tracking-[0.25em] text-white/80">
                <span className="h-px w-8 bg-sffl-red" aria-hidden="true" />
                Game Pass
              </p>
              <h1 className="text-4xl font-black uppercase leading-[0.95] tracking-tight sm:text-5xl lg:text-6xl">
                Every game.
                <span className="block text-sffl-red">One pass.</span>
              </h1>
              <p className="max-w-md text-sm text-white/85 sm:text-base">
                Choose your ticket, pick one match day or as many as you like,
                and get one code that works on all of them.
              </p>
            </div>

            <TicketAccessCodeBox onApply={setAppliedCode} />
          </div>
        </section>

        <TicketFeatureStrip
          items={[
            { icon: TicketIcon, label: "Regular, VIP & VIP Plus" },
            { icon: CalendarDaysIcon, label: "One match day or many. One pass." },
            { icon: TagIcon, label: "Add more days, save more." },
          ]}
          className="mt-3"
        />
      </div>

      {ladder.length > 0 && (
        <section
          aria-labelledby="pass-savings"
          className="border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-900/20"
        >
          <h2
            id="pass-savings"
            className="text-sm font-bold text-emerald-800 dark:text-emerald-200"
          >
            The more match days you add, the more you save
          </h2>
          <ul className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-emerald-800 dark:text-emerald-200">
            {ladder.map((r) => (
              <li key={r.min_days}>
                <strong className="font-black">{r.percent_off}% off</strong> for{" "}
                {r.min_days}+ match days
              </li>
            ))}
          </ul>
        </section>
      )}

      {tournaments.length > 1 && (
        <div className="max-w-sm">
          <Field label="Tournament" htmlFor="tournament-filter">
            <Select
              id="tournament-filter"
              shape="square"
              value={tournament}
              onChange={(e) => setTournament(e.target.value)}
            >
              <option value="">All tournaments</option>
              {tournaments.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      )}

      {isLoading ? (
        <Spinner size="lg" className="py-16" label="Loading Game Passes…" />
      ) : isError ? (
        <div className="border border-red-200 bg-red-50 px-4 py-16 text-center dark:border-red-800 dark:bg-red-900/20">
          <ExclamationTriangleIcon
            className="mx-auto mb-4 h-16 w-16 text-red-400"
            aria-hidden="true"
          />
          <h2 className="mb-2 text-2xl font-black uppercase tracking-tight text-red-700 dark:text-red-300">
            Couldn't load Game Passes
          </h2>
          <p className="mb-6 text-red-600 dark:text-red-400">
            Something went wrong fetching the tickets on sale. Check your
            connection and try again.
          </p>
          <Button
            shape="square"
            variant="navy"
            loading={isRefetching}
            onClick={() => refetch()}
          >
            Try again
          </Button>
        </div>
      ) : list.length === 0 ? (
        <div className="border border-gray-200 bg-white px-4 py-16 text-center dark:border-gray-700 dark:bg-gray-800">
          <TicketIcon
            className="mx-auto mb-4 h-16 w-16 text-gray-400"
            aria-hidden="true"
          />
          <h2 className="mb-2 text-2xl font-black uppercase tracking-tight text-sffl-navy dark:text-white">
            No Game Passes available yet
          </h2>
          <p className="text-gray-500 dark:text-gray-400">
            {tournament
              ? "There are no match days on sale for this tournament. Try another one."
              : "Check back soon: tickets go on sale as match days are scheduled."}
          </p>
          <ButtonLink
            to="/matches"
            variant="navy"
            shape="square"
            className="mt-6"
          >
            View matches
          </ButtonLink>
        </div>
      ) : (
        <section aria-labelledby="choose-pass">
          <h2
            id="choose-pass"
            className="mb-4 text-[11px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400"
          >
            Choose your ticket
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((product, index) => {
              const cheapest = Math.min(...product.days.map((d) => d.price));
              const isSelected = product.id === selectedProductId;
              const isHighlight = topPrice !== null && cheapest === topPrice;
              const isLowest = cheapestPrice !== null && cheapest === cheapestPrice;
              const variant = isHighlight ? "gold" : isLowest ? "outline" : "navy";

              return (
                <TicketProductCard
                  key={product.id}
                  product={product}
                  position={index + 1}
                  highlight={isHighlight}
                >
                  <Button
                    fullWidth
                    shape="square"
                    variant={variant}
                    icon={isSelected ? CheckIcon : ArrowRightIcon}
                    iconPosition="right"
                    onClick={() => setSelectedProductId(product.id)}
                  >
                    {isSelected ? "Selected" : `Choose ${product.name}`}
                  </Button>
                </TicketProductCard>
              );
            })}
          </div>

          {(() => {
            const selectedProduct = list.find((p) => p.id === selectedProductId);
            if (!selectedProduct) return null;

            // The same ticket's full, unfiltered day list, so a day picked
            // under another tournament filter isn't lost from the total.
            const fullProduct = allProductsById.get(selectedProduct.id) ?? selectedProduct;

            const cheapest = Math.min(...selectedProduct.days.map((d) => d.price));
            const isHighlight = topPrice !== null && cheapest === topPrice;
            const isLowest = cheapestPrice !== null && cheapest === cheapestPrice;
            const variant = isHighlight ? "gold" : isLowest ? "outline" : "navy";

            const selectedIds = selectionFor(selectedProduct.id, fullProduct.days);
            const selected = fullProduct.days.filter((d) =>
              selectedIds.includes(d.event_day_id),
            );
            const viewOpenIds = selectedProduct.days
              .filter((d) => !isSoldOut(d))
              .map((d) => d.event_day_id);
            const allViewSelected =
              viewOpenIds.length > 0 && viewOpenIds.every((id) => selectedIds.includes(id));
            const fullOpenCount = fullProduct.days.filter((d) => !isSoldOut(d)).length;

            // A preview of the saving while choosing. The server prices the
            // purchase itself.
            const perPerson = selected.reduce((sum, d) => sum + d.price, 0);
            const percent = gamePassPercentFor(selected.length, rules ?? []);
            const estimate = Math.round(perPerson * (1 - percent / 100));
            const more = nextSaving(selected.length, rules ?? []);

            return (
              <div
                ref={dayPanelRef}
                className="mt-6 scroll-mt-[calc(var(--chrome-h)+var(--store-tabs-h)+var(--ticket-tabs-h)+1rem)] border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800 sm:p-6"
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-[11px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">
                    Pick your match days for {selectedProduct.name}
                  </h3>
                  {viewOpenIds.length > 1 && (
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() => toggleAll(selectedProduct, fullProduct)}
                    >
                      {allViewSelected ? "Clear all" : "Select all"}
                    </Button>
                  )}
                </div>
                <div className="mt-3">
                  <TicketDayPicker
                    mode="multi"
                    name={`${selectedProduct.name} match days`}
                    days={selectedProduct.days}
                    selected={selectedIds}
                    onChange={(ids) =>
                      setPicked((prev) => ({ ...prev, [selectedProduct.id]: ids }))
                    }
                  />
                </div>

                {selected.length >= 1 && (
                  <div className="mt-3 flex items-baseline justify-between gap-3 border-t pt-3 dark:border-gray-700">
                    <span className="text-sm text-gray-600 dark:text-gray-300">
                      {selected.length} match day{selected.length === 1 ? "" : "s"}
                      {percent > 0 && (
                        <span className="ml-1 font-bold text-emerald-600 dark:text-emerald-400">
                          ({percent}% off)
                        </span>
                      )}
                    </span>
                    <span className="text-lg font-black text-sffl-navy dark:text-white">
                      {estimate === 0 ? "Free" : naira(estimate)}
                    </span>
                  </div>
                )}

                {more && fullOpenCount > selected.length && (
                  <p className="mt-3 flex items-start gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                    <TagIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>
                      Add {more.moreDays} more match day
                      {more.moreDays === 1 ? "" : "s"} and save {more.percent}%.
                    </span>
                  </p>
                )}

                <Button
                  fullWidth
                  shape="square"
                  variant={variant}
                  className="mt-4"
                  disabled={selected.length < 1}
                  onClick={() => setCheckout({ product: selectedProduct, days: selected })}
                >
                  {selected.length < 1 ? "Pick a match day" : "Get Game Pass"}
                </Button>
              </div>
            );
          })()}
        </section>
      )}

      <section className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] md:gap-12">
        <div className="space-y-2">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-sffl-red">
            Good to know
          </p>
          <h2 className="text-2xl font-black tracking-tight text-sffl-navy sm:text-3xl dark:text-white">
            How a Game Pass works.
          </h2>
        </div>
        <div className="divide-y divide-gray-200 border-y border-gray-200 dark:divide-gray-700 dark:border-gray-700">
          {FAQS.map((item) => (
            <details key={item.q} className="group">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 py-4 text-sm font-bold text-sffl-navy [&::-webkit-details-marker]:hidden dark:text-white">
                {item.q}
                <ChevronDownIcon
                  className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180"
                  aria-hidden="true"
                />
              </summary>
              <p className="pb-4 text-sm text-gray-600 dark:text-gray-300">
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </section>

      {checkout && (
        <TicketCheckout
          product={checkout.product}
          days={checkout.days}
          accessCode={appliedCode}
          onClose={() => setCheckout(null)}
        />
      )}
    </div>
  );
};
