import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { getCompetitions, getMatches, getStandings, getTeams, sortCompetitionsBySeason, type Match, type Competition, type PaginatedResponse } from '../../services/api';
import { Loader } from '../../components/ui/Loader';
import { Spinner } from '../../components/ui';
import { MatchCard } from '../../components/matches/MatchCard';
import { MatchStandingsTable } from '../../components/matches/MatchStandingsTable';
import { BracketView } from '../../components/matches/BracketView';

export const MatchHub = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const compParam = searchParams.get('comp');
    const teamParam = searchParams.get('team');

    // The competition filter is NOT persisted across visits — we always
    // recompute the default from the most recent match so users land on the
    // active stage, not whatever they last picked. The status filter still
    // persists within the tab since it's a personal preference.
    const [selectedCompetitionId, setSelectedCompetitionId] = useState<string>('');
    const [statusFilter, setStatusFilter] = useState<'ALL' | 'LIVE' | 'FINISHED' | 'SCHEDULED'>(() => {
        return (sessionStorage.getItem('sffl_matches_status') as any) || 'ALL';
    });
    const [collapsedDates, setCollapsedDates] = useState<Record<string, boolean>>({});
    const navigate = useNavigate();

    useEffect(() => {
        sessionStorage.setItem('sffl_matches_status', statusFilter);
    }, [statusFilter]);

    // When the page is opened via /matches?team=X (e.g. from a Team Hub
    // quick-link), look up the team so we can label the active filter.
    const { data: teamsLookupData } = useQuery({
        queryKey: ['publicTeamsLookup'],
        queryFn: () => getTeams(1, 100),
        enabled: !!teamParam,
    });
    const filterTeam = teamParam
        ? teamsLookupData?.data?.find(t => t.id === teamParam)
        : undefined;

    const clearTeamFilter = () => {
        const params = new URLSearchParams(searchParams);
        params.delete('team');
        setSearchParams(params, { replace: true });
    };

    const { data: competitionsData, isLoading: loadingComps } = useQuery({
        queryKey: ['publicCompetitions'],
        queryFn: () => getCompetitions(1, 100),
    });
    const competitions = sortCompetitionsBySeason(
        (competitionsData?.data || []).filter(c => c.status !== 'inactive')
    );
    const leagueComps = competitions.filter(c => c.format !== 'KNOCKOUT');
    const selectedComp = competitions.find(c => c.id === selectedCompetitionId);
    
    // Find linked playoff for selected comp
    const linkedPlayoff = selectedComp?.playoff_competition_id
        ? competitions.find(c => c.id === selectedComp.playoff_competition_id)
        : null;

    // Reverse: if currently on a KNOCKOUT, find its parent league
    const parentLeague = !linkedPlayoff
        ? competitions.find(c => c.playoff_competition_id === selectedCompetitionId)
        : null;

    const isCurrentPlayoff = selectedComp?.format === 'KNOCKOUT';
    const dropdownComps = isCurrentPlayoff
        ? competitions.filter(c => c.format === 'KNOCKOUT')
        : leagueComps;

    // Anchor the default selection to the most recently PLAYED match's
    // competition (FINISHED only). Without the status filter, future scheduled
    // playoff matches would be "newer" than the regular season's last result,
    // so the page would switch to the playoffs before any playoff is played.
    const { data: latestMatchPage, isFetched: latestMatchFetched } = useQuery({
        queryKey: ['publicLatestMatchForDefault'],
        queryFn: () => getMatches(undefined, 1, 1, 'FINISHED'),
        staleTime: 60_000,
    });
    const latestMatchCompetitionId = latestMatchPage?.data?.[0]?.competition?.id;

    // Seed once on mount: honor ?comp= from the URL (e.g. "View All" from the
    // home page) when valid; otherwise pick the competition of the most recent
    // match; finally fall back to the first active competition. After seeding
    // we never override the user's manual dropdown choice.
    useEffect(() => {
        if (competitions.length === 0) return;

        // If URL has a specific compParam, always prioritize it
        if (compParam && competitions.some(c => c.id === compParam)) {
            if (selectedCompetitionId !== compParam) {
                setSelectedCompetitionId(compParam);
            }
            return;
        }

        // Otherwise, if we already have a selected competition, do nothing
        if (selectedCompetitionId) return;

        const timer = setTimeout(() => {
            let initialCompId = '';
            if (latestMatchFetched) {
                if (latestMatchCompetitionId && competitions.some(c => c.id === latestMatchCompetitionId)) {
                    initialCompId = latestMatchCompetitionId;
                } else {
                    initialCompId = leagueComps[0]?.id || competitions[0]?.id;
                }
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

    const selectedCompetition = competitions.find(c => c.id === selectedCompetitionId);
    const isCompleted = selectedCompetition?.status === 'completed';
    // Knockout competitions show the playoff bracket instead of standings.
    const isKnockout = selectedCompetition?.format === 'KNOCKOUT';

    const { data: standingsData, isLoading: standingsLoading } = useQuery({
        queryKey: ['publicStandings', selectedCompetitionId],
        queryFn: () => getStandings(selectedCompetitionId),
        enabled: !!selectedCompetitionId && !isKnockout,
    });
    const standings = standingsData || [];

    const {
        data: infiniteMatchesData,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage: matchesLoading,
        isLoading: initialMatchesLoading
    } = useInfiniteQuery({
        queryKey: ['publicMatchesInfinite', selectedCompetitionId, statusFilter],
        queryFn: ({ pageParam = 1 }) => getMatches(
            selectedCompetitionId,
            pageParam as number,
            10,
            statusFilter === 'ALL' ? undefined : statusFilter
        ),
        initialPageParam: 1,
        getNextPageParam: (lastPage, allPages) => {
            if (!lastPage.total_pages) return undefined;
            return allPages.length < lastPage.total_pages ? allPages.length + 1 : undefined;
        },
        enabled: !!selectedCompetitionId,
    });

    const matches = useMemo(() => {
        const rawMatches = infiniteMatchesData?.pages?.reduce((acc: Match[], p: PaginatedResponse<Match>) => acc.concat(p?.data || []), []) || [];
        if (!teamParam) return rawMatches;
        return rawMatches.filter(m => m.home_team?.id === teamParam || m.away_team?.id === teamParam);
    }, [infiniteMatchesData, teamParam]);
    const hasMore = hasNextPage;
    const loading = loadingComps || initialMatchesLoading;

    // Intersection Observer callback ref
    const observer = useRef<IntersectionObserver | null>(null);
    const lastMatchElementRef = useCallback((node: HTMLDivElement) => {
        if (matchesLoading) return;

        if (observer.current) observer.current.disconnect();
        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasNextPage) {
                fetchNextPage();
            }
        });

        if (node) observer.current.observe(node);
    }, [matchesLoading, hasNextPage, fetchNextPage]);

    const handleCompetitionChange = (compId: string) => {
        setSelectedCompetitionId(compId);
        const params = new URLSearchParams(searchParams);
        params.set('comp', compId);
        setSearchParams(params, { replace: true });
    };

    const toggleDateCollapse = (date: string) => {
        setCollapsedDates(prev => ({
            ...prev,
            [date]: !prev[date]
        }));
    };

    // Grouping Matches by Date (assuming match.date is formatted logically e.g., 'YYYY-MM-DD' or similar)
    const groupedMatches = matches.reduce((acc: Record<string, Match[]>, match: Match) => {
        const dateStr = match.date.substring(0, 10);
        if (!acc[dateStr]) acc[dateStr] = [];
        acc[dateStr].push(match);
        return acc;
    }, {});

    if (loading && competitions.length === 0) return <Loader />;

    return (
        <div className="space-y-4 md:space-y-8 pb-16">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-center bg-sffl-navy text-white p-4 md:p-8 rounded-xl md:rounded-2xl shadow-xl">
                <div>
                    <h1 className="text-3xl md:text-5xl font-black italic tracking-tighter">MATCH HUB</h1>
                    <p className="text-gray-300 mt-2 text-lg">Scores, Fixtures & Standings</p>
                    <div className="mt-4 lg:hidden">
                        <Link to="/standings" className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-full text-xs font-bold transition-all border border-white/20">
                            <span>🏆</span> View Full Standings
                        </Link>
                    </div>
                </div>

                {/* Competition Selector */}
                {competitions.length > 0 && (
                    <div className="mt-4 md:mt-0 flex flex-col md:flex-row md:items-end gap-3">
                        <div className="flex-1 min-w-[260px]">
                            <label className="block text-[10px] uppercase text-gray-400 font-bold mb-1 tracking-wider">Competition</label>
                            <div className="relative">
                                <select
                                    value={selectedCompetitionId}
                                    onChange={(e) => handleCompetitionChange(e.target.value)}
                                    className="w-full appearance-none bg-white/10 border border-white/20 text-white py-2 px-4 pr-10 rounded-lg focus:outline-none focus:ring-1 focus:ring-sffl-red font-bold text-sm cursor-pointer hover:bg-white/20 transition-colors"
                                >
                                    {dropdownComps.map((c: Competition) => (
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
                        {(linkedPlayoff || parentLeague) && (
                            <button
                                onClick={() => handleCompetitionChange(linkedPlayoff ? linkedPlayoff.id : parentLeague!.id)}
                                className="px-4 py-2 h-[38px] bg-sffl-red text-white font-bold rounded-lg shadow-sm hover:shadow-md hover:bg-red-700 transition-all duration-300 hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 whitespace-nowrap text-xs md:text-sm"
                            >
                                {linkedPlayoff ? (
                                    <>
                                        <span>🏆</span> Switch to Playoffs
                                    </>
                                ) : (
                                    <>
                                        <span>←</span> Back to Season
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                )}
            </div>

            {filterTeam && (
                <div className="flex items-center justify-between gap-3 bg-sffl-red/10 border border-sffl-red/30 text-sffl-red dark:bg-sffl-red/20 dark:text-white px-4 py-2.5 rounded-xl">
                    <div className="flex items-center gap-2 text-xs md:text-sm font-bold uppercase tracking-wider">
                        <span>Filtering matches for</span>
                        <span className="font-black">{filterTeam.name}</span>
                    </div>
                    <button
                        onClick={clearTeamFilter}
                        className="text-[10px] md:text-xs font-black uppercase tracking-wider bg-white text-sffl-red hover:bg-gray-100 px-3 py-1 rounded-full transition"
                    >
                        Clear ✕
                    </button>
                </div>
            )}

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* Left Column: Matches (2/3 width) */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <h2 className="text-2xl font-bold text-sffl-navy dark:text-white flex items-center gap-2">
                            <span className="text-sffl-red">●</span> Fixtures & Results
                        </h2>

                        {/* Status Filter */}
                        <div className="bg-gray-100 dark:bg-gray-800 p-1 rounded-lg flex gap-1 w-full sm:w-auto">
                            {(['ALL', 'LIVE', 'FINISHED', 'SCHEDULED'] as const).map(f => (
                                <button
                                    key={f}
                                    onClick={() => setStatusFilter(f)}
                                    className={`flex-1 sm:flex-none px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${statusFilter === f
                                            ? 'bg-sffl-navy text-white shadow-sm'
                                            : 'text-gray-500 dark:text-gray-400 hover:text-sffl-navy dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700'
                                        }`}
                                >
                                    {f === 'SCHEDULED' ? 'UPCOMING' : f}
                                </button>
                            ))}
                        </div>
                    </div>

                    {initialMatchesLoading ? (
                        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl shadow-sm">
                            <Spinner label="Loading matches…" className="py-16" />
                        </div>
                    ) : matches.length === 0 && !matchesLoading ? (
                        <div className="bg-gray-100 dark:bg-gray-800 p-12 rounded-xl text-center">
                            <div className="text-4xl mb-3">⚽</div>
                            <p className="text-gray-500 text-lg font-semibold">No matches found for this filter.</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {Object.entries(groupedMatches).map(([dateStr, dayMatches]: [string, Match[]], groupIndex) => (
                                <div key={dateStr} className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm">
                                    <button
                                        onClick={() => toggleDateCollapse(dateStr)}
                                        className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors border-b border-gray-100 dark:border-gray-700/50"
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="font-bold text-gray-500 dark:text-gray-400 text-lg">
                                                {new Date(dateStr).getFullYear()}
                                            </span>
                                            <div className="bg-sffl-navy text-white w-10 h-10 rounded-lg flex flex-col items-center justify-center font-bold">
                                                <span className="text-xs tracking-wider uppercase">{new Date(dateStr).toLocaleString('default', { month: 'short' })}</span>
                                                <span className="text-sm leading-none">{new Date(dateStr).getDate()}</span>
                                            </div>
                                            <span className="font-bold text-gray-800 dark:text-gray-200 text-lg">
                                                {new Date(dateStr).toLocaleDateString('default', { weekday: 'long' })}
                                            </span>
                                        </div>
                                        <div className="text-gray-400 dark:text-gray-500 bg-white dark:bg-gray-700 w-8 h-8 rounded-full flex items-center justify-center shadow-sm">
                                            <svg
                                                className={`w-5 h-5 transition-transform duration-200 ${collapsedDates[dateStr] ? 'rotate-180' : ''}`}
                                                fill="none" stroke="currentColor" viewBox="0 0 24 24"
                                            >
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </div>
                                    </button>

                                    {!collapsedDates[dateStr] && (
                                        <div className="p-4 grid grid-cols-1 gap-4">
                                            {dayMatches.map((match: Match, index: number) => {
                                                // Check if this is the absolute last match globally to attach the infinite scroll ref
                                                const isLastOverall =
                                                    groupIndex === Object.keys(groupedMatches).length - 1 &&
                                                    index === dayMatches.length - 1;

                                                return (
                                                    <div ref={isLastOverall ? lastMatchElementRef : null} key={match.id}>
                                                        <MatchCard
                                                            match={match}
                                                            onClick={() => {
                                                                const params = new URLSearchParams();
                                                                if (selectedCompetitionId) params.set('comp', selectedCompetitionId);
                                                                if (teamParam) params.set('team', teamParam);
                                                                navigate(`/matches/${match.id}?${params.toString()}`);
                                                            }}
                                                        />
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Infinite Scroll Loader */}
                    {matchesLoading && (
                        <div className="flex justify-center items-center py-6">
                            <div className="flex items-center gap-2 text-gray-500 font-semibold">
                                <div className="w-6 h-6 border-2 border-sffl-red border-t-transparent rounded-full animate-spin"></div>
                                Loading more matches...
                            </div>
                        </div>
                    )}

                    {!hasMore && matches.length > 0 && (
                        <div className="text-center py-6 text-gray-400 font-medium">
                            No more matches to load.
                        </div>
                    )}
                </div>

                {/* Right Column: Standings or Bracket (1/3 width) — sticky sidebar */}
                <div className="hidden lg:block lg:col-span-1 lg:sticky lg:top-[90px] self-start space-y-6">
                    {isKnockout ? (
                        <div className="space-y-6">
                            <BracketView
                                competitionId={selectedCompetitionId}
                                compact
                                viewAllLink={`/standings?comp=${selectedCompetitionId}`}
                            />

                            <div className="bg-gradient-to-br from-purple-600 to-indigo-700 rounded-xl p-6 text-white shadow-lg">
                                <h3 className="text-xl font-bold mb-2">Join the Action!</h3>
                                <p className="text-sm text-purple-100 mb-4">Don't miss a single moment of the SFFL season.</p>
                                <Link to="/tickets" className="w-full py-2 bg-white text-indigo-700 font-bold rounded-lg hover:bg-purple-50 transition-colors block text-center">
                                    Get Tickets
                                </Link>
                            </div>
                        </div>
                    ) : standingsLoading ? (
                        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl shadow-sm">
                            <Spinner label="Loading standings…" className="py-12" />
                        </div>
                    ) : standings.length > 0 ? (
                        <div className="space-y-6">
                            <MatchStandingsTable 
                                standings={standings} 
                                isCompleted={isCompleted} 
                                viewAllLink={`/standings?comp=${selectedCompetitionId}`}
                            />

                            <div className="bg-gradient-to-br from-purple-600 to-indigo-700 rounded-xl p-6 text-white shadow-lg">
                                <h3 className="text-xl font-bold mb-2">Join the Action!</h3>
                                <p className="text-sm text-purple-100 mb-4">Don't miss a single moment of the SFFL season.</p>
                                <Link to="/tickets" className="w-full py-2 bg-white text-indigo-700 font-bold rounded-lg hover:bg-purple-50 transition-colors block text-center">
                                    Get Tickets
                                </Link>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-gray-100 dark:bg-gray-800 p-8 rounded-xl text-center text-gray-500">
                            No standings available.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
