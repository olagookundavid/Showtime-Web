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
    { key: 'passing_attempts', top: 'Pass', bottom: 'ATT', title: 'Pass Attempts', bg: 'bg-blue-50/30 dark:bg-blue-900/10' },
    { key: 'completed_passes', top: 'Pass', bottom: 'COMP', title: 'Pass Completions', bg: 'bg-blue-50/30 dark:bg-blue-900/10' },
    { key: 'incomplete_passes', top: 'Pass', bottom: 'INC', title: 'Incomplete Passes', bg: 'bg-blue-50/30 dark:bg-blue-900/10' },
    { key: 'passing_yards', top: 'Pass', bottom: 'YDS', title: 'Passing Yards', bg: 'bg-blue-50/30 dark:bg-blue-900/10' },
    { key: 'passing_tds', top: 'Pass', bottom: 'TDs', title: 'Passing Touchdowns', bg: 'bg-blue-50/30 dark:bg-blue-900/10' },
    { key: 'interceptions_thrown', top: 'Int', bottom: 'Thrown', title: 'Interceptions Thrown', bg: 'bg-blue-50/30 dark:bg-blue-900/10' },
    { key: 'uncatchable_passes', top: 'Pass', bottom: 'Unc', title: 'Uncatchable Passes', bg: 'bg-blue-50/30 dark:bg-blue-900/10' },
    { key: 'thrown_away_passes', top: 'Pass', bottom: 'TA', title: 'Thrown-Away Passes', bg: 'bg-blue-50/30 dark:bg-blue-900/10' },
    { key: 'batted_down_passes', top: 'Pass', bottom: 'Batted', title: 'Batted-Down Passes (QB)', bg: 'bg-blue-50/30 dark:bg-blue-900/10' },
    { key: 'qb_sacks', top: 'QB', bottom: 'Sacks', title: 'QB Sacks Accounted (QB fault)', bg: 'bg-blue-50/30 dark:bg-blue-900/10' },
    { key: 'rushing_attempts', top: 'Rush', bottom: 'ATT', title: 'Rushing Attempts', bg: 'bg-green-50/30 dark:bg-green-900/10' },
    { key: 'rushing_yards', top: 'Rush', bottom: 'YDS', title: 'Rushing Yards', bg: 'bg-green-50/30 dark:bg-green-900/10' },
    { key: 'rushing_tds', top: 'Rush', bottom: 'TDs', title: 'Rushing Touchdowns', bg: 'bg-green-50/30 dark:bg-green-900/10' },
    { key: 'receptions', top: '', bottom: 'Rec', title: 'Receptions', bg: 'bg-yellow-50/30 dark:bg-yellow-900/10' },
    { key: 'targets', top: '', bottom: 'Tgt', title: 'Targets (thrown to)', bg: 'bg-yellow-50/30 dark:bg-yellow-900/10' },
    { key: 'receiving_yards', top: 'Rec', bottom: 'YDS', title: 'Receiving Yards', bg: 'bg-yellow-50/30 dark:bg-yellow-900/10' },
    { key: 'receiving_tds', top: 'RC', bottom: 'TDs', title: 'Receiving Touchdowns', bg: 'bg-yellow-50/30 dark:bg-yellow-900/10' },
    { key: 'drops', top: '', bottom: 'Drops', title: 'Drops', bg: 'bg-yellow-50/30 dark:bg-yellow-900/10' },
    { key: 'xp_attempts', top: 'XP', bottom: 'Att', title: 'Extra-Point Attempts', bg: 'bg-purple-50/30 dark:bg-purple-900/10' },
    { key: 'xp_good', top: 'XP', bottom: 'Good', title: 'Extra Points Made', bg: 'bg-purple-50/30 dark:bg-purple-900/10' },
    { key: 'xp_fail', top: 'XP', bottom: 'Fail', title: 'Extra Points Failed', bg: 'bg-purple-50/30 dark:bg-purple-900/10' },
    { key: 'extra_points_tds', top: 'X-Pts', bottom: 'TDs', title: 'Extra Point Touchdowns (scorer)', bg: 'bg-purple-50/30 dark:bg-purple-900/10' },
    { key: 'flag_pulls', top: 'Flag', bottom: 'Pulls', title: 'Flag Pulls (Tackles)', bg: 'bg-red-50/30 dark:bg-red-900/10' },
    { key: 'pass_deflections', top: 'Pass', bottom: 'Defl', title: 'Pass Deflections', bg: 'bg-red-50/30 dark:bg-red-900/10' },
    { key: 'interceptions', top: 'Def', bottom: 'INT', title: 'Interceptions Caught', bg: 'bg-red-50/30 dark:bg-red-900/10' },
    { key: 'def_sacks', top: 'Def', bottom: 'Sacks', title: 'Defensive Sacks (Def fault)', bg: 'bg-red-50/30 dark:bg-red-900/10' },
    { key: 'defensive_tds', top: 'Def', bottom: 'TDs', title: 'Defensive Touchdowns', bg: 'bg-red-50/30 dark:bg-red-900/10' },
    { key: 'defensive_xp_tds', top: 'Def XP', bottom: 'TDs', title: 'Defensive Extra-Point TDs (interception returned on an extra point)', bg: 'bg-red-50/30 dark:bg-red-900/10' },
    { key: 'safety', top: '', bottom: 'Safety', title: 'Safeties', bg: 'bg-red-50/30 dark:bg-red-900/10' },
    { key: 'safety_conceded', top: 'Safety', bottom: 'Conc', title: 'Safeties Conceded (QB)', bg: 'bg-red-50/30 dark:bg-red-900/10' },
    // Team-only stats — shown only in the team view, tinted amber and set off
    // with a divider so they read as a distinct block after the player totals.
    { key: 'total_plays', top: 'Team', bottom: 'Plays', title: 'Total Plays (from scrimmage)', bg: 'bg-amber-50 dark:bg-amber-900/20', teamOnly: true, divider: true },
    { key: 'first_downs', top: 'Team', bottom: '1st Dn', title: 'First Downs', bg: 'bg-amber-50 dark:bg-amber-900/20', teamOnly: true },
    { key: 'turnovers', top: 'Team', bottom: 'TO', title: 'Turnovers', bg: 'bg-amber-50 dark:bg-amber-900/20', teamOnly: true },
    { key: 'punts', top: 'Team', bottom: 'Punts', title: 'Punts', bg: 'bg-amber-50 dark:bg-amber-900/20', teamOnly: true },
    { key: 'penalties', top: 'Team', bottom: 'Pen', title: 'Penalties', bg: 'bg-amber-50 dark:bg-amber-900/20', teamOnly: true },
    { key: 'penalty_yards', top: 'Pen', bottom: 'YDS', title: 'Penalty Yards', bg: 'bg-amber-50 dark:bg-amber-900/20', teamOnly: true },
];

