import { useEffect, useState, useRef, useCallback } from 'react';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getCompetitions, getMatches, getStandings, type Match, type Competition, type PaginatedResponse } from '../../services/api';
import { Loader } from '../../components/ui/Loader';
import { MatchCard } from '../../components/matches/MatchCard';
import { MatchStandingsTable } from '../../components/matches/MatchStandingsTable';

export const MatchHub = () => {
    const [selectedCompetitionId, setSelectedCompetitionId] = useState<string>('');
    const [statusFilter, setStatusFilter] = useState<'ALL' | 'LIVE' | 'FINISHED' | 'SCHEDULED'>('ALL');
    const [collapsedDates, setCollapsedDates] = useState<Record<string, boolean>>({});

    const { data: competitionsData, isLoading: loadingComps } = useQuery({
        queryKey: ['publicCompetitions'],
        queryFn: () => getCompetitions(1, 100),
    });
    const competitions = competitionsData?.data || [];

    useEffect(() => {
        if (competitions.length > 0 && !selectedCompetitionId) {
            setSelectedCompetitionId(competitions[0].id);
        }
    }, [competitions, selectedCompetitionId]);

    const { data: standingsData } = useQuery({
        queryKey: ['publicStandings', selectedCompetitionId],
        queryFn: () => getStandings(selectedCompetitionId),
        enabled: !!selectedCompetitionId,
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

    const matches = infiniteMatchesData?.pages?.reduce((acc: Match[], p: PaginatedResponse<Match>) => acc.concat(p?.data || []), []) || [];
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
        <div className="max-w-6xl mx-auto space-y-10 min-h-screen p-4">
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
                    <div className="mt-4 md:mt-0">
                        <label className="block text-xs uppercase text-gray-400 font-bold mb-1 tracking-wider">Competition</label>
                        <div className="relative">
                            <select
                                value={selectedCompetitionId}
                                onChange={(e) => handleCompetitionChange(e.target.value)}
                                className="appearance-none bg-white/10 border border-white/20 text-white py-3 px-6 pr-12 rounded-xl focus:outline-none focus:ring-2 focus:ring-sffl-red font-bold text-lg min-w-[260px] cursor-pointer hover:bg-white/20 transition-colors"
                            >
                                {competitions.map((c: Competition) => (
                                    <option key={c.id} value={c.id} className="text-black bg-white">
                                        {c.name} {c.status && c.status !== 'active' ? `[${c.status.toUpperCase()}]` : ''}
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

                    {matches.length === 0 && !matchesLoading && !initialMatchesLoading ? (
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
                                                            onClick={() => { }}
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

                {/* Right Column: Standings (1/3 width) */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-bold text-sffl-navy dark:text-white flex items-center gap-2">
                            <span className="text-yellow-500">🏆</span> Standings
                        </h2>
                        <Link to="/standings" className="hidden lg:inline-flex px-3 py-1.5 bg-sffl-navy hover:bg-sffl-red text-white text-xs font-bold rounded-lg transition-colors">
                            View All
                        </Link>
                    </div>
                    {standings.length > 0 ? (
                        <div className="sticky top-24 space-y-6">
                            <MatchStandingsTable standings={standings} />

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
