import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getCompetitions, getStandings } from '../../services/api';
import { Loader } from '../../components/ui/Loader';
import { StandingsTable } from '../../components/matches/StandingsTable';

export const StandingsPage = () => {
    const [searchParams] = useSearchParams();
    const compParam = searchParams.get('comp');
    const teamParam = searchParams.get('team');
    const [selectedCompetitionId, setSelectedCompetitionId] = useState<string>('');
    const [showLegend, setShowLegend] = useState(false);

    const { data: competitionsData, isLoading: compLoading } = useQuery({
        queryKey: ['publicCompetitions'],
        queryFn: () => getCompetitions(1, 100),
    });
    const competitions = (competitionsData?.data || []).filter(c => c.status !== 'inactive');

    useEffect(() => {
        if (competitions.length === 0 || selectedCompetitionId) return;
        if (compParam && competitions.some(c => c.id === compParam)) {
            setSelectedCompetitionId(compParam);
        } else {
            setSelectedCompetitionId(competitions[0].id);
        }
    }, [competitions, selectedCompetitionId, compParam]);

    // When arriving with ?team=X, scroll the highlighted row into the viewport
    // so the user can see their team immediately even if the table is long.
    useEffect(() => {
        if (!teamParam) return;
        const t = setTimeout(() => {
            const row = document.querySelector<HTMLTableRowElement>(`tr[data-team-id="${teamParam}"]`);
            row?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 250);
        return () => clearTimeout(t);
    }, [teamParam, selectedCompetitionId]);

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
        <div className="space-y-4 md:space-y-8 pb-20">
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
                                        {c.name} {c.status && !['active', 'completed'].includes(c.status) ? `[${c.status.toUpperCase()}]` : ''}
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
                            {selectedCompetition?.status && !['active', 'completed'].includes(selectedCompetition.status) && (
                                <span className="text-red-500 text-sm ml-2 align-middle">[{selectedCompetition.status.toUpperCase()}]</span>
                            )}
                        </h2>
                    </div>

                    {/* Abbreviation Legend - Descriptive and Colorful (Togglable) */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden mb-6">
                        <div
                            className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                            onClick={() => setShowLegend(!showLegend)}
                        >
                            <div className="flex items-center gap-2">
                                <span className="p-1 px-2 bg-sffl-navy text-white text-[10px] font-black rounded box-border leading-none uppercase">Legend</span>
                                <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Table Key</h3>
                            </div>
                            <button className="text-[10px] font-black uppercase tracking-tight text-sffl-red hover:underline">
                                {showLegend ? 'Close Info ↑' : 'See Info ↓'}
                            </button>
                        </div>

                        {showLegend && (
                            <div className="p-4 pt-0 border-t border-gray-50 dark:border-gray-700 overflow-x-auto scrollbar-hide">
                                <div className="flex items-center gap-3 whitespace-nowrap min-w-max text-[10px] md:text-xs py-3">
                                    {[
                                        { abbr: 'GP', full: 'Games Played', color: 'bg-blue-50 text-blue-600 border-blue-100' },
                                        { abbr: 'W', full: 'Wins', color: 'bg-green-50 text-green-600 border-green-100' },
                                        { abbr: 'D', full: 'Draws', color: 'bg-gray-50 text-gray-600 border-gray-100' },
                                        { abbr: 'L', full: 'Losses', color: 'bg-red-50 text-red-600 border-red-100' },
                                        { abbr: 'PF', full: 'Points For', color: 'bg-yellow-50 text-yellow-700 border-yellow-100' },
                                        { abbr: 'PA', full: 'Points Against', color: 'bg-yellow-50 text-yellow-700 border-yellow-100' },
                                        { abbr: 'PD', full: 'Point Difference', color: 'bg-purple-50 text-purple-600 border-purple-100' },
                                        { abbr: 'PCT', full: 'Percentage', color: 'bg-indigo-50 text-indigo-600 border-indigo-100' },
                                    ].map(item => (
                                        <div key={item.abbr} className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border ${item.color} font-bold`}>
                                            <span className="opacity-70">{item.abbr}:</span>
                                            <span>{item.full}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <StandingsTable
                        standings={standings}
                        isCompleted={selectedCompetition?.status === 'completed'}
                        highlightTeamId={teamParam || undefined}
                    />
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
