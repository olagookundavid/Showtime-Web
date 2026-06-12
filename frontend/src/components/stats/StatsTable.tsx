import React from 'react';
import type { PlayerStat, TeamStat } from '../../services/api';
import { Link } from 'react-router-dom';
import { LightboxImage, Spinner } from '../ui';

interface StatsTableProps {
    type: 'players' | 'teams';
    playerStats?: PlayerStat[];
    teamStats?: TeamStat[];
    sortBy?: string;
    onSortChange?: (key: string) => void;
    isLoading?: boolean;
}

// Order must mirror the stat cells in the table body below.
// `top` is the category, `bottom` is the stat — rendered as two stacked lines
// in the header (e.g. "Passing" over "ATT"). Single-concept columns leave
// `top` empty and just show the bottom label.
const STAT_COLS = [
    { key: 'apps', top: '', bottom: 'Apps', title: 'Appearances (Games Played)', bg: '', playerOnly: true },
    { key: 'passing_attempts', top: 'Passing', bottom: 'ATT', title: 'Pass Attempts', bg: 'bg-blue-50/30 dark:bg-blue-900/10' },
    { key: 'completed_passes', top: 'Passing', bottom: 'COMP', title: 'Pass Completions', bg: 'bg-blue-50/30 dark:bg-blue-900/10' },
    { key: 'passing_tds', top: 'Passing', bottom: 'TDs', title: 'Passing Touchdowns', bg: 'bg-blue-50/30 dark:bg-blue-900/10' },
    { key: 'interceptions_thrown', top: 'Passing', bottom: 'INT', title: 'Interceptions Thrown', bg: 'bg-blue-50/30 dark:bg-blue-900/10' },
    { key: 'qb_sacks', top: 'QB', bottom: 'Sacks', title: 'QB Sacks Accounted (QB fault)', bg: 'bg-blue-50/30 dark:bg-blue-900/10' },
    { key: 'rushing_attempts', top: 'Rush', bottom: 'ATT', title: 'Rushing Attempts', bg: 'bg-green-50/30 dark:bg-green-900/10' },
    { key: 'rushing_tds', top: 'Rush', bottom: 'TDs', title: 'Rushing Touchdowns', bg: 'bg-green-50/30 dark:bg-green-900/10' },
    { key: 'receptions', top: '', bottom: 'Rec', title: 'Receptions', bg: 'bg-yellow-50/30 dark:bg-yellow-900/10' },
    { key: 'receiving_tds', top: 'RC', bottom: 'TDs', title: 'Receiving Touchdowns', bg: 'bg-yellow-50/30 dark:bg-yellow-900/10' },
    { key: 'drops', top: '', bottom: 'Drops', title: 'Drops', bg: 'bg-yellow-50/30 dark:bg-yellow-900/10' },
    { key: 'extra_points_tds', top: 'X-Pts', bottom: 'TDs', title: 'Extra Point Touchdowns', bg: 'bg-purple-50/30 dark:bg-purple-900/10' },
    { key: 'flag_pulls', top: 'Flag', bottom: 'Pulls', title: 'Flag Pulls (Tackles)', bg: 'bg-red-50/30 dark:bg-red-900/10' },
    { key: 'pass_deflections', top: 'Pass', bottom: 'Defl', title: 'Pass Deflections', bg: 'bg-red-50/30 dark:bg-red-900/10' },
    { key: 'interceptions', top: 'Def', bottom: 'INT', title: 'Interceptions Caught', bg: 'bg-red-50/30 dark:bg-red-900/10' },
    { key: 'def_sacks', top: 'Def', bottom: 'Sacks', title: 'Defensive Sacks (Def fault)', bg: 'bg-red-50/30 dark:bg-red-900/10' },
    { key: 'defensive_tds', top: 'Def', bottom: 'TDs', title: 'Defensive Touchdowns', bg: 'bg-red-50/30 dark:bg-red-900/10' },
    { key: 'defensive_xp_tds', top: 'Def XP', bottom: 'TDs', title: 'Defensive Extra-Point TDs (interception returned on an extra point)', bg: 'bg-red-50/30 dark:bg-red-900/10' },
    { key: 'safety', top: '', bottom: 'Safety', title: 'Safeties', bg: 'bg-red-50/30 dark:bg-red-900/10' },
];

// Sticky-column styling. Each sticky `<th>` / `<td>` needs an opaque background
// so the horizontally-scrolling stat cells don't bleed through underneath.
// The `<tr>` is marked `group` so hover styling cascades into sticky cells too.
const STICKY_HEAD_BG = 'bg-gray-50 dark:bg-gray-800';
const STICKY_BODY_BG = 'bg-white dark:bg-gray-900 group-hover:bg-gray-50 dark:group-hover:bg-gray-800';

