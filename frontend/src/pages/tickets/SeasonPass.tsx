import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getSeasonPasses } from "../../services/api";
import type { SeasonPassResponse } from "../../types";
import {
  Button,
  SeasonPassCheckout,
  Spinner,
  TicketFeatureStrip,
  formatDayLong,
  naira,
  perksOf,
  taglineOf,
} from "../../components";
import {
  ArrowRightIcon,
  CalendarDaysIcon,
  ChevronDownIcon,
  CheckIcon,
  SparklesIcon,
  StarIcon,
} from "@heroicons/react/24/outline";

const FAQS = [
  {
    q: "What is a Season Pass?",
    a: "One pass, one price, valid every match day until its end date. No need to pick days — just show your code at the gate whenever you come.",
  },
  {
    q: "How is this different from a Game Pass?",
    a: "A Game Pass covers the specific match days you choose. A Season Pass covers every match day up to its end date, for one flat price.",
  },
  {
    q: "Can I use it more than once a day?",
    a: "Yes. Being scanned in twice on the same day is never a problem.",
  },
  {
    q: "What happens after the end date?",
    a: "The pass stops working. Check the end date on each pass before buying.",
  },
];

/** A season pass card: name, price, end date, and perks parsed from its description. */
const SeasonPassTile = ({
  pass,
  onSelect,
}: {
  pass: SeasonPassResponse;
  onSelect: () => void;
}) => {
  const tagline = taglineOf(pass.description);
  const perks = perksOf(pass.description);

  return (
    <article className="flex flex-col border border-gray-200 bg-white text-sffl-navy dark:border-gray-700 dark:bg-gray-900 dark:text-white">
      <div className="flex min-h-72 flex-1 flex-col gap-4 p-6 sm:p-8">
        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-sffl-red">
          {pass.name}
        </p>

        <div>
          <p className="text-4xl font-black leading-none sm:text-5xl">
            {pass.price === 0 ? "Free" : naira(pass.price)}
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
            <CalendarDaysIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Valid through {formatDayLong(pass.ends_on)}
          </p>
        </div>

        {tagline && (
          <p className="text-sm text-gray-600 dark:text-gray-300">{tagline}</p>
        )}

        {perks.length > 0 && (
          <ul className="flex-1 space-y-3">
            {perks.map((perk) => (
              <li key={perk} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
                <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-sffl-red" aria-hidden="true" />
                <span className="min-w-0 wrap-break-word">{perk}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-3 bg-white p-5 text-sffl-navy dark:bg-gray-800 dark:text-white sm:p-6">
        <Button
          fullWidth
          shape="square"
          variant="navy"
          icon={ArrowRightIcon}
          iconPosition="right"
          onClick={onSelect}
        >
          Choose {pass.name}
        </Button>
      </div>
    </article>
  );
};

export const SeasonPass = () => {
  const [checkoutPass, setCheckoutPass] = useState<SeasonPassResponse | null>(null);

  const { data: passes, isLoading } = useQuery({
    queryKey: ["seasonPasses"],
    queryFn: getSeasonPasses,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  const list = passes ?? [];

  return (
    <div className="space-y-8 md:space-y-12">
      <div>
        <section className="bg-sffl-navy text-white">
          <div className="flex flex-col gap-8 px-5 py-10 sm:px-8 sm:py-14 lg:flex-row lg:items-end lg:justify-between lg:px-12 lg:py-16">
            <div className="min-w-0 space-y-5">
              <p className="flex items-center gap-3 text-[11px] font-black uppercase tracking-[0.25em] text-white/80">
                <span className="h-px w-8 bg-sffl-red" aria-hidden="true" />
                Season Pass
              </p>
              <h1 className="text-4xl font-black uppercase leading-[0.95] tracking-tight sm:text-5xl lg:text-6xl">
                All season.
                <span className="block text-sffl-red">One price.</span>
              </h1>
              <p className="max-w-md text-sm text-white/85 sm:text-base">
                Buy once, show up whenever. One code gets you in on every match
                day until the pass ends.
              </p>
            </div>
          </div>
        </section>

        <TicketFeatureStrip
          items={[
            { icon: StarIcon, label: "One fixed price" },
            { icon: CalendarDaysIcon, label: "Every match day until it ends" },
            { icon: SparklesIcon, label: "No days to pick" },
          ]}
          className="mt-3"
        />
      </div>

      {isLoading ? (
        <Spinner size="lg" className="py-16" label="Loading Season Passes…" />
      ) : list.length === 0 ? (
        <div className="border border-gray-200 bg-white px-4 py-16 text-center dark:border-gray-700 dark:bg-gray-800">
          <StarIcon className="mx-auto mb-4 h-16 w-16 text-gray-400" aria-hidden="true" />
          <h2 className="mb-2 text-2xl font-black uppercase tracking-tight text-sffl-navy dark:text-white">
            No Season Passes available yet
          </h2>
          <p className="text-gray-500 dark:text-gray-400">
            Check back soon, or get a Game Pass for the match days you already
            know you're coming to.
          </p>
        </div>
      ) : (
        <section aria-labelledby="choose-season-pass">
          <h2
            id="choose-season-pass"
            className="mb-4 text-[11px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400"
          >
            Choose your pass
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((pass) => (
              <SeasonPassTile
                key={pass.id}
                pass={pass}
                onSelect={() => setCheckoutPass(pass)}
              />
            ))}
          </div>
        </section>
      )}

      <section className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] md:gap-12">
        <div className="space-y-2">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-sffl-red">
            Good to know
          </p>
          <h2 className="text-2xl font-black tracking-tight text-sffl-navy sm:text-3xl dark:text-white">
            How a Season Pass works.
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

      {checkoutPass && (
        <SeasonPassCheckout
          pass={checkoutPass}
          onClose={() => setCheckoutPass(null)}
        />
      )}
    </div>
  );
};
