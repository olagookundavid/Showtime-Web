import React, { useState, useMemo } from 'react';
import type { PlayerStat, TeamStat } from '../../services/api';
import { Link } from 'react-router-dom';
import { LightboxImage, Spinner } from '../ui';
import { normalizePosition, ALL_STAT_DEFINITIONS, POSITION_STAT_KEYS } from '../../utils/positionStatsMatrix';

interface StatsTableProps {
    type: 'players' | 'teams';
    playerStats?: PlayerStat[];
    teamStats?: TeamStat[];
    sortBy?: string;
    onSortChange?: (key: string) => void;
    isLoading?: boolean;
    positionFilter?: string;
}

// Map from ALL_STAT_DEFINITIONS to table column format
const STAT_COLS = ALL_STAT_DEFINITIONS.map(def => ({
    key: def.key,
    top: def.topHeader ?? '',
    bottom: def.bottomHeader,
    title: def.title,
    bg: def.bg ?? '',
    playerOnly: def.playerOnly,
    teamOnly: def.teamOnly,
    divider: def.divider
}));

// A thicker left border marks the boundary where team-only stats begin.
const dividerClass = (col: { divider?: boolean }) => (col.divider ? 'border-l-2 border-l-amber-400 dark:border-l-amber-600' : '');

// Sticky-column styling. Each sticky `<th>` / `<td>` needs an opaque background
// so the horizontally-scrolling stat cells don't bleed through underneath.
const STICKY_HEAD_BG = 'bg-gray-50 dark:bg-gray-800';
const STICKY_BODY_BG = 'bg-white dark:bg-gray-900 group-hover:bg-gray-50 dark:group-hover:bg-gray-800';

