import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    XMarkIcon,
    ArrowTrendingUpIcon,
    ArrowTrendingDownIcon,
    MinusIcon,
    ScaleIcon,
    BoltIcon,
} from '@heroicons/react/24/outline';
import { fantasyApi, formatFantasyPrice } from '../../services/api';
import { formatStatDecimal } from '../../utils/formatters';

interface PlayerPriceHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    playerId: string | null;
    playerName?: string;
    playerImage?: string | null;
    position?: string;
    teamName?: string;
    seasonId?: string;
}

export function PlayerPriceHistoryModal({
    isOpen,
    onClose,
    playerId,
    playerName,
    playerImage,
    position,
    teamName,
    seasonId,
}: PlayerPriceHistoryModalProps) {
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

    const { data: priceData, isLoading, isError } = useQuery({
        queryKey: ['playerPriceHistory', playerId, seasonId],
        queryFn: () => (playerId ? fantasyApi.getPlayerPriceHistory(playerId, seasonId) : null),
        enabled: isOpen && Boolean(playerId),
        staleTime: 30000,
    });

    if (!isOpen || !playerId) return null;

    const displayName = playerName || priceData?.player_name || 'Player';
    const history = priceData?.history || [];
    const currentPrice = priceData?.current_price ?? 0;
    const basePrice = priceData?.base_price ?? 0;
    const totalChange = priceData?.total_change ?? 0;

    return (
        <div
            data-dialog
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
            onClick={onClose}
        >
            <div
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-2xl md:rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Modal Header */}
                <div className="bg-sffl-navy text-white p-5 md:p-6 flex items-start justify-between gap-4 border-b border-white/10">
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                        {playerImage ? (
                            <img
                                src={playerImage}
                                alt={displayName}
                                className="w-12 h-12 rounded-xl object-cover border border-white/20 shrink-0 shadow-sm"
                            />
                        ) : null}
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-white/15 text-gray-200">
                                    Fantasy Price History
                                </span>
                                {position && (
                                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-sffl-red text-white">
                                        {position}
                                    </span>
                                )}
                            </div>
                            <h2 className="text-xl md:text-2xl font-black italic tracking-tight truncate text-white">
                                {displayName}
                            </h2>
                            {teamName && (
                                <p className="text-xs text-gray-300 mt-0.5 font-medium truncate">
                                    {teamName}
                                </p>
                            )}
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

                {/* KPI Summary Cards */}
                <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-gray-700/60 bg-gray-50/70 dark:bg-gray-900/30 grid grid-cols-3 gap-3">
                    <div className="p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 text-center">
                        <span className="text-[10px] uppercase font-black tracking-wider text-gray-500 dark:text-gray-400 block">
                            Current Price
                        </span>
                        <span className="text-lg md:text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5 block">
                            {formatFantasyPrice(currentPrice)}
                        </span>
                    </div>

                    <div className="p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 text-center">
                        <span className="text-[10px] uppercase font-black tracking-wider text-gray-500 dark:text-gray-400 block">
                            Opening Price
                        </span>
                        <span className="text-lg md:text-2xl font-black text-gray-700 dark:text-gray-300 mt-0.5 block">
                            {formatFantasyPrice(basePrice)}
                        </span>
                    </div>

                    <div className="p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 text-center">
                        <span className="text-[10px] uppercase font-black tracking-wider text-gray-500 dark:text-gray-400 block">
                            Total Net Change
                        </span>
                        <span
                            className={`text-lg md:text-2xl font-black mt-0.5 flex items-center justify-center gap-1 ${
                                totalChange > 0
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : totalChange < 0
                                    ? 'text-red-600 dark:text-red-400'
                                    : 'text-gray-500 dark:text-gray-400'
                            }`}
                        >
                            {totalChange > 0 && <ArrowTrendingUpIcon className="w-4 h-4 shrink-0" />}
                            {totalChange < 0 && <ArrowTrendingDownIcon className="w-4 h-4 shrink-0" />}
                            {totalChange === 0 && <MinusIcon className="w-4 h-4 shrink-0" />}
                            <span>
                                {totalChange > 0 ? '+' : ''}
                                {formatFantasyPrice(totalChange)}
                            </span>
                        </span>
                    </div>
                </div>

                {/* Content Area */}
                <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
                    {isLoading ? (
                        <div className="py-12 flex flex-col items-center justify-center gap-2">
                            <div className="w-8 h-8 border-2 border-sffl-red border-t-transparent rounded-full animate-spin" />
                            <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold">
                                Loading price history...
                            </p>
                        </div>
                    ) : isError ? (
                        <div className="py-10 text-center text-red-600 dark:text-red-400 text-sm">
                            Failed to load price history. Please try again.
                        </div>
                    ) : history.length === 0 ? (
                        <div className="py-10 text-center text-gray-500 dark:text-gray-400 text-sm">
                            No price history recorded for this player yet.
                        </div>
                    ) : (
                        <div className="bg-white dark:bg-gray-800 rounded-xl md:rounded-2xl shadow-sm overflow-hidden border border-gray-200 dark:border-gray-700">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider">
                                        <tr>
                                            <th className="py-3 px-3.5">Event</th>
                                            <th className="py-3 px-3.5">Official Price</th>
                                            <th className="py-3 px-3.5">Form Price</th>
                                            <th className="py-3 px-3.5">GW Change</th>
                                            <th className="py-3 px-3.5">Rating</th>
                                            <th className="py-3 px-3.5">Method</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60 font-medium">
                                        {history.map((row, idx) => {
                                            const isPositive = row.change > 0;
                                            const isNegative = row.change < 0;

                                            return (
                                                <tr
                                                    key={row.gameweek_id || `idx-${idx}`}
                                                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                                                >
                                                    <td className="py-3 px-3.5 font-bold text-gray-900 dark:text-white whitespace-nowrap">
                                                        {row.gameweek_label}
                                                    </td>
                                                    <td className="py-3 px-3.5 font-black text-gray-900 dark:text-white whitespace-nowrap">
                                                        {formatFantasyPrice(row.price)}
                                                    </td>
                                                    <td className="py-3 px-3.5 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                                                        {formatFantasyPrice(row.calculated_price)}
                                                    </td>
                                                    <td className="py-3 px-3.5 whitespace-nowrap">
                                                        {row.gameweek_number === 0 ? (
                                                            <span className="text-gray-400 text-[11px]">—</span>
                                                        ) : isPositive ? (
                                                            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                                                                ▲ +{formatFantasyPrice(row.change)} ({row.percentage_change > 0 ? `+${row.percentage_change}%` : `${row.percentage_change}%`})
                                                            </span>
                                                        ) : isNegative ? (
                                                            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-black bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800">
                                                                ▼ {formatFantasyPrice(row.change)} ({row.percentage_change}%)
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                                                                0.0m (0.0%)
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="py-3 px-3.5 text-gray-600 dark:text-gray-300 whitespace-nowrap font-bold">
                                                        {formatStatDecimal(row.rating, 2)}
                                                    </td>
                                                    <td className="py-3 px-3.5 whitespace-nowrap">
                                                        {row.is_overridden ? (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
                                                                <ScaleIcon className="w-3 h-3" /> Committee Review
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-gray-100 text-gray-600 border border-gray-200 dark:bg-gray-700/60 dark:text-gray-300 dark:border-gray-600">
                                                                <BoltIcon className="w-3 h-3 text-yellow-500" /> Algorithmic
                                                            </span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    <div className="p-3 bg-gray-50 dark:bg-gray-700/40 border border-gray-200 dark:border-gray-700 rounded-xl text-[11px] text-gray-500 dark:text-gray-400">
                        <strong>Transparency Guarantee:</strong> Player prices are automatically recomputed following each official match day using performance metrics. When pricing adjustments are calibrated by the league panel, the raw calculated price remains fully visible.
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-700 flex justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2 rounded-xl bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 text-xs font-black uppercase tracking-wider transition cursor-pointer"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
