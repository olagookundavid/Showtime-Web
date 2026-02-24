import React from 'react';
import type { Standing } from '../../services/api';

interface StandingsTableProps {
    standings: Standing[];
}

export const StandingsTable: React.FC<StandingsTableProps> = ({ standings }) => {
    if (standings.length === 0) {
        return <div className="text-center p-8 text-gray-500">No standings available yet.</div>;
    }

    return (
        <div className="overflow-hidden rounded-xl shadow-lg bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
            <div className="px-6 py-4 bg-sffl-navy text-white font-bold text-lg border-b border-gray-700">
                Team Standings
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-gray-500 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-600">
                        <tr>
                            <th className="px-4 py-3 text-center w-12">Pos</th>
                            <th className="px-4 py-3">Team</th>
                            <th className="px-4 py-3 text-center">P</th>
                            <th className="px-4 py-3 text-center">W</th>
                            <th className="px-4 py-3 text-center">D</th>
                            <th className="px-4 py-3 text-center">L</th>
                            <th className="px-4 py-3 text-center hidden md:table-cell">GF</th>
                            <th className="px-4 py-3 text-center hidden md:table-cell">GA</th>
                            <th className="px-4 py-3 text-center">GD</th>
                            <th className="px-4 py-3 text-center font-black text-base">Pts</th>
                        </tr>
                    </thead>
                    <tbody>
                        {standings.map((standing, index) => (
                            <tr
                                key={standing.id}
                                className={`
                                    border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors
                                    ${index < 4 ? 'border-l-4 border-l-green-500' : ''} /* Champions League spots? */
                                `}
                            >
                                <td className="px-4 py-4 text-center font-bold text-gray-600 dark:text-gray-400">
                                    {standing.position}
                                </td>
                                <td className="px-4 py-4 font-semibold text-sffl-navy dark:text-white flex items-center space-x-3">
                                    <img src={standing.team?.logo || 'https://via.placeholder.com/30'} alt={standing.team?.name || 'Team'} className="w-8 h-8 object-contain" />
                                    <span>{standing.team?.name || 'Unknown Team'}</span>
                                </td>
                                <td className="px-4 py-4 text-center">{standing.played}</td>
                                <td className="px-4 py-4 text-center">{standing.won}</td>
                                <td className="px-4 py-4 text-center">{standing.drawn}</td>
                                <td className="px-4 py-4 text-center">{standing.lost}</td>
                                <td className="px-4 py-4 text-center hidden md:table-cell">{standing.goals_for}</td>
                                <td className="px-4 py-4 text-center hidden md:table-cell">{standing.goals_against}</td>
                                <td className="px-4 py-4 text-center font-bold text-gray-700 dark:text-gray-300">
                                    {standing.goal_diff > 0 ? `+${standing.goal_diff}` : standing.goal_diff}
                                </td>
                                <td className="px-4 py-4 text-center font-black text-lg text-sffl-navy dark:text-white">
                                    {standing.points}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
