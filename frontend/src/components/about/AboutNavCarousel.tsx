import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import { navLinkClass } from "../ui";
import { ABOUT_NAV } from "./aboutNav";

interface AboutNavCarouselProps {
  activeTo: string;
}

/** The hero's section nav as a slider: arrow buttons page through the 11 About links, which also scroll natively (touch/trackpad). */
export const AboutNavCarousel = ({ activeTo }: AboutNavCarouselProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateArrows = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateArrows();
    el.addEventListener("scroll", updateArrows, { passive: true });
    window.addEventListener("resize", updateArrows);
    return () => {
      el.removeEventListener("scroll", updateArrows);
      window.removeEventListener("resize", updateArrows);
    };
  }, [updateArrows]);

  // Keeps the current page's link in view, e.g. landing straight on a page
  // whose link sits further along the strip than what's initially visible.
  useEffect(() => {
    const link = scrollRef.current?.querySelector<HTMLAnchorElement>(
      `a[href="${activeTo}"]`,
    );
    link?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [activeTo]);

  const slide = (direction: 1 | -1) => {
    scrollRef.current?.scrollBy({ left: direction * 220, behavior: "smooth" });
  };

  return (
    <div className="relative mt-6 border-t border-white/15 pt-5">
      {/* Arrow styling replicates LatestMatchesCarousel exactly, for consistency. */}
      <button
        type="button"
        onClick={() => slide(-1)}
        className={`group/arrow absolute left-0 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center transition-opacity duration-200 ${
          canScrollLeft ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        aria-label="Scroll to previous links"
      >
        <span className="rounded-full border border-white/20 bg-sffl-navy/95 p-1.5 text-white shadow-lg transition-all duration-200 group-hover/arrow:scale-110 group-hover/arrow:bg-sffl-red group-active/arrow:scale-95 dark:bg-gray-800/95">
          <ChevronLeftIcon className="h-3 w-3" strokeWidth={2.5} aria-hidden="true" />
        </span>
      </button>
      <div
        ref={scrollRef}
        className="no-scrollbar flex scroll-smooth gap-x-6 overflow-x-auto px-11 text-xs font-bold uppercase tracking-wide"
      >
        {ABOUT_NAV.map((item) => {
          const isActive = item.to === activeTo;
          return (
            <Link
              key={item.to}
              to={item.to}
              aria-current={isActive ? "page" : undefined}
              className={`shrink-0 ${navLinkClass(isActive)}`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => slide(1)}
        className={`group/arrow absolute right-0 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center transition-opacity duration-200 ${
          canScrollRight ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        aria-label="Scroll to more links"
      >
        <span className="rounded-full border border-white/20 bg-sffl-navy/95 p-1.5 text-white shadow-lg transition-all duration-200 group-hover/arrow:scale-110 group-hover/arrow:bg-sffl-red group-active/arrow:scale-95 dark:bg-gray-800/95">
          <ChevronRightIcon className="h-3 w-3" strokeWidth={2.5} aria-hidden="true" />
        </span>
      </button>
    </div>
  );
};
