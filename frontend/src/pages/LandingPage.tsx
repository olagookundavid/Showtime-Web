import { HeroCarousel } from '../components/HeroCarousel';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getMatches, getNews } from '../services/api';
import { CompactMatchCard } from '../components/matches/CompactMatchCard';
import { Loader } from '../components/ui/Loader';

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

    const latestResults = finishedMatchesData?.data || [];
    const upcomingMatches = scheduledMatchesData?.data || [];

    // The backend now filters by category, so the first item is our latest note
    const latestNote = newsData?.data?.[0] || null;
    return (
        <div className="space-y-6 md:space-y-12">
            {/* Hero Section - High Density */}
            <section className="relative h-[250px] md:h-[400px] rounded-xl md:rounded-3xl overflow-hidden shadow-2xl bg-gradient-to-r from-sffl-navy to-sffl-red">
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-10 left-10 w-32 h-32 bg-white rounded-full blur-3xl"></div>
                    <div className="absolute bottom-10 right-10 w-48 h-48 bg-white rounded-full blur-3xl"></div>
                </div>
                <div className="relative h-full flex items-center justify-center text-center text-white px-4">
                    <div className="max-w-3xl">
                        <h1 className="text-2xl md:text-7xl font-black italic tracking-tighter mb-2 animate-fade-in">
                            WELCOME TO <span className="text-sffl-red">SHOWTIME</span>
                        </h1>
                        <p className="text-sm md:text-2xl text-gray-200 mb-6 font-medium animate-fade-in-delayed">
                            The Flag Football League of Champions.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-2 justify-center animate-fade-in-delayed">
                            <Link
                                to="/tickets"
                                className="bg-sffl-red hover:bg-[#A52323] text-white font-black py-2 px-6 md:py-4 md:px-10 rounded-full text-xs md:text-xl uppercase tracking-widest transition transform hover:scale-105 shadow-xl"
                            >
                                Buy Tickets
                            </Link>
                            <Link
                                to="/signup"
                                className="bg-white hover:bg-gray-100 text-sffl-navy font-black py-2 px-6 md:py-4 md:px-10 rounded-full text-xs md:text-xl uppercase tracking-widest transition transform hover:scale-105 shadow-xl"
                            >
                                Join League
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            {/* Promotional Carousel */}
            <HeroCarousel />

            {/* Latest Results */}
            <section className="container mx-auto px-1">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg md:text-4xl font-black italic text-sffl-navy dark:text-white transition-colors duration-300">
                        LATEST <span className="text-sffl-red">RESULTS</span>
                    </h2>
                    <Link to="/matches" className="text-sffl-red text-sm font-semibold hover:underline">View All &rarr;</Link>
                </div>
                {loadingFinished ? (
                    <Loader />
                ) : latestResults.length > 0 ? (
                    <div className="flex overflow-x-auto gap-4 pb-4 snap-x snap-mandatory no-scrollbar -mx-1 px-1">
                        {latestResults.map(match => (
                            <CompactMatchCard key={match.id} match={match} />
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-16 bg-gradient-to-br from-sffl-navy/5 to-sffl-red/5 dark:from-sffl-navy/30 dark:to-sffl-red/10 rounded-3xl border-2 border-dashed border-sffl-navy/10 dark:border-gray-700">
                        <span className="text-5xl mb-4">🏈</span>
                        <h3 className="text-xl font-black italic text-sffl-navy dark:text-white tracking-tight">NO RECENT RESULTS</h3>
                        <p className="text-gray-500 dark:text-gray-400 font-medium mt-2 text-sm">Results will be posted here right after game day.</p>
                    </div>
                )}
            </section>

            {/* Upcoming Matches */}
            <section className="container mx-auto px-1">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg md:text-4xl font-black italic text-sffl-navy dark:text-white transition-colors duration-300">
                        UPCOMING <span className="text-sffl-red">MATCHES</span>
                    </h2>
                    <Link to="/tickets" className="text-sffl-navy dark:text-gray-300 text-sm font-semibold hover:underline">Get Tickets 🎟️</Link>
                </div>
                {loadingScheduled ? (
                    <Loader />
                ) : upcomingMatches.length > 0 ? (
                    <div className="flex overflow-x-auto gap-4 pb-4 snap-x snap-mandatory no-scrollbar -mx-1 px-1">
                        {upcomingMatches.map(match => (
                            <CompactMatchCard key={match.id} match={match} />
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-16 bg-gradient-to-br from-gray-50 to-blue-50/30 dark:from-gray-800/50 dark:to-sffl-navy/20 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                        <span className="text-5xl mb-4">📅</span>
                        <h3 className="text-xl font-black italic text-sffl-navy dark:text-white tracking-tight">NO UPCOMING MATCHES</h3>
                        <p className="text-gray-500 dark:text-gray-400 font-medium mt-2 text-sm">The next game day schedule is being finalized. Stay tuned!</p>
                    </div>
                )}
            </section>

            {/* News/Engagement Placeholder */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-8 px-2 md:px-0">
                <div className="bg-sffl-navy dark:bg-gray-800 text-white p-6 md:p-8 rounded-2xl shadow-xl border border-transparent dark:border-gray-700 flex flex-col h-full">
                    <h3 className="text-xl md:text-2xl font-bold italic mb-4 uppercase">Commissioner's Note</h3>
                    {loadingNews ? (
                        <div className="flex-1 flex justify-center items-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                        </div>
                    ) : latestNote ? (
                        <>
                            <p className="text-gray-300 dark:text-gray-300 mb-6 italic flex-1 relative z-10 before:content-['\201C'] before:absolute before:-top-4 before:-left-2 before:text-5xl before:text-sffl-red/30 before:-z-10 after:content-['\201D'] after:relative after:-bottom-4 after:text-5xl after:text-sffl-red/30 after:leading-none">
                                {latestNote.excerpt || latestNote.content.substring(0, 150) + '...'}
                            </p>
                            <Link to={`/news/${latestNote.slug}`} className="text-sffl-red font-bold hover:text-white dark:hover:text-red-400 transition mt-auto inline-flex items-center gap-1">
                                Read Note <span className="text-lg leading-none">&rarr;</span>
                            </Link>
                        </>
                    ) : (
                        <div className="flex-1 flex items-center justify-center">
                            <p className="text-gray-400 dark:text-gray-500 italic font-medium">No commissioner's note at this time.</p>
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
};
