import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMatches, getStandings, getCompetitions, getNews, type Match, type Standing, type News } from '../services/api';
import { MatchCard } from '../components/matches/MatchCard';

export default function Home() {
    const [latestResults, setLatestResults] = useState<Match[]>([]);
    const [upcomingMatches, setUpcomingMatches] = useState<Match[]>([]);
    const [standings, setStandings] = useState<Standing[]>([]);
    const [latestNews, setLatestNews] = useState<News[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAll = async () => {
            try {
                const [finished, scheduled, comps, newsData] = await Promise.all([
                    getMatches(undefined, 1, 3, 'FINISHED'),
                    getMatches(undefined, 1, 3, 'SCHEDULED'),
                    getCompetitions(),
                    getNews(1, 3),
                ]);
                setLatestResults(finished.data || []);
                setUpcomingMatches(scheduled.data || []);
                setLatestNews(newsData.data || []);

                // Fetch standings for first competition
                if (comps.length > 0) {
                    const standingsData = await getStandings(comps[0].id);
                    setStandings(Array.isArray(standingsData) ? standingsData.slice(0, 5) : []);
                }
            } catch (error) {
                console.error("Failed to fetch homepage data:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchAll();
    }, []);

    return (
        <div className="space-y-16">
            {/* Hero Section */}
            <section className="relative overflow-hidden rounded-3xl bg-gray-900 isolate shadow-2xl">
                <div className="absolute inset-0 -z-10 bg-[url('https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?q=80&w=2069&auto=format&fit=crop')] bg-cover bg-center opacity-20"></div>
                <div className="px-6 py-24 sm:px-6 sm:py-32 lg:px-8 text-center relative z-10">
                    <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-7xl mb-6 drop-shadow-lg">
                        Welcome to the <span className="text-blue-500 italic">Showtime</span>
                    </h1>
                    <p className="mx-auto max-w-2xl text-lg sm:text-xl text-gray-300 mb-10 drop-shadow-md">
                        The premier flag football league. Experience the thrill, stats, and glory of SFFL.
                    </p>
                    <div className="flex justify-center gap-4">
                        <Link to="/matches" className="rounded-full bg-blue-600 px-8 py-3 text-sm font-bold text-white shadow-lg hover:bg-blue-500 hover:scale-105 transition-all duration-300">
                            View Schedule
                        </Link>
                        <Link to="/tickets" className="rounded-full bg-white/10 backdrop-blur-sm px-8 py-3 text-sm font-bold text-white border border-white/20 hover:bg-white/20 hover:scale-105 transition-all duration-300">
                            Get Tickets
                        </Link>
                    </div>
                </div>
            </section>

            {/* Latest Results */}
            <section>
                <div className="flex items-center justify-between mb-8">
                    <h2 className="text-3xl font-black italic tracking-tighter text-sffl-navy dark:text-white">
                        <span className="text-sffl-red mr-2">●</span> LATEST RESULTS
                    </h2>
                    <Link to="/matches" className="text-blue-600 dark:text-blue-400 font-bold hover:underline flex items-center">
                        View All <span className="ml-1">→</span>
                    </Link>
                </div>
                {loading ? (
                    <div className="flex justify-center py-12"><div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>
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

            {/* Upcoming Matches */}
            {upcomingMatches.length > 0 && (
                <section>
                    <div className="flex items-center justify-between mb-8">
                        <h2 className="text-3xl font-black italic tracking-tighter text-sffl-navy dark:text-white">
                            <span className="text-blue-500 mr-2">●</span> UPCOMING MATCHES
                        </h2>
                        <Link to="/tickets" className="text-blue-600 dark:text-blue-400 font-bold hover:underline flex items-center">
                            Get Tickets <span className="ml-1">→</span>
                        </Link>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {upcomingMatches.map(match => (
                            <MatchCard key={match.id} match={match} onClick={() => { }} />
                        ))}
                    </div>
                </section>
            )}

            {/* League Table Mini + Latest News side-by-side */}
            <section className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                {/* League Table */}
                <div className="lg:col-span-3">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-3xl font-black italic tracking-tighter text-sffl-navy dark:text-white">
                            <span className="text-yellow-500 mr-2">●</span> LEAGUE TABLE
                        </h2>
                        <Link to="/standings" className="text-blue-600 dark:text-blue-400 font-bold hover:underline flex items-center">
                            Full Table <span className="ml-1">→</span>
                        </Link>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden border border-gray-100 dark:border-gray-700">
                        <table className="w-full">
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
                </div>

                {/* Latest News */}
                <div className="lg:col-span-2">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-3xl font-black italic tracking-tighter text-sffl-navy dark:text-white">
                            <span className="text-green-500 mr-2">●</span> NEWS
                        </h2>
                        <Link to="/news" className="text-blue-600 dark:text-blue-400 font-bold hover:underline flex items-center">
                            All News <span className="ml-1">→</span>
                        </Link>
                    </div>
                    <div className="space-y-4">
                        {latestNews.length > 0 ? latestNews.map(article => (
                            <Link key={article.id} to={`/news/${article.slug}`} className="block bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden border border-gray-100 dark:border-gray-700 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 group">
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
                                <p className="text-gray-500 font-medium">No news yet.</p>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {/* Features Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <Link to="/matches" className="p-8 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 transition-all duration-300 group shadow-sm hover:shadow-lg">
                    <div className="text-4xl mb-4 group-hover:scale-110 transition-transform duration-300">📺</div>
                    <h3 className="text-xl font-bold mb-2 text-sffl-navy dark:text-white">Latest Matches</h3>
                    <p className="text-gray-500 dark:text-gray-400">Catch up on the latest scores and highlights from every game week.</p>
                </Link>
                <Link to="/standings" className="p-8 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 hover:border-yellow-500 dark:hover:border-yellow-500 transition-all duration-300 group shadow-sm hover:shadow-lg">
                    <div className="text-4xl mb-4 group-hover:scale-110 transition-transform duration-300">🏆</div>
                    <h3 className="text-xl font-bold mb-2 text-sffl-navy dark:text-white">League Standings</h3>
                    <p className="text-gray-500 dark:text-gray-400">See who's leading the race for the championship trophy.</p>
                </Link>
                <Link to="/players" className="p-8 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 hover:border-green-500 dark:hover:border-green-500 transition-all duration-300 group shadow-sm hover:shadow-lg">
                    <div className="text-4xl mb-4 group-hover:scale-110 transition-transform duration-300">⚡</div>
                    <h3 className="text-xl font-bold mb-2 text-sffl-navy dark:text-white">MVP Stats</h3>
                    <p className="text-gray-500 dark:text-gray-400">Track the league's top performers and rising stars.</p>
                </Link>
            </div>

            {/* CTA Banner */}
            <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-sffl-red to-sffl-navy shadow-2xl">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.1),transparent)] pointer-events-none"></div>
                <div className="px-8 py-16 sm:px-16 text-center relative z-10">
                    <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">
                        Don't Miss a Single Play 🏈
                    </h2>
                    <p className="text-gray-200 max-w-xl mx-auto mb-8 text-lg">
                        Get your tickets now — experience the excitement of SFFL live at the arena, or follow along with real-time updates.
                    </p>
                    <div className="flex flex-col sm:flex-row justify-center gap-4">
                        <Link to="/tickets" className="rounded-full bg-white text-sffl-navy px-8 py-3 font-bold shadow-lg hover:scale-105 transition-all duration-300">
                            🎟️ Buy Tickets
                        </Link>
                        <Link to="/highlights" className="rounded-full bg-white/10 backdrop-blur-sm text-white px-8 py-3 font-bold border border-white/20 hover:bg-white/20 hover:scale-105 transition-all duration-300">
                            ▶️ Watch Highlights
                        </Link>
                    </div>
                </div>
            </section>
        </div>
    );
}
