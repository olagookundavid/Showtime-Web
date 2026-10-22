import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";

interface FantasyLinksCarouselProps {
  children: ReactNode;
}

/** The Fantasy hero's CTA row as a slider, replicating AboutNavCarousel:
 *  arrow buttons page through the links, which also scroll natively
 *  (touch/trackpad) — so the row never wraps onto a second line, even on
 *  narrow screens. Each child must carry `shrink-0` so it keeps its natural
 *  width inside the scroller instead of being squeezed. */
export const FantasyLinksCarousel = ({ children }: FantasyLinksCarouselProps) => {
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
    // Re-measure when the button set itself changes (entered vs. not entered).
  }, [updateArrows, children]);

  const slide = (direction: 1 | -1) => {
    scrollRef.current?.scrollBy({ left: direction * 220, behavior: "smooth" });
  };

  return (
    <div className="relative mt-6 border-t border-white/15 pt-5">
      {/* Arrow styling replicates AboutNavCarousel / LatestMatchesCarousel exactly, for consistency. */}
      <button
        type="button"
        onClick={() => slide(-1)}
        className={`group/arrow absolute left-0 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center transition-opacity duration-200 ${
          canScrollLeft ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        aria-label="Scroll to previous links"
      >
        <span className="rounded-full border border-white/20 bg-sffl-navy/95 p-1.5 text-white shadow-lg transition-all duration-200 group-hover/arrow:scale-110 group-hover/arrow:bg-sffl-red group-active/arrow:scale-95">
          <ChevronLeftIcon className="h-3 w-3" strokeWidth={2.5} aria-hidden="true" />
        </span>
      </button>
      <div
        ref={scrollRef}
        className="no-scrollbar flex scroll-smooth items-center gap-2.5 sm:gap-3 overflow-x-auto px-11"
      >
        {children}
      </div>
      <button
        type="button"
        onClick={() => slide(1)}
        className={`group/arrow absolute right-0 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center transition-opacity duration-200 ${
          canScrollRight ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        aria-label="Scroll to more links"
      >
        <span className="rounded-full border border-white/20 bg-sffl-navy/95 p-1.5 text-white shadow-lg transition-all duration-200 group-hover/arrow:scale-110 group-hover/arrow:bg-sffl-red group-active/arrow:scale-95">
          <ChevronRightIcon className="h-3 w-3" strokeWidth={2.5} aria-hidden="true" />
        </span>
      </button>
    </div>
  );
};