export const StatsTable: React.FC<StatsTableProps> = ({ type, playerStats = [], teamStats = [], sortBy = '', onSortChange, isLoading = false }) => {
    const isPlayer = type === 'players';
    const data = isPlayer ? playerStats : teamStats;

    const visibleStatCols = STAT_COLS.filter(c => isPlayer || !c.playerOnly);

    // Clicking a stat header ranks league-wide leaders first (server-side
    // sort, so it spans every page); clicking it again returns to A→Z.
    const handleHeaderClick = (key: string) => {
        if (!onSortChange) return;
        onSortChange(sortBy === key ? '' : key);
    };

    // Loading shows a spinner rather than the empty state, so changing a
    // filter never flashes "No stats" before the new data arrives.
    if (isLoading) {
        return (
            <div className="rounded-lg md:rounded-xl shadow-lg bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700">
                <Spinner label="Loading stats…" className="py-16" />
            </div>
        );
    }

    if (data.length === 0) {
        return <div className="text-center p-8 text-gray-500 dark:text-gray-400">No stats available for the selected filters.</div>;
    }

    return (
        <div className="overflow-hidden rounded-lg md:rounded-xl shadow-lg bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700">
            <div className="px-3 py-2.5 md:px-6 md:py-4 bg-sffl-navy text-white font-bold text-sm md:text-lg">
                {isPlayer ? 'Player Statistics' : 'Team Statistics'}
            </div>
            <div className="overflow-x-auto">
                {/* table-fixed + colgroup locks widths so the single sticky
                    "name" column has a predictable right edge regardless of
                    content length. Player view: # + Player stick; Team chip
                    scrolls with the stats. Team view: # + Team stick. */}
                <table className="w-max text-xs md:text-sm text-center border-collapse table-fixed">
                    <colgroup>
                        <col className="w-10 md:w-12" />
                        <col className="w-[160px] md:w-[210px]" />
                        {isPlayer && <col className="w-[72px] md:w-[90px]" />}
                        {visibleStatCols.map(col => (
                            <col key={col.key} className="w-[60px] md:w-[72px]" />
                        ))}
                    </colgroup>
                    <thead className="text-[10px] md:text-xs bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">
                        <tr>
                            <th className={`sticky left-0 z-20 ${STICKY_HEAD_BG} px-2 py-4 md:px-4 text-center border-r border-gray-100 dark:border-gray-700`}>#</th>
                            <th className={`sticky left-10 md:left-12 z-20 ${STICKY_HEAD_BG} px-2 py-4 md:px-4 text-left whitespace-nowrap uppercase border-r border-gray-100 dark:border-gray-700`}>{isPlayer ? 'Player' : 'Team'}</th>
                            {isPlayer && (
                                <th className="px-2 py-4 md:px-4 text-left whitespace-nowrap uppercase border-r border-gray-100 dark:border-gray-700">Team</th>
                            )}

                            {/* Stacked two-line headers — click to rank league-wide leaders */}
                            {visibleStatCols.map((col, i) => {
                                const isActive = sortBy === col.key;
                                const isLast = i === visibleStatCols.length - 1;
                                return (
                                    <th
                                        key={col.key}
                                        className={`p-0 ${isLast ? '' : 'border-r border-gray-100 dark:border-gray-700'} ${col.bg} ${isActive ? 'bg-sffl-red/10 dark:bg-sffl-red/20' : ''}`}
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
                    <tbody>
                        {data.map((row: any, index: number) => {
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
                                            <div className="flex items-center space-x-2 md:space-x-3 min-w-0">
                                                <LightboxImage
                                                    src={row.team_logo || 'https://via.placeholder.com/30'}
                                                    alt={row.team_name}
                                                    thumbnailClassName="w-6 h-6 md:w-8 md:h-8 object-contain rounded-md shadow-sm"
                                                />
                                                <span className="uppercase text-xs md:text-sm tracking-tight truncate">{row.team_name}</span>
                                            </div>
                                        )}
                                    </td>
                                    {isPlayer && (
                                        <td className="px-2 py-2 md:px-4 md:py-4 text-[10px] md:text-xs font-bold text-gray-600 dark:text-gray-400 whitespace-nowrap text-left border-r border-gray-50 dark:border-gray-800 overflow-hidden">
                                            <div className="flex items-center space-x-2 min-w-0">
                                                <LightboxImage
                                                    src={row.team_logo || 'https://via.placeholder.com/20'}
                                                    alt=""
                                                    thumbnailClassName="w-4 h-4 md:w-5 md:h-5 object-contain rounded-sm opacity-70"
                                                />
                                                <span className="uppercase tracking-tight leading-none truncate">{row.team_short_name || row.team_name}</span>
                                            </div>
                                        </td>
                                    )}

                                    {/* Stat values */}
                                    {isPlayer && (
                                        <td className="px-1 py-4 border-r border-gray-50 dark:border-gray-800 font-medium text-gray-700 dark:text-gray-200">{row.apps || '-'}</td>
                                    )}
                                    <td className="px-1 py-4 border-r border-gray-50 dark:border-gray-800 font-medium bg-blue-50/5 dark:bg-blue-900/5 text-gray-700 dark:text-gray-200">{row.passing_attempts}</td>
                                    <td className="px-1 py-4 border-r border-gray-50 dark:border-gray-800 font-medium bg-blue-50/5 dark:bg-blue-900/5 text-gray-700 dark:text-gray-200">{row.completed_passes}</td>
                                    <td className="px-1 py-4 border-r border-gray-50 dark:border-gray-800 font-bold bg-blue-50/10 dark:bg-blue-900/10 text-blue-600 dark:text-blue-400">{row.passing_tds}</td>
                                    <td className="px-1 py-4 border-r border-gray-50 dark:border-gray-800 font-medium bg-blue-50/5 dark:bg-blue-900/5 text-gray-700 dark:text-gray-200">{row.interceptions_thrown}</td>
                                    <td className="px-1 py-4 border-r border-gray-50 dark:border-gray-800 font-medium bg-blue-50/5 dark:bg-blue-900/5 text-gray-700 dark:text-gray-200">{row.qb_sacks}</td>
                                    <td className="px-1 py-4 border-r border-gray-50 dark:border-gray-800 font-medium bg-green-50/5 dark:bg-green-900/5 text-gray-700 dark:text-gray-200">{row.rushing_attempts}</td>
                                    <td className="px-1 py-4 border-r border-gray-50 dark:border-gray-800 font-bold bg-green-50/10 dark:bg-green-900/10 text-green-600 dark:text-green-400">{row.rushing_tds}</td>
                                    <td className="px-1 py-4 border-r border-gray-50 dark:border-gray-800 font-medium bg-yellow-50/5 dark:bg-yellow-900/5 text-gray-700 dark:text-gray-200">{row.receptions}</td>
                                    <td className="px-1 py-4 border-r border-gray-50 dark:border-gray-800 font-bold bg-yellow-50/10 dark:bg-yellow-900/10 text-yellow-600 dark:text-yellow-400">{row.receiving_tds}</td>
                                    <td className="px-1 py-4 border-r border-gray-50 dark:border-gray-800 font-medium bg-yellow-50/5 dark:bg-yellow-900/5 text-gray-700 dark:text-gray-200">{row.drops}</td>
                                    <td className="px-1 py-4 border-r border-gray-50 dark:border-gray-800 font-bold bg-purple-50/10 dark:bg-purple-900/10 text-purple-600 dark:text-purple-400">{row.extra_points_tds}</td>
                                    <td className="px-1 py-4 border-r border-gray-50 dark:border-gray-800 font-medium bg-red-50/5 dark:bg-red-900/5 text-gray-700 dark:text-gray-200">{row.flag_pulls}</td>
                                    <td className="px-1 py-4 border-r border-gray-50 dark:border-gray-800 font-medium bg-red-50/5 dark:bg-red-900/5 text-gray-700 dark:text-gray-200">{row.pass_deflections}</td>
                                    <td className="px-1 py-4 border-r border-gray-50 dark:border-gray-800 font-bold bg-red-50/10 dark:bg-red-900/10 text-red-600 dark:text-red-400">{row.interceptions}</td>
                                    <td className="px-1 py-4 border-r border-gray-50 dark:border-gray-800 font-medium bg-red-50/5 dark:bg-red-900/5 text-gray-700 dark:text-gray-200">{row.def_sacks}</td>
                                    <td className="px-1 py-4 border-r border-gray-50 dark:border-gray-800 font-bold bg-red-50/10 dark:bg-red-900/10 text-red-600 dark:text-red-400">{row.defensive_tds}</td>
                                    <td className="px-1 py-4 border-r border-gray-50 dark:border-gray-800 font-bold bg-red-50/10 dark:bg-red-900/10 text-red-600 dark:text-red-400">{row.defensive_xp_tds ?? 0}</td>
                                    <td className="px-1 py-4 bg-red-50/5 dark:bg-red-900/5 text-gray-700 dark:text-gray-200 font-medium">{row.safety}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
