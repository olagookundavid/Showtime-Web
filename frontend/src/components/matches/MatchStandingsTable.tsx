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
                            <th className="px-1 py-2 md:px-4 md:py-3 text-center w-8 md:w-12"></th>
                            <th className="px-1 py-2 md:px-4 md:py-3 whitespace-nowrap">Team</th>
                            <th className="px-1 py-2 md:px-4 md:py-3 text-center whitespace-nowrap">P</th>
                            <th className="px-1 py-2 md:px-4 md:py-3 text-center whitespace-nowrap">PD</th>
                            <th className="px-1 py-2 md:px-4 md:py-3 text-center whitespace-nowrap">PCT</th>
                        </tr>
                    </thead>
                    <tbody>
                        {standings.map((standing, index) => {
                            const isGold = isCompleted && index === 0;
                            const isSilver = isCompleted && index === 1;
                            const logoImg = (
                                <img
                                    src={standing.team?.logo || 'https://via.placeholder.com/30'}
                                    alt={standing.team?.name || 'Team'}
                                    className="w-5 h-5 md:w-8 md:h-8 object-contain rounded-md mx-auto"
                                    title={standing.team?.name || 'Team'}
                                />
                            );
                            const nameText = standing.team?.short_name || standing.team?.name || 'Unknown';

                            return (
                                <tr
                                    key={standing.id}
                                    className={`
                                        border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors
                                        ${isGold ? 'bg-amber-500/10 hover:bg-amber-500/20 dark:bg-amber-500/5 dark:hover:bg-amber-500/10 border-l-4 border-l-amber-500' :
                                          isSilver ? 'bg-slate-300/20 hover:bg-slate-300/30 dark:bg-slate-300/10 dark:hover:bg-slate-300/20 border-l-4 border-l-slate-400' :
                                          index < 4 ? 'border-l-4 border-l-green-500' : ''}
                                    `}
                                >
                                    <td className="px-1 py-2 md:px-4 md:py-4 text-center">
                                        {standing.team?.id ? (
                                            <Link to={`/teams/${standing.team.id}`} className="block hover:opacity-80 transition-opacity">
                                                {logoImg}
                                            </Link>
                                        ) : logoImg}
                                    </td>
                                    <td className="px-1 py-2 md:px-4 md:py-4 font-semibold text-sffl-navy dark:text-white whitespace-nowrap">
                                        {standing.team?.id ? (
                                            <Link
                                                to={`/teams/${standing.team.id}`}
                                                className="inline-flex items-center gap-1 uppercase hover:text-sffl-red transition-colors"
                                            >
                                                {nameText}
                                                {isGold && <span title="Champion">👑</span>}
                                                {isSilver && <span title="Runner Up">🥈</span>}
                                            </Link>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 uppercase">
                                                {nameText}
                                                {isGold && <span title="Champion">👑</span>}
                                                {isSilver && <span title="Runner Up">🥈</span>}
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
