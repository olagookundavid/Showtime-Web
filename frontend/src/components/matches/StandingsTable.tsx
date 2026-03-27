import React from 'react';
import type { Standing } from '../../services/api';
import { LightboxImage } from '../ui';

interface StandingsTableProps {
    standings: Standing[];
}

const L5Badge: React.FC<{ result: string }> = ({ result }) => {
    const colors: Record<string, string> = {
        'W': 'bg-green-500 text-white',
        'D': 'bg-yellow-400 text-gray-900',
        'L': 'bg-red-500 text-white',
    };
    return (
        <span className={`inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-black ${colors[result] || 'bg-gray-300 text-gray-600'}`}>
            {result}
        </span>
    );
};

export const StandingsTable: React.FC<StandingsTableProps> = ({ standings }) => {
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
                            <th className="px-1 py-2 md:px-4 md:py-3 whitespace-nowrap">Team</th>
                            <th className="px-1 py-2 md:px-4 md:py-3 text-center whitespace-nowrap">P</th>
                            <th className="px-1 py-2 md:px-4 md:py-3 text-center whitespace-nowrap">W</th>
                            <th className="px-1 py-2 md:px-4 md:py-3 text-center whitespace-nowrap">D</th>
                            <th className="px-1 py-2 md:px-4 md:py-3 text-center whitespace-nowrap">L</th>
                            <th className="px-1 py-2 md:px-4 md:py-3 text-center whitespace-nowrap">PF</th>
                            <th className="px-1 py-2 md:px-4 md:py-3 text-center whitespace-nowrap">PA</th>
                            <th className="px-1 py-2 md:px-4 md:py-3 text-center whitespace-nowrap">PD</th>
                            <th className="px-1 py-2 md:px-4 md:py-3 text-center whitespace-nowrap">PCT</th>
                            <th className="px-1 py-2 md:px-4 md:py-3 text-center">L5</th>
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
                                <td className="px-1 py-2 md:px-4 md:py-4 font-semibold text-sffl-navy dark:text-white flex items-center space-x-1 md:space-x-3 whitespace-nowrap text-left">
                                    <LightboxImage 
                                        src={standing.team?.logo || 'https://via.placeholder.com/30'} 
                                        alt={standing.team?.name || 'Team'} 
                                        thumbnailClassName="w-5 h-5 md:w-8 md:h-8 object-contain rounded-md" 
                                    />
                                    <span className="truncate max-w-[60px] md:max-w-none">{standing.team?.short_name || standing.team?.name || 'Unknown'}</span>
                                </td>
                                <td className="px-1 py-2 md:px-4 md:py-4 text-center text-gray-700 dark:text-gray-200">{standing.played}</td>
                                <td className="px-1 py-2 md:px-4 md:py-4 text-center text-gray-700 dark:text-gray-200">{standing.won}</td>
                                <td className="px-1 py-2 md:px-4 md:py-4 text-center text-gray-700 dark:text-gray-200">{standing.drawn}</td>
                                <td className="px-1 py-2 md:px-4 md:py-4 text-center text-gray-700 dark:text-gray-200">{standing.lost}</td>
                                <td className="px-1 py-2 md:px-4 md:py-4 text-center text-gray-700 dark:text-gray-200">{standing.goals_for}</td>
                                <td className="px-1 py-2 md:px-4 md:py-4 text-center text-gray-700 dark:text-gray-200">{standing.goals_against}</td>
                                <td className="px-1 py-2 md:px-4 md:py-4 text-center font-bold text-gray-800 dark:text-gray-100">
                                    {standing.goal_diff > 0 ? `+${standing.goal_diff}` : standing.goal_diff}
                                </td>
                                <td className="px-1 py-2 md:px-4 md:py-4 text-center font-semibold text-gray-800 dark:text-gray-100">
                                    {standing.pct != null ? `${standing.pct}%` : '-'}
                                </td>
                                <td className="px-1 py-2 md:px-4 md:py-4 text-center">
                                    {standing.l5 ? (
                                        <div className="flex gap-0.5 justify-center">
                                            {standing.l5.split('-').map((r, i) => (
                                                <L5Badge key={i} result={r} />
                                            ))}
                                        </div>
                                    ) : (
                                        <span className="text-gray-400 dark:text-gray-500">-</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
