import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Standing } from '../../services/api';
import { LightboxImage } from '../ui';

interface StandingsTableProps {
    standings: Standing[];
    isCompleted?: boolean;
    highlightTeamId?: string;
}

const L5Badge: React.FC<{ result: string }> = ({ result }) => {
    const colors: Record<string, string> = {
        'W': 'bg-green-500 text-white',
        'D': 'bg-yellow-400 text-gray-900',
        'L': 'bg-red-500 text-white',
    };
    return (
        <span className={`inline-flex items-center justify-center w-3 h-3 md:w-5 md:h-5 rounded text-[6.5px] md:text-[10px] font-black ${colors[result] || 'bg-gray-300 text-gray-600'}`}>
            {result}
        </span>
    );
};

export const StandingsTable: React.FC<StandingsTableProps> = ({ standings, isCompleted, highlightTeamId }) => {
    // See StatsTable for the rationale behind this floating-clone pattern:
    // the table needs overflow-x-auto for narrow screens, which captures any
    // pure-CSS `sticky top-0`. The JS clone gives us a viewport-pinned thead
    // during PAGE scroll.
    const containerRef = useRef<HTMLDivElement>(null);
    const cloneScrollRef = useRef<HTMLDivElement>(null);
    const [floatHead, setFloatHead] = useState({ visible: false, left: 0, width: 0, scrollLeft: 0 });

    useEffect(() => {
        let raf = 0;
        const update = () => {
            raf = 0;
            const c = containerRef.current;
            if (!c) return;
            const rect = c.getBoundingClientRect();
            const thead = c.querySelector('thead');
            const theadHeight = thead?.getBoundingClientRect().height ?? 0;
            const visible = rect.top < 0 && rect.bottom > theadHeight;
            setFloatHead({
                visible,
                left: Math.round(rect.left),
                width: Math.round(rect.width),
                scrollLeft: c.scrollLeft,
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
    }, [standings.length]);

    useEffect(() => {
        const clone = cloneScrollRef.current;
        if (clone && clone.scrollLeft !== floatHead.scrollLeft) {
            clone.scrollLeft = floatHead.scrollLeft;
        }
    }, [floatHead.scrollLeft, floatHead.visible]);

    const theadEl = (
        <thead className="text-[10px] md:text-xs uppercase bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">
            <tr>
                <th className="sticky left-0 z-20 bg-gray-50 dark:bg-gray-800 px-2.5 py-3 md:px-4 md:py-3 text-center w-10 md:w-14">Pos</th>
                <th className="sticky left-10 md:left-14 z-20 bg-gray-50 dark:bg-gray-800 px-2.5 py-3 md:px-4 md:py-3 whitespace-nowrap w-[130px] md:w-[200px] border-r border-gray-100 dark:border-gray-700">Team</th>
                <th className="bg-gray-50 dark:bg-gray-800 px-2.5 py-3 md:px-4 md:py-3 text-center whitespace-nowrap">P</th>
                <th className="bg-gray-50 dark:bg-gray-800 px-2.5 py-3 md:px-4 md:py-3 text-center whitespace-nowrap">W</th>
                <th className="bg-gray-50 dark:bg-gray-800 px-2.5 py-3 md:px-4 md:py-3 text-center whitespace-nowrap">D</th>
                <th className="bg-gray-50 dark:bg-gray-800 px-2.5 py-3 md:px-4 md:py-3 text-center whitespace-nowrap">L</th>
                <th className="bg-gray-50 dark:bg-gray-800 px-2.5 py-3 md:px-4 md:py-3 text-center whitespace-nowrap">PF</th>
                <th className="bg-gray-50 dark:bg-gray-800 px-2.5 py-3 md:px-4 md:py-3 text-center whitespace-nowrap">PA</th>
                <th className="bg-gray-50 dark:bg-gray-800 px-2.5 py-3 md:px-4 md:py-3 text-center whitespace-nowrap">PD</th>
                <th className="bg-gray-50 dark:bg-gray-800 px-2.5 py-3 md:px-4 md:py-3 text-center whitespace-nowrap">PCT</th>
                <th className="bg-gray-50 dark:bg-gray-800 px-2.5 py-3 md:px-4 md:py-3 text-center">L5</th>
            </tr>
        </thead>
    );

    if (standings.length === 0) {
        return <div className="text-center p-8 text-gray-500 dark:text-gray-400">No standings available yet.</div>;
    }

    return (
        <>
            <div className="overflow-hidden rounded-lg md:rounded-xl shadow-lg bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700">
                <div className="px-3 py-2.5 md:px-6 md:py-4 bg-sffl-navy text-white font-bold text-sm md:text-lg flex items-center justify-between">
                    <span>Team Standings</span>
                    {isCompleted && <span className="text-xs bg-amber-500 text-sffl-navy px-2 py-0.5 rounded-full font-black uppercase tracking-wider">Season Completed</span>}
                </div>
                <div ref={containerRef} className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-xs md:text-sm text-left">
                        {theadEl}
                    <tbody>
                        {standings.map((standing, index) => {
                            const isGold = isCompleted && index === 0;
                            const isSilver = isCompleted && index === 1;
                            const isHighlighted = !!highlightTeamId && standing.team?.id === highlightTeamId;
                            // Sticky cells need OPAQUE backgrounds matching their row, since the
                            // scrolling stat cells slide underneath them. The base row keeps the
                            // semi-transparent tint; the sticky cells use solid equivalents.
                            const stickyBg = isHighlighted
                                ? 'bg-sffl-red/15 dark:bg-sffl-red/30 group-hover:bg-sffl-red/25 dark:group-hover:bg-sffl-red/40'
                                : isGold
                                    ? 'bg-amber-50 dark:bg-amber-950 group-hover:bg-amber-100 dark:group-hover:bg-amber-900'
                                    : isSilver
                                        ? 'bg-slate-50 dark:bg-slate-900 group-hover:bg-slate-100 dark:group-hover:bg-slate-800'
                                        : 'bg-white dark:bg-gray-900 group-hover:bg-gray-50 dark:group-hover:bg-gray-800';

                            return (
                                <tr
                                    key={standing.id}
                                    data-team-id={standing.team?.id}
                                    className={`
                                        group border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors
                                        ${isHighlighted ? 'bg-sffl-red/10 hover:bg-sffl-red/20 dark:bg-sffl-red/20 dark:hover:bg-sffl-red/30 border-l-4 border-l-sffl-red ring-2 ring-sffl-red/40 ring-inset' :
                                          isGold ? 'bg-amber-500/10 hover:bg-amber-500/20 dark:bg-amber-500/5 dark:hover:bg-amber-500/10 border-l-4 border-l-amber-500' :
                                          isSilver ? 'bg-slate-300/20 hover:bg-slate-300/30 dark:bg-slate-300/10 dark:hover:bg-slate-300/20 border-l-4 border-l-slate-400' :
                                          index < 4 ? 'border-l-4 border-l-green-500' : ''}
                                    `}
                                >
                                    <td className={`sticky left-0 z-10 ${stickyBg} px-2.5 py-3 md:px-4 md:py-4 text-center font-bold text-gray-600 dark:text-gray-300 w-10 md:w-14`}>
                                        {standing.position}
                                    </td>
                                    <td className={`sticky left-10 md:left-14 z-10 ${stickyBg} px-2.5 py-3 md:px-4 md:py-4 font-semibold text-sffl-navy dark:text-white whitespace-nowrap text-left w-[130px] md:w-[200px] border-r border-gray-100 dark:border-gray-800`}>
                                        <div className="flex items-center space-x-1 md:space-x-3">
                                            <LightboxImage
                                                src={standing.team?.logo || 'https://via.placeholder.com/30'}
                                                alt={standing.team?.name || 'Team'}
                                                thumbnailClassName="w-5 h-5 md:w-8 md:h-8 object-contain rounded-md"
                                            />
                                            {standing.team?.id ? (
                                                <Link
                                                    to={`/teams/${standing.team.id}`}
                                                    className="truncate max-w-[60px] md:max-w-none flex items-center gap-1 uppercase hover:text-sffl-red transition-colors"
                                                >
                                                    {standing.team?.short_name || standing.team?.name || 'Unknown'}
                                                    {isGold && <span title="Champion">👑</span>}
                                                    {isSilver && <span title="Runner Up">🥈</span>}
                                                </Link>
                                            ) : (
                                                <span className="truncate max-w-[60px] md:max-w-none flex items-center gap-1 uppercase">
                                                    {standing.team?.short_name || standing.team?.name || 'Unknown'}
                                                    {isGold && <span title="Champion">👑</span>}
                                                    {isSilver && <span title="Runner Up">🥈</span>}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                <td className="px-2.5 py-3 md:px-4 md:py-4 text-center text-gray-700 dark:text-gray-200">{standing.played}</td>
                                <td className="px-2.5 py-3 md:px-4 md:py-4 text-center text-gray-700 dark:text-gray-200">{standing.won}</td>
                                <td className="px-2.5 py-3 md:px-4 md:py-4 text-center text-gray-700 dark:text-gray-200">{standing.drawn}</td>
                                <td className="px-2.5 py-3 md:px-4 md:py-4 text-center text-gray-700 dark:text-gray-200">{standing.lost}</td>
                                <td className="px-2.5 py-3 md:px-4 md:py-4 text-center text-gray-700 dark:text-gray-200">{standing.goals_for}</td>
                                <td className="px-2.5 py-3 md:px-4 md:py-4 text-center text-gray-700 dark:text-gray-200">{standing.goals_against}</td>
                                <td className="px-2.5 py-3 md:px-4 md:py-4 text-center font-bold text-gray-800 dark:text-gray-100">
                                    {standing.goal_diff > 0 ? `+${standing.goal_diff}` : standing.goal_diff}
                                </td>
                                <td className="px-2.5 py-3 md:px-4 md:py-4 text-center font-semibold text-gray-800 dark:text-gray-100">
                                    {standing.pct != null ? `${standing.pct}%` : '-'}
                                </td>
                                <td className="px-2.5 py-3 md:px-4 md:py-4 text-center">
                                    {standing.l5 ? (
                                        <div className="flex gap-0.5 justify-center">
                                            {standing.l5.split('').filter(c => c !== '-').map((r, i) => (
                                                <L5Badge key={i} result={r} />
                                            ))}
                                        </div>
                                    ) : (
                                        <span className="text-gray-400 dark:text-gray-500">-</span>
                                    )}
                                </td>
                            </tr>
                        );
                    })}
                    </tbody>
                </table>
                </div>
            </div>

            {/* Floating pinned thead — see StatsTable for the rationale. */}
            {floatHead.visible && (
                <div
                    className="fixed top-0 z-50 shadow-md"
                    style={{ left: floatHead.left, width: floatHead.width }}
                >
                    <div ref={cloneScrollRef} className="overflow-x-hidden">
                        <table className="w-full text-xs md:text-sm text-left" style={{ width: floatHead.width }}>
                            {theadEl}
                        </table>
                    </div>
                </div>
            )}
        </>
    );
};
