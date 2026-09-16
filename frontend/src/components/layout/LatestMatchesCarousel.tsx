import { useQuery } from '@tanstack/react-query';
import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { getMatches, type Match } from '../../services/api';
import { Loader } from '../ui/Loader';
import { formatMatchTime } from '../../utils/dateUtils';

// Shared query — React Query dedupes by key so the carousel and info strip
// don't double-fetch when both are on the page.
const useLatestFinishedMatches = () => useQuery({
    queryKey: ['publicMatches', 'FINISHED', 10],
    queryFn: () => getMatches(undefined, 1, 10, 'FINISHED'),
    staleTime: 60_000,
});

// Fetch upcoming matches so we can sort soonest-first ourselves
const useUpcomingMatches = () => useQuery({
    queryKey: ['publicMatches', 'SCHEDULED', 10],
    queryFn: () => getMatches(undefined, 1, 10, 'SCHEDULED'),
    staleTime: 60_000,
});

const soonestFirst = (matches: Match[]) =>
    [...matches].sort((a, b) => {
        const aTime = new Date(`${a.date?.split('T')[0]}T${(a.start_time || '00:00:00').split('T').pop()}`).getTime();
        const bTime = new Date(`${b.date?.split('T')[0]}T${(b.start_time || '00:00:00').split('T').pop()}`).getTime();
        return aTime - bTime;
    });

const latestFirst = (matches: Match[]) =>
    [...matches].sort((a, b) => {
        const aTime = new Date(`${a.date?.split('T')[0]}T${(a.start_time || '00:00:00').split('T').pop()}`).getTime();
        const bTime = new Date(`${b.date?.split('T')[0]}T${(b.start_time || '00:00:00').split('T').pop()}`).getTime();
        return bTime - aTime;
    });

/**
 * Builds the header match strip's content:
 * 5 forward (upcoming, soonest first) and 5 played (finished, latest first).
 */
