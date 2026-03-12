import React from 'react';
import type { PlayerStat, TeamStat } from '../../services/api';
import { Link } from 'react-router-dom';

interface StatsTableProps {
    type: 'players' | 'teams';
    playerStats?: PlayerStat[];
    teamStats?: TeamStat[];
}

export const StatsTable: React.FC<StatsTableProps> = ({ type, playerStats = [], teamStats = [] }) => {
    const isPlayer = type === 'players';
    const data = isPlayer ? playerStats : teamStats;

    if (data.length === 0) {
        return <div className="text-center p-8 text-gray-500 dark:text-gray-400">No stats available for the selected filters.</div>;
    }

    return (
        <div className="overflow-hidden rounded-lg md:rounded-xl shadow-lg bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700">
            <div className="px-3 py-2.5 md:px-6 md:py-4 bg-sffl-navy text-white font-bold text-sm md:text-lg">
                {isPlayer ? 'Player Statistics' : 'Team Statistics'}
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-xs md:text-sm text-center border-collapse">
                    <thead className="text-[10px] md:text-xs uppercase bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">
                        <tr>
                            <th className="px-2 py-4 md:px-4 text-center w-8 md:w-12 border-r border-gray-100 dark:border-gray-700">#</th>
                            <th className="px-2 py-4 md:px-4 text-left whitespace-nowrap min-w-[150px] border-r border-gray-100 dark:border-gray-700">{isPlayer ? 'Player' : 'Team'}</th>
                            {isPlayer && <th className="px-2 py-4 md:px-4 text-left whitespace-nowrap border-r border-gray-100 dark:border-gray-700">Team</th>}

                            {/* Vertical Headers for Stats */}
                            {isPlayer && (
                                <th className="p-0 border-r border-gray-100 dark:border-gray-700">
                                    <div className="[writing-mode:vertical-rl] rotate-180 py-4 px-2 whitespace-nowrap mx-auto" title="Appearances (Games Played)">APPS</div>
                                </th>
                            )}
                            <th className="p-0 border-r border-gray-100 dark:border-gray-700 bg-blue-50/30 dark:bg-blue-900/10">
                                <div className="[writing-mode:vertical-rl] rotate-180 py-4 px-2 whitespace-nowrap mx-auto" title="Pass Attempts">P-ATT</div>
                            </th>
                            <th className="p-0 border-r border-gray-100 dark:border-gray-700 bg-blue-50/30 dark:bg-blue-900/10">
                                <div className="[writing-mode:vertical-rl] rotate-180 py-4 px-2 whitespace-nowrap mx-auto" title="Pass Completions">P-COM</div>
                            </th>
                            <th className="p-0 border-r border-gray-100 dark:border-gray-700 bg-blue-50/30 dark:bg-blue-900/10">
                                <div className="[writing-mode:vertical-rl] rotate-180 py-4 px-2 whitespace-nowrap mx-auto" title="Passing Touchdowns">P-TD</div>
                            </th>
                            <th className="p-0 border-r border-gray-100 dark:border-gray-700 bg-blue-50/30 dark:bg-blue-900/10">
                                <div className="[writing-mode:vertical-rl] rotate-180 py-4 px-2 whitespace-nowrap mx-auto" title="Interceptions Thrown">P-INT</div>
                            </th>
                            <th className="p-0 border-r border-gray-100 dark:border-gray-700 bg-blue-50/30 dark:bg-blue-900/10">
                                <div className="[writing-mode:vertical-rl] rotate-180 py-4 px-2 whitespace-nowrap mx-auto" title="QB Sacks Accounted (QB fault)">QBS</div>
                            </th>
                            <th className="p-0 border-r border-gray-100 dark:border-gray-700 bg-green-50/30 dark:bg-green-900/10">
                                <div className="[writing-mode:vertical-rl] rotate-180 py-4 px-2 whitespace-nowrap mx-auto" title="Rushing Attempts">R-ATT</div>
                            </th>
                            <th className="p-0 border-r border-gray-100 dark:border-gray-700 bg-green-50/30 dark:bg-green-900/10">
                                <div className="[writing-mode:vertical-rl] rotate-180 py-4 px-2 whitespace-nowrap mx-auto" title="Rushing Touchdowns">R-TD</div>
                            </th>
                            <th className="p-0 border-r border-gray-100 dark:border-gray-700 bg-yellow-50/30 dark:bg-yellow-900/10">
                                <div className="[writing-mode:vertical-rl] rotate-180 py-4 px-2 whitespace-nowrap mx-auto" title="Receptions">REC</div>
                            </th>
                            <th className="p-0 border-r border-gray-100 dark:border-gray-700 bg-yellow-50/30 dark:bg-yellow-900/10">
                                <div className="[writing-mode:vertical-rl] rotate-180 py-4 px-2 whitespace-nowrap mx-auto" title="Receiving Touchdowns">RC-TD</div>
                            </th>
                            <th className="p-0 border-r border-gray-100 dark:border-gray-700 bg-yellow-50/30 dark:bg-yellow-900/10">
                                <div className="[writing-mode:vertical-rl] rotate-180 py-4 px-2 whitespace-nowrap mx-auto" title="Drops">DROP</div>
                            </th>
                            <th className="p-0 border-r border-gray-100 dark:border-gray-700 bg-purple-50/30 dark:bg-purple-900/10">
                                <div className="[writing-mode:vertical-rl] rotate-180 py-4 px-2 whitespace-nowrap mx-auto" title="Extra Point Touchdowns">XPT</div>
                            </th>
                            <th className="p-0 border-r border-gray-100 dark:border-gray-700 bg-red-50/30 dark:bg-red-900/10">
                                <div className="[writing-mode:vertical-rl] rotate-180 py-4 px-2 whitespace-nowrap mx-auto" title="Flag Pulls (Tackles)">TKL</div>
                            </th>
                            <th className="p-0 border-r border-gray-100 dark:border-gray-700 bg-red-50/30 dark:bg-red-900/10">
                                <div className="[writing-mode:vertical-rl] rotate-180 py-4 px-2 whitespace-nowrap mx-auto" title="Pass Deflections">P-DEF</div>
                            </th>
                            <th className="p-0 border-r border-gray-100 dark:border-gray-700 bg-red-50/30 dark:bg-red-900/10">
                                <div className="[writing-mode:vertical-rl] rotate-180 py-4 px-2 whitespace-nowrap mx-auto" title="Interceptions Caught">INT</div>
                            </th>
                            <th className="p-0 border-r border-gray-100 dark:border-gray-700 bg-red-50/30 dark:bg-red-900/10">
                                <div className="[writing-mode:vertical-rl] rotate-180 py-4 px-2 whitespace-nowrap mx-auto" title="Defensive Sacks (Def fault)">DEF-S</div>
                            </th>
                            <th className="p-0 border-r border-gray-100 dark:border-gray-700 bg-red-50/30 dark:bg-red-900/10">
                                <div className="[writing-mode:vertical-rl] rotate-180 py-4 px-2 whitespace-nowrap mx-auto" title="Defensive Touchdowns">D-TD</div>
                            </th>
                            <th className="p-0 bg-red-50/30 dark:bg-red-900/10">
                                <div className="[writing-mode:vertical-rl] rotate-180 py-4 px-2 whitespace-nowrap mx-auto" title="Safeties">SFTY</div>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((row: any, index: number) => {
                            return (
                                <tr
                                    key={isPlayer ? row.player_id : row.team_id}
                                    className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-center"
                                >
                                    <td className="px-2 py-2 md:px-4 md:py-4 text-center font-bold text-gray-400 dark:text-gray-500 border-r border-gray-50 dark:border-gray-800">
                                        {index + 1}
                                    </td>
                                    <td className="px-2 py-2 md:px-4 md:py-4 font-bold text-sffl-navy dark:text-white whitespace-nowrap text-left border-r border-gray-50 dark:border-gray-800">
                                        {isPlayer ? (
                                            <Link to={`/players/${row.player_id}`} className="flex items-center space-x-2 md:space-x-3 hover:text-sffl-red transition-colors">
                                                {row.player_image ? (
                                                    <img src={row.player_image} alt={row.player_name} className="w-6 h-6 md:w-8 md:h-8 rounded-full object-cover shadow-sm border border-gray-100 dark:border-gray-700" />
                                                ) : (
                                                    <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-[10px] md:text-xs">
                                                        #{row.player_jersey_number}
                                                    </div>
                                                )}
                                                <div className="flex flex-col">
                                                    <span className="leading-tight text-xs md:text-sm uppercase tracking-tight">{row.player_name}</span>
                                                    <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">{row.player_position}</span>
                                                </div>
                                            </Link>
                                        ) : (
                                            <div className="flex items-center space-x-2 md:space-x-3">
                                                <img src={row.team_logo || 'https://via.placeholder.com/30'} alt={row.team_name} className="w-6 h-6 md:w-8 md:h-8 object-contain shadow-sm" />
                                                <span className="uppercase text-xs md:text-sm tracking-tight">{row.team_name}</span>
                                            </div>
                                        )}
                                    </td>
                                    {isPlayer && (
                                        <td className="px-2 py-2 md:px-4 md:py-4 text-[10px] md:text-xs font-bold text-gray-600 dark:text-gray-400 whitespace-nowrap text-left border-r border-gray-50 dark:border-gray-800">
                                            <div className="flex items-center space-x-2 group">
                                                <img src={row.team_logo || 'https://via.placeholder.com/20'} className="w-4 h-4 md:w-5 md:h-5 object-contain opacity-70 group-hover:opacity-100 transition-opacity" alt="" />
                                                <span className="uppercase tracking-tight leading-none">{row.team_short_name || row.team_name}</span>
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
