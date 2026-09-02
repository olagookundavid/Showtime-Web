import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { 
    UserGroupIcon,
    PencilSquareIcon, 
    ChevronRightIcon, 
    XMarkIcon, 
    LockClosedIcon, 
    ClockIcon, 
    SparklesIcon 
} from '@heroicons/react/24/outline';
import { 
    fantasyApi, 
    type FantasyLineupPick 
} from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { Loader } from '../../components/ui/Loader';

export function FantasyMyTeam() {
    const { isAuthenticated, isLoading: authLoading } = useAuth();

    // Active Season
    const { data: season, isLoading: seasonLoading } = useQuery({
        queryKey: ['fantasySeason'],
        queryFn: fantasyApi.getActiveSeason,
    });

    // Gameweeks
    const { data: gameweeks = [], isLoading: gwLoading } = useQuery({
        queryKey: ['fantasyGameweeks', season?.id],
        queryFn: () => (season?.id ? fantasyApi.getGameweeks(season.id) : Promise.resolve([])),
        enabled: !!season?.id,
    });

    const [selectedGWId, setSelectedGWId] = useState<string>('');

    // Default to first scheduled or locked gameweek
    useEffect(() => {
        if (gameweeks.length > 0 && !selectedGWId) {
            const current = gameweeks.find(gw => gw.status === 'SCHEDULED' || gw.status === 'LOCKED') || gameweeks[0];
            setSelectedGWId(current.id);
        }
    }, [gameweeks, selectedGWId]);

    // Fetch Lineup for Selected Gameweek
    const { data: lineup, isLoading: lineupLoading } = useQuery({
        queryKey: ['myFantasyLineup', season?.id, selectedGWId],
        queryFn: () => (season?.id && selectedGWId ? fantasyApi.getMyLineup(season.id, selectedGWId) : Promise.resolve(null)),
        enabled: !!season?.id && !!selectedGWId && isAuthenticated,
    });

    // Points Breakdown Drawer State
    const [selectedPlayerForBreakdown, setSelectedPlayerForBreakdown] = useState<FantasyLineupPick | null>(null);

    const { data: breakdownData, isLoading: breakdownLoading } = useQuery({
        queryKey: ['playerBreakdown', selectedPlayerForBreakdown?.player_id, selectedGWId],
        queryFn: () => {
            if (!selectedPlayerForBreakdown || !selectedGWId) return Promise.resolve(null);
            return fantasyApi.getPlayerBreakdown(selectedPlayerForBreakdown.player_id, selectedGWId);
        },
        enabled: !!selectedPlayerForBreakdown && !!selectedGWId,
    });

    if (authLoading || seasonLoading || gwLoading || lineupLoading) {
        return <Loader />;
    }

    if (!lineup) {
        return (
            <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4">
                <UserGroupIcon className="w-16 h-16 text-yellow-500 mb-4" />
                <h1 className="text-2xl font-black uppercase text-white mb-2">No Lineup Found</h1>
                <p className="text-neutral-400 max-w-md mb-6">You haven't drafted your 14-player squad for this gameweek yet.</p>
                <Link to="/fantasy/build" className="px-6 py-3 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-black font-extrabold text-sm uppercase shadow-lg shadow-yellow-500/20">
                    Draft Your Lineup Now
                </Link>
            </div>
        );
    }

    const isLocked = lineup.status === 'LOCKED';

    return (
        <div className="min-h-screen bg-black text-white pb-24">
            {/* Header / Summary Bar */}
            <div className="border-b border-neutral-800 bg-neutral-950/80 px-4 sm:px-6 py-6">
                <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className={`text-xs font-black px-2.5 py-0.5 rounded uppercase flex items-center gap-1 ${
                                isLocked ? 'bg-red-500/10 border border-red-500/20 text-red-400' : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                            }`}>
                                {isLocked ? <LockClosedIcon className="w-3 h-3" /> : <ClockIcon className="w-3 h-3" />}
                                {lineup.status}
                            </span>
                            {lineup.is_rollover && (
                                <span className="text-xs font-black px-2.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400 uppercase flex items-center gap-1">
                                    <SparklesIcon className="w-3 h-3" /> Auto Rolled Over
                                </span>
                            )}
                        </div>
                        <h1 className="text-3xl font-black uppercase tracking-tight text-white mt-1">
                            {lineup.team_name}
                        </h1>
                        <p className="text-xs text-neutral-400 mt-0.5">
                            Official Showtime Fantasy Roster (14 Starters)
                        </p>
                    </div>

                    {/* Right Controls: GW Selector + Edit Button */}
                    <div className="flex items-center gap-3">
                        <select
                            value={selectedGWId}
                            onChange={(e) => setSelectedGWId(e.target.value)}
                            className="bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-2.5 text-xs font-bold text-white focus:outline-none focus:border-yellow-500"
                        >
                            {gameweeks.map(gw => (
                                <option key={gw.id} value={gw.id}>
                                    Gameweek {gw.number} ({gw.status})
                                </option>
                            ))}
                        </select>

                        {!isLocked && (
                            <Link
                                to="/fantasy/build"
                                className="px-5 py-2.5 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-black font-extrabold text-xs uppercase flex items-center gap-1.5 transition active:scale-95 shadow-md shadow-yellow-500/20"
                            >
                                <PencilSquareIcon className="w-3.5 h-3.5" /> Edit Lineup
                            </Link>
                        )}
                    </div>
                </div>

                {/* Points & Budget Strip */}
                <div className="max-w-6xl mx-auto mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 bg-neutral-900/60 border border-neutral-800 rounded-xl">
                        <span className="text-[10px] uppercase font-bold text-neutral-400 block">Gameweek Score</span>
                        <span className="text-2xl font-black text-yellow-400">{lineup.points.toFixed(2)} pts</span>
                    </div>
                    <div className="p-3 bg-neutral-900/60 border border-neutral-800 rounded-xl">
                        <span className="text-[10px] uppercase font-bold text-neutral-400 block">Total Budget Spent</span>
                        <span className="text-2xl font-black text-white">{lineup.total_spent.toFixed(2)} SC</span>
                    </div>
                    <div className="p-3 bg-neutral-900/60 border border-neutral-800 rounded-xl">
                        <span className="text-[10px] uppercase font-bold text-neutral-400 block">Remaining Cap</span>
                        <span className="text-2xl font-black text-neutral-300">{lineup.remaining_budget.toFixed(2)} SC</span>
                    </div>
                    <div className="p-3 bg-neutral-900/60 border border-neutral-800 rounded-xl">
                        <span className="text-[10px] uppercase font-bold text-neutral-400 block">Roster Spots</span>
                        <span className="text-2xl font-black text-emerald-400">14 / 14 Starters</span>
                    </div>
                </div>
            </div>

            {/* Squad List */}
            <div className="max-w-6xl mx-auto px-4 sm:px-6 mt-8">
                <div className="space-y-6">
                    {/* Offense Section */}
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                            <h2 className="text-sm font-black uppercase tracking-wider text-yellow-400">Offensive Unit (7 Starters)</h2>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {lineup.picks.filter(p => p.slot.startsWith('QB') || p.slot.startsWith('REC')).map(pick => (
                                <div
                                    key={pick.slot}
                                    onClick={() => setSelectedPlayerForBreakdown(pick)}
                                    className="p-3.5 bg-neutral-900/60 hover:bg-neutral-900 border border-neutral-800 hover:border-neutral-700 rounded-2xl flex items-center justify-between cursor-pointer transition"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="relative">
                                            <img
                                                src={pick.player_image || '/placeholder-player.png'}
                                                alt={pick.player_name}
                                                className="w-12 h-12 rounded-xl object-cover bg-neutral-800"
                                            />
                                            <span className={`absolute -top-1 -right-1 text-[8px] font-black px-1 py-0.5 rounded uppercase ${
                                                pick.gender === 'F' ? 'bg-pink-500 text-white' : 'bg-blue-600 text-white'
                                            }`}>
                                                {pick.gender === 'F' ? '♀' : '♂'}
                                            </span>
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-black px-1.5 py-0.2 bg-neutral-800 rounded text-neutral-300">
                                                    {pick.slot}
                                                </span>
                                                <span className="text-xs text-neutral-400">{pick.position}</span>
                                            </div>
                                            <h4 className="text-sm font-bold text-white mt-0.5">{pick.player_name}</h4>
                                            <p className="text-xs text-neutral-400">{pick.team_short_name || pick.team_name}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        <div className="text-right">
                                            <span className="text-[10px] text-neutral-400 block uppercase">Points</span>
                                            <span className="text-sm font-black text-yellow-400">
                                                {pick.points.toFixed(2)}
                                            </span>
                                        </div>
                                        <ChevronRightIcon className="w-4 h-4 text-neutral-600" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Defense Section */}
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                            <h2 className="text-sm font-black uppercase tracking-wider text-emerald-400">Defensive Unit (7 Starters)</h2>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {lineup.picks.filter(p => p.slot === 'RUSHER' || p.slot.startsWith('DEF')).map(pick => (
                                <div
                                    key={pick.slot}
                                    onClick={() => setSelectedPlayerForBreakdown(pick)}
                                    className="p-3.5 bg-neutral-900/60 hover:bg-neutral-900 border border-neutral-800 hover:border-neutral-700 rounded-2xl flex items-center justify-between cursor-pointer transition"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="relative">
                                            <img
                                                src={pick.player_image || '/placeholder-player.png'}
                                                alt={pick.player_name}
                                                className="w-12 h-12 rounded-xl object-cover bg-neutral-800"
                                            />
                                            <span className={`absolute -top-1 -right-1 text-[8px] font-black px-1 py-0.5 rounded uppercase ${
                                                pick.gender === 'F' ? 'bg-pink-500 text-white' : 'bg-blue-600 text-white'
                                            }`}>
                                                {pick.gender === 'F' ? '♀' : '♂'}
                                            </span>
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-black px-1.5 py-0.2 bg-neutral-800 rounded text-neutral-300">
                                                    {pick.slot}
                                                </span>
                                                <span className="text-xs text-neutral-400">{pick.position}</span>
                                            </div>
                                            <h4 className="text-sm font-bold text-white mt-0.5">{pick.player_name}</h4>
                                            <p className="text-xs text-neutral-400">{pick.team_short_name || pick.team_name}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        <div className="text-right">
                                            <span className="text-[10px] text-neutral-400 block uppercase">Points</span>
                                            <span className="text-sm font-black text-emerald-400">
                                                {pick.points.toFixed(2)}
                                            </span>
                                        </div>
                                        <ChevronRightIcon className="w-4 h-4 text-neutral-600" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Points Breakdown Drawer */}
            {selectedPlayerForBreakdown && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
                    <div className="bg-neutral-900 border border-neutral-800 w-full max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
                        <div className="p-4 sm:p-6 border-b border-neutral-800 flex items-center justify-between">
                            <div>
                                <span className="text-xs font-bold text-yellow-400 uppercase tracking-wider block">
                                    Official Showtime Points Breakdown
                                </span>
                                <h3 className="text-lg font-black text-white">{selectedPlayerForBreakdown.player_name}</h3>
                                <p className="text-xs text-neutral-400 mt-0.5">
                                    Slot: <strong>{selectedPlayerForBreakdown.slot}</strong> • Purchase Price: <strong>{selectedPlayerForBreakdown.purchase_price.toFixed(2)} SC</strong>
                                </p>
                            </div>
                            <button
                                onClick={() => setSelectedPlayerForBreakdown(null)}
                                className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition"
                            >
                                <XMarkIcon className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                            {breakdownLoading ? (
                                <div className="py-12 flex justify-center">
                                    <div className="w-8 h-8 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
                                </div>
                            ) : !breakdownData ? (
                                <div className="py-12 text-center text-neutral-400 text-sm">
                                    No statistical events recorded for this gameweek yet. Live points update automatically as official match stats are finalized.
                                </div>
                            ) : (
                                <div>
                                    <div className="p-4 bg-neutral-950 rounded-2xl border border-neutral-800 flex items-center justify-between mb-4">
                                        <span className="text-sm font-bold uppercase text-white">Net Fantasy Total</span>
                                        <span className="text-2xl font-black text-yellow-400">
                                            {breakdownData.points.toFixed(2)} pts
                                        </span>
                                    </div>

                                    {/* Breakdown Items List */}
                                    <div className="space-y-2 text-xs">
                                        <h4 className="font-bold text-neutral-400 uppercase tracking-wider text-[11px] mb-2">Offensive Categories</h4>
                                        <div className="p-2.5 rounded-xl bg-neutral-950/60 border border-neutral-800/80 flex justify-between">
                                            <span>Passing Yards (0.04 pts/yd)</span>
                                            <span className="font-mono font-bold text-white">{breakdownData.breakdown.passing_yards_pts.toFixed(2)}</span>
                                        </div>
                                        <div className="p-2.5 rounded-xl bg-neutral-950/60 border border-neutral-800/80 flex justify-between">
                                            <span>Passing TDs (4.0 pts)</span>
                                            <span className="font-mono font-bold text-white">{breakdownData.breakdown.passing_tds_pts.toFixed(2)}</span>
                                        </div>
                                        <div className="p-2.5 rounded-xl bg-neutral-950/60 border border-neutral-800/80 flex justify-between">
                                            <span>Interceptions Thrown (-2.0 pts)</span>
                                            <span className="font-mono font-bold text-red-400">{breakdownData.breakdown.interceptions_thrown_pts.toFixed(2)}</span>
                                        </div>
                                        <div className="p-2.5 rounded-xl bg-neutral-950/60 border border-neutral-800/80 flex justify-between">
                                            <span>Receptions (1.0 pt PPR)</span>
                                            <span className="font-mono font-bold text-white">{breakdownData.breakdown.receptions_pts.toFixed(2)}</span>
                                        </div>
                                        <div className="p-2.5 rounded-xl bg-neutral-950/60 border border-neutral-800/80 flex justify-between">
                                            <span>Receiving Yards (0.1 pts/yd)</span>
                                            <span className="font-mono font-bold text-white">{breakdownData.breakdown.receiving_yards_pts.toFixed(2)}</span>
                                        </div>
                                        <div className="p-2.5 rounded-xl bg-neutral-950/60 border border-neutral-800/80 flex justify-between">
                                            <span>Receiving TDs (6.0 pts)</span>
                                            <span className="font-mono font-bold text-white">{breakdownData.breakdown.receiving_tds_pts.toFixed(2)}</span>
                                        </div>

                                        <h4 className="font-bold text-neutral-400 uppercase tracking-wider text-[11px] pt-4 mb-2">Defensive Categories</h4>
                                        <div className="p-2.5 rounded-xl bg-neutral-950/60 border border-neutral-800/80 flex justify-between">
                                            <span>Flag Pulls (1.0 pt)</span>
                                            <span className="font-mono font-bold text-emerald-400">{breakdownData.breakdown.flag_pulls_pts.toFixed(2)}</span>
                                        </div>
                                        <div className="p-2.5 rounded-xl bg-neutral-950/60 border border-neutral-800/80 flex justify-between">
                                            <span>Defensive Sacks (2.0 pts)</span>
                                            <span className="font-mono font-bold text-emerald-400">{breakdownData.breakdown.def_sacks_pts.toFixed(2)}</span>
                                        </div>
                                        <div className="p-2.5 rounded-xl bg-neutral-950/60 border border-neutral-800/80 flex justify-between">
                                            <span>Pass Deflections (1.5 pts)</span>
                                            <span className="font-mono font-bold text-emerald-400">{breakdownData.breakdown.pass_deflections_pts.toFixed(2)}</span>
                                        </div>
                                        <div className="p-2.5 rounded-xl bg-neutral-950/60 border border-neutral-800/80 flex justify-between">
                                            <span>Interceptions Caught (3.0 pts)</span>
                                            <span className="font-mono font-bold text-emerald-400">{breakdownData.breakdown.interceptions_pts.toFixed(2)}</span>
                                        </div>
                                        <div className="p-2.5 rounded-xl bg-neutral-950/60 border border-neutral-800/80 flex justify-between">
                                            <span>Defensive Touchdowns (6.0 pts)</span>
                                            <span className="font-mono font-bold text-emerald-400">{breakdownData.breakdown.defensive_tds_pts.toFixed(2)}</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
