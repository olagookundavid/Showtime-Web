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
        <div className="min-h-screen bg-black text-white pb-24">
            {/* Header */}
            <div className="border-b border-neutral-800 bg-neutral-950/80 px-4 sm:px-6 py-6">
                <div className="max-w-6xl mx-auto">
                    <Link
                        to="/fantasy/leagues"
                        className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white mb-3 font-semibold transition"
                    >
                        <ArrowLeftIcon className="w-3.5 h-3.5" /> Back to Leagues
                    </Link>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-xs font-bold uppercase mb-1">
                                <TrophyIcon className="w-3 h-3" /> Official Standings
                            </div>
                            <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-white">
                                {isOverall ? 'Global Showtime Leaderboard' : 'League Standings'}
                            </h1>
                        </div>

                        {/* Gameweek Filter */}
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-neutral-400 font-bold uppercase">Filter:</span>
                            <select
                                value={selectedGWId}
                                onChange={(e) => {
                                    setSelectedGWId(e.target.value);
                                    setPage(1);
                                }}
                                className="bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-yellow-500"
                            >
                                <option value="">Season Overall</option>
                                {gameweeks.map(gw => (
                                    <option key={gw.id} value={gw.id}>
                                        Gameweek {gw.number}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Table */}
            <div className="max-w-6xl mx-auto px-4 sm:px-6 mt-8">
                <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl overflow-hidden">
                    {isLoading ? (
                        <div className="py-16 flex justify-center">
                            <div className="w-8 h-8 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : !leaderboardData || leaderboardData.data.length === 0 ? (
                        <div className="py-16 text-center text-neutral-400 text-sm">
                            No team rankings available for this selection yet.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-neutral-950/80 text-[11px] uppercase font-black tracking-wider text-neutral-400 border-b border-neutral-800">
                                    <tr>
                                        <th className="py-3.5 px-4 w-16 text-center">Rank</th>
                                        <th className="py-3.5 px-4">Team & Manager</th>
                                        {selectedGWId && <th className="py-3.5 px-4 text-right">GW Points</th>}
                                        <th className="py-3.5 px-4 text-right">Total Points</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-neutral-800/60">
                                    {leaderboardData.data.map((entry) => (
                                        <tr key={entry.team_id} className="hover:bg-neutral-800/40 transition">
                                            <td className="py-3.5 px-4 text-center">
                                                <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-black ${
                                                    entry.rank === 1 ? 'bg-yellow-500 text-black' :
                                                    entry.rank === 2 ? 'bg-neutral-300 text-black' :
                                                    entry.rank === 3 ? 'bg-amber-700 text-white' : 'bg-neutral-800 text-neutral-400'
                                                }`}>
                                                    {entry.rank}
                                                </span>
                                            </td>
                                            <td className="py-3.5 px-4">
                                                <p className="font-bold text-white text-sm">{entry.team_name}</p>
                                                <p className="text-xs text-neutral-400">{entry.user_name}</p>
                                            </td>
                                            {selectedGWId && (
                                                <td className="py-3.5 px-4 text-right font-mono font-bold text-neutral-300">
                                                    {entry.gw_points.toFixed(2)}
                                                </td>
                                            )}
                                            <td className="py-3.5 px-4 text-right font-mono font-black text-yellow-400 text-base">
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
                        <div className="p-4 border-t border-neutral-800 flex items-center justify-between text-xs text-neutral-400">
                            <span>Page {page} of {leaderboardData.total_pages}</span>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 transition"
                                >
                                    <ChevronLeftIcon className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => setPage(p => Math.min(leaderboardData.total_pages, p + 1))}
                                    disabled={page === leaderboardData.total_pages}
                                    className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 transition"
                                >
                                    <ChevronRightIcon className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
