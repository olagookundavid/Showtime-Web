import { useQuery } from '@tanstack/react-query';
import { useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getMatches } from '../../services/api';
import { Loader } from '../ui/Loader';

export const LatestMatchesCarousel = () => {
    const { data: finishedMatchesData, isLoading } = useQuery({
        queryKey: ['publicMatches', 'FINISHED', 10],
        queryFn: () => getMatches(undefined, 1, 10, 'FINISHED'),
        staleTime: 60_000,
    });

    const matches = finishedMatchesData?.data || [];
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Auto-scroll logic (smooth loop scroll)
    useEffect(() => {
        if (matches.length <= 1) return;

        const interval = setInterval(() => {
            if (scrollContainerRef.current) {
                const container = scrollContainerRef.current;
                const maxScrollLeft = container.scrollWidth - container.clientWidth;
                if (container.scrollLeft >= maxScrollLeft - 10) {
                    container.scrollTo({ left: 0, behavior: 'smooth' });
                } else {
                    container.scrollBy({ left: 240, behavior: 'smooth' });
                }
            }
        }, 5000);

        return () => clearInterval(interval);
    }, [matches]);

    const scrollLeft = () => {
        scrollContainerRef.current?.scrollBy({ left: -240, behavior: 'smooth' });
    };

    const scrollRight = () => {
        scrollContainerRef.current?.scrollBy({ left: 240, behavior: 'smooth' });
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

    const latestMatch = matches[0];
    const resultsViewAllHref = latestMatch?.competition?.id
        ? `/matches?comp=${latestMatch.competition.id}`
        : '/matches';

    return (
        <div className="w-full bg-sffl-navy border-b border-white/10 dark:bg-black relative select-none">
            <div className="max-w-shell mx-auto relative px-8 flex flex-col justify-center">
                {/* Row 1: Scrollable Matches (Height increased by 60%) */}
                <div className="relative flex items-center h-[76px] w-full">
                    {/* Left Arrow */}
                    <button
                        onClick={scrollLeft}
                        className="absolute left-1 md:left-2 top-1/2 -translate-y-1/2 z-20 bg-white/10 hover:bg-sffl-red hover:scale-105 text-white p-1 rounded-full shadow-lg transition-all duration-300 flex items-center justify-center cursor-pointer"
                        aria-label="Scroll left"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>

                    {/* Left Blur/Fade Overlay */}
                    <div className="absolute left-0 top-0 bottom-0 w-8 md:w-16 bg-gradient-to-r from-sffl-navy dark:from-black to-transparent pointer-events-none z-10" />

                    {/* Scroll Container */}
                    <div
                        ref={scrollContainerRef}
                        className="flex overflow-x-auto gap-3 py-2 snap-x snap-mandatory no-scrollbar w-full h-full items-center"
                    >
                        {matches.map(match => {
                            const isLive = match.status === 'LIVE';
                            return (
                                <Link
                                    key={match.id}
                                    to={`/matches/${match.id}`}
                                    className="flex-none w-[220px] md:w-[240px] bg-white/5 dark:bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-lg p-2 flex items-center justify-between gap-3 transition-all duration-300 snap-center cursor-pointer group h-[60px]"
                                >
                                    <div className="flex flex-col justify-center gap-1.5 flex-1 min-w-0">
                                        {/* Home Team */}
                                        <div className="flex items-center justify-between gap-1.5 min-w-0">
                                            <div className="flex items-center gap-2 min-w-0">
                                                {match.home_team?.logo ? (
                                                    <img 
                                                        src={match.home_team.logo} 
                                                        alt={match.home_team.name} 
                                                        className="w-5 h-5 object-contain rounded"
                                                    />
                                                ) : (
                                                    <div className="w-5 h-5 bg-white/10 rounded flex items-center justify-center text-[8px] text-white">H</div>
                                                )}
                                                <span className="text-[11px] font-bold text-gray-200 dark:text-gray-100 truncate uppercase group-hover:text-white transition-colors">
                                                    {match.home_team?.short_name || match.home_team?.name}
                                                </span>
                                            </div>
                                            <span className="text-[11px] font-extrabold text-white">
                                                {match.home_score ?? 0}
                                            </span>
                                        </div>
                                        {/* Away Team */}
                                        <div className="flex items-center justify-between gap-1.5 min-w-0">
                                            <div className="flex items-center gap-2 min-w-0">
                                                {match.away_team?.logo ? (
                                                    <img 
                                                        src={match.away_team.logo} 
                                                        alt={match.away_team.name} 
                                                        className="w-5 h-5 object-contain rounded"
                                                    />
                                                ) : (
                                                    <div className="w-5 h-5 bg-white/10 rounded flex items-center justify-center text-[8px] text-white">A</div>
                                                )}
                                                <span className="text-[11px] font-bold text-gray-200 dark:text-gray-100 truncate uppercase group-hover:text-white transition-colors">
                                                    {match.away_team?.short_name || match.away_team?.name}
                                                </span>
                                            </div>
                                            <span className="text-[11px] font-extrabold text-white">
                                                {match.away_score ?? 0}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Divider and status */}
                                    <div className="border-l border-white/10 pl-2.5 ml-1 flex flex-col justify-center items-center text-[8px] font-black tracking-widest min-w-[42px] shrink-0 text-right">
                                        <span className={isLive ? 'text-sffl-red animate-pulse' : 'text-gray-400 dark:text-gray-500'}>
                                            {isLive ? 'LIVE' : 'FINAL'}
                                        </span>
                                        {!isLive && match.date && (
                                            <span className="text-[7.5px] text-gray-500 font-bold mt-0.5 whitespace-nowrap">
                                                {new Date(match.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                            </span>
                                        )}
                                    </div>
                                </Link>
                            );
                        })}
                    </div>

                    {/* Right Blur/Fade Overlay */}
                    <div className="absolute right-0 top-0 bottom-0 w-8 md:w-16 bg-gradient-to-l from-sffl-navy dark:from-black to-transparent pointer-events-none z-10" />

                    {/* Right Arrow */}
                    <button
                        onClick={scrollRight}
                        className="absolute right-1 md:right-2 top-1/2 -translate-y-1/2 z-20 bg-white/10 hover:bg-sffl-red hover:scale-105 text-white p-1 rounded-full shadow-lg transition-all duration-300 flex items-center justify-center cursor-pointer"
                        aria-label="Scroll right"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                </div>

                {/* Row 2: Sleek integrated bottom bar (No vertical space) */}
                <div className="flex items-center justify-between border-t border-white/5 py-1.5 px-4 w-full">
                    <div className="flex items-center gap-2">
                        <span className="text-[9px] md:text-[10px] font-black tracking-widest text-white/95 uppercase">
                            LATEST RESULTS
                        </span>
                        {latestMatch?.competition && (
                            <>
                                <span className="text-white/20 text-[9px]">•</span>
                                <span className="text-[8px] md:text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                                    {latestMatch.competition.name}
                                    {latestMatch.date && ` · ${new Date(latestMatch.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`}
                                </span>
                            </>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        <a 
                            href="https://www.youtube.com/@ShowtimeFlagFootball" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 bg-[#FF0000] hover:bg-[#CC0000] text-white text-[8px] md:text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded shadow-sm transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer"
                        >
                            <svg className="w-2.5 h-2.5 fill-current" viewBox="0 0 24 24">
                                <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816-.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 4-8 4z"/>
                            </svg>
                            <span>Watch Highlights</span>
                        </a>
                        <Link 
                            to={resultsViewAllHref} 
                            className="text-[8px] md:text-[9px] font-black uppercase tracking-wider text-sffl-red hover:text-white transition-colors"
                        >
                            View All &rarr;
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
};
