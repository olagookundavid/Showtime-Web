import { Loader } from '../components/ui/Loader';
import { useEffect, useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getMatches, getStandings, getCompetitions, getNews } from '../services/api';
import { CompactMatchCard } from '../components/matches/CompactMatchCard';
import { LightboxImage } from '../components/ui';

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
        queryKey: ['publicMatches', 'FINISHED', 5],
        queryFn: () => getMatches(undefined, 1, 5, 'FINISHED'),
    });

    const { data: scheduledMatchesData, isLoading: loadingScheduled } = useQuery({
        queryKey: ['publicMatches', 'SCHEDULED', 5],
        queryFn: () => getMatches(undefined, 1, 5, 'SCHEDULED'),
    });

    const { data: competitionsData, isLoading: loadingComps } = useQuery({
        queryKey: ['publicCompetitions'],
        queryFn: () => getCompetitions(1, 100),
    });

    const { data: newsData, isLoading: loadingNews } = useQuery({
        queryKey: ['publicNews', 3],
        queryFn: () => getNews(1, 3),
    });

    const competitions = (competitionsData?.data || []).filter(c => c.status !== 'inactive');
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
        <div className="relative isolate min-h-screen -mt-3 md:-mt-8 -mx-2 sm:-mx-6 lg:-mx-8 px-2 sm:px-6 lg:px-8 py-10 md:py-16 space-y-24">
            {/* Hero Section - Optimized for high transparency */}
            <RevealSection className="relative overflow-hidden rounded-[2.5rem] bg-sffl-navy/40 dark:bg-black/60 backdrop-blur-md isolate shadow-2xl border border-white/20">
                <div className="px-6 py-20 sm:px-6 sm:py-32 lg:px-8 text-center relative z-10">
                    <h1 className="text-5xl font-extrabold tracking-tighter text-white sm:text-8xl mb-6 drop-shadow-2xl">
                        Welcome to the <span className="text-sffl-red italic">Showtime</span>
                    </h1>
                    <p className="mx-auto max-w-2xl text-lg sm:text-2xl text-gray-100 mb-12 font-medium leading-relaxed drop-shadow-lg opacity-90">
                        The premier flag football league. <br className="hidden sm:block" /> Experience the thrill, stats, and glory of SFFL.
                    </p>
                    <div className="flex flex-col sm:flex-row justify-center gap-6 w-full px-4 sm:px-0">
                        <Link to="/matches" className="flex items-center justify-center rounded-full bg-sffl-red px-10 py-4 min-h-[56px] text-base font-black text-white shadow-xl hover:bg-red-700 hover:scale-105 active:scale-95 transition-all duration-300 w-full sm:w-auto uppercase tracking-widest">
                            View Schedule
                        </Link>
                        <Link to="/tickets" className="flex items-center justify-center rounded-full bg-white/10 backdrop-blur-sm px-10 py-4 min-h-[56px] text-base font-black text-white border border-white/20 hover:bg-white/20 hover:scale-105 active:scale-95 transition-all duration-300 w-full sm:w-auto uppercase tracking-widest">
                            Get Tickets
                        </Link>
                    </div>
                </div>
                {/* Animated highlight */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-sffl-red to-transparent opacity-50" />
            </RevealSection>

            {/* Latest Results */}
            <RevealSection>
                <div className="flex items-center justify-between mb-10 px-2">
                    <h2 className="text-4xl font-black italic tracking-tighter text-sffl-navy dark:text-white transition-colors duration-300">
                        <span className="text-sffl-red mr-3 shadow-md">●</span> LATEST RESULTS
                    </h2>
                    <Link to="/matches" className="hidden sm:flex text-sffl-red dark:text-red-400 font-bold hover:underline py-2.5 px-5 rounded-full items-center min-h-[44px] bg-white/30 dark:bg-white/5 backdrop-blur-sm hover:bg-white/80 dark:hover:bg-white/10 active:scale-95 transition-all duration-300 border border-black/5 dark:border-white/5">
                        View All <span className="ml-2">→</span>
                    </Link>
                </div>
                <div className="relative group">
                    {loading ? (
                        <div className="h-48 flex items-center justify-center"><Loader /></div>
                    ) : latestResults.length > 0 ? (
                        <div className="flex overflow-x-auto gap-6 pb-6 snap-x snap-mandatory no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 py-2">
                            {latestResults.map(match => (
                                <div key={match.id} className="snap-center transform transition-transform duration-500 hover:scale-[1.02]">
                                    <CompactMatchCard match={match} />
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-20 bg-white/30 dark:bg-gray-900/40 backdrop-blur-sm rounded-3xl border border-white/20 dark:border-white/5 shadow-xl">
                            <span className="text-6xl mb-4 animate-bounce">🏈</span>
                            <h3 className="text-2xl font-black italic text-sffl-navy dark:text-white tracking-tight">NO RECENT RESULTS</h3>
                            <p className="text-gray-500 dark:text-gray-400 font-medium mt-3 text-base">Results will be posted here right after game day.</p>
                        </div>
                    )}
                </div>
            </RevealSection>

            {/* Upcoming Matches */}
            <RevealSection>
                <div className="flex items-center justify-between mb-10 px-2">
                    <h2 className="text-4xl font-black italic tracking-tighter text-sffl-navy dark:text-white transition-colors duration-300">
                        <span className="text-sffl-red mr-3 shadow-md">●</span> UPCOMING MATCHES
                    </h2>
                    <Link to="/tickets" className="text-sffl-navy dark:text-gray-300 font-bold hover:underline py-2.5 px-5 rounded-full flex items-center min-h-[44px] bg-white/30 dark:bg-white/5 backdrop-blur-sm hover:bg-white/80 dark:hover:bg-white/10 active:scale-95 transition-all duration-300 border border-black/5 dark:border-white/5">
                        Get Tickets <span className="ml-2">🎟️</span>
                    </Link>
                </div>
                {loading ? (
                    <div className="h-48 flex items-center justify-center"><Loader /></div>
                ) : upcomingMatches.length > 0 ? (
                    <div className="flex overflow-x-auto gap-6 pb-6 snap-x snap-mandatory no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 py-2">
                        {upcomingMatches.map(match => (
                            <div key={match.id} className="snap-center transform transition-transform duration-500 hover:scale-[1.02]">
                                <CompactMatchCard match={match} />
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 bg-white/40 dark:bg-gray-900/40 backdrop-blur-md rounded-3xl border border-white/20 dark:border-white/5 shadow-xl">
                        <span className="text-6xl mb-4 opacity-50">📅</span>
                        <h3 className="text-2xl font-black italic text-sffl-navy dark:text-white tracking-tight">NO UPCOMING MATCHES</h3>
                        <p className="text-gray-500 dark:text-gray-400 font-medium mt-3 text-base">The next game day schedule is being finalized.</p>
                    </div>
                )}
            </RevealSection>

            {/* League Table Mini + Latest News side-by-side */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">
                {/* League Table */}
                <RevealSection className="lg:col-span-3">
                    <div className="flex items-center justify-between mb-8 px-2">
                        <h2 className="text-4xl font-black italic tracking-tighter text-sffl-navy dark:text-white transition-colors duration-300">
                            <span className="text-yellow-500 mr-3 shadow-md">●</span> LEAGUE TABLE
                        </h2>
                        <Link to="/standings" className="text-sffl-red dark:text-red-400 font-bold hover:underline py-2.5 px-5 rounded-full flex items-center min-h-[44px] bg-white/50 dark:bg-white/5 backdrop-blur-sm hover:bg-white/80 dark:hover:bg-white/10 active:scale-95 transition-all duration-300 border border-black/5 dark:border-white/5">
                            Full Table <span className="ml-2">→</span>
                        </Link>
                    </div>
                    <div className="bg-white/40 dark:bg-gray-900/40 backdrop-blur-md rounded-[2rem] shadow-2xl overflow-hidden border border-white/30 dark:border-white/5">
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[500px]">
                                <thead>
                                    <tr className="bg-sffl-navy/10 dark:bg-white/5 text-sffl-navy dark:text-gray-300 text-xs uppercase font-black">
                                        <th className="px-6 py-5 text-left w-14">#</th>
                                        <th className="px-6 py-5 text-left">Team</th>
                                        <th className="px-6 py-5 text-center">P</th>
                                        <th className="px-6 py-5 text-center">W</th>
                                        <th className="px-6 py-5 text-center">D</th>
                                        <th className="px-6 py-5 text-center">L</th>
                                        <th className="px-6 py-5 text-center">PD</th>
                                        <th className="px-6 py-5 text-center font-black">PCT</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200/50 dark:divide-white/5">
                                    {standings.length > 0 ? standings.map((s, i) => (
                                        <tr key={s.id} className={`hover:bg-sffl-red/5 dark:hover:bg-sffl-red/10 transition-colors duration-300 ${i === 0 ? 'bg-yellow-500/5' : ''}`}>
                                            <td className="px-6 py-4 font-black text-sffl-navy dark:text-white text-lg">{s.position}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-4">
                                                    {s.team?.logo && (
                                                        <LightboxImage 
                                                            src={s.team.logo} 
                                                            alt={s.team.name} 
                                                            thumbnailClassName="w-8 h-8 object-contain rounded-lg shadow-sm" 
                                                        />
                                                    )}
                                                    {s.team?.id ? (
                                                        <Link
                                                            to={`/teams/${s.team.id}`}
                                                            className="font-bold text-base dark:text-white tracking-tight hover:text-sffl-red transition-colors"
                                                        >
                                                            {s.team.name}
                                                        </Link>
                                                    ) : (
                                                        <span className="font-bold text-base dark:text-white tracking-tight">—</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center text-sm font-semibold dark:text-gray-300">{s.played ?? 0}</td>
                                            <td className="px-6 py-4 text-center text-sm font-semibold dark:text-gray-300">{s.won ?? 0}</td>
                                            <td className="px-6 py-4 text-center text-sm font-semibold dark:text-gray-300">{s.drawn ?? 0}</td>
                                            <td className="px-6 py-4 text-center text-sm font-semibold dark:text-gray-300">{s.lost ?? 0}</td>
                                            <td className="px-6 py-4 text-center text-sm font-bold dark:text-gray-300">{(s.goal_diff ?? 0) > 0 ? '+' : ''}{s.goal_diff ?? 0}</td>
                                            <td className="px-6 py-4 text-center font-black text-sffl-navy dark:text-white text-base bg-white/5">{s.pct != null ? `${s.pct}%` : '-'}</td>
                                        </tr>
                                    )) : (
                                        <tr><td colSpan={8} className="px-6 py-12 text-center text-gray-400 italic">No standings data available</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </RevealSection>

                {/* Latest News */}
                <RevealSection className="lg:col-span-2" delay={200}>
                    <div className="flex items-center justify-between mb-8 px-2">
                        <h2 className="text-4xl font-black italic tracking-tighter text-sffl-navy dark:text-white transition-colors duration-300">
                            <span className="text-green-500 mr-3 shadow-md">●</span> NEWS
                        </h2>
                        <Link to="/news" className="text-sffl-red dark:text-red-400 font-bold hover:underline py-2.5 px-5 rounded-full flex items-center min-h-[44px] bg-white/50 dark:bg-white/5 backdrop-blur-sm hover:bg-white/80 dark:hover:bg-white/10 active:scale-95 transition-all duration-300 border border-black/5 dark:border-white/5">
                            All News <span className="ml-2">→</span>
                        </Link>
                    </div>
                    <div className="space-y-6">
                        {latestNews.length > 0 ? latestNews.map(article => {
                            const imageSrc = article.featured_image || (article.category === "Commissioner's Note" ? '/images/leadership/adebare_adejumo.jpg' : null);
                            return (
                            <Link key={article.id} to={`/news/${article.slug}`} className="block bg-white/40 dark:bg-gray-900/40 backdrop-blur-md rounded-2xl shadow-xl overflow-hidden border border-white/30 dark:border-white/5 hover:shadow-2xl hover:-translate-y-1 active:scale-[0.98] transition-all duration-300 group">
                                <div className="flex">
                                    {imageSrc && (
                                        <div className="relative w-32 h-32 flex-shrink-0 overflow-hidden">
                                            <LightboxImage 
                                                src={imageSrc} 
                                                alt={article.title} 
                                                thumbnailClassName="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
                                            />
                                            <div className="absolute inset-0 bg-gradient-to-r from-transparent to-white/10 dark:to-black/20" />
                                        </div>
                                    )}
                                    <div className="p-5 flex-1 min-w-0 flex flex-col justify-center">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-[10px] font-black bg-sffl-red/10 text-sffl-red dark:text-red-400 px-2 py-0.5 rounded-full uppercase tracking-widest">{article.category || 'News'}</span>
                                            <span className="text-[10px] text-gray-500 font-bold">{article.published_at ? new Date(article.published_at).toLocaleDateString() : ''}</span>
                                        </div>
                                        <h3 className="font-black text-base text-sffl-navy dark:text-white leading-tight line-clamp-2 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors tracking-tight">{article.title}</h3>
                                    </div>
                                </div>
                            </Link>
                        );
                        }) : (
                            <div className="text-center py-20 bg-white/40 dark:bg-gray-900/40 backdrop-blur-md rounded-[2rem] border border-white/20 dark:border-white/5 shadow-xl">
                                <p className="text-gray-500 dark:text-gray-300 font-medium text-lg">No news yet.</p>
                            </div>
                        )}
                    </div>
                </RevealSection>
            </div>

            {/* Features Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                {[
                    { to: '/matches', emoji: '📺', title: 'Latest Matches', desc: 'Catch up on the latest scores and highlights from every game week.', color: 'hover:border-red-500' },
                    { to: '/standings', emoji: '🏆', title: 'League Standings', desc: 'See who\'s leading the race for the championship trophy.', color: 'hover:border-yellow-500' },
                    { to: '/players', emoji: '⚡', title: 'MVP Stats', desc: 'Track the league\'s top performers and rising stars.', color: 'hover:border-green-500' }
                ].map((feature, i) => (
                    <RevealSection key={i} delay={i * 200}>
                        <Link to={feature.to} className={`block w-full h-full p-10 bg-white/40 dark:bg-gray-900/40 backdrop-blur-md rounded-[2.5rem] border border-white/30 dark:border-white/5 transition-all duration-500 group shadow-lg hover:shadow-2xl active:scale-[0.98] ${feature.color}`}>
                            <div className="text-6xl mb-6 group-hover:scale-110 group-hover:-rotate-6 transition-all duration-500 filter drop-shadow-lg">{feature.emoji}</div>
                            <h3 className="text-2xl font-black mb-3 text-sffl-navy dark:text-white tracking-tighter uppercase italic">{feature.title}</h3>
                            <p className="text-gray-500 dark:text-gray-400 text-base leading-relaxed font-medium">{feature.desc}</p>
                        </Link>
                    </RevealSection>
                ))}
            </div>

            {/* CTA Banner */}
            <RevealSection className="relative overflow-hidden rounded-[3rem] bg-sffl-navy shadow-2xl border border-white/10 group">
                <div className="absolute inset-0 bg-gradient-to-r from-sffl-red to-sffl-navy opacity-90 transition-opacity duration-700 group-hover:opacity-100" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.15),transparent)] pointer-events-none" />
                <div className="px-8 py-20 sm:px-20 text-center relative z-10">
                    <h2 className="text-4xl sm:text-6xl font-black text-white mb-6 tracking-tighter drop-shadow-2xl italic">
                        DON'T MISS A SINGLE PLAY 🏈
                    </h2>
                    <p className="text-gray-100 max-w-2xl mx-auto mb-12 text-xl font-medium leading-relaxed opacity-90">
                        Experience the raw energy of SFFL live at the arena. <br className="hidden sm:block" /> Secure your spot in the stands today.
                    </p>
                    <div className="flex flex-col sm:flex-row justify-center gap-6">
                        <Link to="/tickets" className="flex items-center justify-center min-h-[60px] rounded-full bg-white text-sffl-navy px-12 py-4 font-black shadow-2xl hover:scale-105 active:scale-95 transition-all duration-300 uppercase tracking-widest text-lg">
                            🎟️ Buy Tickets
                        </Link>
                        <Link to="/highlights" className="flex items-center justify-center min-h-[60px] rounded-full bg-white/10 backdrop-blur-md text-white px-12 py-4 font-black border border-white/20 hover:bg-white/20 hover:scale-105 active:scale-95 transition-all duration-300 uppercase tracking-widest text-lg">
                            ▶️ Watch Highlights
                        </Link>
                    </div>
                </div>
            </RevealSection>
        </div>
    );
}