const useHeaderMatches = () => {
    const { data: finishedMatchesData, isLoading: loadingFinished } = useLatestFinishedMatches();
    const { data: upcomingMatchesData, isLoading: loadingUpcoming } = useUpcomingMatches();

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

    const scrollLeft = () => {
        scrollContainerRef.current?.scrollBy({ left: -260, behavior: 'smooth' });
    };

    const scrollRight = () => {
        scrollContainerRef.current?.scrollBy({ left: 260, behavior: 'smooth' });
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
                <div className="relative flex items-center h-[52px] sm:h-[56px] w-full">
                    {/* Left Arrow */}
                    <button
                        onClick={scrollLeft}
                        className="hidden sm:flex absolute left-0.5 sm:left-1 top-1/2 -translate-y-1/2 z-20 bg-white/10 hover:bg-sffl-red hover:scale-105 text-white p-1 rounded-full shadow-lg transition-all duration-300 items-center justify-center cursor-pointer"
                        aria-label="Scroll left"
                    >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>

                    {/* Left Blur/Fade Overlay */}
                    <div className="hidden sm:block absolute left-0 top-0 bottom-0 w-6 sm:w-8 bg-gradient-to-r from-sffl-navy dark:from-black to-transparent pointer-events-none z-10" />

                    {/* Scroll Container */}
                    <div
                        ref={scrollContainerRef}
                        className="flex overflow-x-auto gap-2 py-1 px-6 sm:px-8 md:px-10 snap-x snap-mandatory scroll-px-6 sm:scroll-px-8 md:scroll-px-10 no-scrollbar w-full h-full items-center"
                    >
                        {matches.map(match => {
                            const isLive = match.status === 'LIVE';
                            // A knockout match with exactly one team is a bye — show "BYE"
                            // on the empty side instead of the raw T1/T2 placeholder.
                            const isBye = match.competition?.format === 'KNOCKOUT' &&
                                ((!!match.home_team?.id && !match.away_team?.id) ||
                                 (!match.home_team?.id && !!match.away_team?.id));
                            return (
                                <Link
                                    key={match.id}
                                    to={`/matches/${match.id}`}
                                    className="flex-none w-[92px] sm:w-[98px] rounded-lg px-1.5 py-1 flex items-center justify-between gap-1 transition-all duration-300 snap-center cursor-pointer group h-[38px] sm:h-[40px] bg-white/5 dark:bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20"
                                >
                                    <div className="flex flex-col justify-center gap-0.5 flex-1 min-w-0">
                                        {/* Home Team */}
                                        <div className="flex items-center gap-1 min-w-0 h-[14px] sm:h-[15px]">
                                            {!match.home_team?.id && isBye ? (
                                                <span className="font-bold text-[9px] text-gray-400 italic uppercase truncate">BYE</span>
                                            ) : (
                                                <>
                                                    {match.home_team?.logo ? (
                                                        <img
                                                            src={match.home_team.logo}
                                                            alt={match.home_team.short_name || match.home_team.name}
                                                            className="w-3 h-3 sm:w-3.5 sm:h-3.5 object-contain shrink-0"
                                                        />
                                                    ) : (
                                                        <span className="w-3 h-3 sm:w-3.5 sm:h-3.5 bg-white/10 rounded flex items-center justify-center text-[7.5px] text-gray-400 shrink-0">T1</span>
                                                    )}
                                                    <span className="font-bold text-[9.5px] sm:text-[10px] text-white truncate leading-none" title={match.home_team?.name}>
                                                        {match.home_team?.short_name || match.home_team?.name}
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                        {/* Away Team */}
                                        <div className="flex items-center gap-1 min-w-0 h-[14px] sm:h-[15px]">
                                            {!match.away_team?.id && isBye ? (
                                                <span className="font-bold text-[9px] text-gray-400 italic uppercase truncate">BYE</span>
                                            ) : (
                                                <>
                                                    {match.away_team?.logo ? (
                                                        <img
                                                            src={match.away_team.logo}
                                                            alt={match.away_team.short_name || match.away_team.name}
                                                            className="w-3 h-3 sm:w-3.5 sm:h-3.5 object-contain shrink-0"
                                                        />
                                                    ) : (
                                                        <span className="w-3 h-3 sm:w-3.5 sm:h-3.5 bg-white/10 rounded flex items-center justify-center text-[7.5px] text-gray-400 shrink-0">T2</span>
                                                    )}
                                                    <span className="font-bold text-[9.5px] sm:text-[10px] text-white truncate leading-none" title={match.away_team?.name}>
                                                        {match.away_team?.short_name || match.away_team?.name}
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    {/* Action / Status / Score Column */}
                                    {match.status === 'FINISHED' ? (
                                        <div className="flex flex-col justify-center shrink-0 border-l border-white/10 pl-1 sm:pl-1.5 text-right min-w-[14px] sm:min-w-[16px] gap-0.5">
                                            <span className="font-black text-[9.5px] sm:text-[10px] text-white/95 tabular-nums leading-none h-[14px] sm:h-[15px] flex items-center justify-end">
                                                {match.home_score ?? 0}
                                            </span>
                                            <span className="font-black text-[9.5px] sm:text-[10px] text-white/95 tabular-nums leading-none h-[14px] sm:h-[15px] flex items-center justify-end">
                                                {match.away_score ?? 0}
                                            </span>
                                        </div>
                                    ) : isLive ? (
                                        <div className="flex flex-col items-center justify-center shrink-0 border-l border-white/10 pl-1 sm:pl-1.5 text-center min-w-[22px] sm:min-w-[26px]">
                                            <span className="bg-sffl-red text-white text-[6.5px] sm:text-[7px] font-black uppercase px-1 py-0.5 rounded animate-pulse">LIVE</span>
                                        </div>
                                    ) : isBye ? (
                                        <div className="flex flex-col items-center justify-center shrink-0 border-l border-white/10 pl-1 sm:pl-1.5 text-center min-w-[22px] sm:min-w-[26px]">
                                            <span className="text-[7px] font-black text-emerald-400 uppercase">BYE</span>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center shrink-0 border-l border-white/10 pl-1 sm:pl-1.5 text-center min-w-[26px] sm:min-w-[28px] leading-tight gap-0.5">
                                            <span className="text-[7.5px] sm:text-[8px] font-bold text-gray-300 whitespace-nowrap">
                                                {match.date ? new Date(match.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''}
                                            </span>
                                            {match.start_time && formatMatchTime(match.start_time) !== 'TBD' && (
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

                    {/* Right Blur/Fade Overlay */}
                    <div className="hidden sm:block absolute right-0 top-0 bottom-0 w-6 sm:w-8 bg-gradient-to-l from-sffl-navy dark:from-black to-transparent pointer-events-none z-10" />

                    {/* Right Arrow */}
                    <button
                        onClick={scrollRight}
                        className="hidden sm:flex absolute right-0.5 sm:right-1 top-1/2 -translate-y-1/2 z-20 bg-white/10 hover:bg-sffl-red hover:scale-105 text-white p-1 rounded-full shadow-lg transition-all duration-300 items-center justify-center cursor-pointer"
                        aria-label="Scroll right"
                    >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
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
        : '/matches';

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
                                <span className="text-white/20 text-[7px] sm:text-[9px]">•</span>
                                <span className="text-[6.5px] sm:text-[8px] md:text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider truncate max-w-[150px] sm:max-w-none">
                                    {latestMatch.competition.name}
                                </span>
                                {latestMatch.date && (
                                    <>
                                        <span className="text-white/20 text-[7px] sm:text-[9px]">•</span>
                                        <span className="text-[6.5px] sm:text-[8px] md:text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider whitespace-nowrap">
                                            {new Date(latestMatch.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                        </span>
                                    </>
                                )}
                            </>
                        )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
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
