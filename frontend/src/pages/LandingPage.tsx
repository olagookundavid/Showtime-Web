import { HeroCarousel } from '../components/HeroCarousel';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getMatches, getNews } from '../services/api';
import { MatchCard } from '../components/matches/MatchCard';
import { Loader } from '../components/ui/Loader';

export const LandingPage = () => {
    const { data: finishedMatchesData, isLoading: loadingFinished } = useQuery({
        queryKey: ['publicMatches', 'FINISHED', 3],
        queryFn: () => getMatches(undefined, 1, 3, 'FINISHED'),
    });

    const { data: newsData, isLoading: loadingNews } = useQuery({
        queryKey: ['publicNews', 'commissioners-note'],
        queryFn: () => getNews(1, 10), // We'll fetch the recent 10 and filter by category
    });

    const latestResults = finishedMatchesData?.data || [];

    // Find the latest commissioner's note
    const commissionerNotes = (newsData?.data || []).filter(n => n.category === "Commissioner's Note");
    const latestNote = commissionerNotes.length > 0 ? commissionerNotes[0] : null;
    return (
        <div className="space-y-12">
            {/* Main Hero Section */}
            <section className="relative bg-gradient-to-r from-sffl-navy to-sffl-red text-white p-12 md:p-20 rounded-3xl shadow-2xl overflow-hidden">
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-10 left-10 w-32 h-32 bg-white rounded-full blur-3xl"></div>
                    <div className="absolute bottom-10 right-10 w-48 h-48 bg-white rounded-full blur-3xl"></div>
                </div>
                <div className="relative z-10 max-w-3xl">
                    <h1 className="text-5xl md:text-7xl font-black italic mb-6 tracking-tight leading-tight">
                        WELCOME TO SHOWTIME FLAG FOOTBALL
                    </h1>
                    <p className="text-xl md:text-2xl text-gray-100 mb-8 leading-relaxed">
                        Experience the thrill of flag football in Lagos. Fast-paced action, fierce competition, and unforgettable moments.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4">
                        <Link
                            to="/matches"
                            className="bg-sffl-red hover:bg-red-700 text-white font-bold py-3 px-8 rounded-full transition transform hover:scale-105 shadow-lg uppercase tracking-wide text-center"
                        >
                            View Schedule
                        </Link>
                        <Link
                            to="/standings"
                            className="bg-white hover:bg-gray-100 text-sffl-navy font-bold py-3 px-8 rounded-full transition transform hover:scale-105 shadow-lg uppercase tracking-wide text-center"
                        >
                            Latest Standings
                        </Link>
                    </div>
                </div>
            </section>

            {/* Promotional Carousel */}
            <HeroCarousel />

            {/* Latest Scores Mockup */}
            <section>
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-3xl font-bold italic text-sffl-navy">LATEST RESULTS</h2>
                    <Link to="/matches" className="text-sffl-red font-semibold hover:underline">View All &rarr;</Link>
                </div>
                {loadingFinished ? (
                    <Loader />
                ) : latestResults.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {latestResults.map(match => (
                            <MatchCard key={match.id} match={match} onClick={() => { }} />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-2xl">
                        <p className="text-gray-500 font-medium">No recent results available.</p>
                    </div>
                )}
            </section>

            {/* News/Engagement Placeholder */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-sffl-navy dark:bg-gray-800 text-white p-8 rounded-2xl shadow-xl border border-transparent dark:border-gray-700 flex flex-col h-full">
                    <h3 className="text-2xl font-bold italic mb-4 uppercase">Commissioner's Note</h3>
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
                <div className="bg-white p-8 rounded-2xl shadow-xl">
                    <h3 className="text-2xl font-bold italic text-sffl-navy mb-4">PLAYER OF THE WEEK</h3>
                    <div className="flex items-center gap-6">
                        <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center font-bold text-gray-400">IMG</div>
                        <div>
                            <div className="text-3xl font-black text-sffl-red">J. SMITH</div>
                            <div className="text-gray-600 font-bold uppercase">QB - Outlaws</div>
                            <div className="mt-2 text-sm text-gray-500">4 TDs, 0 INT, 250 Yds</div>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
};
