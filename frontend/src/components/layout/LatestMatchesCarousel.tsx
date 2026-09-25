import { useQuery } from "@tanstack/react-query";
import { useRef, useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { getMatches, type Match } from "../../services/api";
import { Loader } from "../ui/Loader";
import { formatMatchTime } from "../../utils/dateUtils";

// Shared query — React Query dedupes by key so the carousel and info strip
// don't double-fetch when both are on the page.
const useLatestFinishedMatches = () =>
  useQuery({
    queryKey: ["publicMatches", "FINISHED", 10],
    queryFn: () => getMatches(undefined, 1, 10, "FINISHED"),
    staleTime: 60_000,
  });

// Fetch upcoming matches so we can sort soonest-first ourselves
const useUpcomingMatches = () =>
  useQuery({
    queryKey: ["publicMatches", "SCHEDULED", 10],
    queryFn: () => getMatches(undefined, 1, 10, "SCHEDULED"),
    staleTime: 60_000,
  });

const soonestFirst = (matches: Match[]) =>
  [...matches].sort((a, b) => {
    const aTime = new Date(
      `${a.date?.split("T")[0]}T${(a.start_time || "00:00:00").split("T").pop()}`,
    ).getTime();
    const bTime = new Date(
      `${b.date?.split("T")[0]}T${(b.start_time || "00:00:00").split("T").pop()}`,
    ).getTime();
    return aTime - bTime;
  });

const latestFirst = (matches: Match[]) =>
  [...matches].sort((a, b) => {
    const aTime = new Date(
      `${a.date?.split("T")[0]}T${(a.start_time || "00:00:00").split("T").pop()}`,
    ).getTime();
    const bTime = new Date(
      `${b.date?.split("T")[0]}T${(b.start_time || "00:00:00").split("T").pop()}`,
    ).getTime();
    return bTime - aTime;
  });

/**
 * Builds the header match strip's content:
 * 5 forward (upcoming, soonest first) and 5 played (finished, latest first).
 */
const useHeaderMatches = () => {
  const { data: finishedMatchesData, isLoading: loadingFinished } =
    useLatestFinishedMatches();
  const { data: upcomingMatchesData, isLoading: loadingUpcoming } =
    useUpcomingMatches();

  const finished = finishedMatchesData?.data || [];
  const upcoming = soonestFirst(upcomingMatchesData?.data || []);
  const recentFinished = latestFirst(finished);

  const forwardMatches = upcoming.slice(0, 5);
  const playedMatches = recentFinished.slice(0, 5);

  let matches: Match[] = [];
  if (forwardMatches.length === 0) {
    matches = recentFinished.slice(0, 10);
  } else if (playedMatches.length === 0) {
    matches = upcoming.slice(0, 10);
  } else {
    matches = [...forwardMatches, ...playedMatches];
  }

  return { matches, isLoading: loadingFinished || loadingUpcoming };
};

/**
 * The scrolling tile row of 5 upcoming (forward) + 5 played finished matches.
 * Uniform styling across all match cards.
 */
export const LatestMatchesCarousel = () => {
  const { matches, isLoading } = useHeaderMatches();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  // Touch swipe tracking to distinguish tap from slide
  const touchStartXRef = useRef(0);
  const touchStartYRef = useRef(0);
  const isSwipingRef = useRef(false);

  // Mouse drag-to-scroll tracking (for desktop & mobile emulation)
  const isMouseDownRef = useRef(false);
  const mouseStartXRef = useRef(0);
  const mouseScrollLeftRef = useRef(0);
  const hasMouseDraggedRef = useRef(false);

  const updateScrollButtons = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 6);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 6);
  }, []);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    updateScrollButtons();
    el.addEventListener("scroll", updateScrollButtons, { passive: true });
    window.addEventListener("resize", updateScrollButtons);
    return () => {
      el.removeEventListener("scroll", updateScrollButtons);
      window.removeEventListener("resize", updateScrollButtons);
    };
  }, [matches, updateScrollButtons]);

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isMouseDownRef.current) {
        isMouseDownRef.current = false;
        if (hasMouseDraggedRef.current) {
          setTimeout(() => {
            hasMouseDraggedRef.current = false;
          }, 120);
        }
      }
    };
    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => window.removeEventListener("mouseup", handleGlobalMouseUp);
  }, []);

  const scrollLeft = () => {
    scrollContainerRef.current?.scrollBy({ left: -240, behavior: "smooth" });
  };

  const scrollRight = () => {
    scrollContainerRef.current?.scrollBy({ left: 240, behavior: "smooth" });
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
    isSwipingRef.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const dx = Math.abs(e.touches[0].clientX - touchStartXRef.current);
    const dy = Math.abs(e.touches[0].clientY - touchStartYRef.current);
    if (dx > 6 && dx > dy) {
      isSwipingRef.current = true;
    }
  };

  const handleTouchEnd = () => {
    if (isSwipingRef.current) {
      setTimeout(() => {
        isSwipingRef.current = false;
      }, 150);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    isMouseDownRef.current = true;
    hasMouseDraggedRef.current = false;
    mouseStartXRef.current = e.pageX;
    mouseScrollLeftRef.current = scrollContainerRef.current?.scrollLeft || 0;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isMouseDownRef.current || !scrollContainerRef.current) return;
    const dx = e.pageX - mouseStartXRef.current;
    if (Math.abs(dx) > 4) {
      hasMouseDraggedRef.current = true;
      scrollContainerRef.current.scrollLeft = mouseScrollLeftRef.current - dx;
    }
  };

  const handleMouseUpOrLeave = () => {
    isMouseDownRef.current = false;
    if (hasMouseDraggedRef.current) {
      setTimeout(() => {
        hasMouseDraggedRef.current = false;
      }, 120);
    }
  };

  const handleClickCapture = (e: React.MouseEvent) => {
    if (isSwipingRef.current || hasMouseDraggedRef.current) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  if (isLoading) {
    return (
      <div className="w-full bg-sffl-navy border-b border-white/10 dark:bg-black h-14 flex items-center justify-center">
        <Loader />
      </div>
    );
  }

  if (matches.length === 0) {
    return null;
  }

  return (
    <div className="w-full bg-sffl-navy border-b border-white/10 dark:bg-black relative select-none">
      <div className="max-w-shell mx-auto relative px-1 sm:px-4 flex flex-col justify-center">
        <div className="relative flex items-center h-13 sm:h-14 w-full">
          {/* Left Arrow */}
          <button
            onClick={scrollLeft}
            className={`flex absolute left-0.5 sm:left-1 top-1/2 -translate-y-1/2 z-20 bg-sffl-navy/95 dark:bg-gray-800/95 hover:bg-sffl-red text-white p-1.5 sm:p-1 rounded-full shadow-lg transition-all duration-200 items-center justify-center cursor-pointer border border-white/20 hover:scale-110 active:scale-95 ${
              canScrollLeft ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
            aria-label="Scroll left"
          >
            <svg
              className="w-3 h-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>

          {/* Scroll Container */}
          <div
            ref={scrollContainerRef}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseUpOrLeave}
            onMouseUp={handleMouseUpOrLeave}
            onClickCapture={handleClickCapture}
            className="flex overflow-x-auto gap-2 py-1 px-7 sm:px-8 md:px-10 no-scrollbar w-full h-full items-center touch-pan-x overscroll-x-contain cursor-grab active:cursor-grabbing select-none"
            style={{
              WebkitOverflowScrolling: "touch",
              scrollbarWidth: "none",
              msOverflowStyle: "none",
            }}
          >
            {matches.map((match) => {
              const isLive = match.status === "LIVE";
              // A knockout match with exactly one team is a bye — show "BYE"
              // on the empty side instead of the raw T1/T2 placeholder.
              const isBye =
                match.competition?.format === "PLAYOFFS" &&
                ((!!match.home_team?.id && !match.away_team?.id) ||
                  (!match.home_team?.id && !!match.away_team?.id));
              return (
                <Link
                  key={match.id}
                  to={`/matches/${match.id}`}
                  draggable={false}
                  className="flex-none w-28.5 sm:w-30 rounded-lg px-2 py-1 flex items-center justify-between gap-1.5 transition-all duration-300 cursor-pointer group h-9.5 sm:h-10 bg-white/5 dark:bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 select-none"
                >
                  <div className="flex flex-col justify-center gap-0.5 flex-1 min-w-0">
                    {/* Home Team */}
                    <div className="flex items-center gap-1 min-w-0 h-3.5 sm:h-3.75">
                      {!match.home_team?.id && isBye ? (
                        <span className="font-bold text-[9px] text-gray-400 italic uppercase truncate">
                          BYE
                        </span>
                      ) : (
                        <>
                          {match.home_team?.logo ? (
                            <img
                              src={match.home_team.logo}
                              alt={
                                match.home_team.short_name ||
                                match.home_team.name
                              }
                              draggable={false}
                              className="w-3 h-3 sm:w-3.5 sm:h-3.5 object-contain shrink-0 pointer-events-none select-none"
                            />
                          ) : (
                            <span className="w-3 h-3 sm:w-3.5 sm:h-3.5 bg-white/10 rounded flex items-center justify-center text-[7.5px] text-gray-400 shrink-0">
                              T1
                            </span>
                          )}
                          <span
                            className="font-bold text-[9.5px] sm:text-[10px] text-white truncate leading-none"
                            title={match.home_team?.name}
                          >
                            {match.home_team?.short_name ||
                              match.home_team?.name}
                          </span>
                        </>
                      )}
                    </div>
                    {/* Away Team */}
                    <div className="flex items-center gap-1 min-w-0 h-3.5 sm:h-3.75">
                      {!match.away_team?.id && isBye ? (
                        <span className="font-bold text-[9px] text-gray-400 italic uppercase truncate">
                          BYE
                        </span>
                      ) : (
                        <>
                          {match.away_team?.logo ? (
                            <img
                              src={match.away_team.logo}
                              alt={
                                match.away_team.short_name ||
                                match.away_team.name
                              }
                              draggable={false}
                              className="w-3 h-3 sm:w-3.5 sm:h-3.5 object-contain shrink-0 pointer-events-none select-none"
                            />
                          ) : (
                            <span className="w-3 h-3 sm:w-3.5 sm:h-3.5 bg-white/10 rounded flex items-center justify-center text-[7.5px] text-gray-400 shrink-0">
                              T2
                            </span>
                          )}
                          <span
                            className="font-bold text-[9.5px] sm:text-[10px] text-white truncate leading-none"
                            title={match.away_team?.name}
                          >
                            {match.away_team?.short_name ||
                              match.away_team?.name}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  {/* Action / Status / Score Column */}
                  {match.status === "FINISHED" ? (
                    <div className="flex flex-col justify-center shrink-0 border-l border-white/10 pl-1 sm:pl-1.5 text-right min-w-3.5 sm:min-w-4 gap-0.5">
                      <span className="font-black text-[9.5px] sm:text-[10px] text-white/95 tabular-nums leading-none h-3.5 sm:h-3.75 flex items-center justify-end">
                        {match.home_score ?? 0}
                      </span>
                      <span className="font-black text-[9.5px] sm:text-[10px] text-white/95 tabular-nums leading-none h-3.5 sm:h-3.75 flex items-center justify-end">
                        {match.away_score ?? 0}
                      </span>
                    </div>
                  ) : isLive ? (
                    <div className="flex flex-col items-center justify-center shrink-0 border-l border-white/10 pl-1 sm:pl-1.5 text-center min-w-5.5 sm:min-w-6.5">
                      <span className="bg-sffl-red text-white text-[6.5px] sm:text-[7px] font-black uppercase px-1 py-0.5 rounded animate-pulse">
                        LIVE
                      </span>
                    </div>
                  ) : isBye ? (
                    <div className="flex flex-col items-center justify-center shrink-0 border-l border-white/10 pl-1 sm:pl-1.5 text-center min-w-5.5 sm:min-w-6.5">
                      <span className="text-[7px] font-black text-emerald-400 uppercase">
                        BYE
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center shrink-0 border-l border-white/10 pl-1 sm:pl-1.5 text-center min-w-6.5 sm:min-w-7.5 leading-tight gap-0.5">
                      <span className="text-[7.5px] sm:text-[8px] font-bold text-gray-300 whitespace-nowrap">
                        {match.date
                          ? new Date(match.date).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                            })
                          : ""}
                      </span>
                      {match.start_time &&
                        formatMatchTime(match.start_time) !== "TBD" && (
                          <span className="text-[6.5px] sm:text-[7px] font-medium text-gray-400 whitespace-nowrap">
                            {formatMatchTime(match.start_time)}
                          </span>
                        )}
                    </div>
                  )}
                </Link>
              );
            })}
          </div>

          {/* Right Arrow */}
          <button
            onClick={scrollRight}
            className={`flex absolute right-0.5 sm:right-1 top-1/2 -translate-y-1/2 z-20 bg-sffl-navy/95 dark:bg-gray-800/95 hover:bg-sffl-red text-white p-1.5 sm:p-1 rounded-full shadow-lg transition-all duration-200 items-center justify-center cursor-pointer border border-white/20 hover:scale-110 active:scale-95 ${
              canScrollRight ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
            aria-label="Scroll right"
          >
            <svg
              className="w-3 h-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * The "LATEST RESULTS · Competition · Date  Watch Highlights | View All →"
 * info strip that previously sat directly under the carousel. Home page only,
 * and intentionally NOT sticky so it scrolls away with the rest of the page.
 */
export const LatestMatchesInfoStrip = () => {
  const { data: finishedMatchesData } = useLatestFinishedMatches();
  const matches = finishedMatchesData?.data || [];

  if (matches.length === 0) return null;

  const latestMatch = matches[0];
  const resultsViewAllHref = latestMatch?.competition?.id
    ? `/matches?comp=${latestMatch.competition.id}`
    : "/matches";

  return (
    <div className="w-full bg-sffl-navy border-b border-white/10 dark:bg-black select-none">
      <div className="max-w-shell mx-auto px-2 sm:px-8">
        <div className="flex items-center justify-between border-t border-white/5 py-1.5 px-2 sm:px-4 w-full">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[7.5px] sm:text-[9px] md:text-[10px] font-black tracking-widest text-white/95 uppercase whitespace-nowrap">
              LATEST RESULTS
            </span>
            {latestMatch?.competition && (
              <>
                <span className="text-white/20 text-[7px] sm:text-[9px]">
                  •
                </span>
                <span className="text-[6.5px] sm:text-[8px] md:text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider truncate max-w-37.5 sm:max-w-none">
                  {latestMatch.competition.name}
                </span>
                {latestMatch.date && (
                  <>
                    <span className="text-white/20 text-[7px] sm:text-[9px]">
                      •
                    </span>
                    <span className="text-[6.5px] sm:text-[8px] md:text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      {new Date(latestMatch.date).toLocaleDateString(
                        undefined,
                        { month: "short", day: "numeric" },
                      )}
                    </span>
                  </>
                )}
              </>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href="https://www.youtube.com/@ShowtimeFlagFootball/streams"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 bg-[#FF0000] hover:bg-[#CC0000] text-white text-[7.5px] sm:text-[8.5px] md:text-[9px] font-black uppercase tracking-wider px-3.5 py-1 rounded shadow-sm transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer whitespace-nowrap"
            >
              <svg className="w-2.5 h-2.5 fill-current" viewBox="0 0 24 24">
                <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816-.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 4-8 4z" />
              </svg>
              <span>Watch Highlights</span>
            </a>
            <Link
              to={resultsViewAllHref}
              className="hidden sm:inline text-[7.5px] sm:text-[8.5px] md:text-[9px] font-black uppercase tracking-wider text-sffl-red hover:text-white transition-colors"
            >
              View All &rarr;
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
