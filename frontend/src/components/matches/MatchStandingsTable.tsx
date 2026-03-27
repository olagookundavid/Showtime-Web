import React from 'react';
import type { Standing } from '../../services/api';
import { LightboxImage } from '../ui';

interface MatchStandingsTableProps {
    standings: Standing[];
}

export const MatchStandingsTable: React.FC<MatchStandingsTableProps> = ({ standings }) => {
    if (standings.length === 0) {
        return <div className="text-center p-8 text-gray-500 dark:text-gray-400">No standings available yet.</div>;
    }

    return (
        <div className="overflow-hidden rounded-lg md:rounded-xl shadow-lg bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700">
            <div className="px-3 py-2.5 md:px-6 md:py-4 bg-sffl-navy text-white font-bold text-sm md:text-lg">
                Team Standings
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-xs md:text-sm text-left">
                    <thead className="text-[10px] md:text-xs uppercase bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">
                        <tr>
                            <th className="px-1 py-2 md:px-4 md:py-3 text-center w-8 md:w-12">Pos</th>
                            <th className="px-1 py-2 md:px-4 md:py-3 text-center whitespace-nowrap">Team</th>
                            <th className="px-1 py-2 md:px-4 md:py-3 text-center whitespace-nowrap">P</th>
                            <th className="px-1 py-2 md:px-4 md:py-3 text-center whitespace-nowrap">PD</th>
                            <th className="px-1 py-2 md:px-4 md:py-3 text-center whitespace-nowrap">PCT</th>
                        </tr>
                    </thead>
                    <tbody>
                        {standings.map((standing, index) => (
                            <tr
                                key={standing.id}
                                className={`
                                    border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors
                                    ${index < 4 ? 'border-l-4 border-l-green-500' : ''}
                                `}
                            >
                                <td className="px-1 py-2 md:px-4 md:py-4 text-center font-bold text-gray-600 dark:text-gray-300">
                                    {standing.position}
                                </td>
                                <td className="px-1 py-2 md:px-4 md:py-4 font-semibold text-sffl-navy dark:text-white flex justify-center items-center">
                                    <LightboxImage 
                                        src={standing.team?.logo || 'https://via.placeholder.com/30'} 
                                        alt={standing.team?.name || 'Team'} 
                                        thumbnailClassName="w-5 h-5 md:w-8 md:h-8 object-contain rounded-md" 
                                        title={standing.team?.name || 'Team'} 
                                    />
                                </td>
                                <td className="px-1 py-2 md:px-4 md:py-4 text-center text-gray-700 dark:text-gray-200">{standing.played}</td>
                                <td className="px-1 py-2 md:px-4 md:py-4 text-center font-bold text-gray-800 dark:text-gray-100">
                                    {standing.goal_diff > 0 ? `+${standing.goal_diff}` : standing.goal_diff}
                                </td>
                                <td className="px-1 py-2 md:px-4 md:py-4 text-center font-semibold text-gray-800 dark:text-gray-100">
                                    {standing.pct != null ? `${standing.pct}%` : '-'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
