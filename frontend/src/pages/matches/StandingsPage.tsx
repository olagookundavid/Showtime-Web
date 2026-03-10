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
        <div className="max-w-5xl mx-auto space-y-4 md:space-y-10 min-h-screen p-2 md:p-4 pb-20">
            {/* Header - Condensed */}
            <div className="flex flex-col md:flex-row justify-between items-center bg-sffl-navy text-white p-4 md:p-8 rounded-xl md:rounded-2xl shadow-xl">
                <div>
                    <h1 className="text-3xl md:text-5xl font-black italic tracking-tighter">STANDINGS</h1>
                    <p className="text-gray-300 mt-0.5 text-xs md:text-lg">Rankings & Tables</p>
                </div>

                {/* Competition Selector - Mobile Optimized */}
                {competitions.length > 0 && (
                    <div className="mt-3 md:mt-0 w-full md:w-auto">
                        <label className="block text-[10px] uppercase text-gray-400 font-bold mb-1 tracking-wider">Competition</label>
                        <div className="relative">
                            <select
                                value={selectedCompetitionId}
                                onChange={(e) => setSelectedCompetitionId(e.target.value)}
                                className="appearance-none bg-white/10 border border-white/20 text-white py-2 px-4 pr-10 rounded-lg focus:outline-none focus:ring-1 focus:ring-sffl-red font-bold text-sm min-w-full md:min-w-[260px] cursor-pointer hover:bg-white/20 transition-colors"
                            >
                                {competitions.map((c: any) => (
                                    <option key={c.id} value={c.id} className="text-black bg-white">
                                        {c.name}
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
                    <span className="font-semibold">Loading standings...</span>
                </div>
            )}

            {/* Standings Table with Compact Legend */}
            {!dataLoading && standings.length > 0 ? (
                <div className="space-y-3 md:space-y-6">
                    <div className="flex items-center gap-2">
                        <span className="text-base md:text-2xl">🏆</span>
                        <h2 className="text-sm md:text-2xl font-black text-sffl-navy dark:text-white uppercase tracking-tight">
                            {selectedCompetition?.name || 'League'}
                        </h2>
                    </div>

                    {/* Abbreviation Legend - Horizontal Scroll on Mobile */}
                    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 px-3 py-2 shadow-sm overflow-x-auto scrollbar-hide">
                        <div className="flex items-center gap-2 whitespace-nowrap min-w-max">
                            <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {[
                                { abbr: 'P', full: 'GP' },
                                { abbr: 'W', full: 'W' },
                                { abbr: 'D', full: 'D' },
                                { abbr: 'L', full: 'L' },
                                { abbr: 'PF', full: 'PF' },
                                { abbr: 'PA', full: 'PA' },
                                { abbr: 'PD', full: 'PD' },
                                { abbr: 'PCT', full: '%' },
                            ].map(item => (
                                <div key={item.abbr} className="flex items-center gap-1 bg-gray-50 dark:bg-gray-700 px-1.5 py-0.5 rounded border border-gray-100 dark:border-gray-600">
                                    <span className="text-[10px] font-black text-sffl-red">{item.abbr}:</span>
                                    <span className="text-[9px] font-bold text-gray-500 dark:text-gray-400">{item.full}</span>
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
