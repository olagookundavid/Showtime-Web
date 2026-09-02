import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { 
    TrophyIcon, 
    ShieldCheckIcon, 
    BoltIcon, 
    ArrowRightIcon, 
    SparklesIcon,
    BanknotesIcon
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
            <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4">
                <ShieldCheckIcon className="w-16 h-16 text-yellow-500 mb-4 animate-bounce" />
                <h1 className="text-3xl font-black uppercase tracking-tight text-white mb-2">Fantasy Flag Football</h1>
                <p className="text-neutral-400 max-w-md mb-6">No active fantasy season currently open. Stay tuned for the upcoming season kickoff!</p>
                <Link to="/" className="px-6 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-sm font-semibold transition">
                    Return to Homepage
                </Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-white pb-20">
            {/* Hero Section */}
            <div className="relative overflow-hidden border-b border-neutral-800 bg-gradient-to-b from-neutral-900/80 to-black pt-12 pb-16 px-4 sm:px-6 lg:px-8">
                <div className="max-w-6xl mx-auto text-center">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-xs font-semibold uppercase tracking-wider mb-6">
                        <BoltIcon className="w-3.5 h-3.5" /> Official Showtime Fantasy V1.2
                    </div>

                    <h1 className="text-4xl sm:text-6xl font-black uppercase tracking-tight text-white mb-4">
                        {season.name}
                    </h1>

                    <p className="text-base sm:text-lg text-neutral-400 max-w-2xl mx-auto mb-8">
                        Assemble your 14-player squad with 230 SC budget. Compete in private and public leagues across Nigeria with live official Showtime scoring.
                    </p>

                    <div className="flex flex-wrap items-center justify-center gap-4">
                        <Link
                            to={isAuthenticated ? "/fantasy/build" : "/login?redirect=/fantasy/build"}
                            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-black font-extrabold text-sm uppercase tracking-wider shadow-lg shadow-yellow-500/20 transition active:scale-95"
                        >
                            Build My Lineup <ArrowRightIcon className="w-4 h-4" />
                        </Link>
                        <Link
                            to="/fantasy/leagues"
                            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-white font-bold text-sm transition"
                        >
                            <TrophyIcon className="w-4 h-4 text-yellow-400" /> Leagues & Pools
                        </Link>
                        {isAuthenticated && (
                            <>
                                <Link
                                    to="/fantasy/my-team"
                                    className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-white font-bold text-sm transition"
                                >
                                    <ShieldCheckIcon className="w-4 h-4 text-emerald-400" /> My Active Squad
                                </Link>
                                <Link
                                    to="/fantasy/wallet"
                                    className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-white font-bold text-sm transition"
                                >
                                    <BanknotesIcon className="w-4 h-4 text-yellow-400" /> My Wallet
                                </Link>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Quick Stats Bar */}
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-neutral-900/90 border border-neutral-800 p-4 rounded-2xl shadow-xl backdrop-blur-md">
                    <div className="text-center border-r border-neutral-800/80">
                        <span className="text-xs text-neutral-400 font-medium">Signing Budget</span>
                        <p className="text-xl font-black text-yellow-400 mt-0.5">230.00 SC</p>
                    </div>
                    <div className="text-center sm:border-r border-neutral-800/80">
                        <span className="text-xs text-neutral-400 font-medium">Starters (No Subs)</span>
                        <p className="text-xl font-black text-white mt-0.5">14 Players</p>
                    </div>
                    <div className="text-center border-r border-neutral-800/80">
                        <span className="text-xs text-neutral-400 font-medium">Current Status</span>
                        <p className="text-xl font-black text-emerald-400 mt-0.5">{currentGW ? `GW ${currentGW.number}` : 'ACTIVE'}</p>
                    </div>
                    <div className="text-center">
                        <span className="text-xs text-neutral-400 font-medium">Lock Rule</span>
                        <p className="text-xl font-black text-white mt-0.5">15m Pre-Game</p>
                    </div>
                </div>
            </div>

            {/* Core Features / Explanations */}
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-16">
                <div className="text-center mb-10">
                    <h2 className="text-2xl font-black uppercase tracking-tight text-white">How Showtime Fantasy Works</h2>
                    <p className="text-sm text-neutral-400 mt-1">Official flag football mechanics built for genuine Nigerian co-ed competition.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-neutral-900/40 border border-neutral-800 rounded-2xl p-6 relative overflow-hidden">
                        <div className="w-10 h-10 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center text-yellow-400 mb-4">
                            <ShieldCheckIcon className="w-5 h-5" />
                        </div>
                        <h3 className="text-lg font-bold text-white mb-2">Strict 7/7 Coed Split</h3>
                        <p className="text-sm text-neutral-400 leading-relaxed">
                            7 Offense (1 Male QB, 1 Female QB, 5 Receivers) and 7 Defense (1 Rusher, 6 Defenders). Minimum 3 female athletes required on offense and defense.
                        </p>
                    </div>

                    <div className="bg-neutral-900/40 border border-neutral-800 rounded-2xl p-6 relative overflow-hidden">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-4">
                            <BoltIcon className="w-5 h-5" />
                        </div>
                        <h3 className="text-lg font-bold text-white mb-2">Set & Forget or Edit Weekly</h3>
                        <p className="text-sm text-neutral-400 leading-relaxed">
                            Unedited lineups automatically carry forward to the next match day and accumulate points all season long. You can also make unlimited free lineup adjustments before each lock.
                        </p>
                    </div>

                    <div className="bg-neutral-900/40 border border-neutral-800 rounded-2xl p-6 relative overflow-hidden">
                        <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-4">
                            <SparklesIcon className="w-5 h-5" />
                        </div>
                        <h3 className="text-lg font-bold text-white mb-2">One Squad Across All Leagues</h3>
                        <p className="text-sm text-neutral-400 leading-relaxed">
                            Your single squad competes simultaneously in the global leaderboard and any private or paid custom leagues you join. Seamless Paystack payments for cash prize pools.
                        </p>
                    </div>
                </div>
            </div>

            {/* Top Leaderboard Preview */}
            {leaderboardData && leaderboardData.data.length > 0 && (
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-16">
                    <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h2 className="text-xl font-black uppercase tracking-tight text-white flex items-center gap-2">
                                    <TrophyIcon className="w-5 h-5 text-yellow-400" /> Global Leaderboard Leaders
                                </h2>
                                <p className="text-xs text-neutral-400 mt-0.5">Top performing managers in the official league</p>
                            </div>
                            <Link
                                to={`/fantasy/leaderboard/${season.id}?type=overall`}
                                className="text-xs text-yellow-400 hover:text-yellow-300 font-bold inline-flex items-center gap-1"
                            >
                                View All <ArrowRightIcon className="w-3.5 h-3.5" />
                            </Link>
                        </div>

                        <div className="divide-y divide-neutral-800">
                            {leaderboardData.data.map((entry) => (
                                <div key={entry.team_id} className="py-3 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black ${
                                            entry.rank === 1 ? 'bg-yellow-500 text-black' :
                                            entry.rank === 2 ? 'bg-neutral-300 text-black' :
                                            entry.rank === 3 ? 'bg-amber-700 text-white' : 'bg-neutral-800 text-neutral-400'
                                        }`}>
                                            {entry.rank}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-white">{entry.team_name}</p>
                                            <p className="text-xs text-neutral-400">{entry.user_name}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-black text-yellow-400">{entry.total_points.toFixed(2)} pts</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
