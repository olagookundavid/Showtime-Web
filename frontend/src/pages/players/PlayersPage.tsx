import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getPlayers, getTeams } from '../../services/api';
import { Loader } from '../../components/ui/Loader';

export const PlayersPage = () => {
    const [selectedTeamId, setSelectedTeamId] = useState<string>('');

    const { data: teamsData, isLoading: loadingTeams } = useQuery({
        queryKey: ['publicTeams'],
        queryFn: getTeams,
    });
    const teams = teamsData || [];

    const { data: playersData, isLoading: dataLoading } = useQuery({
        queryKey: ['publicPlayers', selectedTeamId],
        queryFn: () => getPlayers(selectedTeamId || undefined),
    });
    const players = playersData || [];

    const loading = loadingTeams;

    if (loading) return <Loader />;

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-center bg-sffl-navy text-white p-8 rounded-2xl shadow-xl">
                <div>
                    <h1 className="text-4xl md:text-5xl font-black italic tracking-tighter">PLAYER PROFILES</h1>
                    <p className="text-gray-300 mt-2 text-lg">Meet the stars of SFFL</p>
                </div>

                {/* Team Filter */}
                {teams.length > 0 && (
                    <div className="mt-4 md:mt-0">
                        <label className="block text-xs uppercase text-gray-400 font-bold mb-1 tracking-wider">Filter by Team</label>
                        <div className="relative">
                            <select
                                value={selectedTeamId}
                                onChange={(e) => setSelectedTeamId(e.target.value)}
                                className="appearance-none bg-white/10 border border-white/20 text-white py-3 px-6 pr-12 rounded-xl focus:outline-none focus:ring-2 focus:ring-sffl-red font-bold text-lg min-w-[260px] cursor-pointer hover:bg-white/20 transition-colors"
                            >
                                <option value="" className="text-black bg-white">All Teams</option>
                                {teams.map((t) => (
                                    <option key={t.id} value={t.id} className="text-black bg-white">
                                        {t.name}
                                    </option>
                                ))}
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4 text-white">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

            {/* Players Grid */}
            {!dataLoading && players.length === 0 ? (
                <div className="bg-gray-100 dark:bg-gray-800 p-16 rounded-xl text-center">
                    <div className="text-5xl mb-4">🏈</div>
                    <p className="text-gray-500 text-lg font-semibold">No players found.</p>
                    <p className="text-gray-400 mt-2">Try selecting a different team.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {players.map(player => (
                        <Link
                            key={player.id}
                            to={`/players/${player.id}`}
                            className="bg-white dark:bg-gray-800 rounded-xl shadow-md hover:shadow-xl transition overflow-hidden group"
                        >
                            {/* Player Image */}
                            <div className="relative h-64 overflow-hidden bg-gradient-to-br from-sffl-navy to-sffl-red">
                                {player.image ? (
                                    <img
                                        src={player.image}
                                        alt={player.name}
                                        className="w-full h-full object-cover opacity-80 group-hover:scale-110 transition-transform duration-300"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-white text-6xl font-black opacity-50">
                                        #{player.jersey_number}
                                    </div>
                                )}
                                <div className="absolute top-4 right-4 bg-sffl-red text-white font-black px-4 py-2 rounded-full shadow-lg">
                                    #{player.jersey_number}
                                </div>
                            </div>

                            {/* Player Info */}
                            <div className="p-6">
                                <h3 className="text-2xl font-black text-sffl-navy dark:text-white mb-1">{player.name}</h3>
                                <div className="text-sffl-red font-bold mb-3">{player.position} — {player.team?.name || 'Free Agent'}</div>

                                {/* Stats */}
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                    <div className="bg-gray-100 dark:bg-gray-700 p-2 rounded">
                                        <div className="text-gray-500 dark:text-gray-400 text-xs">TDs</div>
                                        <div className="font-black text-sffl-navy dark:text-white">{player.touchdowns}</div>
                                    </div>
                                    <div className="bg-gray-100 dark:bg-gray-700 p-2 rounded">
                                        <div className="text-gray-500 dark:text-gray-400 text-xs">Yards</div>
                                        <div className="font-black text-sffl-navy dark:text-white">{player.yards}</div>
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
