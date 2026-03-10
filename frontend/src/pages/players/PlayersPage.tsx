import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getPlayers, getTeams } from '../../services/api';
import { Loader } from '../../components/ui/Loader';

export const PlayersPage = () => {
    const [selectedTeamId, setSelectedTeamId] = useState<string>('');

    const { data: teamsData, isLoading: loadingTeams } = useQuery({
        queryKey: ['publicTeams'],
        queryFn: () => getTeams(1, 100),
    });
    const teams: any[] = (teamsData as any)?.data || teamsData || [];

    const { data: playersData, isLoading: dataLoading } = useQuery({
        queryKey: ['publicPlayers', selectedTeamId],
        queryFn: () => getPlayers(selectedTeamId || undefined),
    });
    const players: any[] = (playersData as any)?.data || playersData || [];

    const loading = loadingTeams;

    if (loading) return <Loader />;

    return (
        <div className="space-y-8">
            {/* Header - High Density */}
            <div className="flex flex-col md:flex-row justify-between items-center bg-sffl-navy text-white p-4 md:p-8 rounded-xl md:rounded-2xl shadow-xl">
                <div>
                    <h1 className="text-xl md:text-5xl font-black italic tracking-tighter">PLAYERS</h1>
                    <p className="text-gray-300 mt-1 text-sm md:text-lg">Meet the stars</p>
                </div>

                {/* Team Filter - Condensed */}
                {teams.length > 0 && (
                    <div className="mt-3 md:mt-0 w-full md:w-auto">
                        <label className="block text-[10px] uppercase text-gray-400 font-bold mb-1 tracking-wider">Filter by Team</label>
                        <div className="relative">
                            <select
                                value={selectedTeamId}
                                onChange={(e) => setSelectedTeamId(e.target.value)}
                                className="appearance-none bg-white/10 border border-white/20 text-white py-2 px-4 pr-10 rounded-lg focus:outline-none focus:ring-1 focus:ring-sffl-red font-bold text-sm min-w-full md:min-w-[260px] cursor-pointer hover:bg-white/20 transition-colors"
                            >
                                <option value="" className="text-black bg-white">All Teams</option>
                                {teams.map((t: any) => (
                                    <option key={t.id} value={t.id} className="text-black bg-white">
                                        {t.name}
                                    </option>
                                ))}
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-white">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Loading Indicator */}
            {dataLoading && (
                <div className="flex justify-center items-center gap-2 text-gray-500">
                    <div className="w-5 h-5 border-2 border-sffl-red border-t-transparent rounded-full animate-spin"></div>
                    <span className="font-semibold">Loading players...</span>
                </div>
            )}

            {/* Players Grid - 2 Column Mobile Stack */}
            {!dataLoading && players.length === 0 ? (
                <div className="bg-gray-100 dark:bg-gray-800 p-8 md:p-16 rounded-xl text-center">
                    <div className="text-3xl md:text-5xl mb-4">🏈</div>
                    <p className="text-gray-500 text-base md:text-lg font-semibold">No players found.</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 md:gap-6">
                    {players.map((player: any) => (
                        <Link
                            key={player.id}
                            to={`/players/${player.id}`}
                            className="bg-white dark:bg-gray-800 rounded-lg md:rounded-xl shadow-sm hover:shadow-xl transition overflow-hidden group border border-gray-100 dark:border-gray-700"
                        >
                            {/* Player Image - Condensed */}
                            <div className="relative h-32 md:h-64 overflow-hidden bg-gradient-to-br from-sffl-navy to-sffl-red">
                                {player.image ? (
                                    <img
                                        src={player.image}
                                        alt={player.name}
                                        className="w-full h-full object-cover opacity-80 group-hover:scale-110 transition-transform duration-300"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-white text-3xl md:text-6xl font-black opacity-40">
                                        #{player.jersey_number}
                                    </div>
                                )}
                                <div className="absolute top-2 right-2 md:top-4 md:right-4 bg-sffl-red text-white font-black text-[10px] md:text-base px-2 py-0.5 md:px-4 md:py-2 rounded-full shadow-lg">
                                    #{player.jersey_number}
                                </div>
                            </div>

                            {/* Player Info - High Density */}
                            <div className="p-2 md:p-6">
                                <h3 className="text-xs md:text-2xl font-black text-sffl-navy dark:text-white truncate">{player.name}</h3>
                                <div className="text-[10px] md:text-sm text-sffl-red font-bold truncate mb-1 md:mb-3">
                                    {player.position}
                                </div>

                                {/* Stats - Compact Grid */}
                                <div className="grid grid-cols-2 gap-1 md:gap-2">
                                    <div className="bg-gray-50 dark:bg-gray-700/50 p-1 md:p-2 rounded text-center">
                                        <div className="text-gray-500 dark:text-gray-400 text-[8px] md:text-xs">TDs</div>
                                        <div className="font-black text-[10px] md:text-base text-sffl-navy dark:text-white">{player.touchdowns || 0}</div>
                                    </div>
                                    <div className="bg-gray-50 dark:bg-gray-700/50 p-1 md:p-2 rounded text-center">
                                        <div className="text-gray-500 dark:text-gray-400 text-[8px] md:text-xs">YDS</div>
                                        <div className="font-black text-[10px] md:text-base text-sffl-navy dark:text-white">{player.yards || 0}</div>
                                    </div>
                                </div>

                                <div className="mt-4 text-sffl-red font-semibold text-sm group-hover:underline">
                                    View Profile →
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
};
