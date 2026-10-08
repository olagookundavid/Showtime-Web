import { useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import { Button, Input } from "../ui";
import { ModeSelectorCards, type GamedayStoreMode } from "./ModeSelectorCards";

export interface GamedayStoreContext {
  appliedCode?: string;
}

const FAQS = [
  {
    q: "What is the difference between the three options?",
    a: "A Ticket covers one selected gameday. A Game Pass bundles multiple selected gamedays with a graduated discount. A Season Pass covers the eligible season and includes credits, arena and lounge benefits, plus an event-hosting entitlement.",
  },
  {
    q: "How does the Game Pass discount work?",
    a: "The more gamedays you bundle into one Game Pass, the bigger the discount: 5% off for 2-3 gamedays, 10% off for 4-5, and 15% off for 6 or more.",
  },
  {
    q: "Are Season Pass benefits available in every tier?",
    a: "Season Pass is launching soon. Every tier will include arena and lounge benefits plus an event-hosting entitlement once it is available.",
  },
  {
    q: "What does the lounge event entitlement cover?",
    a: "Season Pass holders get the right to host an event at Showtime Lounge. Full terms will be confirmed when Season Pass launches.",
  },
  {
    q: "Does a ticket cover one fixture or a full gameday?",
    a: "A ticket covers the whole gameday, including every fixture scheduled on it — not just one match.",
  },
];

/**
 * Shared chrome for the Gameday store: the existing hero (unchanged), the
 * Season Pass / Game Pass / Tickets mode selector, and — since their content
 * doesn't depend on which tab is active — the Season Pass promo band and FAQ.
 * Tickets and GamePass render inside the Outlet.
 */
export const GamedayStoreLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const [accessCode, setAccessCode] = useState("");
  const [appliedCode, setAppliedCode] = useState<string | undefined>(undefined);

  const mode: GamedayStoreMode = location.pathname.startsWith("/tickets/game-pass")
    ? "game-pass"
    : "tickets";

  const handleSelectMode = (next: GamedayStoreMode) => {
    const target = next === "game-pass" ? "/tickets/game-pass" : "/tickets";
    if (target === location.pathname) return;
    navigate({ pathname: target, search: location.search });
  };

  return (
    <div className="space-y-8 md:space-y-12">
      {/* Hero: unchanged from the original ticket page — the headline, plus the access-code box that unlocks hidden tiers. */}
      <section className="bg-sffl-navy text-white">
        <div className="flex flex-col gap-8 px-5 py-10 sm:px-8 sm:py-14 lg:flex-row lg:items-end lg:justify-between lg:px-12 lg:py-16">
          <div className="min-w-0 space-y-5">
            <p className="flex items-center gap-3 text-[11px] font-black uppercase tracking-[0.25em] text-white/80">
              <span className="h-px w-8 bg-sffl-red" aria-hidden="true" />
              Gameday tickets
            </p>
            <h1 className="text-4xl font-black uppercase leading-[0.95] tracking-tight sm:text-5xl lg:text-6xl">
              Don&apos;t just watch.
              <span className="block text-sffl-red">Be there.</span>
            </h1>
            <p className="max-w-md text-sm text-white/85 sm:text-base">
              Pick your gameday, choose your tier and get your ticket by email.
            </p>
          </div>

          <div className="w-full bg-white/10 p-4 lg:w-80">
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-200">
              Access code?
            </p>
            <div className="flex gap-2">
              <Input
                tone="dark"
                shape="square"
                type="text"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
                placeholder="CODE"
                aria-label="Access code"
                className="min-w-0 flex-1"
              />
              <Button
                tone="dark"
                variant="secondary"
                shape="square"
                className="shrink-0"
                onClick={() => setAppliedCode(accessCode.trim())}
              >
                Apply
              </Button>
            </div>
          </div>
        </div>
      </section>

      <div className="space-y-4">
        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-sffl-red">
          Your way into Showtime
        </p>
        <h2 className="text-2xl font-black tracking-tight text-sffl-navy sm:text-3xl dark:text-white">
          Make every gameday yours.
        </h2>
        <ModeSelectorCards mode={mode} onSelect={handleSelectMode} />
      </div>

      <Outlet context={{ appliedCode } as GamedayStoreContext} />

      {/* Season Pass Privileges: static promo — Season Pass itself isn't live yet. */}
      <section className="grid grid-cols-1 items-center gap-8 bg-gray-50 p-6 dark:bg-gray-800/40 sm:p-8 lg:grid-cols-2 lg:p-12">
        <div className="space-y-4">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-sffl-red">
            Season Pass privileges
          </p>
          <h2 className="text-2xl font-black tracking-tight text-sffl-navy sm:text-3xl dark:text-white">
            Your season goes beyond the game.
          </h2>
          <p className="max-w-md text-sm text-gray-600 dark:text-gray-300">
            Enjoy credits, arena and lounge benefits — and the right to host an event at Showtime
            Lounge. Every Season Pass tier brings you closer to the experience.
          </p>
          <Button variant="outline" shape="square" disabled title="Season Pass is coming soon">
            Explore Season Passes
          </Button>
        </div>
        <div className="flex h-48 items-center justify-center bg-sffl-navy text-center text-white sm:h-64">
          <div className="space-y-1">
            <p className="text-xs font-black uppercase tracking-[0.3em] text-sffl-gold">
              Showtime Lounge
            </p>
            <p className="text-lg font-black uppercase tracking-tight">Make it your occasion.</p>
          </div>
        </div>
      </section>

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
              <p className="pb-4 text-sm text-gray-600 dark:text-gray-300">{item.a}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
};
