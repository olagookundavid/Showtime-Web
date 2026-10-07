import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { 
    UserGroupIcon,
    PencilSquareIcon, 
    LockClosedIcon, 
    ClockIcon, 
    SparklesIcon 
} from '@heroicons/react/24/outline';
import {
    fantasyApi,
    fantasySeasonApi,
    fantasySquadApi,
    formatFantasyPrice,
} from '../../services/api';
import type { FantasyLineupPick } from '../../types/fantasy/core';
import { useAuth } from '../../contexts/AuthContext';
import { Loader } from '../../components/ui/Loader';
import { Modal, Select } from '../../components/ui';
import { FantasyBackLink } from '../../components/fantasy/FantasyBackLink';
import { FantasyPitch } from '../../components/fantasy/FantasyPitch';
import { Spinner } from '../../components/ui/Spinner';

export function FantasyMyTeam() {
    // Shares the hub/dashboard query key, so this is a cache hit.
    const { data: dashboard } = useQuery({
        queryKey: ['fantasyDashboard'],
        queryFn: () => fantasySeasonApi.getDashboard(),
    });
    const hasJoined = dashboard ? dashboard.entered : undefined;

    const { isLoading: authLoading } = useAuth();

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

    const [requestedGWId, setRequestedGWId] = useState<string>('');
    // Default to first scheduled or locked gameweek without setting state in an effect.
    const selectedGWId = gameweeks.some(gw => gw.id === requestedGWId)
        ? requestedGWId
        : (gameweeks.find(gw => gw.status === 'SCHEDULED' || gw.status === 'LOCKED') || gameweeks[0])?.id ?? '';
    const setSelectedGWId = setRequestedGWId;

    // Fetch Lineup for Selected Gameweek
    const { data: lineup, isLoading: lineupLoading } = useQuery({
        queryKey: ['myFantasyLineup', season?.id, selectedGWId],
        queryFn: () => (season?.id && selectedGWId ? fantasyApi.getMyLineup(season.id, selectedGWId) : Promise.resolve(null)),
        enabled: !!season?.id && !!selectedGWId,
        refetchInterval: () => {
            const activeGw = gameweeks.find(gw => gw.id === selectedGWId);
            if (activeGw && (activeGw.status === 'LOCKED' || activeGw.status === 'LIVE')) {
                return 30_000;
            }
            return false;
        },
    });

    // Fetch Squad to show accurate bank & squad values
    const { data: mySquad } = useQuery({
        queryKey: ['fantasySquad', season?.id],
        queryFn: () => (season?.id ? fantasySquadApi.getSquad(season.id) : Promise.resolve(null)),
        enabled: !!season?.id,
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

    // Someone who never joined the season has no lineup for a different
    // reason than someone who joined but hasn't picked — say which.
    if (hasJoined === false) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4 bg-white dark:bg-gray-800 rounded-2xl md:rounded-3xl border border-gray-200 dark:border-gray-700 shadow-sm p-8 md:p-12">
                <div className="w-16 h-16 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 mb-4">
                    <UserGroupIcon className="w-10 h-10" />
                </div>
                <h1 className="text-2xl font-black uppercase text-sffl-navy dark:text-white mb-2">Join The Season First</h1>
                <p className="text-gray-600 dark:text-gray-300 max-w-md mb-6 text-sm">
                    You haven't joined this season yet. It only takes a team name.
                </p>
                <Link to="/fantasy" className="px-6 py-2.5 rounded-xl bg-sffl-red hover:bg-[#A52323] text-white font-bold text-sm shadow-md transition active:scale-95">
                    Go To The Season
                </Link>
            </div>
        );
    }

    if (!lineup) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4 bg-white dark:bg-gray-800 rounded-2xl md:rounded-3xl border border-gray-200 dark:border-gray-700 shadow-sm p-8 md:p-12">
                <div className="w-16 h-16 rounded-2xl bg-sffl-red/10 dark:bg-sffl-red/20 flex items-center justify-center text-sffl-red mb-4">
                    <UserGroupIcon className="w-10 h-10" />
                </div>
                <h1 className="text-2xl font-black uppercase text-sffl-navy dark:text-white mb-2">No Lineup Found</h1>
                <p className="text-gray-600 dark:text-gray-300 max-w-md mb-6 text-sm">You haven't drafted your 14-player squad for this gameweek yet.</p>
                <Link to="/fantasy/build" className="px-6 py-2.5 rounded-xl bg-sffl-red hover:bg-[#A52323] text-white font-bold text-sm shadow-md transition active:scale-95">
                    Draft Your Lineup Now
                </Link>
            </div>
        );
    }

    const isLocked = lineup.status === 'LOCKED';
    const selectedGw = gameweeks.find(gw => gw.id === selectedGWId);

    return (
        <div className="space-y-6 md:space-y-8">
            <FantasyBackLink to="/fantasy/dashboard" label="Back to Dashboard" />
            {/* Header Showtime Navy Banner */}
            <div className="bg-sffl-navy text-white rounded-2xl md:rounded-3xl shadow-xl p-4 sm:p-6 md:p-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className={`text-xs font-black px-2.5 py-0.5 rounded uppercase flex items-center gap-1 ${
                                isLocked ? 'bg-red-500/20 text-red-300 border border-red-400/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                            }`}>
                                {isLocked ? <LockClosedIcon className="w-3 h-3" /> : <ClockIcon className="w-3 h-3" />}
                                {lineup.status}
                            </span>
                            {lineup.is_rollover && (
                                <span className="text-xs font-black px-2.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-400/30 uppercase flex items-center gap-1">
                                    <SparklesIcon className="w-3 h-3" /> Auto Rolled Over
                                </span>
                            )}
                        </div>
                        <h1 className="text-2xl sm:text-3xl md:text-5xl font-black italic uppercase tracking-tight text-white mt-2 wrap-break-word">
                            {lineup.team_name}
                        </h1>
                        <p className="text-xs md:text-sm text-gray-300 mt-1 font-medium">
                            Official Showtime Fantasy Roster (14 Starters)
                        </p>
                    </div>

                    {/* Right Controls: GW Selector + Edit Button */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full md:w-auto">
                        <Select
                            aria-label="Gameweek"
                            tone="dark"
                            value={selectedGWId}
                            onChange={(e) => setSelectedGWId(e.target.value)}
                            className="w-full sm:w-auto min-w-0"
                        >
                            {gameweeks.map(gw => (
                                <option key={gw.id} value={gw.id} className="text-gray-900 bg-white">
                                    Gameweek {gw.number} ({gw.status})
                                </option>
                            ))}
                        </Select>

                        {!isLocked && (
                            <Link
                                to="/fantasy/build"
                                className="min-h-11 px-5 py-2.5 rounded-xl bg-sffl-red hover:bg-[#A52323] text-white font-black text-xs uppercase flex items-center justify-center gap-1.5 transition active:scale-95 shadow-md"
                            >
                                <PencilSquareIcon className="w-3.5 h-3.5" /> Edit Lineup
                            </Link>
                        )}
                    </div>
                </div>

                {/* Points & Financial Strip */}
                <div className="mt-6 pt-6 border-t border-white/10 grid grid-cols-1 min-[400px]:grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 bg-white/10 rounded-xl min-w-0">
                        <span className="text-[10px] uppercase font-bold text-gray-300 block">Gameweek Score</span>
                        <span className="block text-xl sm:text-2xl font-black text-yellow-400 wrap-break-word">{lineup.points.toFixed(2)} pts</span>
                    </div>
                    <div className="p-3 bg-white/10 rounded-xl min-w-0">
                        <span className="text-[10px] uppercase font-bold text-gray-300 block">In the Bank</span>
                        <span className="block text-xl sm:text-2xl font-black text-yellow-400 wrap-break-word">{formatFantasyPrice(mySquad?.bank ?? 0)}</span>
                    </div>
                    <div className="p-3 bg-white/10 rounded-xl min-w-0">
                        <span className="text-[10px] uppercase font-bold text-gray-300 block">Squad Value</span>
                        <span className="block text-xl sm:text-2xl font-black text-emerald-400 wrap-break-word">{formatFantasyPrice(mySquad?.squad_value ?? lineup.total_spent)}</span>
                    </div>
                    <div className="p-3 bg-white/10 rounded-xl min-w-0">
                        <span className="text-[10px] uppercase font-bold text-gray-300 block">Club Value</span>
                        <span className="block text-xl sm:text-2xl font-black text-white wrap-break-word">{formatFantasyPrice((mySquad?.bank ?? 0) + (mySquad?.squad_value ?? lineup.total_spent))}</span>
                    </div>
                </div>
            </div>

            {/* Pitch Lineup View */}
            <div>
                <FantasyPitch
                    picks={lineup.picks}
                    gameweekLabel={selectedGw ? `Gameweek ${selectedGw.number}` : undefined}
                    gameweekId={selectedGWId}
                    showPoints={true}
                    title={`${lineup.team_name} Starting Lineup`}
                    onPlayerClick={(pick) => setSelectedPlayerForBreakdown(pick)}
                />
            </div>

            {/* Points Breakdown Modal */}
            {selectedPlayerForBreakdown && (
                <Modal
                    open
                    onClose={() => setSelectedPlayerForBreakdown(null)}
                    title={selectedPlayerForBreakdown.player_name}
                    subtitle="Showtime Points Breakdown"
                    maxWidth="lg"
                >
                        <div className="space-y-4">
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                Slot: <strong>{selectedPlayerForBreakdown.slot}</strong> • Purchase Price: <strong>{formatFantasyPrice(selectedPlayerForBreakdown.purchase_price)}</strong>
                            </p>
                            {breakdownLoading ? (
                                <Spinner label="Loading points breakdown…" className="py-12" />
                            ) : !breakdownData || (
                                breakdownData.breakdown.net_total === 0 &&
                                breakdownData.breakdown.offensive_total === 0 &&
                                breakdownData.breakdown.defensive_total === 0
                            ) ? (
                                <div className="py-12 text-center text-gray-500 dark:text-gray-400 text-sm">
                                    No statistical events recorded for this gameweek yet. Points update live as official match stats are entered.
                                </div>
                            ) : (
                                <div>
                                    <div className="p-4 bg-gray-50 dark:bg-gray-700/60 rounded-2xl border border-gray-200 dark:border-gray-600 flex items-center justify-between mb-4">
                                        <span className="text-sm font-black uppercase text-sffl-navy dark:text-white">Net Fantasy Total</span>
                                        <span className="text-2xl font-black text-sffl-red">
                                            {breakdownData.points.toFixed(2)} pts
                                        </span>
                                    </div>

                                    {/* Breakdown Items List */}
                                    <div className="space-y-2 text-xs">
                                        <h4 className="font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-[11px] mb-2">Offensive Categories</h4>
                                        <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-gray-700/40 border border-gray-200 dark:border-gray-700 flex justify-between">
                                            <span>Passing Yards (0.04 pts/yd)</span>
                                            <span className="font-mono font-bold text-gray-900 dark:text-white">{breakdownData.breakdown.passing_yards_pts.toFixed(2)}</span>
                                        </div>
                                        <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-gray-700/40 border border-gray-200 dark:border-gray-700 flex justify-between">
                                            <span>Passing TDs (4.0 pts)</span>
                                            <span className="font-mono font-bold text-gray-900 dark:text-white">{breakdownData.breakdown.passing_tds_pts.toFixed(2)}</span>
                                        </div>
                                        <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-gray-700/40 border border-gray-200 dark:border-gray-700 flex justify-between">
                                            <span>Interceptions Thrown (-2.0 pts)</span>
                                            <span className="font-mono font-bold text-red-600 dark:text-red-400">{breakdownData.breakdown.interceptions_thrown_pts.toFixed(2)}</span>
                                        </div>
                                        <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-gray-700/40 border border-gray-200 dark:border-gray-700 flex justify-between">
                                            <span>Receptions (1.0 pt PPR)</span>
                                            <span className="font-mono font-bold text-gray-900 dark:text-white">{breakdownData.breakdown.receptions_pts.toFixed(2)}</span>
                                        </div>
                                        <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-gray-700/40 border border-gray-200 dark:border-gray-700 flex justify-between">
                                            <span>Receiving Yards (0.1 pts/yd)</span>
                                            <span className="font-mono font-bold text-gray-900 dark:text-white">{breakdownData.breakdown.receiving_yards_pts.toFixed(2)}</span>
                                        </div>
                                        <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-gray-700/40 border border-gray-200 dark:border-gray-700 flex justify-between">
                                            <span>Receiving TDs (6.0 pts)</span>
                                            <span className="font-mono font-bold text-gray-900 dark:text-white">{breakdownData.breakdown.receiving_tds_pts.toFixed(2)}</span>
                                        </div>

                                        <h4 className="font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-[11px] pt-4 mb-2">Defensive Categories</h4>
                                        <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-gray-700/40 border border-gray-200 dark:border-gray-700 flex justify-between">
                                            <span>Flag Pulls (1.0 pt)</span>
                                            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{breakdownData.breakdown.flag_pulls_pts.toFixed(2)}</span>
                                        </div>
                                        <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-gray-700/40 border border-gray-200 dark:border-gray-700 flex justify-between">
                                            <span>Defensive Sacks (2.0 pts)</span>
                                            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{breakdownData.breakdown.def_sacks_pts.toFixed(2)}</span>
                                        </div>
                                        <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-gray-700/40 border border-gray-200 dark:border-gray-700 flex justify-between">
                                            <span>Pass Deflections (1.5 pts)</span>
                                            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{breakdownData.breakdown.pass_deflections_pts.toFixed(2)}</span>
                                        </div>
                                        <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-gray-700/40 border border-gray-200 dark:border-gray-700 flex justify-between">
                                            <span>Interceptions Caught (3.0 pts)</span>
                                            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{breakdownData.breakdown.interceptions_pts.toFixed(2)}</span>
                                        </div>
                                        <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-gray-700/40 border border-gray-200 dark:border-gray-700 flex justify-between">
                                            <span>Defensive Touchdowns (6.0 pts)</span>
                                            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{breakdownData.breakdown.defensive_tds_pts.toFixed(2)}</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                </Modal>
            )}
        </div>
    );
}
