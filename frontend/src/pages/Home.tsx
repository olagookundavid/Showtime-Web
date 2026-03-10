import { Loader } from '../components/ui/Loader';
import { useEffect, useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getMatches, getStandings, getCompetitions, getNews } from '../services/api';
import { MatchCard } from '../components/matches/MatchCard';

// Hook for scroll animations
function useScrollReveal() {
    const ref = useRef<HTMLDivElement>(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                    observer.disconnect();
                }
            },
            { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
        );

        if (ref.current) observer.observe(ref.current);
        return () => observer.disconnect();
    }, []);

    return { ref, isVisible };
}

// Wrapper component for sections
function RevealSection({ children, className = '', delay = 0 }: { children: React.ReactNode, className?: string, delay?: number }) {
    const { ref, isVisible } = useScrollReveal();
    return (
        <div
            ref={ref}
            className={`transition-all duration-1000 ease-out fill-mode-forwards ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'} ${className}`}
            style={{ transitionDelay: `${delay}ms` }}
        >
            {children}
        </div>
    );
}

export default function Home() {
    const { data: finishedMatchesData, isLoading: loadingFinished } = useQuery({
        queryKey: ['publicMatches', 'FINISHED', 3],
        queryFn: () => getMatches(undefined, 1, 3, 'FINISHED'),
    });

    const { data: scheduledMatchesData, isLoading: loadingScheduled } = useQuery({
        queryKey: ['publicMatches', 'SCHEDULED', 3],
        queryFn: () => getMatches(undefined, 1, 3, 'SCHEDULED'),
    });

    const { data: competitionsData, isLoading: loadingComps } = useQuery({
        queryKey: ['publicCompetitions'],
        queryFn: () => getCompetitions(1, 100),
    });

    const { data: newsData, isLoading: loadingNews } = useQuery({
        queryKey: ['publicNews', 3],
        queryFn: () => getNews(1, 3),
    });

    const competitions = competitionsData?.data || [];
    const firstCompId = competitions?.[0]?.id;

    const { data: standingsDataRaw, isLoading: loadingStandings } = useQuery({
        queryKey: ['publicStandings', firstCompId],
        queryFn: () => getStandings(firstCompId!),
        enabled: !!firstCompId,
    });

    const latestResults = finishedMatchesData?.data || [];
    const upcomingMatches = scheduledMatchesData?.data || [];
    const latestNews = newsData?.data || [];
    const standings = Array.isArray(standingsDataRaw) ? standingsDataRaw.slice(0, 5) : [];
    const loading = loadingFinished || loadingScheduled || loadingComps || loadingNews || (!!firstCompId && loadingStandings);

    return (
        <div className="space-y-16">
            {/* Hero Section */}
            <RevealSection className="relative overflow-hidden rounded-3xl bg-gray-900 isolate shadow-2xl">
                <div className="absolute inset-0 -z-10 bg-[url('https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?q=80&w=2069&auto=format&fit=crop')] bg-cover bg-center opacity-20"></div>
                <div className="px-6 py-24 sm:px-6 sm:py-32 lg:px-8 text-center relative z-10">
                    <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-7xl mb-6 drop-shadow-lg">
                        Welcome to the <span className="text-blue-500 italic">Showtime</span>
                    </h1>
                    <p className="mx-auto max-w-2xl text-lg sm:text-xl text-gray-300 mb-10 drop-shadow-md">
                        The premier flag football league. Experience the thrill, stats, and glory of SFFL.
                    </p>
                    <div className="flex flex-col sm:flex-row justify-center gap-4 w-full px-4 sm:px-0">
                        <Link to="/matches" className="flex items-center justify-center rounded-full bg-blue-600 px-8 py-3 min-h-[44px] text-sm font-bold text-white shadow-lg hover:bg-blue-500 hover:scale-105 active:scale-95 transition-all duration-300 w-full sm:w-auto">
                            View Schedule
                        </Link>
                        <Link to="/tickets" className="flex items-center justify-center rounded-full bg-white/10 backdrop-blur-sm px-8 py-3 min-h-[44px] text-sm font-bold text-white border border-white/20 hover:bg-white/20 hover:scale-105 active:scale-95 transition-all duration-300 w-full sm:w-auto">
                            Get Tickets
                        </Link>
                    </div>
                </div>
            </RevealSection>

            {/* Latest Results */}
            <RevealSection>
                <div className="flex items-center justify-between mb-8">
                    <h2 className="text-3xl font-black italic tracking-tighter text-sffl-navy dark:text-white transition-colors duration-300">
                        <span className="text-sffl-red mr-2">●</span> LATEST RESULTS
                    </h2>
                    <Link to="/matches" className="text-blue-600 dark:text-blue-400 font-bold hover:underline py-2 px-3 -mr-3 rounded-lg flex items-center min-h-[44px] hover:bg-blue-50 dark:hover:bg-blue-900/20 active:scale-95 transition-all duration-300">
                        View All <span className="ml-1">→</span>
                    </Link>
                </div>
                {loading ? (
                    <Loader />
                ) : latestResults.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {latestResults.map(match => (
                            <MatchCard key={match.id} match={match} onClick={() => { }} />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-2xl">
                        <p className="text-gray-500 dark:text-gray-300 font-medium">No recent results available.</p>
                    </div>
                )}
            </RevealSection>

            {/* Upcoming Matches */}
            {upcomingMatches.length > 0 && (
                <RevealSection>
                    <div className="flex items-center justify-between mb-8">
                        <h2 className="text-3xl font-black italic tracking-tighter text-sffl-navy dark:text-white transition-colors duration-300">
                            <span className="text-blue-500 mr-2">●</span> UPCOMING MATCHES
                        </h2>
                        <Link to="/tickets" className="text-blue-600 dark:text-blue-400 font-bold hover:underline py-2 px-3 -mr-3 rounded-lg flex items-center min-h-[44px] hover:bg-blue-50 dark:hover:bg-blue-900/20 active:scale-95 transition-all duration-300">
                            Get Tickets <span className="ml-1">→</span>
                        </Link>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {upcomingMatches.map(match => (
                            <MatchCard key={match.id} match={match} onClick={() => { }} />
                        ))}
                    </div>
                </RevealSection>
            )}

            {/* League Table Mini + Latest News side-by-side */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                {/* League Table */}
                <RevealSection className="lg:col-span-3">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-3xl font-black italic tracking-tighter text-sffl-navy dark:text-white transition-colors duration-300">
                            <span className="text-yellow-500 mr-2">●</span> LEAGUE TABLE
                        </h2>
                        <Link to="/standings" className="text-blue-600 dark:text-blue-400 font-bold hover:underline py-2 px-3 -mr-3 rounded-lg flex items-center min-h-[44px] hover:bg-blue-50 dark:hover:bg-blue-900/20 active:scale-95 transition-all duration-300">
                            Full Table <span className="ml-1">→</span>
                        </Link>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-x-auto border border-gray-100 dark:border-gray-700">
                        <table className="w-full min-w-[500px]">
                            <thead>
                                <tr className="bg-sffl-navy text-white text-xs uppercase">
                                    <th className="px-4 py-3 text-left w-10">#</th>
                                    <th className="px-4 py-3 text-left">Team</th>
                                    <th className="px-4 py-3 text-center">P</th>
                                    <th className="px-4 py-3 text-center">W</th>
                                    <th className="px-4 py-3 text-center">D</th>
                                    <th className="px-4 py-3 text-center">L</th>
                                    <th className="px-4 py-3 text-center">PD</th>
                                    <th className="px-4 py-3 text-center font-black">PCT</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {standings.length > 0 ? standings.map((s, i) => (
                                    <tr key={s.id} className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 transition ${i === 0 ? 'bg-yellow-50 dark:bg-yellow-900/10' : ''}`}>
                                        <td className="px-4 py-3 font-black text-sffl-navy dark:text-white">{s.position}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                {s.team?.logo && <img src={s.team.logo} alt="" className="w-5 h-5 object-contain" />}
                                                <span className="font-semibold text-sm dark:text-white">{s.team?.name || '—'}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-center text-sm dark:text-gray-300">{s.played ?? 0}</td>
                                        <td className="px-4 py-3 text-center text-sm dark:text-gray-300">{s.won ?? 0}</td>
                                        <td className="px-4 py-3 text-center text-sm dark:text-gray-300">{s.drawn ?? 0}</td>
                                        <td className="px-4 py-3 text-center text-sm dark:text-gray-300">{s.lost ?? 0}</td>
                                        <td className="px-4 py-3 text-center text-sm font-semibold dark:text-gray-300">{(s.goal_diff ?? 0) > 0 ? '+' : ''}{s.goal_diff ?? 0}</td>
                                        <td className="px-4 py-3 text-center font-black text-sffl-navy dark:text-white">{s.pct != null ? `${s.pct}%` : '-'}</td>
                                    </tr>
                                )) : (
                                    <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No standings data available</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </RevealSection>

                {/* Latest News */}
                <RevealSection className="lg:col-span-2" delay={200}>
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-3xl font-black italic tracking-tighter text-sffl-navy dark:text-white transition-colors duration-300">
                            <span className="text-green-500 mr-2">●</span> NEWS
                        </h2>
                        <Link to="/news" className="text-blue-600 dark:text-blue-400 font-bold hover:underline py-2 px-3 -mr-3 rounded-lg flex items-center min-h-[44px] hover:bg-blue-50 dark:hover:bg-blue-900/20 active:scale-95 transition-all duration-300">
                            All News <span className="ml-1">→</span>
                        </Link>
                    </div>
                    <div className="space-y-4">
                        {latestNews.length > 0 ? latestNews.map(article => (
                            <Link key={article.id} to={`/news/${article.slug}`} className="block bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden border border-gray-100 dark:border-gray-700 hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-300 group">
                                <div className="flex">
                                    {article.featured_image && (
                                        <div className="w-24 h-24 flex-shrink-0">
                                            <img src={article.featured_image} alt="" className="w-full h-full object-cover" />
                                        </div>
                                    )}
                                    <div className="p-3 flex-1 min-w-0">
                                        <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase">{article.category || 'News'}</span>
                                        <h3 className="font-bold text-sm text-sffl-navy dark:text-white leading-tight mt-1 line-clamp-2 group-hover:text-blue-600 transition-colors">{article.title}</h3>
                                        <p className="text-xs text-gray-500 mt-1">{article.published_at ? new Date(article.published_at).toLocaleDateString() : ''}</p>
                                    </div>
                                </div>
                            </Link>
                        )) : (
                            <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-2xl">
                                <p className="text-gray-500 dark:text-gray-300 font-medium">No news yet.</p>
                            </div>
                        )}
                    </div>
                </RevealSection>
            </div>

            {/* Features Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <RevealSection delay={0}>
                    <Link to="/matches" className="block w-full h-full p-8 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 transition-all duration-300 group shadow-sm hover:shadow-lg active:scale-[0.98]">
                        <div className="text-4xl mb-4 group-hover:scale-110 transition-transform duration-300">📺</div>
                        <h3 className="text-xl font-bold mb-2 text-sffl-navy dark:text-white">Latest Matches</h3>
                        <p className="text-gray-500 dark:text-gray-400">Catch up on the latest scores and highlights from every game week.</p>
                    </Link>
                </RevealSection>
                <RevealSection delay={200}>
                    <Link to="/standings" className="block w-full h-full p-8 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 hover:border-yellow-500 dark:hover:border-yellow-500 transition-all duration-300 group shadow-sm hover:shadow-lg active:scale-[0.98]">
                        <div className="text-4xl mb-4 group-hover:scale-110 transition-transform duration-300">🏆</div>
                        <h3 className="text-xl font-bold mb-2 text-sffl-navy dark:text-white">League Standings</h3>
                        <p className="text-gray-500 dark:text-gray-400">See who's leading the race for the championship trophy.</p>
                    </Link>
                </RevealSection>
                <RevealSection delay={400}>
                    <Link to="/players" className="block w-full h-full p-8 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 hover:border-green-500 dark:hover:border-green-500 transition-all duration-300 group shadow-sm hover:shadow-lg active:scale-[0.98]">
                        <div className="text-4xl mb-4 group-hover:scale-110 transition-transform duration-300">⚡</div>
                        <h3 className="text-xl font-bold mb-2 text-sffl-navy dark:text-white">MVP Stats</h3>
                        <p className="text-gray-500 dark:text-gray-400">Track the league's top performers and rising stars.</p>
                    </Link>
                </RevealSection>
            </div>

            {/* CTA Banner */}
            <RevealSection className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-sffl-red to-sffl-navy shadow-2xl">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.1),transparent)] pointer-events-none"></div>
                <div className="px-8 py-16 sm:px-16 text-center relative z-10">
                    <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">
                        Don't Miss a Single Play 🏈
                    </h2>
                    <p className="text-gray-200 max-w-xl mx-auto mb-8 text-lg">
                        Get your tickets now — experience the excitement of SFFL live at the arena, or follow along with real-time updates.
                    </p>
                    <div className="flex flex-col sm:flex-row justify-center gap-4">
                        <Link to="/tickets" className="flex items-center justify-center min-h-[44px] rounded-full bg-white text-sffl-navy px-8 py-3 font-bold shadow-lg hover:scale-105 active:scale-95 transition-all duration-300">
                            🎟️ Buy Tickets
                        </Link>
                        <Link to="/highlights" className="flex items-center justify-center min-h-[44px] rounded-full bg-white/10 backdrop-blur-sm text-white px-8 py-3 font-bold border border-white/20 hover:bg-white/20 hover:scale-105 active:scale-95 transition-all duration-300">
                            ▶️ Watch Highlights
                        </Link>
                    </div>
                </div>
            </RevealSection>
        </div>
    );
}
