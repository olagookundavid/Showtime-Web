import React, { useEffect, useRef, useState } from 'react';
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

    // ─── Floating sticky thead ────────────────────────────────────────────
    // The table needs overflow-x-auto to allow horizontal scroll on narrow
    // screens; that establishes a scroll container, which means a pure-CSS
    // `position: sticky; top: 0` thead would pin to that container (not the
    // viewport). Result: as the user scrolls the PAGE, the thead scrolls off
    // with the table. To get "header sticks to the screen", we render a
    // cloned thead in a `position: fixed; top: 0` overlay whenever the real
    // thead has scrolled above the viewport and the table is still visible.
    // Horizontal scrolling is kept in sync (original ↔ clone) so the columns
    // always line up under the pinned header.
    const containerRef = useRef<HTMLDivElement>(null);
    const cloneScrollRef = useRef<HTMLDivElement>(null);
    const [floatHead, setFloatHead] = useState({ visible: false, left: 0, width: 0, scrollLeft: 0, top: 0 });

    useEffect(() => {
        let raf = 0;
        const update = () => {
            raf = 0;
            const c = containerRef.current;
            if (!c) return;
            const rect = c.getBoundingClientRect();
            // The site's <nav> is sticky at top-0 — pin the floating thead
            // beneath it, not at the absolute viewport top, otherwise the nav
            // covers it (same z-50) and the header looks invisible.
            const nav = document.querySelector('nav');
            const navBottom = nav?.getBoundingClientRect().bottom ?? 0;
            const thead = c.querySelector('thead');
            const theadHeight = thead?.getBoundingClientRect().height ?? 0;
            // Pin when the table's own top has scrolled above the nav (so the
            // original thead is hidden) AND the table body extends past where
            // the pinned header would sit.
            const visible = rect.top < navBottom && rect.bottom > navBottom + theadHeight;
            setFloatHead({
                visible,
                left: Math.round(rect.left),
                width: Math.round(rect.width),
                scrollLeft: c.scrollLeft,
                top: Math.round(navBottom),
            });
        };
        const schedule = () => {
            if (raf) return;
            raf = requestAnimationFrame(update);
        };
        update();
        window.addEventListener('scroll', schedule, { passive: true });
        window.addEventListener('resize', schedule);
        const c = containerRef.current;
        c?.addEventListener('scroll', schedule, { passive: true });
        return () => {
            window.removeEventListener('scroll', schedule);
            window.removeEventListener('resize', schedule);
            c?.removeEventListener('scroll', schedule);
            if (raf) cancelAnimationFrame(raf);
        };
    }, [data.length]);

    // Mirror the original's horizontal scroll into the clone so its sticky-
    // left cells line up under the body's sticky-left columns.
    useEffect(() => {
        const clone = cloneScrollRef.current;
        if (clone && clone.scrollLeft !== floatHead.scrollLeft) {
            clone.scrollLeft = floatHead.scrollLeft;
        }
    }, [floatHead.scrollLeft, floatHead.visible]);

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
        <thead className="text-[10px] md:text-xs bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">
            <tr>
                <th className={`sticky left-0 z-20 ${STICKY_HEAD_BG} px-2 py-4 md:px-4 text-center border-r border-gray-100 dark:border-gray-700`}>#</th>
                <th className={`sticky left-10 md:left-12 z-20 ${STICKY_HEAD_BG} px-2 py-4 md:px-4 text-left whitespace-nowrap uppercase border-r border-gray-100 dark:border-gray-700`}>{isPlayer ? 'Player' : 'Team'}</th>
                {isPlayer && (
                    <th className={`${STICKY_HEAD_BG} px-2 py-4 md:px-4 text-left whitespace-nowrap uppercase border-r border-gray-100 dark:border-gray-700`}>Team</th>
                )}
                {visibleStatCols.map((col, i) => {
                    const isActive = sortBy === col.key;
                    const isLast = i === visibleStatCols.length - 1;
                    return (
                        <th
                            key={col.key}
                            className={`p-0 ${isLast ? '' : 'border-r border-gray-100 dark:border-gray-700'} ${STICKY_HEAD_BG} ${isActive ? 'border-b-2 border-b-sffl-red' : ''}`}
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
        <>
            <div className="overflow-hidden rounded-lg md:rounded-xl shadow-lg bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700">
                <div className="px-3 py-2.5 md:px-6 md:py-4 bg-sffl-navy text-white font-bold text-sm md:text-lg">
                    {isPlayer ? 'Player Statistics' : 'Team Statistics'}
                </div>
                {/* table-fixed + colgroup locks widths so the single sticky
                    "name" column has a predictable right edge regardless of
                    content length. Player view: # + Player stick; Team chip
                    scrolls with the stats. Team view: # + Team stick. */}
                <div ref={containerRef} className="overflow-x-auto">
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
                                                    src={row.team_logo || 'https://via.placeholder.com/30'}
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
                                                    src={row.team_logo || 'https://via.placeholder.com/20'}
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

            {/* Floating pinned thead — only mounts while the real header has
                scrolled off the top. Pinned below the sticky nav (top:
                navBottom) so the nav stays usable. z-40 sits between the
                z-50 nav and the z-40 mobile menu (they don't co-occur with
                this view). Background is opaque so body rows scrolling
                underneath don't bleed through. */}
            {floatHead.visible && (
                <div
                    className="fixed z-40 shadow-md bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700"
                    style={{ top: floatHead.top, left: floatHead.left, width: floatHead.width }}
                >
                    <div ref={cloneScrollRef} className="overflow-x-hidden">
                        <table className="w-max text-xs md:text-sm text-center border-collapse table-fixed">
                            {colgroupEl}
                            {theadEl}
                        </table>
                    </div>
                </div>
            )}
        </>
    );
};
