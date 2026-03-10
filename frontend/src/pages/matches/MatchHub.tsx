import { useEffect, useState, useRef, useCallback } from 'react';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getCompetitions, getMatches, getStandings } from '../../services/api';
import { Loader } from '../../components/ui/Loader';
import { MatchCard } from '../../components/matches/MatchCard';
import { StandingsTable } from '../../components/matches/StandingsTable';

export const MatchHub = () => {
    const [selectedCompetitionId, setSelectedCompetitionId] = useState<string>('');

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
        queryKey: ['publicMatchesInfinite', selectedCompetitionId],
        queryFn: ({ pageParam = 1 }) => getMatches(selectedCompetitionId, pageParam as number, 5),
        initialPageParam: 1,
        getNextPageParam: (lastPage, allPages) => {
            if (!lastPage.total_pages) return undefined;
            return allPages.length < lastPage.total_pages ? allPages.length + 1 : undefined;
        },
        enabled: !!selectedCompetitionId,
    });

    const matches = infiniteMatchesData?.pages.flatMap(p => p.data || []) || [];
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

    if (loading && competitions.length === 0) return <Loader />;

    return (
        <div className="max-w-6xl mx-auto space-y-10 min-h-screen p-4">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-center bg-sffl-navy text-white p-8 rounded-2xl shadow-xl">
                <div>
                    <h1 className="text-4xl md:text-5xl font-black italic tracking-tighter">MATCH HUB</h1>
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

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* Left Column: Matches (2/3 width) */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-2xl font-bold text-sffl-navy dark:text-white flex items-center gap-2">
                            <span className="text-sffl-red">●</span> Fixtures & Results
                        </h2>
                    </div>

                    {matches.length === 0 && !matchesLoading ? (
                        <div className="bg-gray-100 dark:bg-gray-800 p-12 rounded-xl text-center">
                            <div className="text-4xl mb-3">⚽</div>
                            <p className="text-gray-500 text-lg font-semibold">No matches found for this competition.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-4">
                            {matches.map((match, index) => {
                                if (matches.length === index + 1) {
                                    // Last element ref for infinite scroll
                                    return (
                                        <div ref={lastMatchElementRef} key={match.id}>
                                            <MatchCard
                                                match={match}
                                                onClick={() => { }}
                                            />
                                        </div>
                                    );
                                } else {
                                    return (
                                        <MatchCard
                                            key={match.id}
                                            match={match}
                                            onClick={() => { }}
                                        />
                                    );
                                }
                            })}
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
                    <h2 className="text-2xl font-bold text-sffl-navy dark:text-white flex items-center gap-2">
                        <span className="text-yellow-500">🏆</span> Standings
                    </h2>
                    {standings.length > 0 ? (
                        <div className="sticky top-24 space-y-6">
                            <StandingsTable standings={standings} />

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
