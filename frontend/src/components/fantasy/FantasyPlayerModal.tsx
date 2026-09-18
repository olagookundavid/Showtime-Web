import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
    XMarkIcon,
    ArrowTopRightOnSquareIcon,
    SparklesIcon,
    UserIcon,
} from '@heroicons/react/24/outline';
import {
    fantasyApi,
    formatFantasyPrice,
} from '../../services/api';

export interface FantasyPlayerModalData {
    playerId: string;
    playerName: string;
    playerImage?: string | null;
    position?: string;
    gender?: string;
    teamName?: string;
    teamShortName?: string;
    teamLogo?: string;
    price?: number;
    currentPrice?: number;
    purchasePrice?: number;
    points?: number;
    totalPoints?: number;
    rating?: number;
    ownedByPct?: number;
    gameweekId?: string;
    gameweekNumber?: number;
}

interface FantasyPlayerModalProps {
    isOpen: boolean;
    onClose: () => void;
    player: FantasyPlayerModalData | null;
}

function normalizePosition(pos?: string): string {
    const p = (pos || '').trim();
    switch (p.toUpperCase()) {
        case 'ALLROUNDER':
        case 'ALL-ROUNDER':
        case 'ALL ROUNDER':
        case 'AR':
            return 'All-Rounder';
        case 'CENTRE':
            return 'Center';
        default:
            return p || 'Player';
    }
}

function unitOfPosition(pos?: string): 'Offense' | 'Defense' {
    const p = (pos || '').toUpperCase();
    if (p.includes('DEF') || p.includes('RUSH') || p.includes('SAFETY') || p.includes('CORNER')) {
        return 'Defense';
    }
    return 'Offense';
}

const POSITION_STYLES: Record<string, { bg: string; text: string }> = {
    QB: { bg: 'bg-sffl-red', text: 'text-white' },
    Receiver: { bg: 'bg-amber-400', text: 'text-amber-950' },
    Center: { bg: 'bg-violet-400', text: 'text-violet-950' },
    Rusher: { bg: 'bg-emerald-400', text: 'text-emerald-950' },
    Defender: { bg: 'bg-[#7fbbfa]', text: 'text-[#0d2440]' },
    'All-Rounder': { bg: 'bg-cyan-400', text: 'text-cyan-950' },
};

