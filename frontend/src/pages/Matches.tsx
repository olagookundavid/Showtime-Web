import { useState } from 'react';
import { MOCK_MATCHES, MOCK_TEAMS } from '../services/mockData';
import MatchCard from '../components/MatchCard';

export default function Matches() {
    const [filter, setFilter] = useState<'all' | 'scheduled' | 'completed'>('all');

    const filteredMatches = MOCK_MATCHES.filter(m => {
        if (filter === 'all') return true;
        return m.status === filter;
    });

    return (
        <div>
            <div className="flex flex-col md:flex-row justify-between items-center mb-8">
                <h1 className="text-3xl font-bold mb-4 md:mb-0">Match Schedule</h1>

                {/* Filters */}
                <div className="bg-gray-800 p-1 rounded-lg flex flex-wrap justify-center gap-1 w-full sm:w-auto mt-4 md:mt-0">
                    {(['all', 'scheduled', 'completed'] as const).map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${filter === f
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'text-gray-400 hover:text-white hover:bg-gray-700'
                                }`}
                        >
                            {f.charAt(0).toUpperCase() + f.slice(1)}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
                {filteredMatches.map(match => (
                    <MatchCard
                        key={match.id}
                        match={match}
                        homeTeam={MOCK_TEAMS[match.homeTeamId]}
                        awayTeam={MOCK_TEAMS[match.awayTeamId]}
                    />
                ))}
            </div>

            {filteredMatches.length === 0 && (
                <div className="bg-gray-100 dark:bg-gray-800 p-12 rounded-xl text-center">
                    <div className="text-4xl mb-3">🏈</div>
                    <p className="text-gray-500 text-lg font-semibold">No matches found for this filter.</p>
                </div>
            )}
        </div>
    );
}
