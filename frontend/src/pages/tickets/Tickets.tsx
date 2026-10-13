import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams, useOutletContext } from "react-router-dom";
import { getTicketProducts } from "../../services/api";
import type {
  TicketProductDayResponse,
  TicketProductResponse,
} from "../../types";
import {
  Button,
  ButtonLink,
  Spinner,
  FootballIcon,
  TicketCheckout,
  TicketDayPicker,
  TicketProductCard,
  isSoldOut,
  type GamedayStoreContext,
} from "../../components";
import {
  CalendarDaysIcon,
  ChevronDownIcon,
  TicketIcon,
} from "@heroicons/react/24/outline";

// Answers only describe what the purchase flow does today.
const FAQS = [
  {
    q: "How do I get my ticket?",
    a: "Your ticket is emailed to the address you enter at checkout. Free tickets are sent straight away. You also get a reminder the day before your match day.",
  },
  {
    q: "How do I pay?",
    a: "Paid tickets are paid securely through Paystack. You will be taken to Paystack to complete payment.",
  },
  {
    q: "Can I buy more than one ticket?",
    a: "Yes. Choose up to 10 tickets in a single purchase.",
  },
  {
    q: "Can I go to more than one match day?",
    a: "Yes. A Game Pass covers several match days with one code. Pick your days on the Game Pass page.",
  },
  {
    q: "What are the access and referral codes for?",
    a: "An access code, entered at the top of the page, shows tickets that are not listed by default. A referral code is optional and credits the person who referred you.",
  },
];

interface Checkout {
  product: TicketProductResponse;
  days: TicketProductDayResponse[];
}

export const Tickets = () => {
  const [searchParams] = useSearchParams();
  // A match card links here with ?date=, so that day starts picked.
  const dateParam = searchParams.get("date");
  const { appliedCode } = useOutletContext<GamedayStoreContext>();

  // The day picked on each ticket, by product id.
  const [picked, setPicked] = useState<Record<string, string[]>>({});
  const [checkout, setCheckout] = useState<Checkout | null>(null);

  const { data: products, isLoading } = useQuery({
    queryKey: ["publicTicketProducts", appliedCode],
    queryFn: () => getTicketProducts(appliedCode),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  const list = useMemo(() => products ?? [], [products]);

  // The most expensive ticket gets the navy card. Only meaningful with several.
  const topPrice = useMemo(() => {
    if (list.length < 2) return null;
    return Math.max(...list.map((p) => Math.min(...p.days.map((d) => d.price))));
  }, [list]);

  const hasPassOption = list.some(
    (p) => p.allow_game_pass && p.days.filter((d) => !isSoldOut(d)).length >= 2,
  );

  // What is picked for a ticket: the buyer's own choice, else the day from the
  // link, else the only day there is.
  const selectionFor = (product: TicketProductResponse): string[] => {
    const chosen = picked[product.id];
    if (chosen) return chosen;
    const open = product.days.filter((d) => !isSoldOut(d));
    if (open.length === 1) return [open[0].event_day_id];
    const fromLink = open.find((d) => d.event_date === dateParam);
    return fromLink ? [fromLink.event_day_id] : [];
  };

  const buy = (product: TicketProductResponse) => {
    const ids = selectionFor(product);
    const days = product.days.filter((d) => ids.includes(d.event_day_id));
    if (days.length === 1) setCheckout({ product, days });
  };

  const linkedDayMissing =
    !!dateParam &&
    !isLoading &&
    list.length > 0 &&
    !list.some((p) => p.days.some((d) => d.event_date === dateParam));

  return (
    <div className="space-y-8 md:space-y-12">
      {linkedDayMissing && (
        <div className="border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
          <strong className="font-bold">No tickets on sale for {dateParam}.</strong>{" "}
          Showing every upcoming match day instead.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-3 border border-red-500/20 bg-linear-to-r from-red-600/10 to-transparent p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4 dark:text-gray-200">
          <div className="min-w-0">
            <h2 className="flex items-center gap-1.5 text-sm font-bold">
              <FootballIcon
                className="h-4 w-4 shrink-0 text-sffl-red"
                aria-hidden="true"
              />
              Earn rewards by inviting friends!
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Generate a referral code and get payouts for every ticket sold.
            </p>
          </div>
          <ButtonLink
            to="/tickets/referrals"
            variant="primary"
            shape="square"
            className="shrink-0"
          >
            Get referral link
          </ButtonLink>
        </div>

        {hasPassOption && (
          <div className="flex flex-col gap-3 border border-sffl-navy/20 bg-linear-to-r from-sffl-navy/10 to-transparent p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4 dark:text-gray-200">
            <div className="min-w-0">
              <h2 className="flex items-center gap-1.5 text-sm font-bold">
                <CalendarDaysIcon
                  className="h-4 w-4 shrink-0 text-sffl-red"
                  aria-hidden="true"
                />
                Going to more than one match day?
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                A Game Pass covers the days you pick with one code.
              </p>
            </div>
            <ButtonLink
              to="/tickets/game-pass"
              variant="navy"
              shape="square"
              className="shrink-0"
            >
              Get a Game Pass
            </ButtonLink>
          </div>
        )}
      </div>

      {isLoading ? (
        <Spinner size="lg" className="py-16" label="Loading tickets…" />
      ) : list.length === 0 ? (
        <div className="border border-gray-200 bg-white px-4 py-16 text-center dark:border-gray-700 dark:bg-gray-800">
          <TicketIcon
            className="mx-auto mb-4 h-16 w-16 text-gray-400"
            aria-hidden="true"
          />
          <h2 className="mb-2 text-2xl font-black uppercase tracking-tight text-sffl-navy dark:text-white">
            No tickets on sale
          </h2>
          <p className="text-gray-500 dark:text-gray-400">
            Check back soon for new gameday schedules.
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
        <section aria-labelledby="choose-ticket">
          <h2
            id="choose-ticket"
            className="mb-4 text-[11px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400"
          >
            Choose your ticket
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((product) => {
              const cheapest = Math.min(...product.days.map((d) => d.price));
              const selected = selectionFor(product);
              const allSoldOut = product.days.every(isSoldOut);

              return (
                <TicketProductCard
                  key={product.id}
                  product={product}
                  highlight={topPrice !== null && cheapest === topPrice}
                >
                  <h3 className="text-[11px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">
                    Pick your match day
                  </h3>
                  <TicketDayPicker
                    mode="single"
                    name={`${product.name} match day`}
                    days={product.days}
                    selected={selected}
                    onChange={(ids) =>
                      setPicked((prev) => ({ ...prev, [product.id]: ids }))
                    }
                  />
                  <Button
                    fullWidth
                    shape="square"
                    variant="primary"
                    disabled={allSoldOut || selected.length !== 1}
                    onClick={() => buy(product)}
                  >
                    {allSoldOut
                      ? "Sold out"
                      : selected.length === 0
                        ? "Pick a match day"
                        : "Buy now"}
                  </Button>
                </TicketProductCard>
              );
            })}
          </div>
        </section>
      )}

      {/* Before the whistle: answers to the questions buyers ask most. */}
      <section className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] md:gap-12">
        <div className="space-y-2">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-sffl-red">
            Good to know
          </p>
          <h2 className="text-2xl font-black tracking-tight text-sffl-navy sm:text-3xl dark:text-white">
            Before the whistle.
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
          purchaseType="SINGLE"
          accessCode={appliedCode}
          onClose={() => setCheckout(null)}
        />
      )}
    </div>
  );
};