export function FantasyPlayerModal({ isOpen, onClose, player }: FantasyPlayerModalProps) {
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

    const { data: breakdownData, isLoading: loadingBreakdown } = useQuery({
        queryKey: ['playerFantasyBreakdown', player?.playerId, player?.gameweekId],
        queryFn: () => (player?.playerId && player?.gameweekId ? fantasyApi.getPlayerBreakdown(player.playerId, player.gameweekId) : null),
        enabled: isOpen && Boolean(player?.playerId) && Boolean(player?.gameweekId),
        staleTime: 30000,
    });

    if (!isOpen || !player) return null;

    const isFemale = (player.gender || '').toUpperCase().startsWith('F');
    const posLabel = normalizePosition(player.position);
    const unit = unitOfPosition(player.position);
    const posStyle = POSITION_STYLES[posLabel] || { bg: 'bg-gray-700', text: 'text-white' };
    const price = player.currentPrice ?? player.price ?? player.purchasePrice ?? 0;
    const breakdown = breakdownData?.breakdown;

    return (
        <div
            data-dialog
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 pt-[calc(var(--chrome-h)+1rem)] overflow-y-auto transition-[padding] duration-300 motion-reduce:transition-none"
        >
            {/* Click outside backdrop */}
            <div className="fixed inset-0" onClick={onClose} />

            <div
                className="relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-2xl md:rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[92vh] z-10 animate-in fade-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header Banner */}
                <div className="bg-sffl-navy text-white p-5 md:p-6 flex items-start justify-between gap-4 border-b border-white/10">
                    <div className="min-w-0 flex-1">
                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-white/15 text-gray-200 inline-block mb-1.5">
                            Fantasy Player Profile
                        </span>
                        <h2 className="text-xl md:text-2xl font-black italic tracking-tight truncate text-white">
                            {player.playerName}
                        </h2>
                        <div className="flex items-center gap-2 mt-1 text-xs text-gray-300">
                            {player.teamLogo && (
                                <img src={player.teamLogo} alt="" className="w-4 h-4 rounded-full object-contain bg-white/10 p-0.5" />
                            )}
                            <span className="font-semibold truncate">{player.teamName || player.teamShortName || 'Independent'}</span>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-gray-200 hover:text-white transition cursor-pointer shrink-0"
                        aria-label="Close dialog"
                    >
                        <XMarkIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Hero / Avatar Card */}
                <div className="p-5 md:p-6 border-b border-gray-100 dark:border-gray-700/60 bg-gray-50/70 dark:bg-gray-800/40 flex items-center gap-4">
                    <div className="relative shrink-0">
                        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden border-2 border-white dark:border-gray-700 shadow-md bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                            {player.playerImage ? (
                                <img src={player.playerImage} alt={player.playerName} className="w-full h-full object-cover" />
                            ) : (
                                <UserIcon className="w-10 h-10 text-gray-400 dark:text-gray-500" />
                            )}
                        </div>
                        {/* Gender pip outside the photo */}
                        <span
                            aria-label={isFemale ? 'Female athlete' : 'Male athlete'}
                            className={`absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full border-2 border-white dark:border-gray-800 flex items-center justify-center text-xs font-black text-white shadow ${
                                isFemale ? 'bg-pink-500' : 'bg-blue-500'
                            }`}
                        >
                            {isFemale ? '♀' : '♂'}
                        </span>
                    </div>

                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                            <span className={`px-2.5 py-0.5 rounded text-[11px] font-black uppercase tracking-wider ${posStyle.bg} ${posStyle.text}`}>
                                {posLabel}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200">
                                {unit}
                            </span>
                        </div>

                        <div>
                            <span className="text-[10px] font-black uppercase tracking-wider text-gray-500 dark:text-gray-400 block">
                                Fantasy Price
                            </span>
                            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
                                {formatFantasyPrice(price)}
                            </span>
                        </div>
                    </div>
                </div>

                {/* KPI Metrics Strip */}
                <div className="p-5 md:p-6 overflow-y-auto space-y-5 flex-1">
                    <div className="grid grid-cols-3 gap-2.5 text-center">
                        <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-700">
                            <span className="text-[10px] font-black uppercase tracking-wider text-gray-500 dark:text-gray-400 block">
                                GW Points
                            </span>
                            <span className="text-lg font-black text-sffl-red mt-0.5 block">
                                {typeof player.points === 'number' ? `${player.points.toFixed(1)} pts` : '—'}
                            </span>
                        </div>

                        <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-700">
                            <span className="text-[10px] font-black uppercase tracking-wider text-gray-500 dark:text-gray-400 block">
                                Total Points
                            </span>
                            <span className="text-lg font-black text-gray-900 dark:text-white mt-0.5 block">
                                {typeof player.totalPoints === 'number' ? `${player.totalPoints.toFixed(1)} pts` : '—'}
                            </span>
                        </div>

                        <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-700">
                            <span className="text-[10px] font-black uppercase tracking-wider text-gray-500 dark:text-gray-400 block">
                                Ownership
                            </span>
                            <span className="text-lg font-black text-gray-900 dark:text-white mt-0.5 block">
                                {typeof player.ownedByPct === 'number' ? `${player.ownedByPct.toFixed(1)}%` : '—'}
                            </span>
                        </div>
                    </div>

                    {/* Gameweek Scoring Breakdown (if available) */}
                    {player.gameweekId && (
                        <div className="rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden bg-gray-50 dark:bg-gray-800/60 p-4">
                            <div className="flex items-center justify-between mb-3 border-b border-gray-200 dark:border-gray-700 pb-2">
                                <h4 className="text-xs font-black uppercase tracking-wider text-sffl-navy dark:text-white flex items-center gap-1.5">
                                    <SparklesIcon className="w-4 h-4 text-sffl-red" />
                                    Gameweek Scoring Breakdown
                                </h4>
                                {breakdownData?.match_label && (
                                    <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400">
                                        {breakdownData.match_label}
                                    </span>
                                )}
                            </div>

                            {loadingBreakdown ? (
                                <p className="text-xs text-gray-500 py-3 text-center">Loading gameweek stats...</p>
                            ) : breakdown ? (
                                <div className="space-y-3 text-xs">
                                    {/* Offensive stats */}
                                    {breakdown.offensive_total !== 0 && (
                                        <div>
                                            <span className="text-[10px] font-black uppercase text-sffl-red block mb-1">
                                                Offense (+{breakdown.offensive_total.toFixed(1)} pts)
                                            </span>
                                            <div className="grid grid-cols-2 gap-1.5 text-[11px] text-gray-600 dark:text-gray-300">
                                                {breakdown.passing_tds_pts > 0 && <div>Passing TDs: +{breakdown.passing_tds_pts}</div>}
                                                {breakdown.passing_yards_pts > 0 && <div>Passing Yds: +{breakdown.passing_yards_pts.toFixed(1)}</div>}
                                                {breakdown.rushing_tds_pts > 0 && <div>Rushing TDs: +{breakdown.rushing_tds_pts}</div>}
                                                {breakdown.receiving_tds_pts > 0 && <div>Receiving TDs: +{breakdown.receiving_tds_pts}</div>}
                                                {breakdown.receptions_pts > 0 && <div>Receptions: +{breakdown.receptions_pts}</div>}
                                                {breakdown.xp_good_pts > 0 && <div>Extra Points: +{breakdown.xp_good_pts}</div>}
                                                {breakdown.interceptions_thrown_pts < 0 && <div className="text-red-500">INT Thrown: {breakdown.interceptions_thrown_pts}</div>}
                                                {breakdown.qb_sacks_pts < 0 && <div className="text-red-500">QB Sacks: {breakdown.qb_sacks_pts}</div>}
                                            </div>
                                        </div>
                                    )}

                                    {/* Defensive stats */}
                                    {breakdown.defensive_total !== 0 && (
                                        <div>
                                            <span className="text-[10px] font-black uppercase text-[#7fbbfa] block mb-1">
                                                Defense (+{breakdown.defensive_total.toFixed(1)} pts)
                                            </span>
                                            <div className="grid grid-cols-2 gap-1.5 text-[11px] text-gray-600 dark:text-gray-300">
                                                {breakdown.flag_pulls_pts > 0 && <div>Flag Pulls: +{breakdown.flag_pulls_pts.toFixed(1)}</div>}
                                                {breakdown.def_sacks_pts > 0 && <div>Sacks: +{breakdown.def_sacks_pts}</div>}
                                                {breakdown.interceptions_pts > 0 && <div>Interceptions: +{breakdown.interceptions_pts}</div>}
                                                {breakdown.pass_deflections_pts > 0 && <div>Deflections: +{breakdown.pass_deflections_pts.toFixed(1)}</div>}
                                                {breakdown.defensive_tds_pts > 0 && <div>Defensive TDs: +{breakdown.defensive_tds_pts}</div>}
                                                {breakdown.safety_pts > 0 && <div>Safeties: +{breakdown.safety_pts}</div>}
                                            </div>
                                        </div>
                                    )}

                                    <div className="pt-2 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center font-black">
                                        <span>Net Match Score</span>
                                        <span className="text-sffl-red text-sm">{breakdown.net_total.toFixed(1)} pts</span>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-xs text-gray-500 py-2 text-center">
                                    No live match stats recorded for this gameweek yet.
                                </p>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="p-4 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between gap-3">
                    <Link
                        to={`/players/${player.playerId}`}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-sffl-navy dark:text-gray-200 hover:text-sffl-red transition"
                    >
                        View Full Season Stats <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
                    </Link>

                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 text-xs font-black uppercase tracking-wider transition cursor-pointer"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
