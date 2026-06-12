import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getPlayerById, getPlayerStatById, getCompetitions, getStatDates } from '../../services/api';
import { Loader } from '../../components/ui/Loader';
import { Spinner } from '../../components/ui';
import { useSearchParams } from 'react-router-dom';

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
    const [searchParams, setSearchParams] = useSearchParams();
    
    const compId = searchParams.get('comp') || '';
    const matchDate = searchParams.get('date') || '';
    const matchId = searchParams.get('match') || undefined;

    const { data: player, isLoading: loadingPlayer, isError: error } = useQuery({
        queryKey: ['publicPlayer', id],
        queryFn: () => getPlayerById(id!),
        enabled: !!id,
    });

    // ── Filters Data ─────────────────────────────────────────────────────────
    const { data: competitionsData } = useQuery({
        queryKey: ['publicCompetitions'],
        queryFn: () => getCompetitions(1, 100),
    });
    const competitions = (competitionsData?.data || []).filter(c => c.status !== 'inactive');

    const { data: datesData } = useQuery({
        queryKey: ['statDates', compId],
        queryFn: () => getStatDates(compId),
        enabled: !!compId,
    });
    const statDates = datesData || [];

    // Auto-select latest date when competition changes and no date is selected
    useEffect(() => {
        if (compId && statDates.length > 0 && !matchDate) {
            const params = new URLSearchParams(searchParams);
            params.set('date', statDates[0].substring(0, 10));
            setSearchParams(params, { replace: true });
        }
    }, [compId, statDates, matchDate, setSearchParams, searchParams]);

    const { data: stats, isLoading: loadingStats } = useQuery({
        queryKey: ['playerStats', id, compId, matchDate, matchId],
        queryFn: () => getPlayerStatById(id!, compId || undefined, matchDate || undefined, matchId),
        enabled: !!id,
    });

    // Only the initial player fetch blocks the whole page. Stats reload in place
    // (see the section below) so changing the competition/match-day filters never
    // tears down the header — just the stats area spins.
    if (loadingPlayer) return <Loader />;

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
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                {/* Stats Filters */}
                <div className="p-4 md:p-6 bg-gray-50 dark:bg-gray-900/40 border-b border-gray-100 dark:border-gray-700">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <h2 className="text-xl md:text-2xl font-black text-sffl-navy dark:text-white uppercase tracking-tight">
                            Performance Stats
                        </h2>
                        
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="flex flex-col gap-1 min-w-[160px]">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Competition</label>
                                <select
                                    value={compId}
                                    onChange={(e) => {
                                        const params = new URLSearchParams(searchParams);
                                        if (e.target.value) params.set('comp', e.target.value);
                                        else params.delete('comp');
                                        params.delete('date'); 
                                        params.delete('match');
                                        setSearchParams(params, { replace: true });
                                    }}
                                    className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-1.5 text-xs font-bold outline-none focus:ring-2 focus:ring-sffl-red transition-all"
                                >
                                    <option value="">All Competitions</option>
                                    {competitions.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className={`flex flex-col gap-1 min-w-[140px] transition-opacity duration-300 ${!compId ? 'opacity-40' : 'opacity-100'}`}>
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Match Day</label>
                                <select
                                    value={matchDate}
                                    onChange={(e) => {
                                        const params = new URLSearchParams(searchParams);
                                        if (e.target.value) params.set('date', e.target.value);
                                        else params.delete('date');
                                        params.delete('match');
                                        setSearchParams(params, { replace: true });
                                    }}
                                    className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-1.5 text-xs font-bold outline-none focus:ring-2 focus:ring-sffl-red transition-all disabled:cursor-not-allowed"
                                    disabled={!compId}
                                >
                                    <option value="">Full Season</option>
                                    {statDates.map(date => (
                                        <option key={date} value={date.substring(0, 10)}>
                                            {new Date(date).toLocaleDateString('en-US', { 
                                                weekday: 'short', 
                                                month: 'short', 
                                                day: 'numeric'
                                            })}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                {loadingStats ? (
                    <Spinner label="Loading stats…" className="py-16" />
                ) : stats ? (
                    <div className="p-4 md:p-8">
                        <div className="mb-6 flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-sffl-red animate-pulse" />
                            <span className="text-xs font-black text-gray-400 uppercase tracking-widest">
                                {matchDate ? `Viewing Match: ${matchDate}` : compId ? `Viewing Season: ${competitions.find(c => c.id === compId)?.name}` : 'Viewing All-Time Stats'}
                            </span>
                        </div>
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
                        <StatCard label="Extra Points" value={stats.extra_points_tds} />
                        <StatCard label="Safety" value={stats.safety} />
                    </div>
                </div>
                ) : (
                    <div className="p-12 text-center opacity-60">
                        <div className="text-4xl mb-4">📊</div>
                        <p className="text-lg font-bold text-gray-500">
                            {matchDate
                                ? `No statistics recorded yet for ${matchDate}.`
                                : 'No statistics recorded yet for this selection.'
                            }
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};
