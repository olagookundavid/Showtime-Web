import { useParams, Link } from 'react-router-dom';
import { mockPlayers } from '../../services/playerData';

export const PlayerDetail = () => {
    const { id } = useParams<{ id: string }>();
    const player = mockPlayers.find(p => p.id === id);

    if (!player) {
        return (
            <div className="text-center py-20">
                <h1 className="text-4xl font-black text-sffl-navy dark:text-white mb-4">Player Not Found</h1>
                <Link to="/players" className="text-sffl-red hover:underline">Back to Players</Link>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Back Button */}
            <Link to="/players" className="inline-flex items-center text-sffl-red hover:underline font-semibold">
                ← Back to Players
            </Link>

            {/* Player Header */}
            <div className="bg-gradient-to-r from-sffl-navy to-sffl-red rounded-2xl overflow-hidden">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-8">
                    {/* Player Image */}
                    <div className="relative">
                        {player.image ? (
                            <img
                                src={player.image}
                                alt={player.name}
                                className="w-full h-96 object-cover rounded-xl shadow-2xl"
                            />
                        ) : (
                            <div className="w-full h-96 bg-gray-200 dark:bg-gray-700 rounded-xl flex items-center justify-center">
                                <div className="text-9xl font-black text-gray-400">#{player.jerseyNumber}</div>
                            </div>
                        )}
                        <div className="absolute top-4 right-4 bg-white text-sffl-navy font-black px-6 py-3 rounded-full shadow-lg text-2xl">
                            #{player.jerseyNumber}
                        </div>
                    </div>

                    {/* Player Info */}
                    <div className="text-white flex flex-col justify-center">
                        <h1 className="text-5xl md:text-6xl font-black mb-4">{player.name}</h1>
                        <div className="text-2xl font-bold mb-2">{player.position}</div>
                        <div className="text-xl mb-6">{player.team}</div>
                        {player.bio && (
                            <p className="text-lg text-gray-200">{player.bio}</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Stats Section */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
                <h2 className="text-3xl font-black text-sffl-navy dark:text-white mb-6">Season Stats</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <div className="text-center p-6 bg-gray-100 dark:bg-gray-700 rounded-xl">
                        <div className="text-4xl font-black text-sffl-red mb-2">{player.stats.touchdowns}</div>
                        <div className="text-gray-600 dark:text-gray-300 font-bold">Touchdowns</div>
                    </div>
                    <div className="text-center p-6 bg-gray-100 dark:bg-gray-700 rounded-xl">
                        <div className="text-4xl font-black text-sffl-navy dark:text-white mb-2">{player.stats.yards}</div>
                        <div className="text-gray-600 dark:text-gray-300 font-bold">Total Yards</div>
                    </div>
                    {player.stats.interceptions !== undefined && (
                        <div className="text-center p-6 bg-gray-100 dark:bg-gray-700 rounded-xl">
                            <div className="text-4xl font-black text-sffl-red mb-2">{player.stats.interceptions}</div>
                            <div className="text-gray-600 dark:text-gray-300 font-bold">Interceptions</div>
                        </div>
                    )}
                    {player.stats.tackles !== undefined && (
                        <div className="text-center p-6 bg-gray-100 dark:bg-gray-700 rounded-xl">
                            <div className="text-4xl font-black text-sffl-navy dark:text-white mb-2">{player.stats.tackles}</div>
                            <div className="text-gray-600 dark:text-gray-300 font-bold">Tackles</div>
                        </div>
                    )}
                </div>
            </div>

            {/* Career Highlights */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
                <h2 className="text-3xl font-black text-sffl-navy dark:text-white mb-4">Career Highlights</h2>
                <ul className="space-y-2 text-gray-700 dark:text-gray-300">
                    <li className="flex items-center gap-2">
                        <span className="text-sffl-red font-bold">•</span>
                        Week 5 Player of the Week
                    </li>
                    <li className="flex items-center gap-2">
                        <span className="text-sffl-red font-bold">•</span>
                        2025 Season MVP Candidate
                    </li>
                    <li className="flex items-center gap-2">
                        <span className="text-sffl-red font-bold">•</span>
                        Team Captain
                    </li>
                </ul>
            </div>
        </div>
    );
};
