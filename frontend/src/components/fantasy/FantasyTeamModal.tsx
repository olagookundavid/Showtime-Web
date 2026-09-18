import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    XMarkIcon,
    ArrowPathIcon,
    ListBulletIcon,
    Squares2X2Icon,
} from '@heroicons/react/24/outline';
import {
    fantasyApi,
    formatFantasyPrice,
    type FantasyGameweek,
    type FantasyLineupPick,
} from '../../services/api';
import { FantasyPitch } from './FantasyPitch';
import { FantasyPlayerModal, type FantasyPlayerModalData } from './FantasyPlayerModal';

interface FantasyTeamModalProps {
    isOpen: boolean;
    onClose: () => void;
    teamId: string | null;
    gameweeks?: FantasyGameweek[];
    initialGameweekId?: string;
    seasonId?: string;
}

export function FantasyTeamModal({
    isOpen,
    onClose,
    teamId,
    gameweeks = [],
    initialGameweekId,
    seasonId,
}: FantasyTeamModalProps) {
    const [viewMode, setViewMode] = useState<'pitch' | 'list'>('pitch');
    const [selectedGwId, setSelectedGwId] = useState<string>(initialGameweekId || '');
    const [inspectingPlayer, setInspectingPlayer] = useState<FantasyPlayerModalData | null>(null);

    useEffect(() => {
        if (initialGameweekId) {
            setSelectedGwId(initialGameweekId);
        } else if (gameweeks && gameweeks.length > 0) {
            // Find current active/locked/scheduled, or the first one
            const current = gameweeks.find((g) => g.status === 'LIVE' || g.status === 'LOCKED' || g.status === 'SCHEDULED') || gameweeks[0];
            setSelectedGwId(current.id);
        }
    }, [initialGameweekId, gameweeks, isOpen]);

    // Lineup query
    const { data, isLoading, isError, refetch } = useQuery({
        queryKey: ['fantasyTeamLineup', teamId, selectedGwId],
        queryFn: () => (teamId && selectedGwId ? fantasyApi.getTeamLineup(teamId, selectedGwId) : null),
        enabled: isOpen && Boolean(teamId) && Boolean(selectedGwId),
        staleTime: 30000,
    });

    const activeSeasonId = seasonId || data?.season_id;

    const { data: fetchedGameweeks } = useQuery({
        queryKey: ['fantasyGameweeksForModal', activeSeasonId],
        queryFn: () => (activeSeasonId ? fantasyApi.getGameweeks(activeSeasonId) : []),
        enabled: isOpen && gameweeks.length === 0 && Boolean(activeSeasonId),
        staleTime: 60000,
    });

    const activeGameweeks = gameweeks.length > 0 ? gameweeks : (fetchedGameweeks || []);

    useEffect(() => {
        if (!selectedGwId && activeGameweeks.length > 0) {
            const current = activeGameweeks.find((g) => g.status === 'LIVE' || g.status === 'LOCKED' || g.status === 'SCHEDULED') || activeGameweeks[0];
            setSelectedGwId(current.id);
        }
    }, [activeGameweeks, selectedGwId]);

    // Handle ESC key to dismiss
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) {
            window.addEventListener('keydown', handleKeyDown);
            document.body.style.overflow = 'hidden';
        }
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = 'unset';
        };
    }, [isOpen, onClose]);

    if (!isOpen || !teamId) return null;

    const picks = data?.picks || [];
    const selectedGw = activeGameweeks.find((g) => g.id === selectedGwId);

    const isOffenseSlot = (slot: string) => slot.startsWith('QB') || slot.startsWith('REC');
    const offensePicks = picks.filter((p) => isOffenseSlot(p.slot));
    const defensePicks = picks.filter((p) => !isOffenseSlot(p.slot));

    return (
        <div
            data-dialog
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 pt-[calc(var(--chrome-h)+1rem)] overflow-y-auto transition-[padding] duration-300 motion-reduce:transition-none"
        >
            {/* Click outside backdrop */}
            <div className="fixed inset-0" onClick={onClose} />

            <div
                className="relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-2xl md:rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh] z-10 animate-in fade-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header Banner */}
                <div className="bg-sffl-navy text-white p-5 md:p-6 flex items-start justify-between gap-4 border-b border-white/10">
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-white/15 text-gray-200">
                                Team Inspection
                            </span>
                            {data?.is_rollover && (
                                <span className="text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                    Rollover Squad
                                </span>
                            )}
                            {data?.gameweek_status && (
                                <span
                                    className={`text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${
                                        data.gameweek_status === 'FINALIZED'
                                            ? 'bg-emerald-500/20 text-emerald-300'
                                            : data.gameweek_status === 'LIVE'
                                            ? 'bg-sffl-red text-white animate-pulse'
                                            : data.gameweek_status === 'LOCKED'
                                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                            : 'bg-white/10 text-gray-300'
                                    }`}
                                >
                                    {data.gameweek_status === 'LOCKED'
                                        ? 'GW Locked'
                                        : data.gameweek_status === 'SCHEDULED'
                                        ? 'Scheduled'
                                        : data.gameweek_status}
                                </span>
                            )}
                        </div>

                        <h2 className="text-xl md:text-2xl font-black italic tracking-tight truncate text-white">
                            {data?.team_name || 'Loading Squad...'}
                        </h2>

                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-300">
                            <span>Manager: <strong className="text-white">{data?.manager_name || '—'}</strong></span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        {/* Gameweek Selector Dropdown */}
                        {activeGameweeks.length > 0 && (
                            <select
                                value={selectedGwId}
                                onChange={(e) => setSelectedGwId(e.target.value)}
                                className="bg-white/10 border border-white/20 text-white rounded-xl px-3 py-1.5 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-sffl-red cursor-pointer"
                            >
                                {activeGameweeks.map((gw) => (
                                    <option key={gw.id} value={gw.id} className="text-gray-900 bg-white">
                                        Gameweek {gw.number}
                                    </option>
                                ))}
                            </select>
                        )}

                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-gray-200 hover:text-white transition cursor-pointer"
                            aria-label="Close dialog"
                        >
                            <XMarkIcon className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* KPI Overview Strip */}
                {data && (
                    <div className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700 px-5 py-3 grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="border-r border-gray-200 dark:border-gray-700/80 pr-2">
                            <span className="text-gray-500 dark:text-gray-400 font-bold block text-[10px] uppercase tracking-wider">
                                Formation
                            </span>
                            <span className="font-black text-sffl-navy dark:text-white mt-0.5 block">
                                7 OFF · 7 DEF
                            </span>
                        </div>

                        <div className="border-r border-gray-200 dark:border-gray-700/80 px-2">
                            <span className="text-gray-500 dark:text-gray-400 font-bold block text-[10px] uppercase tracking-wider">
                                Lineup Value
                            </span>
                            <span className="font-mono font-black text-gray-800 dark:text-gray-200 mt-0.5 block">
                                ₦{data.total_spent.toFixed(1)}m
                            </span>
                        </div>

                        <div className="pl-2">
                            <span className="text-gray-500 dark:text-gray-400 font-bold block text-[10px] uppercase tracking-wider">
                                GW Points
                            </span>
                            <span className="font-mono font-black text-sffl-red mt-0.5 block text-sm">
                                {data.points.toFixed(1)} pts
                            </span>
                        </div>
                    </div>
                )}

                {/* View Switcher Strip */}
                {data && picks.length > 0 && (
                    <div className="flex items-center justify-between px-5 py-2.5 bg-gray-100/70 dark:bg-gray-700/40 border-b border-gray-200 dark:border-gray-700">
                        <div className="flex items-center gap-1 bg-white dark:bg-gray-800 p-0.5 rounded-xl border border-gray-200 dark:border-gray-700">
                            <button
                                type="button"
                                onClick={() => setViewMode('pitch')}
                                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                                    viewMode === 'pitch'
                                        ? 'bg-sffl-navy text-white shadow-sm'
                                        : 'text-gray-600 dark:text-gray-300 hover:text-gray-900'
                                }`}
                            >
                                <Squares2X2Icon className="w-3.5 h-3.5" /> Formation
                            </button>
                            <button
                                type="button"
                                onClick={() => setViewMode('list')}
                                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                                    viewMode === 'list'
                                        ? 'bg-sffl-navy text-white shadow-sm'
                                        : 'text-gray-600 dark:text-gray-300 hover:text-gray-900'
                                }`}
                            >
                                <ListBulletIcon className="w-3.5 h-3.5" /> Squad List
                            </button>
                        </div>

                        <span className="text-[11px] text-gray-500 dark:text-gray-400 font-bold">
                            {picks.length} players · Tap for profile
                        </span>
                    </div>
                )}

                {/* Modal Content / Lineup */}
                <div className="p-4 md:p-6 overflow-y-auto flex-1">
                    {isLoading ? (
                        <div className="py-16 flex flex-col items-center justify-center gap-3 text-gray-500 dark:text-gray-400">
                            <ArrowPathIcon className="w-8 h-8 animate-spin text-sffl-red" />
                            <p className="text-xs font-bold uppercase tracking-wider">Loading team formation...</p>
                        </div>
                    ) : isError ? (
                        <div className="py-12 text-center text-red-600 dark:text-red-400 text-sm">
                            <p className="font-bold">Failed to load this lineup.</p>
                            <button
                                type="button"
                                onClick={() => refetch()}
                                className="mt-3 px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-gray-700 text-xs font-bold hover:bg-gray-200 dark:hover:bg-gray-600 cursor-pointer"
                            >
                                Try again
                            </button>
                        </div>
                    ) : picks.length === 0 ? (
                        <div className="py-16 text-center text-gray-500 dark:text-gray-400 text-sm max-w-sm mx-auto">
                            <div className="w-12 h-12 mx-auto rounded-2xl bg-gray-100 dark:bg-gray-700/60 flex items-center justify-center text-gray-400 mb-3">
                                <Squares2X2Icon className="w-6 h-6" />
                            </div>
                            <p className="font-bold text-gray-700 dark:text-gray-200">
                                No lineup recorded for {selectedGw ? `Gameweek ${selectedGw.number}` : 'this gameweek'}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                If this manager fielded a lineup in another gameweek, switch to it using the selector above.
                            </p>
                        </div>
                    ) : viewMode === 'pitch' ? (
                        <FantasyPitch
                            picks={picks}
                            gameweekLabel={selectedGw ? `Gameweek ${selectedGw.number}` : undefined}
                            gameweekId={selectedGwId}
                            showPoints
                            title="Starting Lineup"
                        />
                    ) : (
                        /* Squad List View */
                        <div className="space-y-5">
                            {/* Offense */}
                            <div>
                                <div className="flex items-center justify-between mb-2 px-1">
                                    <span className="text-xs font-black uppercase text-sffl-red tracking-wider flex items-center gap-1.5">
                                        <span className="w-2 h-2 rounded-full bg-sffl-red" /> Offense ({offensePicks.length})
                                    </span>
                                </div>
                                <div className="divide-y divide-gray-100 dark:divide-gray-700 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden bg-white dark:bg-gray-800">
                                    {offensePicks.map((pick: FantasyLineupPick) => (
                                        <button
                                            key={pick.slot}
                                            type="button"
                                            onClick={() => setInspectingPlayer({
                                                playerId: pick.player_id,
                                                playerName: pick.player_name || 'Player',
                                                playerImage: pick.player_image,
                                                position: pick.position,
                                                gender: pick.gender,
                                                teamName: pick.team_name,
                                                teamShortName: pick.team_short_name,
                                                teamLogo: pick.team_logo,
                                                price: pick.current_price ?? pick.purchase_price,
                                                currentPrice: pick.current_price,
                                                purchasePrice: pick.purchase_price,
                                                points: pick.points,
                                                gameweekId: selectedGwId,
                                            })}
                                            className="w-full text-left p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 flex items-center justify-between gap-3 transition cursor-pointer"
                                        >
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 shrink-0">
                                                    {pick.slot}
                                                </span>
                                                <div className="relative shrink-0">
                                                    <div className="w-9 h-9 rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 flex items-center justify-center">
                                                        {pick.player_image ? (
                                                            <img src={pick.player_image} alt="" className="w-full h-full object-cover" />
                                                        ) : (
                                                            <span className="text-[10px] font-black text-gray-400">P</span>
                                                        )}
                                                    </div>
                                                    <span className={`absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full border border-white text-[7px] font-black flex items-center justify-center text-white ${
                                                        (pick.gender || '').toUpperCase().startsWith('F') ? 'bg-pink-500' : 'bg-blue-500'
                                                    }`}>
                                                        {(pick.gender || '').toUpperCase().startsWith('F') ? '♀' : '♂'}
                                                    </span>
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-xs font-bold text-gray-900 dark:text-white truncate">
                                                        {pick.player_name}
                                                    </p>
                                                    <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                                                        {pick.position} · {pick.team_short_name || pick.team_name || '—'}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="text-right shrink-0">
                                                <span className="block text-xs font-black text-gray-900 dark:text-white">
                                                    {formatFantasyPrice(pick.current_price ?? pick.purchase_price)}
                                                </span>
                                                <span className="block text-[10px] font-black text-sffl-red">
                                                    {pick.points?.toFixed(1) ?? '0.0'} pts
                                                </span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Defense */}
                            <div>
                                <div className="flex items-center justify-between mb-2 px-1">
                                    <span className="text-xs font-black uppercase text-[#7fbbfa] tracking-wider flex items-center gap-1.5">
                                        <span className="w-2 h-2 rounded-full bg-[#7fbbfa]" /> Defense ({defensePicks.length})
                                    </span>
                                </div>
                                <div className="divide-y divide-gray-100 dark:divide-gray-700 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden bg-white dark:bg-gray-800">
                                    {defensePicks.map((pick: FantasyLineupPick) => (
                                        <button
                                            key={pick.slot}
                                            type="button"
                                            onClick={() => setInspectingPlayer({
                                                playerId: pick.player_id,
                                                playerName: pick.player_name || 'Player',
                                                playerImage: pick.player_image,
                                                position: pick.position,
                                                gender: pick.gender,
                                                teamName: pick.team_name,
                                                teamShortName: pick.team_short_name,
                                                teamLogo: pick.team_logo,
                                                price: pick.current_price ?? pick.purchase_price,
                                                currentPrice: pick.current_price,
                                                purchasePrice: pick.purchase_price,
                                                points: pick.points,
                                                gameweekId: selectedGwId,
                                            })}
                                            className="w-full text-left p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 flex items-center justify-between gap-3 transition cursor-pointer"
                                        >
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 shrink-0">
                                                    {pick.slot}
                                                </span>
                                                <div className="relative shrink-0">
                                                    <div className="w-9 h-9 rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 flex items-center justify-center">
                                                        {pick.player_image ? (
                                                            <img src={pick.player_image} alt="" className="w-full h-full object-cover" />
                                                        ) : (
                                                            <span className="text-[10px] font-black text-gray-400">P</span>
                                                        )}
                                                    </div>
                                                    <span className={`absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full border border-white text-[7px] font-black flex items-center justify-center text-white ${
                                                        (pick.gender || '').toUpperCase().startsWith('F') ? 'bg-pink-500' : 'bg-blue-500'
                                                    }`}>
                                                        {(pick.gender || '').toUpperCase().startsWith('F') ? '♀' : '♂'}
                                                    </span>
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-xs font-bold text-gray-900 dark:text-white truncate">
                                                        {pick.player_name}
                                                    </p>
                                                    <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                                                        {pick.position} · {pick.team_short_name || pick.team_name || '—'}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="text-right shrink-0">
                                                <span className="block text-xs font-black text-gray-900 dark:text-white">
                                                    {formatFantasyPrice(pick.current_price ?? pick.purchase_price)}
                                                </span>
                                                <span className="block text-[10px] font-black text-sffl-red">
                                                    {pick.points?.toFixed(1) ?? '0.0'} pts
                                                </span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-700 flex justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 text-xs font-black uppercase tracking-wider transition cursor-pointer"
                    >
                        Close
                    </button>
                </div>
            </div>

            {/* Fantasy Player Modal */}
            <FantasyPlayerModal
                isOpen={Boolean(inspectingPlayer)}
                onClose={() => setInspectingPlayer(null)}
                player={inspectingPlayer}
            />
        </div>
    );
}