export const StatsTable: React.FC<StatsTableProps> = ({ type, playerStats = [], teamStats = [], sortBy = '', onSortChange, isLoading = false, positionFilter = 'QB' }) => {
    const isPlayer = type === 'players';
    const normalizedPos = normalizePosition(positionFilter);

    // If a position filter is active, filter player rows by normalized position (Center is treated as Receiver)
    const filteredPlayerStats = useMemo(() => {
        if (!isPlayer || normalizedPos === 'ALL') return playerStats;
        return playerStats.filter(p => normalizePosition(p.player_position) === normalizedPos);
    }, [isPlayer, playerStats, normalizedPos]);

    const rawData = isPlayer ? filteredPlayerStats : teamStats;

    const [localSortBy, setLocalSortBy] = useState<string>('');
    const activeSortBy = sortBy || localSortBy;

    // Filter visible columns based on whether viewing teams or a specific player position
    const visibleStatCols = useMemo(() => {
        if (!isPlayer) {
            return STAT_COLS.filter(c => !c.playerOnly);
        }
        if (normalizedPos === 'ALL') {
            return STAT_COLS.filter(c => !c.teamOnly);
        }
        const allowedKeys = new Set(POSITION_STAT_KEYS[normalizedPos]);
        return STAT_COLS.filter(c => !c.teamOnly && allowedKeys.has(c.key));
    }, [isPlayer, normalizedPos]);

    // Clicking a stat header ranks leaders first (server-side if callback provided,
    // otherwise client-side sort); clicking it again returns to default order.
    const handleHeaderClick = (key: string) => {
        const nextSort = activeSortBy === key ? '' : key;
        if (onSortChange) {
            onSortChange(nextSort);
        }
        setLocalSortBy(nextSort);
    };

    const sortedData = useMemo(() => {
        if (!activeSortBy) return rawData;
        return [...rawData].sort((a: any, b: any) => {
            const valA = Number(a[activeSortBy] ?? 0);
            const valB = Number(b[activeSortBy] ?? 0);
            return valB - valA;
        });
    }, [rawData, activeSortBy]);

    const colgroupEl = (
        <colgroup>
            <col className="w-10 md:w-12" />
            <col className="w-[160px] md:w-[210px]" />
            {isPlayer && <col className="w-[72px] md:w-[90px]" />}
            {visibleStatCols.map(col => (
                <col key={col.key} className="w-[60px] md:w-[72px]" />
            ))}
        </colgroup>
    );

    const theadEl = (
        <thead className="text-[10px] md:text-xs text-gray-500 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-20 shadow-sm">
            <tr>
                <th className={`sticky left-0 top-0 z-30 ${STICKY_HEAD_BG} px-2 py-4 md:px-4 text-center border-r border-gray-100 dark:border-gray-700 shadow-sm`}>#</th>
                <th className={`sticky left-10 md:left-12 top-0 z-30 ${STICKY_HEAD_BG} px-2 py-4 md:px-4 text-left whitespace-nowrap uppercase border-r border-gray-100 dark:border-gray-700 shadow-sm`}>{isPlayer ? 'Player' : 'Team'}</th>
                {isPlayer && (
                    <th className={`sticky top-0 z-20 ${STICKY_HEAD_BG} px-2 py-4 md:px-4 text-left whitespace-nowrap uppercase border-r border-gray-100 dark:border-gray-700`}>Team</th>
                )}
                {visibleStatCols.map((col, i) => {
                    const isActive = activeSortBy === col.key;
                    const isLast = i === visibleStatCols.length - 1;
                    return (
                        <th
                            key={col.key}
                            className={`p-0 sticky top-0 z-20 ${isLast ? '' : 'border-r border-gray-100 dark:border-gray-700'} ${dividerClass(col)} ${STICKY_HEAD_BG} ${isActive ? 'border-b-2 border-b-sffl-red' : ''}`}
                        >
                            <button
                                type="button"
                                onClick={() => handleHeaderClick(col.key)}
                                title={isActive ? `${col.title} — click to clear sort` : `${col.title} — click to sort by leaders`}
                                className={`flex flex-col items-center justify-center leading-tight py-3 px-1 w-full whitespace-nowrap cursor-pointer select-none transition-colors hover:text-sffl-red ${isActive ? 'text-sffl-red font-black' : ''}`}
                            >
                                {col.top && <span className="text-[9px] md:text-[10px] font-semibold opacity-70">{col.top}</span>}
                                <span className="font-bold">
                                    {col.bottom}{isActive ? ' ▾' : ''}
                                </span>
                            </button>
                        </th>
                    );
                })}
            </tr>
        </thead>
    );

    // Loading shows a spinner rather than the empty state, so changing a
    // filter never flashes "No stats" before the new data arrives.
    if (isLoading) {
        return (
            <div className="rounded-lg md:rounded-xl shadow-lg bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700">
                <Spinner label="Loading stats…" className="py-16" />
            </div>
        );
    }

    if (rawData.length === 0) {
        return <div className="text-center p-8 text-gray-500 dark:text-gray-400">No stats available for the selected filters.</div>;
    }

    return (
        <div className="overflow-hidden rounded-lg md:rounded-xl shadow-lg bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700">
            <div className="px-3 py-2.5 md:px-6 md:py-4 bg-sffl-navy text-white font-bold text-sm md:text-lg">
                {isPlayer ? 'Player Statistics' : 'Team Statistics'}
            </div>
            {/* table-fixed + colgroup locks widths so the single sticky
                "name" column has a predictable right edge regardless of
                content length. Player view: # + Player stick; Team chip
                scrolls with the stats. Team view: # + Team stick. */}
            <div className="overflow-x-auto max-h-[70vh]">
                <table className="w-max text-xs md:text-sm text-center border-collapse table-fixed">
                    {colgroupEl}
                    {theadEl}
                    <tbody>
                    {sortedData.map((row: any, index: number) => {
                        return (
                            <tr
                                key={isPlayer ? row.player_id : row.team_id}
                                className="group border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-center"
                            >
                                <td className={`sticky left-0 z-10 ${STICKY_BODY_BG} px-2 py-2 md:px-4 md:py-4 text-center font-bold text-gray-400 dark:text-gray-500 border-r border-gray-50 dark:border-gray-800`}>
                                    {index + 1}
                                </td>
                                <td className={`sticky left-10 md:left-12 z-10 ${STICKY_BODY_BG} px-2 py-2 md:px-4 md:py-4 font-bold text-sffl-navy dark:text-white whitespace-nowrap text-left border-r border-gray-50 dark:border-gray-800 overflow-hidden`}>
                                    {isPlayer ? (
                                        <Link to={`/players/${row.player_id}`} className="flex items-center space-x-2 md:space-x-3 hover:text-sffl-red transition-colors min-w-0">
                                            {row.player_image ? (
                                                <LightboxImage
                                                    src={row.player_image}
                                                    alt={row.player_name}
                                                    thumbnailClassName="w-6 h-6 md:w-8 md:h-8 rounded-full object-cover shadow-sm border border-gray-100 dark:border-gray-700"
                                                />
                                            ) : (
                                                <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-[10px] md:text-xs shrink-0">
                                                    #{row.player_jersey_number}
                                                </div>
                                            )}
                                            <div className="flex flex-col min-w-0">
                                                <span className="leading-tight text-xs md:text-sm uppercase tracking-tight truncate">{row.player_name}</span>
                                                <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium truncate">{row.player_position}</span>
                                            </div>
                                        </Link>
                                    ) : (
                                        // Logo stays outside the Link so its built-in lightbox
                                        // (preventDefault) doesn't swallow navigation; the name
                                        // alone is the click target for the team page.
                                        <div className="flex items-center space-x-2 md:space-x-3 min-w-0">
                                            <LightboxImage
                                                src={row.team_logo || '/images/default_football.png'}
                                                alt={row.team_name}
                                                thumbnailClassName="w-6 h-6 md:w-8 md:h-8 object-contain rounded-md shadow-sm"
                                            />
                                            <Link
                                                to={`/teams/${row.team_id}`}
                                                className="uppercase text-xs md:text-sm tracking-tight truncate hover:text-sffl-red transition-colors"
                                            >
                                                {row.team_name}
                                            </Link>
                                        </div>
                                    )}
                                </td>
                                {isPlayer && (
                                    <td className="px-2 py-2 md:px-4 md:py-4 text-[10px] md:text-xs font-bold text-gray-600 dark:text-gray-400 whitespace-nowrap text-left border-r border-gray-50 dark:border-gray-800 overflow-hidden">
                                        <div className="flex items-center space-x-2 min-w-0">
                                            <LightboxImage
                                                src={row.team_logo || '/images/default_football.png'}
                                                alt=""
                                                thumbnailClassName="w-4 h-4 md:w-5 md:h-5 object-contain rounded-sm opacity-70"
                                            />
                                            <Link
                                                to={`/teams/${row.team_id}`}
                                                className="uppercase tracking-tight leading-none truncate hover:text-sffl-red transition-colors"
                                            >
                                                {row.team_short_name || row.team_name}
                                            </Link>
                                        </div>
                                    </td>
                                )}

                                {/* Stat values — rendered from visibleStatCols so header/body stay in sync */}
                                {visibleStatCols.map((col, i) => {
                                    const isLast = i === visibleStatCols.length - 1;
                                    const value = col.key === 'apps' ? (row.apps || '-') : ((row as Record<string, number>)[col.key] ?? 0);
                                    return (
                                        <td
                                            key={col.key}
                                            className={`px-1 py-4 ${isLast ? '' : 'border-r border-gray-50 dark:border-gray-800'} ${dividerClass(col)} font-medium text-gray-700 dark:text-gray-200 ${col.bg || ''}`}
                                        >
                                            {value}
                                        </td>
                                    );
                                })}
                            </tr>
                        );
                    })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
