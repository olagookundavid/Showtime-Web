import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { 
    TrophyIcon, 
    ShieldCheckIcon, 
    BoltIcon, 
    ArrowRightIcon, 
    SparklesIcon 
} from '@heroicons/react/24/outline';
import { fantasyApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { Loader } from '../../components/ui/Loader';

export function FantasyHub() {
    const { isAuthenticated } = useAuth();

    const { data: season, isLoading: seasonLoading } = useQuery({
        queryKey: ['fantasySeason'],
        queryFn: fantasyApi.getActiveSeason,
    });

    const { data: gameweeks = [], isLoading: gwLoading } = useQuery({
        queryKey: ['fantasyGameweeks', season?.id],
        queryFn: () => (season?.id ? fantasyApi.getGameweeks(season.id) : Promise.resolve([])),
        enabled: !!season?.id,
    });

    const currentGW = gameweeks.find(gw => gw.status === 'SCHEDULED' || gw.status === 'LOCKED') || gameweeks[0];

    const { data: leaderboardData } = useQuery({
        queryKey: ['fantasyOverallLeaderboard', season?.id, currentGW?.id],
        queryFn: () => (season?.id ? fantasyApi.getOverallLeaderboard(season.id, { limit: 5 }) : Promise.resolve({ data: [], total: 0, total_pages: 0 })),
        enabled: !!season?.id,
    });

    if (seasonLoading || gwLoading) {
        return <Loader />;
    }

    if (!season) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4 bg-white dark:bg-gray-800 rounded-2xl md:rounded-3xl border border-gray-200 dark:border-gray-700 shadow-sm p-8 md:p-12">
                <div className="w-16 h-16 rounded-2xl bg-sffl-red/10 dark:bg-sffl-red/20 flex items-center justify-center text-sffl-red mb-4">
                    <ShieldCheckIcon className="w-10 h-10 animate-bounce" />
                </div>
                <h1 className="text-3xl font-black uppercase tracking-tight text-sffl-navy dark:text-white mb-2">
                    Fantasy Flag Football
                </h1>
                <p className="text-gray-600 dark:text-gray-300 max-w-md mb-6 text-sm">
                    No active fantasy season is currently open. Fixtures and player pools are being finalized. Stay tuned for kickoff!
                </p>
                <Link 
                    to="/" 
                    className="px-6 py-2.5 rounded-xl bg-sffl-red hover:bg-[#A52323] text-white font-bold text-sm shadow-md transition-all active:scale-95"
                >
                    Return to Homepage
                </Link>
            </div>
        );
    }

    return (
        <div className="space-y-6 md:space-y-10 pb-20">
            {/* Hero Section Banner */}
            <div className="relative overflow-hidden bg-sffl-navy text-white rounded-2xl md:rounded-3xl shadow-xl p-6 sm:p-10 md:p-14 text-center">
                <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 rounded-full bg-sffl-red/20 blur-3xl pointer-events-none" />
                <div className="absolute bottom-0 left-0 -mb-8 -ml-8 w-64 h-64 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />

                <div className="relative z-10 max-w-4xl mx-auto">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-yellow-400 text-xs font-bold uppercase tracking-wider mb-5 backdrop-blur-md">
                        <BoltIcon className="w-3.5 h-3.5 text-yellow-400" /> Official Showtime Fantasy V1.2
                    </div>

                    <h1 className="text-3xl sm:text-5xl md:text-6xl font-black italic uppercase tracking-tighter text-white mb-4">
                        {season.name}
                    </h1>

                    <p className="text-sm sm:text-base md:text-lg text-gray-200 max-w-2xl mx-auto mb-8 leading-relaxed font-medium">
                        Assemble your 14-player squad with a 230 SC budget. Compete in private friend leagues, company pools, and national tournaments with official Showtime scoring.
                    </p>

                    <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
                        <Link
                            to={isAuthenticated ? "/fantasy/build" : "/login?redirect=/fantasy/build"}
                            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-sffl-red hover:bg-[#A52323] text-white font-black text-sm uppercase tracking-wider shadow-lg shadow-sffl-red/30 transition active:scale-95"
                        >
                            Build My Lineup <ArrowRightIcon className="w-4 h-4" />
                        </Link>
                        <Link
                            to="/fantasy/leagues"
                            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-sm transition backdrop-blur-md"
                        >
                            <TrophyIcon className="w-4 h-4 text-yellow-400" /> Leagues & Pools
                        </Link>
                        {isAuthenticated && (
                            <Link
                                to="/fantasy/my-team"
                                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-sm transition backdrop-blur-md"
                            >
                                <ShieldCheckIcon className="w-4 h-4 text-emerald-400" /> My Active Squad
                            </Link>
                        )}
                        {isAuthenticated && (
                            <Link
                                to="/fantasy/wallet"
                                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-sm transition backdrop-blur-md"
                            >
                                <SparklesIcon className="w-4 h-4 text-yellow-400" /> Prize Wallet
                            </Link>
                        )}
                    </div>
                </div>
            </div>

            {/* Quick Stats Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 rounded-xl md:rounded-2xl shadow-sm text-center">
                    <span className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider block">Signing Budget</span>
                    <p className="text-xl md:text-2xl font-black text-sffl-navy dark:text-white mt-1">230.00 SC</p>
                </div>
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 rounded-xl md:rounded-2xl shadow-sm text-center">
                    <span className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider block">Starters (No Subs)</span>
                    <p className="text-xl md:text-2xl font-black text-sffl-navy dark:text-white mt-1">14 Players</p>
                </div>
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 rounded-xl md:rounded-2xl shadow-sm text-center">
                    <span className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider block">Current Status</span>
                    <p className="text-xl md:text-2xl font-black text-sffl-red mt-1">
                        {currentGW ? `GW ${currentGW.number}` : 'ACTIVE'}
                    </p>
                </div>
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 rounded-xl md:rounded-2xl shadow-sm text-center">
                    <span className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider block">Lock Rule</span>
                    <p className="text-xl md:text-2xl font-black text-sffl-navy dark:text-white mt-1">
                        {season.lock_mins_before}m Pre-Kickoff
                    </p>
                </div>
            </div>

            {/* How Showtime Fantasy Works */}
            <div>
                <div className="mb-6">
                    <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-sffl-navy dark:text-white">
                        How Showtime Fantasy Works
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        Official co-ed flag football competition built for authentic Nigerian gamedays.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6">
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
                        <div>
                            <div className="w-12 h-12 rounded-xl bg-sffl-red/10 dark:bg-sffl-red/20 border border-sffl-red/20 flex items-center justify-center text-sffl-red mb-4">
                                <ShieldCheckIcon className="w-6 h-6" />
                            </div>
                            <h3 className="text-lg font-black text-sffl-navy dark:text-white mb-2">Strict 7/7 Coed Split</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                                7 Offense (1 Male QB, 1 Female QB, 5 Receivers) and 7 Defense (1 Rusher, 6 Defenders). Minimum 3 female athletes required on offense and defense.
                            </p>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
                        <div>
                            <div className="w-12 h-12 rounded-xl bg-sffl-navy/10 dark:bg-white/10 border border-sffl-navy/20 dark:border-white/20 flex items-center justify-center text-sffl-navy dark:text-white mb-4">
                                <BoltIcon className="w-6 h-6" />
                            </div>
                            <h3 className="text-lg font-black text-sffl-navy dark:text-white mb-2">Set & Forget or Edit Weekly</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                                Unedited lineups automatically roll over to the next match day and accumulate points all season long. You can also make free tactical adjustments before lock.
                            </p>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
                        <div>
                            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-4">
                                <SparklesIcon className="w-6 h-6" />
                            </div>
                            <h3 className="text-lg font-black text-sffl-navy dark:text-white mb-2">One Squad Across All Leagues</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                                Your single squad competes simultaneously in the global leaderboard and private leagues. Cash prize pools are settled directly into your Showtime Wallet with Paystack.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Global Standings Preview Card */}
            {leaderboardData && leaderboardData.data.length > 0 && (
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100 dark:border-gray-700">
                        <div>
                            <h2 className="text-xl font-black uppercase tracking-tight text-sffl-navy dark:text-white flex items-center gap-2">
                                <TrophyIcon className="w-5 h-5 text-sffl-red" /> Global Standings Leaders
                            </h2>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Top performing managers in the official league</p>
                        </div>
                        <Link
                            to={`/fantasy/leaderboard/${season.id}?type=overall`}
                            className="text-xs text-sffl-red hover:text-[#A52323] font-black uppercase inline-flex items-center gap-1 transition"
                        >
                            Full Table <ArrowRightIcon className="w-3.5 h-3.5" />
                        </Link>
                    </div>

                    <div className="divide-y divide-gray-100 dark:divide-gray-700">
                        {leaderboardData.data.map((entry) => (
                            <div key={entry.team_id} className="py-3.5 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 px-2 rounded-xl transition">
                                <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black ${
                                        entry.rank === 1 ? 'bg-amber-400 text-gray-900 shadow-md ring-2 ring-amber-400/50' :
                                        entry.rank === 2 ? 'bg-gray-300 text-gray-800' :
                                        entry.rank === 3 ? 'bg-amber-700 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                                    }`}>
                                        {entry.rank}
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-gray-900 dark:text-white">{entry.team_name}</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">{entry.user_name}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-base font-black text-sffl-red">{entry.total_points.toFixed(2)} pts</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
