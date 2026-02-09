import { Link } from 'react-router-dom';
import { mockPlayers } from '../../services/playerData';

export const PlayersPage = () => {
    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="text-center">
                <h1 className="text-4xl md:text-5xl font-black text-sffl-navy dark:text-white mb-4">PLAYER PROFILES</h1>
                <p className="text-gray-600 dark:text-gray-300 text-lg">Meet the stars of SFFL</p>
            </div>

            {/* Players Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {mockPlayers.map(player => (
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
                                    #{player.jerseyNumber}
                                </div>
                            )}
                            <div className="absolute top-4 right-4 bg-sffl-red text-white font-black px-4 py-2 rounded-full shadow-lg">
                                #{player.jerseyNumber}
                            </div>
                        </div>

                        {/* Player Info */}
                        <div className="p-6">
                            <h3 className="text-2xl font-black text-sffl-navy dark:text-white mb-1">{player.name}</h3>
                            <div className="text-sffl-red font-bold mb-3">{player.position} - {player.team}</div>

                            {/* Stats */}
                            <div className="grid grid-cols-2 gap-2 text-sm">
                                <div className="bg-gray-100 dark:bg-gray-700 p-2 rounded">
                                    <div className="text-gray-500 dark:text-gray-400 text-xs">TDs</div>
                                    <div className="font-black text-sffl-navy dark:text-white">{player.stats.touchdowns}</div>
                                </div>
                                <div className="bg-gray-100 dark:bg-gray-700 p-2 rounded">
                                    <div className="text-gray-500 dark:text-gray-400 text-xs">Yards</div>
                                    <div className="font-black text-sffl-navy dark:text-white">{player.stats.yards}</div>
                                </div>
                            </div>

                            <div className="mt-4 text-sffl-red font-semibold text-sm group-hover:underline">
                                View Profile →
                            </div>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
};
