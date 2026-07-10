import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getSeasonGraphics, getSeasonMVPs, type SeasonGraphic } from '../../services/api';

// Homepage seasonal block shown directly under the hero: two "Team of the
// Season" graphics (offense / defense) and a "Meet our MVPs" grid. Renders
// nothing until an admin has added content, so it never leaves empty boxes.
export const SeasonShowcase = () => {
    const { data: graphics = [] } = useQuery({
        queryKey: ['seasonGraphics'],
        queryFn: getSeasonGraphics,
        staleTime: 60_000,
    });
    const { data: mvps = [] } = useQuery({
        queryKey: ['seasonMVPs'],
        queryFn: getSeasonMVPs,
        staleTime: 60_000,
    });

    if (graphics.length === 0 && mvps.length === 0) return null;

    const byCategory = (cat: 'offense' | 'defense') => graphics.find(g => g.category === cat);
    const offense = byCategory('offense');
    const defense = byCategory('defense');

    return (
        <div className="space-y-12">
            {/* Team of the Season graphics */}
            {(offense || defense) && (
                <section className="px-1">
                    <h2 className="text-lg md:text-4xl font-black italic text-sffl-navy dark:text-white mb-6 text-center uppercase tracking-tight">
                        TEAM OF THE <span className="text-sffl-red">SEASON</span>
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <SeasonGraphicCard graphic={offense} title="Offense" />
                        <SeasonGraphicCard graphic={defense} title="Defense" />
                    </div>
                </section>
            )}

            {/* Meet our MVPs */}
            {mvps.length > 0 && (
                <section className="px-1">
                    <h2 className="text-lg md:text-4xl font-black italic text-sffl-navy dark:text-white mb-6 text-center uppercase tracking-tight">
                        MEET OUR <span className="text-sffl-red">MVPs</span>
                    </h2>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                        {mvps.map(mvp => (
                            <Link
                                key={mvp.id}
                                to={`/players/${mvp.player_id}`}
                                className="group bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-sm hover:shadow-xl transition border border-gray-100 dark:border-gray-700 flex flex-col"
                            >
                                <div className="relative h-44 md:h-64 overflow-hidden bg-gray-100 dark:bg-gray-900">
                                    {mvp.player_image ? (
                                        <img
                                            src={mvp.player_image}
                                            alt={mvp.player_name}
                                            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                        />
                                    ) : (
                                        <div className="absolute inset-0 flex items-center justify-center text-4xl md:text-6xl font-black text-gray-300 dark:text-gray-700">
                                            #{mvp.player_jersey_number}
                                        </div>
                                    )}
                                    <div className="absolute top-2 left-2 bg-sffl-red text-white text-[10px] md:text-xs font-black uppercase tracking-wider px-2.5 py-1 rounded-full shadow">
                                        ★ {mvp.label}
                                    </div>
                                </div>
                                <div className="p-3 md:p-4 flex-1 flex flex-col">
                                    <h3 className="text-sm md:text-lg font-black text-sffl-navy dark:text-white leading-tight group-hover:text-sffl-red transition-colors">
                                        {mvp.player_name}
                                    </h3>
                                    <p className="text-[10px] md:text-xs text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wide mt-0.5">
                                        {mvp.player_position}{mvp.team_name ? ` · ${mvp.team_name}` : ''}
                                    </p>
                                    <span className="mt-auto pt-2 text-sffl-red text-[10px] md:text-xs font-bold group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
                                        View Profile →
                                    </span>
                                </div>
                            </Link>
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
};

// A single Team-of-the-Season graphic. Rendered at natural aspect (never
// cropped/stretched — it's a designed graphic). Uses the square/portrait mobile
// variant on phones when the admin uploaded one.
const SeasonGraphicCard = ({ graphic, title }: { graphic?: SeasonGraphic; title: string }) => {
    if (!graphic) {
        return (
            <div className="rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 flex items-center justify-center min-h-[200px] text-gray-400 dark:text-gray-600 font-bold uppercase tracking-wider text-sm">
                {title} — coming soon
            </div>
        );
    }
    return (
        <div className="rounded-2xl overflow-hidden shadow-lg bg-sffl-navy/5">
            {/* Mobile variant when available, else the desktop image */}
            <img
                src={graphic.mobile_image_url || graphic.image_url}
                alt={`Team of the Season — ${title}`}
                className="md:hidden w-full h-auto"
            />
            <img
                src={graphic.image_url}
                alt={`Team of the Season — ${title}`}
                className="hidden md:block w-full h-auto"
            />
        </div>
    );
};
