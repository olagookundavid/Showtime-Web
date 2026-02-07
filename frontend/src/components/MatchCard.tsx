import type { Match, Team } from '../types';

interface MatchCardProps {
    match: Match;
    homeTeam: Team;
    awayTeam: Team;
}

export default function MatchCard({ match, homeTeam, awayTeam }: MatchCardProps) {
    const matchDate = new Date(match.date).toLocaleDateString(undefined, {
        weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    return (
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 shadow-lg hover:border-blue-500/50 transition-colors">
            <div className="text-center text-gray-400 text-sm mb-4 uppercase tracking-wider font-semibold">
                {match.status === 'completed' ? 'Final Score' : matchDate}
            </div>

            <div className="flex justify-between items-center">
                {/* Home Team */}
                <div className="flex flex-col items-center flex-1">
                    {homeTeam.logoUrl ? (
                        <img src={homeTeam.logoUrl} alt={homeTeam.name} className="w-16 h-16 rounded-full mb-2 object-cover bg-gray-700" />
                    ) : (
                        <div className="w-16 h-16 rounded-full bg-gray-700 mb-2 flex items-center justify-center text-2xl font-bold">
                            {homeTeam.name[0]}
                        </div>
                    )}
                    <span className="font-bold text-lg text-center">{homeTeam.name}</span>
                </div>

                {/* Score / VS */}
                <div className="px-4 flex flex-col items-center w-24">
                    {match.status === 'completed' ? (
                        <div className="flex items-center gap-2">
                            <span className={`text-3xl font-bold ${match.homeScore! > match.awayScore! ? 'text-white' : 'text-gray-400'}`}>
                                {match.homeScore}
                            </span>
                            <span className="text-gray-600">-</span>
                            <span className={`text-3xl font-bold ${match.awayScore! > match.homeScore! ? 'text-white' : 'text-gray-400'}`}>
                                {match.awayScore}
                            </span>
                        </div>
                    ) : (
                        <span className="text-2xl font-bold text-gray-500 font-mono">VS</span>
                    )}
                </div>

                {/* Away Team */}
                <div className="flex flex-col items-center flex-1">
                    {awayTeam.logoUrl ? (
                        <img src={awayTeam.logoUrl} alt={awayTeam.name} className="w-16 h-16 rounded-full mb-2 object-cover bg-gray-700" />
                    ) : (
                        <div className="w-16 h-16 rounded-full bg-gray-700 mb-2 flex items-center justify-center text-2xl font-bold">
                            {awayTeam.name[0]}
                        </div>
                    )}
                    <span className="font-bold text-lg text-center">{awayTeam.name}</span>
                </div>
            </div>

            <div className="mt-4 text-center">
                <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-gray-700 text-gray-300">
                    {match.venue}
                </span>
            </div>
        </div>
    );
}
