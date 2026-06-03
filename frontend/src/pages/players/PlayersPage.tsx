import { useCallback, useEffect, useRef, useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { getPlayers, getTeams, type PaginatedResponse, type Player } from '../../services/api';
import { Loader } from '../../components/ui/Loader';
import { LightboxImage } from '../../components/ui';

const PAGE_SIZE = 20;

export const PlayersPage = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const [selectedTeamId, setSelectedTeamId] = useState<string>(searchParams.get('team') ?? '');

    // Keep state in sync if user navigates between team-card links.
    useEffect(() => {
        const t = searchParams.get('team') ?? '';
        if (t !== selectedTeamId) setSelectedTeamId(t);
    }, [searchParams, selectedTeamId]);

    const handleTeamChange = (id: string) => {
        setSelectedTeamId(id);
        const next = new URLSearchParams(searchParams);
        if (id) next.set('team', id); else next.delete('team');
        setSearchParams(next, { replace: true });
    };

    const { data: teamsData, isLoading: loadingTeams } = useQuery({
        queryKey: ['publicTeams'],
        queryFn: () => getTeams(1, 100),
    });
    const teams: any[] = Array.isArray(teamsData?.data) ? teamsData.data : Array.isArray(teamsData) ? teamsData : [];

    const {
        data: infinitePlayersData,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage: playersLoadingMore,
        isLoading: initialPlayersLoading,
    } = useInfiniteQuery({
        queryKey: ['publicPlayersInfinite', selectedTeamId],
        queryFn: ({ pageParam = 1 }) =>
            getPlayers(selectedTeamId || undefined, pageParam as number, PAGE_SIZE),
        initialPageParam: 1,
        getNextPageParam: (lastPage, allPages) => {
            if (!lastPage?.total_pages) return undefined;
            return allPages.length < lastPage.total_pages ? allPages.length + 1 : undefined;
        },
    });

    const players: Player[] = infinitePlayersData?.pages?.reduce(
        (acc: Player[], p: PaginatedResponse<Player>) => acc.concat(p?.data || []),
        [],
    ) || [];
    const hasMore = hasNextPage;

    // Auto-load next page when the last card scrolls into view.
    const observer = useRef<IntersectionObserver | null>(null);
    const lastCardRef = useCallback((node: HTMLDivElement | null) => {
        if (playersLoadingMore) return;
        if (observer.current) observer.current.disconnect();
        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasNextPage) {
                fetchNextPage();
            }
        });
        if (node) observer.current.observe(node);
    }, [playersLoadingMore, hasNextPage, fetchNextPage]);

    if (loadingTeams) return <Loader />;

    return (
        <div className="space-y-8 pb-16">
            {/* Header - High Density */}
            <div className="flex flex-col md:flex-row justify-between items-center bg-sffl-navy text-white p-4 md:p-8 rounded-xl md:rounded-2xl shadow-xl">
                <div>
                    <h1 className="text-3xl md:text-5xl font-black italic tracking-tighter">PLAYERS</h1>
                    <p className="text-gray-300 mt-1 text-sm md:text-lg">Meet the stars</p>
                </div>

                {/* Team Filter - Condensed */}
                {teams.length > 0 && (
                    <div className="mt-3 md:mt-0 w-full md:w-auto">
                        <label className="block text-[10px] uppercase text-gray-400 font-bold mb-1 tracking-wider">Filter by Team</label>
                        <div className="relative">
                            <select
                                value={selectedTeamId}
                                onChange={(e) => handleTeamChange(e.target.value)}
                                className="appearance-none bg-white/10 border border-white/20 text-white py-2 px-4 pr-10 rounded-lg focus:outline-none focus:ring-1 focus:ring-sffl-red font-bold text-sm min-w-full md:min-w-[260px] cursor-pointer hover:bg-white/20 transition-colors"
                            >
                                <option value="" className="text-black bg-white">All Teams</option>
                                {teams.map((t: any) => (
                                    <option key={t.id} value={t.id} className="text-black bg-white">
                                        {t.name}
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

            {/* Initial-load Indicator */}
            {initialPlayersLoading && (
                <div className="flex justify-center items-center gap-2 text-gray-500">
                    <div className="w-5 h-5 border-2 border-sffl-red border-t-transparent rounded-full animate-spin"></div>
                    <span className="font-semibold">Loading players...</span>
                </div>
            )}

            {/* Players Grid */}
            {!initialPlayersLoading && players.length === 0 ? (
                <div className="bg-gray-100 dark:bg-gray-800 p-8 md:p-16 rounded-xl text-center">
                    <div className="text-3xl md:text-5xl mb-4">🏈</div>
                    <p className="text-gray-500 text-base md:text-lg font-semibold">No players found.</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 md:gap-6">
                    {players.map((player: Player, idx: number) => {
                        const isLast = idx === players.length - 1;
                        return (
                            <div
                                key={player.id}
                                ref={isLast ? lastCardRef : null}
                                className="bg-white dark:bg-gray-800 rounded-lg md:rounded-xl shadow-sm hover:shadow-xl transition overflow-hidden group border border-gray-100 dark:border-gray-700 flex flex-col"
                            >
                                {/* Player Image - Lightbox only click */}
                                <div className="relative h-48 md:h-80 overflow-hidden bg-gray-100 dark:bg-gray-900 group-image cursor-zoom-in">
                                    {player.image ? (
                                        <LightboxImage
                                            src={player.image}
                                            alt={player.name}
                                            thumbnailClassName="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-sffl-navy to-sffl-navy/80 text-white text-3xl md:text-6xl font-black opacity-40">
                                            #{player.jersey_number}
                                        </div>
                                    )}
                                    <div className="absolute top-2 right-2 md:top-4 md:right-4 bg-sffl-red text-white font-black text-[10px] md:text-base px-2 py-0.5 md:px-4 md:py-2 rounded-full shadow-lg z-20">
                                        #{player.jersey_number}
                                    </div>
                                </div>

                                {/* Player Info - Link to profile */}
                                <Link to={`/players/${player.id}`} className="p-2 md:p-6 flex-1 flex flex-col justify-between hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                    <div>
                                        <h3 className="text-xs md:text-2xl font-black text-sffl-navy dark:text-white truncate">{player.name}</h3>
                                        <div className="text-[10px] md:text-sm text-sffl-red font-bold truncate">
                                            {player.position}
                                        </div>
                                    </div>

                                    <div className="mt-2 md:mt-4 text-sffl-red font-semibold text-[10px] md:text-sm uppercase tracking-wider flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                                        View Profile <span>→</span>
                                    </div>
                                </Link>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Infinite Scroll Loader */}
            {playersLoadingMore && (
                <div className="flex justify-center items-center py-6">
                    <div className="flex items-center gap-2 text-gray-500 font-semibold">
                        <div className="w-6 h-6 border-2 border-sffl-red border-t-transparent rounded-full animate-spin"></div>
                        Loading more players...
                    </div>
                </div>
            )}

            {!hasMore && players.length > 0 && (
                <div className="text-center py-6 text-gray-400 font-medium">
                    No more players to load.
                </div>
            )}
        </div>
    );
};
