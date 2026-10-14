import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getGamePassRules, getTicketProducts } from "../../services/api";
import type {
  TicketProductDayResponse,
  TicketProductResponse,
} from "../../types";
import {
  Button,
  ButtonLink,
  Spinner,
  TicketAccessCodeBox,
  TicketCheckout,
  TicketDayPicker,
  TicketFeatureStrip,
  TicketProductCard,
  gamePassPercentFor,
  isSoldOut,
  naira,
} from "../../components";
import {
  CalendarDaysIcon,
  ChevronDownIcon,
  TagIcon,
  TicketIcon,
} from "@heroicons/react/24/outline";

const FAQS = [
  {
    q: "What is a Game Pass?",
    a: "One ticket that covers several match days. You choose the days, pay once and get one code that works on each of them.",
  },
  {
    q: "Can I pick any days?",
    a: "Yes. Any combination of match days that are on sale. They don't need to be back to back.",
  },
  {
    q: "How do I get in?",
    a: "Show your code at the entrance on each match day. You will also get an email reminder the day before each one.",
  },
  {
    q: "What if one of the days sells out?",
    a: "A sold-out day can't be added. Pick the days that are still open, or buy single tickets instead.",
  },
];

interface Checkout {
  product: TicketProductResponse;
  days: TicketProductDayResponse[];
}

export const GamePass = () => {
  const [appliedCode, setAppliedCode] = useState<string | undefined>(undefined);
  // The days picked on each ticket, by product id.
  const [picked, setPicked] = useState<Record<string, string[]>>({});
  const [checkout, setCheckout] = useState<Checkout | null>(null);

  const { data: products, isLoading } = useQuery({
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

  // A pass needs at least two days to choose between.
  const list = useMemo(
    () =>
      (products ?? []).filter(
        (p) =>
          p.allow_game_pass && p.days.filter((d) => !isSoldOut(d)).length >= 2,
      ),
    [products],
  );

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

  const toggleAll = (product: TicketProductResponse) => {
    const open = product.days.filter((d) => !isSoldOut(d)).map((d) => d.event_day_id);
    const current = picked[product.id] ?? [];
    setPicked((prev) => ({
      ...prev,
      [product.id]: current.length === open.length ? [] : open,
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
                Choose your ticket, pick the match days you want and get one code
                that works on all of them.
              </p>
            </div>

            <TicketAccessCodeBox onApply={setAppliedCode} />
          </div>
        </section>

        <TicketFeatureStrip
          items={[
            { icon: TicketIcon, label: "Regular, VIP & VIP Plus" },
            { icon: CalendarDaysIcon, label: "Several match days. One pass." },
            { icon: TagIcon, label: "The more days, the more you save." },
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
            The more match days, the more you save
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

      {isLoading ? (
        <Spinner size="lg" className="py-16" label="Loading Game Passes…" />
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
            A Game Pass needs at least two match days on sale. You can still
            buy a ticket for a single day.
          </p>
          <ButtonLink
            to="/tickets"
            variant="navy"
            shape="square"
            className="mt-6"
          >
            Buy a single ticket
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
              const isHighlight = topPrice !== null && cheapest === topPrice;
              const isLowest = cheapestPrice !== null && cheapest === cheapestPrice;
              const variant = isHighlight ? "gold" : isLowest ? "outline" : "navy";
              const selectedIds = picked[product.id] ?? [];
              const selected = product.days.filter((d) =>
                selectedIds.includes(d.event_day_id),
              );
              const openCount = product.days.filter((d) => !isSoldOut(d)).length;

              // A preview of the saving while choosing. The server prices the
              // purchase itself.
              const perPerson = selected.reduce((sum, d) => sum + d.price, 0);
              const percent = gamePassPercentFor(selected.length, rules ?? []);
              const estimate = Math.round(perPerson * (1 - percent / 100));

              return (
                <TicketProductCard
                  key={product.id}
                  product={product}
                  position={index + 1}
                  highlight={isHighlight}
                >
                  <div className="flex items-center justify-between gap-3">
                    <h3
                      className={`text-[11px] font-black uppercase tracking-widest ${
                        isHighlight ? "text-white/60" : "text-gray-500 dark:text-gray-400"
                      }`}
                    >
                      Pick your match days
                    </h3>
                    <Button
                      variant="link"
                      size="sm"
                      tone={isHighlight ? "dark" : "light"}
                      onClick={() => toggleAll(product)}
                    >
                      {selectedIds.length === openCount
                        ? "Clear all"
                        : "Select all"}
                    </Button>
                  </div>
                  <TicketDayPicker
                    mode="multi"
                    name={`${product.name} match days`}
                    days={product.days}
                    selected={selectedIds}
                    tone={isHighlight ? "dark" : "light"}
                    onChange={(ids) =>
                      setPicked((prev) => ({ ...prev, [product.id]: ids }))
                    }
                  />

                  {selected.length >= 2 && (
                    <div
                      className={`flex items-baseline justify-between gap-3 border-t pt-3 ${
                        isHighlight ? "border-white/10" : "dark:border-gray-700"
                      }`}
                    >
                      <span className={`text-sm ${isHighlight ? "text-white/80" : "text-gray-600 dark:text-gray-300"}`}>
                        {selected.length} match days
                        {percent > 0 && (
                          <span
                            className={`ml-1 font-bold ${
                              isHighlight ? "text-emerald-300" : "text-emerald-600 dark:text-emerald-400"
                            }`}
                          >
                            ({percent}% off)
                          </span>
                        )}
                      </span>
                      <span className={`text-lg font-black ${isHighlight ? "text-white" : "text-sffl-navy dark:text-white"}`}>
                        {estimate === 0 ? "Free" : naira(estimate)}
                      </span>
                    </div>
                  )}

                  <Button
                    fullWidth
                    shape="square"
                    variant={variant}
                    disabled={selected.length < 2}
                    onClick={() => setCheckout({ product, days: selected })}
                  >
                    {selected.length < 2
                      ? "Pick at least 2 match days"
                      : "Get Game Pass"}
                  </Button>
                </TicketProductCard>
              );
            })}
          </div>
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
          purchaseType="GAME_PASS"
          accessCode={appliedCode}
          onClose={() => setCheckout(null)}
        />
      )}
    </div>
  );
};
