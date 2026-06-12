import { MainHeroCarousel } from '../components/MainHeroCarousel';
import { HeroCarousel } from '../components/HeroCarousel';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useRef, useEffect } from 'react';
import { getMatches, getNews, getEventDayByDate } from '../services/api';
import { CompactMatchCard } from '../components/matches/CompactMatchCard';
import { Loader } from '../components/ui/Loader';
import { ArrowRightIcon } from '@heroicons/react/24/outline';
import { TOTWWidget } from '../components/widgets/TOTWWidget';
import { LightboxImage } from '../components/ui/LightboxImage';

export const LandingPage = () => {
    const { data: finishedMatchesData, isLoading: loadingFinished } = useQuery({
        queryKey: ['publicMatches', 'FINISHED', 5],
        queryFn: () => getMatches(undefined, 1, 5, 'FINISHED'),
    });

    const { data: scheduledMatchesData, isLoading: loadingScheduled } = useQuery({
        queryKey: ['publicMatches', 'SCHEDULED', 5],
        queryFn: () => getMatches(undefined, 1, 5, 'SCHEDULED'),
    });

    const { data: newsData, isLoading: loadingNews } = useQuery({
        queryKey: ['publicNews', "Commissioner's Note"],
        queryFn: () => getNews(1, 1, undefined, "Commissioner's Note"),
    });

    const { data: teamNewsData, isLoading: loadingTeamNews } = useQuery({
        queryKey: ['publicTeamNews', 6],
        queryFn: () => getNews(1, 6),
    });

    const resultsRef = useRef<HTMLDivElement>(null);
    const scheduledRef = useRef<HTMLDivElement>(null);

    const scrollLeft = (ref: React.RefObject<HTMLDivElement | null>) => {
        ref.current?.scrollBy({ left: -320, behavior: 'smooth' });
    };

    const scrollRight = (ref: React.RefObject<HTMLDivElement | null>) => {
        ref.current?.scrollBy({ left: 320, behavior: 'smooth' });
    };

    const latestResults = finishedMatchesData?.data || [];
    const upcomingMatches = scheduledMatchesData?.data || [];
    const latestNote = newsData?.data?.[0] || null;
    const teamNews = teamNewsData?.data || [];

    // Latest finished match drives the competition+week strip above the carousel
    // and the "View All" destination, so users land on the same competition they
    // were just looking at.
    const latestMatch = latestResults[0];
    const latestMatchDate = latestMatch?.date?.substring(0, 10);
    const { data: latestEventDay } = useQuery({
        queryKey: ['publicEventDayForLatest', latestMatchDate],
        queryFn: () => getEventDayByDate(latestMatchDate!),
        enabled: !!latestMatchDate,
        retry: false,
        staleTime: 60_000,
    });
    const latestWeekLabel = latestEventDay?.title || (latestMatchDate
        ? new Date(latestMatch!.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
        : '');
    const resultsViewAllHref = latestMatch?.competition?.id
        ? `/matches?comp=${latestMatch.competition.id}`
        : '/matches';

    useEffect(() => {
        if (latestResults.length <= 1) return;
        
        const interval = setInterval(() => {
            if (resultsRef.current) {
                const maxScrollLeft = resultsRef.current.scrollWidth - resultsRef.current.clientWidth;
                if (resultsRef.current.scrollLeft >= maxScrollLeft - 10) {
                    resultsRef.current.scrollTo({ left: 0, behavior: 'smooth' });
                } else {
                    resultsRef.current.scrollBy({ left: 280, behavior: 'smooth' });
                }
            }
        }, 5000);

        return () => clearInterval(interval);
    }, [latestResults]);

    return (
        <div className="space-y-6 md:space-y-12 pt-4">
            {/* Latest Results */}
            <section className="px-1">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg md:text-4xl font-black italic text-sffl-navy dark:text-white transition-colors duration-300">
                        LATEST <span className="text-sffl-red">RESULTS</span>
                    </h2>
                    <div className="flex items-center gap-3 md:gap-4">
                        <a 
                            href="https://www.youtube.com/@ShowtimeFlagFootball" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 md:gap-2 bg-[#FF0000] hover:bg-[#CC0000] text-white text-[10px] md:text-xs font-black uppercase tracking-wider px-2.5 py-1.5 md:px-4 md:py-2 rounded-full shadow-lg transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer"
                        >
                            <svg className="w-3.5 h-3.5 md:w-4 md:h-4 fill-current" viewBox="0 0 24 24">
                                <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816-.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 4-8 4z"/>
                            </svg>
                            <span>Watch Highlights</span>
                        </a>
                        <Link to={resultsViewAllHref} className="text-sffl-red text-xs md:text-sm font-semibold hover:underline">View All &rarr;</Link>
                    </div>
                </div>

                {loadingFinished ? (
                    <Loader />
                ) : latestResults.length > 0 ? (
                    <div className="relative group px-2 md:px-4">
                        {/* Left Arrow */}
                        <button 
                            onClick={() => scrollLeft(resultsRef)}
                            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-sffl-navy dark:bg-gray-800 hover:bg-sffl-red dark:hover:bg-sffl-red text-white p-1.5 md:p-2.5 rounded-full shadow-xl transition-all duration-300 flex items-center justify-center cursor-pointer border-2 border-white/20"
                        >
                            <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>

                        <div 
                            ref={resultsRef}
                            className="flex overflow-x-auto gap-4 pb-4 snap-x snap-mandatory no-scrollbar -mx-1 px-1"
                        >
                            {latestResults.map(match => (
                                <CompactMatchCard key={match.id} match={match} hideHeaderAndVenue={true} />
                            ))}
                        </div>

                        {/* Right Arrow */}
                        <button
                            onClick={() => scrollRight(resultsRef)}
                            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-sffl-navy dark:bg-gray-800 hover:bg-sffl-red dark:hover:bg-sffl-red text-white p-1.5 md:p-2.5 rounded-full shadow-xl transition-all duration-300 flex items-center justify-center cursor-pointer border-2 border-white/20"
                        >
                            <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-16 bg-gradient-to-br from-sffl-navy/5 to-sffl-red/5 dark:from-sffl-navy/30 dark:to-sffl-red/10 rounded-3xl border-2 border-dashed border-sffl-navy/10 dark:border-gray-700">
                        <span className="text-5xl mb-4">🏈</span>
                        <h3 className="text-xl font-black italic text-sffl-navy dark:text-white tracking-tight">NO RECENT RESULTS</h3>
                        <p className="text-gray-500 dark:text-gray-400 font-medium mt-2 text-sm">Results will be posted here right after game day.</p>
                    </div>
                )}

                {/* Compact competition + week strip — sits directly under the carousel */}
                {latestMatch?.competition && (
                    <div className="flex items-center gap-2 px-1 md:px-2 text-xs md:text-sm">
                        <span className="font-black uppercase tracking-tight text-sffl-navy dark:text-white truncate">
                            {latestMatch.competition.name}
                        </span>
                        {latestWeekLabel && (
                            <>
                                <span className="text-gray-300 dark:text-gray-600">·</span>
                                <span className="italic font-semibold text-gray-500 dark:text-gray-400 truncate">
                                    {latestWeekLabel}
                                </span>
                            </>
                        )}
                    </div>
                )}
            </section>

            {/* Hero Carousel Section */}
            <section className="px-1">
                <MainHeroCarousel />
            </section>

            {/* Upcoming Matches */}
            <section className="px-1">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg md:text-4xl font-black italic text-sffl-navy dark:text-white transition-colors duration-300">
                        UPCOMING <span className="text-sffl-red">MATCHES</span>
                    </h2>
                    <Link to="/tickets" className="text-sffl-navy dark:text-gray-300 text-sm font-semibold hover:underline">Get Tickets 🎟️</Link>
                </div>
                {loadingScheduled ? (
                    <Loader />
                ) : upcomingMatches.length > 0 ? (
                    <div className="relative group px-2 md:px-4">
                        {/* Left Arrow */}
                        <button 
                            onClick={() => scrollLeft(scheduledRef)}
                            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-sffl-navy dark:bg-gray-800 hover:bg-sffl-red dark:hover:bg-sffl-red text-white p-1.5 md:p-2.5 rounded-full shadow-xl transition-all duration-300 flex items-center justify-center cursor-pointer border-2 border-white/20"
                        >
                            <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>

                        <div 
                            ref={scheduledRef}
                            className="flex overflow-x-auto gap-4 pb-4 snap-x snap-mandatory no-scrollbar -mx-1 px-1"
                        >
                            {upcomingMatches.map(match => (
                                <CompactMatchCard key={match.id} match={match} />
                            ))}
                        </div>

                        {/* Right Arrow */}
                        <button 
                            onClick={() => scrollRight(scheduledRef)}
                            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-sffl-navy dark:bg-gray-800 hover:bg-sffl-red dark:hover:bg-sffl-red text-white p-1.5 md:p-2.5 rounded-full shadow-xl transition-all duration-300 flex items-center justify-center cursor-pointer border-2 border-white/20"
                        >
                            <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-16 bg-gradient-to-br from-gray-50 to-blue-50/30 dark:from-gray-800/50 dark:to-sffl-navy/20 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                        <span className="text-5xl mb-4">📅</span>
                        <h3 className="text-xl font-black italic text-sffl-navy dark:text-white tracking-tight">NO UPCOMING MATCHES</h3>
                        <p className="text-gray-500 dark:text-gray-400 font-medium mt-2 text-sm">The next game day schedule is being finalized. Stay tuned!</p>
                    </div>
                )}
            </section>

            {/* News and TOTW Section */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-8 px-2 md:px-0">
                {/* Team of the Week Widget */}
                <TOTWWidget />

                {/* Commissioner's Note */}
                <div className="bg-sffl-navy dark:bg-gray-800 text-white p-6 md:p-8 rounded-2xl shadow-xl border border-transparent dark:border-gray-700 flex flex-col h-full relative overflow-hidden group">
                    <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/4 w-32 h-32 bg-sffl-red/10 rounded-full blur-2xl group-hover:bg-sffl-red/20 transition-all duration-700"></div>
                    <h3 className="text-xl md:text-2xl font-black italic mb-6 uppercase tracking-tighter relative z-10">Commissioner's <span className="text-sffl-red">Note</span></h3>
                    {loadingNews ? (
                        <div className="flex-1 flex justify-center items-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                        </div>
                    ) : latestNote ? (
                        <div className="relative z-10 flex flex-col h-full">
                            <p className="text-gray-300 dark:text-gray-300 mb-8 italic flex-1 relative z-10 leading-relaxed text-sm md:text-base before:content-['\201C'] before:absolute before:-top-6 before:-left-4 before:text-7xl before:text-sffl-red/20 before:-z-10 after:content-['\201D'] after:relative after:-bottom-4 after:text-5xl after:text-sffl-red/20 after:leading-none">
                                {latestNote.excerpt || latestNote.content.substring(0, 200) + '...'}
                            </p>
                            <Link to={`/news/${latestNote.slug}`} className="text-white bg-sffl-red/20 hover:bg-sffl-red/40 px-6 py-2.5 rounded-xl font-bold transition-all mt-auto inline-flex items-center justify-center gap-2 w-fit border border-sffl-red/30 hover:scale-[1.02] active:scale-95">
                                Read Full Note <ArrowRightIcon className="w-4 h-4" />
                            </Link>
                        </div>
                    ) : (
                        <div className="flex-1 flex items-center justify-center border-2 border-dashed border-white/10 rounded-2xl">
                            <p className="text-gray-400 dark:text-gray-500 italic font-medium">No commissioner's note at this time.</p>
                        </div>
                    )}
                </div>
            </section>

            {/* Promotional Carousel */}
            <HeroCarousel />

            {/* Team News Section */}
            <section className="px-1 mt-12">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-lg md:text-4xl font-black italic text-sffl-navy dark:text-white transition-colors duration-300">
                        TEAM <span className="text-sffl-red">NEWS</span>
                    </h2>
                    <Link to="/news" className="text-sffl-red text-sm font-semibold hover:underline flex items-center gap-1">
                        View All News &rarr;
                    </Link>
                </div>

                {loadingTeamNews ? (
                    <Loader />
                ) : teamNews.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {teamNews.map(item => (
                            <div 
                                key={item.id} 
                                className="bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 flex flex-col group border border-gray-100 dark:border-gray-700/50 hover:scale-[1.01]"
                            >
                                <div className="h-48 overflow-hidden relative bg-gray-100 dark:bg-gray-900">
                                    <LightboxImage 
                                        src={item.featured_image || ''} 
                                        alt={item.title} 
                                        thumbnailClassName="w-full h-full"
                                        imgClassName="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                    />
                                </div>
                                <Link 
                                    to={`/news/${item.slug}`}
                                    className="p-5 flex flex-col flex-1"
                                >
                                    <h3 className="text-base font-black text-sffl-navy dark:text-white mb-2 line-clamp-2 group-hover:text-sffl-red transition-colors">
                                        {item.title}
                                    </h3>
                                    <p className="text-gray-500 dark:text-gray-400 text-xs line-clamp-3 mb-4 flex-1 leading-relaxed">
                                        {item.excerpt || item.content.substring(0, 120) + '...'}
                                    </p>
                                    <div className="flex justify-between items-center mt-auto pt-4 border-t border-gray-50 dark:border-gray-700/30">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                                                {new Date(item.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                            </span>
                                            {item.category && (
                                                <span className="bg-sffl-red/10 text-sffl-red text-[10px] font-bold px-2 py-0.5 rounded-md uppercase">
                                                    {item.category}
                                                </span>
                                            )}
                                        </div>
                                        <span className="text-sffl-red text-xs font-bold group-hover:translate-x-1 transition-transform flex items-center gap-1">
                                            Read More &rarr;
                                        </span>
                                    </div>
                                </Link>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/20 rounded-3xl border border-dashed border-gray-200 dark:border-gray-700">
                        <p className="text-gray-500 dark:text-gray-400 font-medium italic">No recent news available.</p>
                    </div>
                )}
            </section>
        </div>
    );
};
