import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { getPlayerById, getPlayerStatById } from '../../services/api';
import { Loader } from '../../components/ui/Loader';

const StatCard = ({ label, value }: { label: string, value: number }) => {
    return (
        <div className="text-center p-4 md:p-6 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700">
            <div className="text-2xl md:text-4xl font-black text-sffl-navy dark:text-white mb-1 md:mb-2">{value}</div>
            <div className="text-[10px] md:text-sm text-gray-500 dark:text-gray-400 font-black uppercase tracking-widest">{label}</div>
        </div>
    );
};

export const PlayerDetail = () => {
    const { id } = useParams<{ id: string }>();

    const { data: player, isLoading: loadingPlayer, isError: error } = useQuery({
        queryKey: ['publicPlayer', id],
        queryFn: () => getPlayerById(id!),
        enabled: !!id,
    });

    const { data: stats, isLoading: loadingStats } = useQuery({
        queryKey: ['playerStats', id],
        queryFn: () => getPlayerStatById(id!),
        enabled: !!id,
    });

    if (loadingPlayer || loadingStats) return <Loader />;

    if (error || !player) {
        return (
            <div className="text-center py-20">
                <h1 className="text-4xl font-black text-sffl-navy dark:text-white mb-4">Player Not Found</h1>
                <Link to="/players" className="text-sffl-red hover:underline font-semibold">Back to Players</Link>
            </div>
        );
    }

    return (
        <div className="space-y-4 md:space-y-8">
            {/* Back Button */}
            <Link to="/players" className="inline-flex items-center text-sffl-red hover:underline font-bold text-xs uppercase tracking-wider px-2">
                ← Back to Players
            </Link>

            {/* Player Header */}
            <div className="bg-gradient-to-r from-sffl-navy to-sffl-red rounded-2xl overflow-hidden">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-8">
                    {/* Player Image */}
                    <div className="relative group">
                        {player.image ? (
                            <img
                                src={player.image}
                                alt={player.name}
                                className="w-full h-72 md:h-96 object-cover rounded-xl shadow-2xl transition-transform duration-500 group-hover:scale-[1.02]"
                            />
                        ) : (
                            <div className="w-full h-72 md:h-96 bg-gray-200 dark:bg-gray-700/50 rounded-xl flex items-center justify-center">
                                <div className="text-9xl font-black text-gray-300 dark:text-gray-600">#{player.jersey_number}</div>
                            </div>
                        )}
                        <div className="absolute top-3 right-3 md:top-4 md:right-4 bg-white dark:bg-gray-900 text-sffl-navy dark:text-white font-black px-4 py-2 md:px-6 md:py-3 rounded-full shadow-2xl text-lg md:text-2xl border-2 border-sffl-red/30">
                            #{player.jersey_number}
                        </div>
                    </div>

                    {/* Player Info */}
                    <div className="text-white flex flex-col justify-center gap-1 md:gap-4">
                        <h1 className="text-3xl md:text-6xl font-black uppercase tracking-tighter leading-none">{player.name}</h1>
                        <div className="text-lg md:text-2xl font-black text-sffl-red italic">{player.position}</div>
                        <div className="text-sm md:text-xl font-bold text-gray-100">{player.team?.name || 'Free Agent'}</div>
                        {player.bio && (
                            <div className="mt-4 p-4 bg-black/20 dark:bg-white/5 backdrop-blur-sm rounded-xl border border-white/10">
                                <p className="text-xs md:text-lg text-gray-100 leading-relaxed italic">{player.bio}</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Stats Section */}
            {stats && (
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-4 md:p-8 border border-gray-100 dark:border-gray-700">
                    <h2 className="text-xl md:text-3xl font-black text-sffl-navy dark:text-white mb-4 md:mb-6 uppercase tracking-tight">Season Performance</h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-4">
                        <StatCard label="Passing TDs" value={stats.passing_tds} />
                        <StatCard label="Comp. Passes" value={stats.completed_passes} />
                        <StatCard label="Pass Attempts" value={stats.passing_attempts} />
                        <StatCard label="Rushing TDs" value={stats.rushing_tds} />
                        <StatCard label="Rush Attempts" value={stats.rushing_attempts} />
                        <StatCard label="Receiving TDs" value={stats.receiving_tds} />
                        <StatCard label="Receptions" value={stats.receptions} />
                        <StatCard label="INT Thrown" value={stats.interceptions_thrown} />
                        <StatCard label="INT Caught" value={stats.interceptions} />
                        <StatCard label="DEF Sacks" value={stats.def_sacks} />
                        <StatCard label="QB Sacks" value={stats.qb_sacks} />
                        <StatCard label="Flag Pulls" value={stats.flag_pulls} />
                        <StatCard label="DEF TDs" value={stats.defensive_tds} />
                        <StatCard label="Pass Deflect" value={stats.pass_deflections} />
                        <StatCard label="Drops" value={stats.drops} />
                        <StatCard label="Safety" value={stats.safety} />
                    </div>
                </div>
            )}

            {/* If no stats exist, we can just omit or show a quick note */}
            {!stats && (
                <div className="text-center py-10 opacity-60">
                    <p className="text-lg font-bold text-gray-500">No statistics recorded yet.</p>
                </div>
            )}
        </div>
    );
};
