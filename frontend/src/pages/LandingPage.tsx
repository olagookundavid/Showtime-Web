import { MainHeroCarousel } from '../components/MainHeroCarousel';
import { ReliveCarousel } from '../components/ReliveCarousel';
import { HeroCarousel } from '../components/HeroCarousel';
// Temporarily disabled on the homepage — re-enable to show the Team of the
// Season banner + MVPs (admin content still lives at /admin/season).
// import { SeasonShowcase } from '../components/widgets/SeasonShowcase';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getNews } from '../services/api';
import { Loader } from '../components/ui/Loader';
import { ArrowRightIcon } from '@heroicons/react/24/outline';
// Team of the Week disabled for now (likely becoming a static image like
// Team of the Season) — no TOTW API calls should fire until that's decided.
// import { TOTWWidget } from '../components/widgets/TOTWWidget';
import { LightboxImage } from '../components/ui/LightboxImage';

export const LandingPage = () => {
    const { data: newsData, isLoading: loadingNews } = useQuery({
        queryKey: ['publicNews', "Commissioner's Note"],
        queryFn: () => getNews(1, 1, undefined, "Commissioner's Note"),
    });

    const { data: teamNewsData, isLoading: loadingTeamNews } = useQuery({
        queryKey: ['publicTeamNews', 6],
        queryFn: () => getNews(1, 6),
    });

    const latestNote = newsData?.data?.[0] || null;
    const teamNews = teamNewsData?.data || [];

    return (
        <div className="space-y-6 md:space-y-12 pt-4">
            {/* Hero Carousel Section */}
            <section className="px-1">
                <MainHeroCarousel />
            </section>

            {/* RELIVE - YouTube Playlist Video Carousel */}
            <section className="px-1">
                <ReliveCarousel />
            </section>

            {/* Team of the Season + MVPs — temporarily commented out. Re-enable
                the import above and this line to show it again. */}
            {/* <SeasonShowcase /> */}

            {/* Team News — moved immediately after the hero so news is the
                first thing visitors see below the carousel. */}
            <section className="px-1">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-lg md:text-4xl font-black italic text-sffl-navy dark:text-white transition-colors duration-300">
                        <span className="text-sffl-red">NEWS</span>
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

            {/* Commissioner's Note — was a 2-col grid with the Team of the Week
                widget; TOTW is disabled for now (see import above), so this
                goes full-width (capped) until TOTW is re-decided. */}
            <section className="px-2 md:px-0">
                <div className="max-w-2xl mx-auto">
                {/* Commissioner's Note */}
                <div className="bg-sffl-navy dark:bg-gray-800 text-white p-6 md:p-8 rounded-2xl shadow-xl border border-transparent dark:border-gray-700 flex flex-col h-full relative overflow-hidden group min-h-[320px]">
                    {/* Commissioner background image */}
                    <div className="absolute inset-0 z-0 overflow-hidden">
                        <img
                            src="/images/leadership/adebare_adejumo.jpg"
                            alt="Adebare Adejumo - League Commissioner"
                            className="w-full h-full object-cover object-top filter brightness-90 group-hover:scale-105 transition-transform duration-700 opacity-40 dark:opacity-30"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-sffl-navy via-sffl-navy/85 to-sffl-navy/70 dark:from-gray-900 dark:via-gray-900/90 dark:to-gray-900/75"></div>
                    </div>

                    <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/4 w-32 h-32 bg-sffl-red/10 rounded-full blur-2xl group-hover:bg-sffl-red/20 transition-all duration-700 z-10"></div>

                    <div className="flex items-center justify-between mb-6 relative z-10">
                        <h3 className="text-xl md:text-2xl font-black italic uppercase tracking-tighter">Commissioner's <span className="text-sffl-red">Note</span></h3>
                        <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider bg-white/10 dark:bg-white/10 px-3 py-1 rounded-full border border-white/10 backdrop-blur-sm text-gray-200">
                            Adebare Adejumo
                        </span>
                    </div>

                    {loadingNews ? (
                        <div className="flex-1 flex justify-center items-center py-8 relative z-10">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                        </div>
                    ) : latestNote ? (
                        <div className="relative z-10 flex flex-col h-full">
                            <p className="text-gray-200 dark:text-gray-200 mb-8 italic flex-1 relative z-10 leading-relaxed text-sm md:text-base before:content-['\201C'] before:absolute before:-top-6 before:-left-4 before:text-7xl before:text-sffl-red/30 before:-z-10 after:content-['\201D'] after:relative after:-bottom-4 after:text-5xl after:text-sffl-red/30 after:leading-none">
                                {latestNote.excerpt || latestNote.content.substring(0, 200) + '...'}
                            </p>
                            <div className="flex items-center justify-between mt-auto pt-4 border-t border-white/10">
                                <Link to={`/news/${latestNote.slug}`} className="text-white bg-sffl-red hover:bg-sffl-red/90 px-6 py-2.5 rounded-xl font-bold transition-all inline-flex items-center justify-center gap-2 border border-sffl-red/30 hover:scale-[1.02] active:scale-95 shadow-lg">
                                    Read Full Note <ArrowRightIcon className="w-4 h-4" />
                                </Link>
                                <span className="text-xs text-gray-300 font-medium italic hidden sm:inline">
                                    — Adebare Adejumo
                                </span>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex items-center justify-center border-2 border-dashed border-white/10 rounded-2xl relative z-10 backdrop-blur-xs">
                            <p className="text-gray-300 dark:text-gray-400 italic font-medium">No commissioner's note at this time.</p>
                        </div>
                    )}
                </div>
                </div>
            </section>

            {/* Promotional Carousel */}
            <HeroCarousel />
        </div>
    );
};
