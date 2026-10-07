import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    ArrowPathIcon,
    ListBulletIcon,
    Squares2X2Icon,
    UserIcon,
} from '@heroicons/react/24/outline';
import { FemaleIcon } from '../icons/FemaleIcon';
import { MaleIcon } from '../icons/MaleIcon';
import { fantasyApi, formatFantasyPrice } from '../../services/api';
import type { FantasyGameweek, FantasyLineupPick, FantasyPlayerModalData } from '../../types/fantasy/core';
import { Button, Field, Modal, Select } from '../ui';
import { FantasyPitch } from './FantasyPitch';
import { FantasyPlayerModal } from './FantasyPlayerModal';

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
    const [selectedGwIdOverride, setSelectedGwId] = useState<string>('');
    const [inspectingPlayer, setInspectingPlayer] = useState<FantasyPlayerModalData | null>(null);
    const defaultGameweek = gameweeks.find((g) => g.status === 'LIVE' || g.status === 'LOCKED' || g.status === 'SCHEDULED') || gameweeks[0];
    const selectedGwId = selectedGwIdOverride || initialGameweekId || defaultGameweek?.id || '';

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

    if (!isOpen || !teamId) return null;

    const picks = data?.picks || [];
    const selectedGw = activeGameweeks.find((g) => g.id === selectedGwId);

    const isOffenseSlot = (slot: string) => slot.startsWith('QB') || slot.startsWith('REC');
    const offensePicks = picks.filter((p) => isOffenseSlot(p.slot));
    const defensePicks = picks.filter((p) => !isOffenseSlot(p.slot));

    return (
        <>
            <Modal
                open
                onClose={onClose}
                title={data?.team_name || 'Loading squad…'}
                subtitle={`Team Inspection • Manager: ${data?.manager_name || '—'}`}
                maxWidth="2xl"
                footer={
                    <Button variant="secondary" onClick={onClose}>
                        Close
                    </Button>
                }
            >
                <div className="flex flex-wrap items-center gap-2 mb-4">
                    {data?.is_rollover && (
                        <span className="text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
                            Rollover Squad
                        </span>
                    )}
                    {data?.gameweek_status && (
                        <span
                            className={`text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${
                                data.gameweek_status === 'FINALIZED'
                                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                                    : data.gameweek_status === 'LIVE'
                                    ? 'bg-sffl-red text-white animate-pulse'
                                    : data.gameweek_status === 'LOCKED'
                                    ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                                    : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
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

                {activeGameweeks.length > 0 && (
                    <Field label="Gameweek" htmlFor="team-modal-gw" className="mb-4 sm:max-w-xs">
                        <Select
                            id="team-modal-gw"
                            value={selectedGwId}
                            onChange={(e) => setSelectedGwId(e.target.value)}
                        >
                            {activeGameweeks.map((gw) => (
                                <option key={gw.id} value={gw.id}>
                                    Gameweek {gw.number}
                                </option>
                            ))}
                        </Select>
                    </Field>
                )}

                {/* KPI Overview Strip */}
                {data && (
                    <div className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700 px-3 sm:px-5 py-3 grid grid-cols-3 gap-2 text-center text-xs shrink-0">
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
                    <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-5 py-2 bg-gray-100/70 dark:bg-gray-700/40 border-b border-gray-200 dark:border-gray-700 shrink-0">
                        <div className="flex items-center gap-1 bg-white dark:bg-gray-800 p-0.5 rounded-xl border border-gray-200 dark:border-gray-700">
                            <Button
                                size="sm"
                                variant={viewMode === 'pitch' ? 'navy' : 'ghost'}
                                icon={Squares2X2Icon}
                                aria-pressed={viewMode === 'pitch'}
                                onClick={() => setViewMode('pitch')}
                            >
                                Formation
                            </Button>
                            <Button
                                size="sm"
                                variant={viewMode === 'list' ? 'navy' : 'ghost'}
                                icon={ListBulletIcon}
                                aria-pressed={viewMode === 'list'}
                                onClick={() => setViewMode('list')}
                            >
                                Squad List
                            </Button>
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
                            <Button className="mt-3" size="sm" variant="secondary" onClick={() => refetch()}>
                                Try again
                            </Button>
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
                                    {offensePicks.map((pick: FantasyLineupPick) => {
                                        const isInvalidPick = pick.is_eligible === false || pick.team_active === false || pick.player_status === 'inactive' || pick.player_status === 'deleted' || !!pick.is_reserve;
                                        return (
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
                                                gameweekNumber: selectedGw?.number,
                                            })}
                                            className={`w-full text-left p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 flex items-center justify-between gap-3 transition cursor-pointer ${
                                                isInvalidPick ? 'bg-red-50/40 dark:bg-red-950/20 opacity-75' : ''
                                            }`}
                                        >
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 shrink-0">
                                                    {pick.slot}
                                                </span>
                                                <div className="relative shrink-0">
                                                    <div className={`w-9 h-9 rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 flex items-center justify-center ${
                                                        isInvalidPick ? 'filter grayscale opacity-60' : ''
                                                    }`}>
                                                        {pick.player_image ? (
                                                            <img src={pick.player_image} alt="" className="w-full h-full object-cover" />
                                                        ) : (
                                                            <UserIcon className="w-5 h-5 text-gray-400" aria-hidden="true" />
                                                        )}
                                                    </div>
                                                    <span className={`absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full border border-white flex items-center justify-center text-white ${
                                                        (pick.gender || '').toUpperCase().startsWith('F') ? 'bg-pink-500' : 'bg-blue-500'
                                                    }`}>
                                                        {(pick.gender || '').toUpperCase().startsWith('F') ? (
                                                            <FemaleIcon className="w-2.5 h-2.5" strokeWidth={2.5} aria-label="Woman" />
                                                        ) : (
                                                            <MaleIcon className="w-2.5 h-2.5" strokeWidth={2.5} aria-label="Man" />
                                                        )}
                                                    </span>
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <p className={`text-xs font-bold truncate ${
                                                            isInvalidPick ? 'text-gray-500 dark:text-gray-400 line-through' : 'text-gray-900 dark:text-white'
                                                        }`}>
                                                            {pick.player_name}
                                                        </p>
                                                        {isInvalidPick && (
                                                            <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-800">
                                                                {pick.is_reserve ? 'Reserve' : 'Inactive'}
                                                            </span>
                                                        )}
                                                    </div>
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
                                        );
                                    })}
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
                                    {defensePicks.map((pick: FantasyLineupPick) => {
                                        const isInvalidPick = pick.is_eligible === false || pick.team_active === false || pick.player_status === 'inactive' || pick.player_status === 'deleted' || !!pick.is_reserve;
                                        return (
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
                                                gameweekNumber: selectedGw?.number,
                                            })}
                                            className={`w-full text-left p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 flex items-center justify-between gap-3 transition cursor-pointer ${
                                                isInvalidPick ? 'bg-red-50/40 dark:bg-red-950/20 opacity-75' : ''
                                            }`}
                                        >
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 shrink-0">
                                                    {pick.slot}
                                                </span>
                                                <div className="relative shrink-0">
                                                    <div className={`w-9 h-9 rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 flex items-center justify-center ${
                                                        isInvalidPick ? 'filter grayscale opacity-60' : ''
                                                    }`}>
                                                        {pick.player_image ? (
                                                            <img src={pick.player_image} alt="" className="w-full h-full object-cover" />
                                                        ) : (
                                                            <UserIcon className="w-5 h-5 text-gray-400" aria-hidden="true" />
                                                        )}
                                                    </div>
                                                    <span className={`absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full border border-white flex items-center justify-center text-white ${
                                                        (pick.gender || '').toUpperCase().startsWith('F') ? 'bg-pink-500' : 'bg-blue-500'
                                                    }`}>
                                                        {(pick.gender || '').toUpperCase().startsWith('F') ? (
                                                            <FemaleIcon className="w-2.5 h-2.5" strokeWidth={2.5} aria-label="Woman" />
                                                        ) : (
                                                            <MaleIcon className="w-2.5 h-2.5" strokeWidth={2.5} aria-label="Man" />
                                                        )}
                                                    </span>
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <p className={`text-xs font-bold truncate ${
                                                            isInvalidPick ? 'text-gray-500 dark:text-gray-400 line-through' : 'text-gray-900 dark:text-white'
                                                        }`}>
                                                            {pick.player_name}
                                                        </p>
                                                        {isInvalidPick && (
                                                            <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-800">
                                                                {pick.is_reserve ? 'Reserve' : 'Inactive'}
                                                            </span>
                                                        )}
                                                    </div>
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
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

            </Modal>

            {/* Outside the Modal: a click inside the player profile would otherwise bubble up to this backdrop. */}
            <FantasyPlayerModal
                isOpen={Boolean(inspectingPlayer)}
                onClose={() => setInspectingPlayer(null)}
                player={inspectingPlayer}
            />
        </>
    );
}

