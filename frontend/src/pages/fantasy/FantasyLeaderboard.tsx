import { useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { 
    TrophyIcon, 
    ArrowLeftIcon, 
    ChevronLeftIcon, 
    ChevronRightIcon 
} from '@heroicons/react/24/outline';
import { fantasyApi } from '../../services/api';

export function FantasyLeaderboard() {
    const { id } = useParams<{ id: string }>();
    const [searchParams] = useSearchParams();
    const isOverall = searchParams.get('type') === 'overall';

    const [page, setPage] = useState(1);
    const [selectedGWId, setSelectedGWId] = useState<string>('');

    const { data: season } = useQuery({
        queryKey: ['fantasySeason'],
        queryFn: fantasyApi.getActiveSeason,
    });

    const { data: gameweeks = [] } = useQuery({
        queryKey: ['fantasyGameweeks', season?.id],
        queryFn: () => (season?.id ? fantasyApi.getGameweeks(season.id) : Promise.resolve([])),
        enabled: !!season?.id,
    });

    const { data: leaderboardData, isLoading } = useQuery({
        queryKey: ['fantasyLeaderboard', id, isOverall, selectedGWId, page],
        queryFn: () => {
            if (!id) return Promise.resolve({ data: [], total: 0, total_pages: 0 });
            const params = {
                gameweek_id: selectedGWId || undefined,
                page,
                limit: 25,
            };
            if (isOverall) {
                return fantasyApi.getOverallLeaderboard(id, params);
            }
            return fantasyApi.getLeaderboard(id, params);
        },
        enabled: !!id,
    });

    return (
        <div className="space-y-6 md:space-y-8 pb-24">
            {/* Header Showtime Navy Banner */}
            <div className="bg-sffl-navy text-white rounded-2xl md:rounded-3xl shadow-xl p-6 md:p-8">
                <Link
                    to="/fantasy/leagues"
                    className="inline-flex items-center gap-1.5 text-xs text-gray-300 hover:text-white mb-3 font-semibold transition"
                >
                    <ArrowLeftIcon className="w-3.5 h-3.5" /> Back to Leagues
                </Link>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 border border-white/20 text-yellow-400 text-xs font-bold uppercase mb-2">
                            <TrophyIcon className="w-3 h-3 text-yellow-400" /> Official Standings
                        </div>
                        <h1 className="text-2xl sm:text-4xl font-black italic uppercase tracking-tight text-white">
                            {isOverall ? 'Global Showtime Leaderboard' : 'League Standings'}
                        </h1>
                    </div>

                    {/* Gameweek Filter */}
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-300 font-bold uppercase">Filter:</span>
                        <select
                            value={selectedGWId}
                            onChange={(e) => {
                                setSelectedGWId(e.target.value);
                                setPage(1);
                            }}
                            className="bg-white/10 border border-white/20 text-white rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-sffl-red cursor-pointer"
                        >
                            <option value="" className="text-gray-900 bg-white">Season Overall</option>
                            {gameweeks.map(gw => (
                                <option key={gw.id} value={gw.id} className="text-gray-900 bg-white">
                                    Gameweek {gw.number}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Main Table Card */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm overflow-hidden">
                {isLoading ? (
                    <div className="py-16 flex justify-center">
                        <div className="w-8 h-8 border-2 border-sffl-red border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : !leaderboardData || leaderboardData.data.length === 0 ? (
                    <div className="py-16 text-center text-gray-500 dark:text-gray-400 text-sm">
                        No team rankings available for this selection yet.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 dark:bg-gray-700/50 text-[11px] uppercase font-bold tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                                <tr>
                                    <th className="py-3.5 px-4 w-16 text-center">Rank</th>
                                    <th className="py-3.5 px-4">Team & Manager</th>
                                    {selectedGWId && <th className="py-3.5 px-4 text-right">GW Points</th>}
                                    <th className="py-3.5 px-4 text-right">Total Points</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {leaderboardData.data.map((entry) => (
                                    <tr key={entry.team_id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition">
                                        <td className="py-3.5 px-4 text-center">
                                            <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-black ${
                                                entry.rank === 1 ? 'bg-amber-400 text-gray-900 shadow-md ring-2 ring-amber-400/50' :
                                                entry.rank === 2 ? 'bg-gray-300 text-gray-800' :
                                                entry.rank === 3 ? 'bg-amber-700 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                                            }`}>
                                                {entry.rank}
                                            </span>
                                        </td>
                                        <td className="py-3.5 px-4">
                                            <p className="font-bold text-gray-900 dark:text-white text-sm">{entry.team_name}</p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">{entry.user_name}</p>
                                        </td>
                                        {selectedGWId && (
                                            <td className="py-3.5 px-4 text-right font-mono font-bold text-gray-700 dark:text-gray-300">
                                                {entry.gw_points.toFixed(2)}
                                            </td>
                                        )}
                                        <td className="py-3.5 px-4 text-right font-mono font-black text-sffl-red text-base">
                                            {entry.total_points.toFixed(2)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination */}
                {leaderboardData && leaderboardData.total_pages > 1 && (
                    <div className="p-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                        <span>Page {page} of {leaderboardData.total_pages}</span>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="p-2 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-40 transition cursor-pointer"
                            >
                                <ChevronLeftIcon className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => setPage(p => Math.min(leaderboardData.total_pages, p + 1))}
                                disabled={page === leaderboardData.total_pages}
                                className="p-2 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-40 transition cursor-pointer"
                            >
                                <ChevronRightIcon className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
