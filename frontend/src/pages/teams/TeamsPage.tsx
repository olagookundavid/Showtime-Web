import { useCallback, useRef } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  getTeams,
  type PaginatedResponse,
  type Team,
} from "../../services/api";
import { Loader } from "../../components/ui/Loader";
import { Spinner } from "../../components/ui/Spinner";
import { ShieldCheckIcon } from "@heroicons/react/24/outline";

const PAGE_SIZE = 20;

export const TeamsPage = () => {
  const {
    data: infiniteTeamsData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage: teamsLoadingMore,
    isLoading: initialTeamsLoading,
  } = useInfiniteQuery({
    queryKey: ["publicTeamsInfinite"],
    queryFn: ({ pageParam = 1 }) => getTeams(pageParam as number, PAGE_SIZE),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage?.total_pages) return undefined;
      return allPages.length < lastPage.total_pages
        ? allPages.length + 1
        : undefined;
    },
  });

  const teams: Team[] = (
    infiniteTeamsData?.pages?.reduce(
      (acc: Team[], p: PaginatedResponse<Team>) => acc.concat(p?.data || []),
      [],
    ) || []
  ).filter((t: Team) => t.status !== "inactive");
  const hasMore = hasNextPage;

  const observer = useRef<IntersectionObserver | null>(null);
  const lastCardRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (teamsLoadingMore) return;
      if (observer.current) observer.current.disconnect();
      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasNextPage) {
          fetchNextPage();
        }
      });
      if (node) observer.current.observe(node);
    },
    [teamsLoadingMore, hasNextPage, fetchNextPage],
  );

  if (initialTeamsLoading) return <Loader />;

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-sffl-navy text-white p-4 md:p-8 rounded-xl md:rounded-2xl shadow-xl">
        <div>
          <h1 className="text-3xl md:text-5xl font-black italic tracking-tighter">
            TEAMS
          </h1>
          <p className="text-gray-300 mt-1 text-sm md:text-lg">
            The clubs of the league
          </p>
        </div>
      </div>

      {teams.length === 0 ? (
        <div className="bg-gray-100 dark:bg-gray-800 p-8 md:p-16 rounded-xl text-center">
          <ShieldCheckIcon
            className="w-10 h-10 md:w-14 md:h-14 mx-auto mb-4 text-gray-400"
            aria-hidden="true"
          />
          <p className="text-gray-500 text-base md:text-lg font-semibold">
            No teams yet.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 min-[360px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-6">
          {teams.map((team: Team, idx: number) => {
            const isLast = idx === teams.length - 1;
            return (
              <div key={team.id} ref={isLast ? lastCardRef : null}>
                <Link
                  to={`/teams/${team.id}`}
                  className="block bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-xl transition-all overflow-hidden border border-gray-100 dark:border-gray-700 group"
                >
                  <div className="aspect-square bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
                    {team.logo ? (
                      <img
                        src={team.logo}
                        alt={team.name}
                        className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-linear-to-br from-sffl-navy to-sffl-navy/80 text-white text-3xl md:text-5xl font-black rounded-lg">
                        {team.short_name?.toUpperCase() ||
                          team.name.substring(0, 3).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="p-3 md:p-4 border-t border-gray-100 dark:border-gray-700">
                    <h3 className="text-sm md:text-base font-black text-sffl-navy dark:text-white truncate uppercase">
                      {team.name}
                    </h3>
                    {team.short_name && (
                      <div className="text-[10px] md:text-xs text-sffl-red font-bold tracking-wider mt-0.5">
                        {team.short_name.toUpperCase()}
                      </div>
                    )}
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      )}

      {teamsLoadingMore && (
        <Spinner size="sm" label="Loading more teams…" className="py-6" />
      )}

      {!hasMore && teams.length > 0 && (
        <div className="text-center py-6 text-gray-400 font-medium">
          No more teams to load.
        </div>
      )}
    </div>
  );
};