// A thicker left border marks the boundary where team-only stats begin.
const dividerClass = (col: { divider?: boolean }) => (col.divider ? 'border-l-2 border-l-amber-400 dark:border-l-amber-600' : '');

// Sticky-column styling. Each sticky `<th>` / `<td>` needs an opaque background
// so the horizontally-scrolling stat cells don't bleed through underneath.
const STICKY_HEAD_BG = 'bg-gray-50 dark:bg-gray-800';
const STICKY_BODY_BG = 'bg-white dark:bg-gray-900 group-hover:bg-gray-50 dark:group-hover:bg-gray-800';

export const StatsTable: React.FC<StatsTableProps> = ({ type, playerStats = [], teamStats = [], sortBy = '', onSortChange, isLoading = false }) => {
    const isPlayer = type === 'players';
    const data = isPlayer ? playerStats : teamStats;

    const visibleStatCols = STAT_COLS.filter(c => isPlayer ? !(c as { teamOnly?: boolean }).teamOnly : !c.playerOnly);

    // Clicking a stat header ranks league-wide leaders first (server-side
    // sort, so it spans every page); clicking it again returns to A→Z.
    const handleHeaderClick = (key: string) => {
        if (!onSortChange) return;
        onSortChange(sortBy === key ? '' : key);
    };

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
                    const isActive = sortBy === col.key;
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

    if (data.length === 0) {
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
