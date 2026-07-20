import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getCompetitions, getStandings, getMatches, sortCompetitionsBySeason } from '../../services/api';
import { Loader } from '../../components/ui/Loader';
import { StandingsTable } from '../../components/matches/StandingsTable';
import { BracketView } from '../../components/matches/BracketView';
import { SeasonPlayoffTabs } from '../../components/common/SeasonPlayoffTabs';

export const StandingsPage = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const compParam = searchParams.get('comp');
    const teamParam = searchParams.get('team');
    const [selectedCompetitionId, setSelectedCompetitionId] = useState<string>(() => {
        return sessionStorage.getItem('sffl_standings_comp') || '';
    });
    const [showLegend, setShowLegend] = useState(false);

    useEffect(() => {
        if (selectedCompetitionId) {
            sessionStorage.setItem('sffl_standings_comp', selectedCompetitionId);
        }
    }, [selectedCompetitionId]);

    const { data: competitionsData, isLoading: compLoading } = useQuery({
        queryKey: ['publicCompetitions'],
        queryFn: () => getCompetitions(1, 100),
    });
    const competitions = sortCompetitionsBySeason(
        (competitionsData?.data || []).filter(c => c.status !== 'inactive')
    );
    const leagueComps = competitions.filter(c => c.format !== 'KNOCKOUT');
    const selectedComp = competitions.find(c => c.id === selectedCompetitionId);

    const isCurrentPlayoff = selectedComp?.format === 'KNOCKOUT';
    const dropdownComps = isCurrentPlayoff
        ? competitions.filter(c => c.format === 'KNOCKOUT')
        : leagueComps;

    // Pick the competition of the most recent match so the default lands on
    // the currently-running stage (regular season → playoffs → bowl) instead
    // of just the newest competition row.
    const { data: latestMatchPage, isFetched: latestMatchFetched } = useQuery({
        queryKey: ['publicLatestMatchForDefault'],
        queryFn: () => getMatches(undefined, 1, 1, 'FINISHED'),
        staleTime: 60_000,
    });
    const latestMatchCompetitionId = latestMatchPage?.data?.[0]?.competition?.id;

    useEffect(() => {
        if (competitions.length === 0) return;

        if (compParam && competitions.some(c => c.id === compParam)) {
            if (selectedCompetitionId !== compParam) {
                setSelectedCompetitionId(compParam);
            }
            return;
        }

        if (selectedCompetitionId) {
            if (!compParam) {
                const params = new URLSearchParams(searchParams);
                params.set('comp', selectedCompetitionId);
                setSearchParams(params, { replace: true });
            }
            return;
        }

        if (!latestMatchFetched) return;

        const timer = setTimeout(() => {
            let initialCompId = '';
            if (latestMatchCompetitionId && competitions.some(c => c.id === latestMatchCompetitionId)) {
                initialCompId = latestMatchCompetitionId;
            } else {
                initialCompId = leagueComps[0]?.id || competitions[0]?.id;
            }

            if (initialCompId) {
                setSelectedCompetitionId(initialCompId);
                const params = new URLSearchParams(searchParams);
                params.set('comp', initialCompId);
                setSearchParams(params, { replace: true });
            }
        }, 0);

        return () => clearTimeout(timer);
    }, [competitions, selectedCompetitionId, compParam, latestMatchFetched, latestMatchCompetitionId, leagueComps, searchParams, setSearchParams]);

    const handleCompetitionChange = (compId: string) => {
        setSelectedCompetitionId(compId);
        const params = new URLSearchParams(searchParams);
        params.set('comp', compId);
        setSearchParams(params, { replace: true });
    };

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

    // Find selected competition name
    const selectedCompetition = competitions.find(c => c.id === selectedCompetitionId);
    // Knockout competitions (playoffs + bowl) have a bracket instead of standings.
    const isKnockout = selectedCompetition?.format === 'KNOCKOUT';

    const { data: standingsData, isLoading: dataLoading } = useQuery({
        queryKey: ['publicStandings', selectedCompetitionId],
        queryFn: () => getStandings(selectedCompetitionId),
        enabled: !!selectedCompetitionId && !isKnockout,
    });
    const standings = standingsData || [];

    const loading = compLoading;

    if (loading && competitions.length === 0) return <Loader />;

    return (
        <div className="space-y-4 md:space-y-8 pb-20">
            {/* Header - Condensed */}
            <div className="flex flex-col md:flex-row justify-between items-center bg-sffl-navy text-white p-4 md:p-8 rounded-xl md:rounded-2xl shadow-xl">
                <div>
                    <h1 className="text-3xl md:text-5xl font-black italic tracking-tighter">{isKnockout ? 'PLAYOFFS' : 'STANDINGS'}</h1>
                    <p className="text-gray-300 mt-0.5 text-xs md:text-lg">{isKnockout ? 'Bracket & Road to the Bowl' : 'Rankings & Tables'}</p>
                </div>

                {/* Competition Selector - Mobile Optimized */}
                {competitions.length > 0 && (
                    <div className="mt-3 md:mt-0 w-full md:w-auto flex flex-col md:flex-row md:items-end gap-3">
                        <div className="flex-1 min-w-[260px]">
                            <label className="block text-[10px] uppercase text-gray-400 font-bold mb-1 tracking-wider">Competition</label>
                            <div className="relative">
                                <select
                                    value={selectedCompetitionId}
                                    onChange={(e) => handleCompetitionChange(e.target.value)}
                                    className="w-full appearance-none bg-white/10 border border-white/20 text-white py-2 px-4 pr-10 rounded-lg focus:outline-none focus:ring-1 focus:ring-sffl-red font-bold text-sm cursor-pointer hover:bg-white/20 transition-colors"
                                >
                                    {dropdownComps.map((c: any) => (
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
                    </div>
                )}
            </div>

            {competitions.length > 0 && (
                <SeasonPlayoffTabs competitions={competitions} currentId={selectedCompetitionId} onChange={handleCompetitionChange} />
            )}

            {dataLoading && !isKnockout && (
                <div className="flex justify-center items-center gap-2 text-gray-500">
                    <div className="w-5 h-5 border-2 border-sffl-red border-t-transparent rounded-full animate-spin"></div>
                    <span className="font-semibold">Loading standings...</span>
                </div>
            )}

            {/* Knockout: bracket replaces the standings table */}
            {isKnockout && selectedCompetitionId && (
                <div className="space-y-3 md:space-y-6">
                    <div className="flex items-center gap-2">
                        <span className="text-base md:text-2xl">🏈</span>
                        <h2 className="text-sm md:text-2xl font-black text-sffl-navy dark:text-white uppercase tracking-tight">
                            {selectedCompetition?.name}
                        </h2>
                    </div>
                    <BracketView competitionId={selectedCompetitionId} />
                </div>
            )}

            {/* Standings Table with Compact Legend */}
            {!isKnockout && !dataLoading && standings.length > 0 ? (
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
            ) : !isKnockout && !dataLoading ? (
                <div className="bg-gray-100 dark:bg-gray-800 p-16 rounded-xl text-center">
                    <div className="text-5xl mb-4">🏆</div>
                    <p className="text-gray-500 text-lg font-semibold">No standings available for this competition yet.</p>
                    <p className="text-gray-400 mt-2">Check back once matches have been played.</p>
                </div>
            ) : null}
        </div>
    );
};
