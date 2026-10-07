import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    ArrowTrendingUpIcon,
    ArrowTrendingDownIcon,
    MinusIcon,
    ScaleIcon,
    BoltIcon,
} from '@heroicons/react/24/outline';
import { fantasyApi, formatFantasyPrice } from '../../services/api';
import { formatStatDecimal } from '../../utils';
import { Button, Modal } from '../ui';
import { DataTable, type Column } from '../ui/DataTable';

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

const NO_HISTORY: never[] = [];

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
    const { data: priceData, isLoading, isError } = useQuery({
        queryKey: ['playerPriceHistory', playerId, seasonId],
        queryFn: () => (playerId ? fantasyApi.getPlayerPriceHistory(playerId, seasonId) : null),
        enabled: isOpen && Boolean(playerId),
        staleTime: 30000,
    });

    const history = priceData?.history ?? NO_HISTORY;

    const columns = useMemo<Column<(typeof history)[number]>[]>(
        () => [
            {
                header: 'Event',
                cell: (row) => <span className="font-bold text-gray-900 dark:text-white">{row.gameweek_label}</span>,
                className: 'px-3.5 py-3 text-xs whitespace-nowrap',
            },
            {
                header: 'Official Price',
                sortable: true,
                sortValue: (row) => row.price,
                cell: (row) => <span className="font-black text-gray-900 dark:text-white">{formatFantasyPrice(row.price)}</span>,
                className: 'px-3.5 py-3 text-xs whitespace-nowrap',
            },
            {
                header: 'Form Price',
                sortable: true,
                sortValue: (row) => row.calculated_price,
                cell: (row) => formatFantasyPrice(row.calculated_price),
                className: 'px-3.5 py-3 text-xs whitespace-nowrap text-gray-600 dark:text-gray-300',
            },
            {
                header: 'GW Change',
                sortable: true,
                sortValue: (row) => row.change,
                cell: (row) => {
                    if (row.gameweek_number === 0) return <span className="text-gray-400 text-[11px]">—</span>;
                    if (row.change > 0) {
                        return (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                                <ArrowTrendingUpIcon className="w-3 h-3 shrink-0" aria-hidden="true" />
                                +{formatFantasyPrice(row.change)} ({row.percentage_change > 0 ? `+${row.percentage_change}%` : `${row.percentage_change}%`})
                            </span>
                        );
                    }
                    if (row.change < 0) {
                        return (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-black bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800">
                                <ArrowTrendingDownIcon className="w-3 h-3 shrink-0" aria-hidden="true" />
                                {formatFantasyPrice(row.change)} ({row.percentage_change}%)
                            </span>
                        );
                    }
                    return (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                            <MinusIcon className="w-3 h-3 shrink-0" aria-hidden="true" />
                            0.0m (0.0%)
                        </span>
                    );
                },
                className: 'px-3.5 py-3 text-xs whitespace-nowrap',
            },
            {
                header: 'Rating',
                sortable: true,
                sortValue: (row) => row.rating,
                cell: (row) => formatStatDecimal(row.rating, 2),
                className: 'px-3.5 py-3 text-xs whitespace-nowrap font-bold text-gray-600 dark:text-gray-300',
            },
            {
                header: 'Method',
                cell: (row) =>
                    row.is_overridden ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
                            <ScaleIcon className="w-3 h-3" aria-hidden="true" /> Committee Review
                        </span>
                    ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-gray-100 text-gray-600 border border-gray-200 dark:bg-gray-700/60 dark:text-gray-300 dark:border-gray-600">
                            <BoltIcon className="w-3 h-3 text-yellow-500" aria-hidden="true" /> Algorithmic
                        </span>
                    ),
                className: 'px-3.5 py-3 text-xs whitespace-nowrap',
            },
        ],
        [],
    );

    if (!isOpen || !playerId) return null;

    const displayName = playerName || priceData?.player_name || 'Player';
    const currentPrice = priceData?.current_price ?? 0;
    const basePrice = priceData?.base_price ?? 0;
    const totalChange = priceData?.total_change ?? 0;
    const subtitle = ['Fantasy Price History', position].filter(Boolean).join(' • ');

    return (
        <Modal
            open
            onClose={onClose}
            title={displayName}
            subtitle={subtitle}
            maxWidth="2xl"
            footer={
                <Button variant="secondary" className="uppercase tracking-wider" onClick={onClose}>
                    Close
                </Button>
            }
        >
            <div className="space-y-4">
                {(playerImage || teamName) && (
                    <div className="flex items-center gap-3 min-w-0">
                        {playerImage && (
                            <img
                                src={playerImage}
                                alt={displayName}
                                className="w-12 h-12 rounded-xl object-cover border border-gray-200 dark:border-gray-700 shrink-0"
                            />
                        )}
                        {teamName && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium truncate">{teamName}</p>
                        )}
                    </div>
                )}

                {/* KPI Summary Cards */}
                <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 bg-gray-50 dark:bg-gray-700/40 rounded-xl border border-gray-200 dark:border-gray-700 text-center">
                        <span className="text-[10px] uppercase font-black tracking-wider text-gray-500 dark:text-gray-400 block">
                            Current Price
                        </span>
                        <span className="text-lg md:text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5 block">
                            {formatFantasyPrice(currentPrice)}
                        </span>
                    </div>

                    <div className="p-3 bg-gray-50 dark:bg-gray-700/40 rounded-xl border border-gray-200 dark:border-gray-700 text-center">
                        <span className="text-[10px] uppercase font-black tracking-wider text-gray-500 dark:text-gray-400 block">
                            Opening Price
                        </span>
                        <span className="text-lg md:text-2xl font-black text-gray-700 dark:text-gray-300 mt-0.5 block">
                            {formatFantasyPrice(basePrice)}
                        </span>
                    </div>

                    <div className="p-3 bg-gray-50 dark:bg-gray-700/40 rounded-xl border border-gray-200 dark:border-gray-700 text-center">
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
                            {totalChange > 0 && <ArrowTrendingUpIcon className="w-4 h-4 shrink-0" aria-hidden="true" />}
                            {totalChange < 0 && <ArrowTrendingDownIcon className="w-4 h-4 shrink-0" aria-hidden="true" />}
                            {totalChange === 0 && <MinusIcon className="w-4 h-4 shrink-0" aria-hidden="true" />}
                            <span>
                                {totalChange > 0 ? '+' : ''}
                                {formatFantasyPrice(totalChange)}
                            </span>
                        </span>
                    </div>
                </div>

                {/* Content Area */}
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
                    <DataTable
                        data={history}
                        columns={columns}
                        searchable={false}
                        paginated={false}
                        compact
                        getRowId={(row) => String(row.gameweek_id || row.gameweek_label)}
                    />
                )}

                <div className="p-3 bg-gray-50 dark:bg-gray-700/40 border border-gray-200 dark:border-gray-700 rounded-xl text-[11px] text-gray-500 dark:text-gray-400">
                    <strong>Transparency Guarantee:</strong> Player prices are automatically recomputed following each official match day using performance metrics. When pricing adjustments are calibrated by the league panel, the raw calculated price remains fully visible.
                </div>
            </div>
        </Modal>
    );
}
