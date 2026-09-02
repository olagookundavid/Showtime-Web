import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
    TrophyIcon,
    ShieldCheckIcon,
    BoltIcon,
    ArrowRightIcon,
    SparklesIcon,
    XMarkIcon,
    CheckBadgeIcon,
} from '@heroicons/react/24/outline';
import { fantasySeasonApi, type LeaderboardEntry } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { Loader } from '../../components/ui/Loader';

const num = (v: number | null | undefined): number =>
    typeof v === 'number' && Number.isFinite(v) ? v : 0;

export function FantasyHub() {
    const { isAuthenticated } = useAuth();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const { data: dashboard, isLoading } = useQuery({
        queryKey: ['fantasyDashboard'],
        queryFn: () => fantasySeasonApi.getDashboard(),
    });

    const [showJoinModal, setShowJoinModal] = useState(false);
    const [teamNameInput, setTeamNameInput] = useState('');

    const season = dashboard?.season;
    const entered = dashboard?.entered === true;
    const topManagers: LeaderboardEntry[] = dashboard?.top_managers ?? [];

    const trimmedName = teamNameInput.trim();
    const nameValid = trimmedName.length >= 3 && trimmedName.length <= 40;

    const enterMutation = useMutation({
        mutationFn: async () => {
            if (!season?.id) throw new Error('Season not loaded');
            if (!nameValid) throw new Error('Team name must be 3–40 characters');
            return fantasySeasonApi.enterSeason(season.id, trimmedName);
        },
        onSuccess: () => {
            toast.success("You're in! Welcome to the season.");
            setShowJoinModal(false);
            setTeamNameInput('');
            queryClient.invalidateQueries({ queryKey: ['fantasyDashboard'] });
            navigate('/fantasy/dashboard');
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.error || err.message || 'Failed to join the season');
        },
    });

    if (isLoading) {
        return <Loader />;
    }

    if (!dashboard || !season) {
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

    const gameweek = dashboard.current_gameweek;
    // Only real once the manager is in — never invent a total we weren't given.
    const totalManagers = num(dashboard.team?.total_managers);

    return (
        <div className="space-y-6 md:space-y-10 pb-20">
            {/* Season card — a season you choose to enter, never one you're placed in */}
            <div className="relative overflow-hidden bg-sffl-navy text-white rounded-2xl md:rounded-3xl shadow-xl p-6 sm:p-10 md:p-12">
                <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 rounded-full bg-sffl-red/20 blur-3xl pointer-events-none" />
                <div className="absolute bottom-0 left-0 -mb-8 -ml-8 w-64 h-64 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />

                <div className="relative z-10 max-w-4xl mx-auto text-center">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-yellow-400 text-xs font-bold uppercase tracking-wider mb-5 backdrop-blur-md">
                        <BoltIcon className="w-3.5 h-3.5 text-yellow-400" />
                        {entered ? 'You Are Entered' : 'Season Open — Entry By Choice'}
                    </div>

                    <h1 className="text-3xl sm:text-5xl md:text-6xl font-black italic uppercase tracking-tighter text-white mb-4">
                        {season.name}
                    </h1>

                    <p className="text-sm sm:text-base md:text-lg text-gray-200 max-w-2xl mx-auto mb-6 leading-relaxed font-medium">
                        {entered
                            ? 'You have entered this season. Head to your dashboard for your rank, points, deadline and squad.'
                            : 'Review the season rules below, then decide for yourself. Nothing is created for you until you press Join.'}
                    </p>

                    {/* Season terms */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-left mb-8">
                        <div className="p-3.5 bg-white/10 rounded-xl border border-white/10">
                            <span className="text-[10px] uppercase font-black tracking-wider text-gray-300 block">
                                Signing Budget
                            </span>
                            <span className="text-xl font-black text-white">{num(season.budget).toFixed(2)} SC</span>
                        </div>
                        <div className="p-3.5 bg-white/10 rounded-xl border border-white/10">
                            <span className="text-[10px] uppercase font-black tracking-wider text-gray-300 block">
                                Squad Size
                            </span>
                            <span className="text-xl font-black text-white">{num(season.squad_size)} Players</span>
                        </div>
                        <div className="p-3.5 bg-white/10 rounded-xl border border-white/10">
                            <span className="text-[10px] uppercase font-black tracking-wider text-gray-300 block">
                                Female Quota
                            </span>
                            <span className="text-xl font-black text-white">
                                {num(season.min_female_offense)} OFF / {num(season.min_female_defense)} DEF
                            </span>
                        </div>
                        <div className="p-3.5 bg-white/10 rounded-xl border border-white/10">
                            <span className="text-[10px] uppercase font-black tracking-wider text-gray-300 block">
                                Lock Window
                            </span>
                            <span className="text-xl font-black text-white">
                                {num(season.lock_mins_before)}m Pre-Kickoff
                            </span>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
                        {!isAuthenticated ? (
                            <Link
                                to="/login?redirect=/fantasy"
                                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-sffl-red hover:bg-[#A52323] text-white font-black text-sm uppercase tracking-wider shadow-lg shadow-sffl-red/30 transition active:scale-95"
                            >
                                Sign In To Join <ArrowRightIcon className="w-4 h-4" />
                            </Link>
                        ) : entered ? (
                            <Link
                                to="/fantasy/dashboard"
                                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-sffl-red hover:bg-[#A52323] text-white font-black text-sm uppercase tracking-wider shadow-lg shadow-sffl-red/30 transition active:scale-95"
                            >
                                <CheckBadgeIcon className="w-4 h-4" /> Go To My Dashboard
                            </Link>
                        ) : (
                            <button
                                onClick={() => setShowJoinModal(true)}
                                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-sffl-red hover:bg-[#A52323] text-white font-black text-sm uppercase tracking-wider shadow-lg shadow-sffl-red/30 transition active:scale-95 cursor-pointer"
                            >
                                Join This Season <ArrowRightIcon className="w-4 h-4" />
                            </button>
                        )}

                        <Link
                            to="/fantasy/leagues"
                            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-sm transition backdrop-blur-md"
                        >
                            <TrophyIcon className="w-4 h-4 text-yellow-400" /> Leagues & Pools
                        </Link>

                        {isAuthenticated && entered && (
                            <Link
                                to="/fantasy/my-team"
                                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-sm transition backdrop-blur-md"
                            >
                                <ShieldCheckIcon className="w-4 h-4 text-emerald-400" /> My Active Squad
                            </Link>
                        )}
                        {isAuthenticated && entered && (
                            <Link
                                to="/fantasy/wallet"
                                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-sm transition backdrop-blur-md"
                            >
                                <SparklesIcon className="w-4 h-4 text-yellow-400" /> Prize Wallet
                            </Link>
                        )}
                    </div>

                    {/* Who's already in — only shown when we actually have the numbers */}
                    <p className="text-xs text-gray-300 font-medium mt-6">
                        {gameweek ? `Currently on Gameweek ${gameweek.number}. ` : ''}
                        {entered && totalManagers > 0
                            ? `${totalManagers.toLocaleString()} manager${totalManagers === 1 ? '' : 's'} in this season.`
                            : topManagers.length > 0
                            ? 'Managers are already on the board — see the standings below.'
                            : 'Be one of the first managers on the board.'}
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
                                7 Offense (1 Male QB, 1 Female QB, 5 Receivers) and 7 Defense (1 Rusher, 6 Defenders). Minimum{' '}
                                {num(season.min_female_offense)} female athletes on offense and {num(season.min_female_defense)} on defense.
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
                            <h3 className="text-lg font-black text-sffl-navy dark:text-white mb-2">Mini-Leagues Are Optional</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                                Entering the season is all you need to play — your squad scores in the overall rankings on its own. Private leagues and cash pools are a separate, optional extra.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Global Standings Preview Card */}
            {topManagers && topManagers.length > 0 && (
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
                        {topManagers.map((entry, idx) => (
                            <div key={entry.team_id ?? idx} className="py-3.5 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 px-2 rounded-xl transition">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                                        entry.rank === 1 ? 'bg-amber-400 text-gray-900 shadow-md ring-2 ring-amber-400/50' :
                                        entry.rank === 2 ? 'bg-gray-300 text-gray-800' :
                                        entry.rank === 3 ? 'bg-amber-700 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                                    }`}>
                                        {num(entry.rank) > 0 ? entry.rank : idx + 1}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{entry.team_name || 'Unnamed squad'}</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{entry.user_name || '—'}</p>
                                    </div>
                                </div>
                                <div className="text-right shrink-0">
                                    <p className="text-base font-black text-sffl-red">{num(entry.total_points).toFixed(2)} pts</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Join Season Modal — the deliberate opt-in */}
            {showJoinModal && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 w-full max-w-md rounded-3xl p-6 shadow-2xl">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-black text-sffl-navy dark:text-white uppercase">Join {season.name}</h3>
                            <button
                                onClick={() => setShowJoinModal(false)}
                                className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500 dark:text-gray-300 cursor-pointer"
                            >
                                <XMarkIcon className="w-5 h-5" />
                            </button>
                        </div>

                        <p className="text-xs text-gray-600 dark:text-gray-300 mb-4 leading-relaxed">
                            You are choosing to enter this season. This creates your manager team and puts you on the overall rankings — nothing happens until you confirm. Joining a mini-league is a separate, optional step.
                        </p>

                        <label className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase block mb-1">
                            Team Name (3–40 characters)
                        </label>
                        <input
                            type="text"
                            value={teamNameInput}
                            onChange={(e) => setTeamNameInput(e.target.value)}
                            placeholder="e.g. Lagos Blitz"
                            maxLength={40}
                            className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl p-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-sffl-red focus:ring-1 focus:ring-sffl-red"
                        />
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1.5 mb-4">
                            {trimmedName.length === 0
                                ? 'This is the name shown on every leaderboard.'
                                : nameValid
                                ? `${trimmedName.length}/40 characters`
                                : 'Team name must be between 3 and 40 characters.'}
                        </p>

                        <button
                            onClick={() => enterMutation.mutate()}
                            disabled={!nameValid || enterMutation.isPending}
                            className="w-full py-3 rounded-xl bg-sffl-red hover:bg-[#A52323] disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white font-black text-xs uppercase transition shadow-md cursor-pointer"
                        >
                            {enterMutation.isPending ? (
                                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                            ) : (
                                'Confirm & Enter Season'
                            )}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
