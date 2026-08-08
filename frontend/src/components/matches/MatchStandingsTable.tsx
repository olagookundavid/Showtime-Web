import React from 'react';
import { Link } from 'react-router-dom';
import type { Standing } from '../../services/api';

interface MatchStandingsTableProps {
    standings: Standing[];
    isCompleted?: boolean;
    viewAllLink?: string;
}

export const MatchStandingsTable: React.FC<MatchStandingsTableProps> = ({ standings, isCompleted, viewAllLink }) => {
    if (standings.length === 0) {
        return <div className="text-center p-8 text-gray-500 dark:text-gray-400">No standings available yet.</div>;
    }

    return (
        <div className="overflow-hidden rounded-lg md:rounded-xl shadow-lg bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700">
            <div className="px-3 py-2.5 md:px-6 md:py-4 bg-sffl-navy text-white font-bold text-sm md:text-lg flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-yellow-500">🏆</span>
                    <span>Team Standings</span>
                </div>
                <div className="flex items-center gap-3">
                    {viewAllLink && (
                        <Link to={viewAllLink} className="text-[10px] md:text-xs bg-white/10 hover:bg-white/20 text-white px-2 py-1 rounded transition-colors uppercase tracking-tight">
                            View All →
                        </Link>
                    )}
                </div>
            </div>
            <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-xs md:text-sm text-left">
                    <thead className="text-[10px] md:text-xs uppercase bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">
                        <tr>
                            <th className="sticky left-0 z-20 bg-gray-50 dark:bg-gray-800 px-1 py-2 md:px-4 md:py-3 text-center w-10 md:w-14"></th>
                            <th className="sticky left-10 md:left-14 z-20 bg-gray-50 dark:bg-gray-800 px-1 py-2 md:px-4 md:py-3 whitespace-nowrap w-[100px] md:w-[140px] border-r border-gray-100 dark:border-gray-700">Team</th>
                            <th className="px-1 py-2 md:px-4 md:py-3 text-center whitespace-nowrap">P</th>
                            <th className="px-1 py-2 md:px-4 md:py-3 text-center whitespace-nowrap">PD</th>
                            <th className="px-1 py-2 md:px-4 md:py-3 text-center whitespace-nowrap">PCT</th>
                        </tr>
                    </thead>
                    <tbody>
                        {standings.map((standing, index) => {
                            const isGold = isCompleted && index === 0;
                            const isWildcard = index >= 1 && index < 7;
                            const logoImg = (
                                <img
                                    src={standing.team?.logo || '/images/default_football.png'}
                                    alt={standing.team?.name || 'Team'}
                                    className="w-5 h-5 md:w-8 md:h-8 object-contain rounded-md mx-auto"
                                    title={standing.team?.name || 'Team'}
                                />
                            );
                            const nameText = standing.team?.short_name || standing.team?.name || 'Unknown';

                            const stickyBg = isGold
                                ? 'bg-amber-100/90 dark:bg-amber-950/90 group-hover:bg-amber-200/90 dark:group-hover:bg-amber-900/90'
                                : 'bg-white dark:bg-gray-900 group-hover:bg-gray-50 dark:group-hover:bg-gray-800';
                            const stickyZ = isGold ? 'z-30' : 'z-10';

                            return (
                                <tr
                                    key={standing.id}
                                    className={`
                                        group border-b border-gray-100 dark:border-gray-700 transition-all duration-300
                                        ${isGold
                                            ? 'bg-gradient-to-r from-amber-300/40 via-yellow-400/50 to-amber-300/40 dark:from-amber-600/40 dark:via-yellow-500/50 dark:to-amber-600/40 border-l-4 border-l-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.45)] ring-2 ring-yellow-400/50 font-bold text-amber-950 dark:text-amber-100 relative z-30'
                                            : isWildcard
                                            ? 'border-l-4 border-l-green-500 hover:bg-gray-50 dark:hover:bg-gray-800'
                                            : 'hover:bg-gray-50 dark:hover:bg-gray-800'}
                                    `}
                                >
                                    <td className={`sticky left-0 ${stickyZ} ${stickyBg} px-1 py-2 md:px-4 md:py-4 text-center w-10 md:w-14`}>
                                        {standing.team?.id ? (
                                            <Link to={`/teams/${standing.team.id}`} className="block hover:opacity-80 transition-opacity">
                                                {logoImg}
                                            </Link>
                                        ) : logoImg}
                                    </td>
                                    <td className={`sticky left-10 md:left-14 ${stickyZ} ${stickyBg} px-1 py-2 md:px-4 md:py-4 font-semibold text-sffl-navy dark:text-white whitespace-nowrap w-[100px] md:w-[140px] border-r border-gray-100 dark:border-gray-800`}>
                                        {standing.team?.id ? (
                                            <Link
                                                to={`/teams/${standing.team.id}`}
                                                className="inline-flex items-center gap-1 uppercase hover:text-sffl-red transition-colors min-w-0 relative z-30"
                                            >
                                                <span className="truncate max-w-[60px] md:max-w-none">{nameText}</span>
                                                {isGold && <img src="/images/branding/showtime-bowl-trophy.png" alt="Champion Trophy" className="w-5 h-5 md:w-7 md:h-7 object-contain inline-block ml-1 animate-bounce drop-shadow-xl relative z-40 flex-shrink-0" title="Champion" />}
                                            </Link>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 uppercase min-w-0 relative z-30">
                                                <span className="truncate max-w-[60px] md:max-w-none">{nameText}</span>
                                                {isGold && <img src="/images/branding/showtime-bowl-trophy.png" alt="Champion Trophy" className="w-5 h-5 md:w-7 md:h-7 object-contain inline-block ml-1 animate-bounce drop-shadow-xl relative z-40 flex-shrink-0" title="Champion" />}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-1 py-2 md:px-4 md:py-4 text-center text-gray-700 dark:text-gray-200">{standing.played}</td>
                                    <td className="px-1 py-2 md:px-4 md:py-4 text-center font-bold text-gray-800 dark:text-gray-100">
                                        {standing.goal_diff > 0 ? `+${standing.goal_diff}` : standing.goal_diff}
                                    </td>
                                    <td className="px-1 py-2 md:px-4 md:py-4 text-center font-semibold text-gray-800 dark:text-gray-100">
                                        {standing.pct != null ? `${standing.pct}%` : '-'}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
