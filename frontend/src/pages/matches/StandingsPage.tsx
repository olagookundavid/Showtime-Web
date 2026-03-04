import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getCompetitions, getStandings } from '../../services/api';
import { Loader } from '../../components/ui/Loader';
import { StandingsTable } from '../../components/matches/StandingsTable';

export const StandingsPage = () => {
    const [selectedCompetitionId, setSelectedCompetitionId] = useState<string>('');

    const { data: competitionsData, isLoading: compLoading } = useQuery({
        queryKey: ['publicCompetitions'],
        queryFn: () => getCompetitions(1, 100),
    });
    const competitions = competitionsData?.data || [];

    useEffect(() => {
        if (competitions.length > 0 && !selectedCompetitionId) {
            setSelectedCompetitionId(competitions[0].id);
        }
    }, [competitions, selectedCompetitionId]);

    const { data: standingsData, isLoading: dataLoading } = useQuery({
        queryKey: ['publicStandings', selectedCompetitionId],
        queryFn: () => getStandings(selectedCompetitionId),
        enabled: !!selectedCompetitionId,
    });
    const standings = standingsData || [];

    const loading = compLoading;

    if (loading && competitions.length === 0) return <Loader />;

    // Find selected competition name
    const selectedCompetition = competitions.find(c => c.id === selectedCompetitionId);

    return (
        <div className="max-w-5xl mx-auto space-y-10 min-h-screen p-4">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-center bg-sffl-navy text-white p-8 rounded-2xl shadow-xl">
                <div>
                    <h1 className="text-4xl md:text-5xl font-black italic tracking-tighter">STANDINGS</h1>
                    <p className="text-gray-300 mt-2 text-lg">League tables & team rankings</p>
                </div>

                {/* Competition Selector */}
                {competitions.length > 0 && (
                    <div className="mt-4 md:mt-0">
                        <label className="block text-xs uppercase text-gray-400 font-bold mb-1 tracking-wider">Competition</label>
                        <div className="relative">
                            <select
                                value={selectedCompetitionId}
                                onChange={(e) => setSelectedCompetitionId(e.target.value)}
                                className="appearance-none bg-white/10 border border-white/20 text-white py-3 px-6 pr-12 rounded-xl focus:outline-none focus:ring-2 focus:ring-sffl-red font-bold text-lg min-w-[260px] cursor-pointer hover:bg-white/20 transition-colors"
                            >
                                {competitions.map((c) => (
                                    <option key={c.id} value={c.id} className="text-black bg-white">
                                        {c.name}
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
                    <span className="font-semibold">Loading standings...</span>
                </div>
            )}

            {/* Standings Table */}
            {!dataLoading && standings.length > 0 ? (
                <div className="space-y-6">
                    <div className="flex items-center gap-3">
                        <span className="text-yellow-500 text-2xl">🏆</span>
                        <h2 className="text-2xl font-bold text-sffl-navy dark:text-white">
                            {selectedCompetition?.name || 'League'} Table
                        </h2>
                    </div>

                    {/* Abbreviation Legend — above the table for context */}
                    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-600 px-6 py-4 shadow-sm">
                        <div className="flex flex-wrap items-center gap-3">
                            <svg className="w-5 h-5 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            {[
                                { abbr: 'P', full: 'Played', color: 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-100' },
                                { abbr: 'W', full: 'Win', color: 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100' },
                                { abbr: 'D', full: 'Draw', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-700 dark:text-yellow-100' },
                                { abbr: 'L', full: 'Loss', color: 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100' },
                                { abbr: 'PF', full: 'Points For', color: 'bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100' },
                                { abbr: 'PA', full: 'Points Against', color: 'bg-orange-100 text-orange-800 dark:bg-orange-800 dark:text-orange-100' },
                                { abbr: 'PD', full: 'Points Diff', color: 'bg-purple-100 text-purple-800 dark:bg-purple-800 dark:text-purple-100' },
                                { abbr: 'PCT', full: 'Win %', color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-800 dark:text-indigo-100' },
                                { abbr: 'L5', full: 'Last 5', color: 'bg-teal-100 text-teal-800 dark:bg-teal-800 dark:text-teal-100' },
                            ].map(item => (
                                <div key={item.abbr} className="flex items-center gap-1.5">
                                    <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-md text-xs font-black ${item.color}`}>
                                        {item.abbr}
                                    </span>
                                    <span className="text-xs text-gray-600 dark:text-gray-300">{item.full}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <StandingsTable standings={standings} />
                </div>
            ) : !dataLoading ? (
                <div className="bg-gray-100 dark:bg-gray-800 p-16 rounded-xl text-center">
                    <div className="text-5xl mb-4">🏆</div>
                    <p className="text-gray-500 text-lg font-semibold">No standings available for this competition yet.</p>
                    <p className="text-gray-400 mt-2">Check back once matches have been played.</p>
                </div>
            ) : null}
        </div>
    );
};
