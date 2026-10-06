import { useCallback, useEffect, useRef, useState } from "react";
import {
  isDeletedPlayer,
  DELETED_TITLE,
} from "../../components/common/DeletedPlayer";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import {
  getPlayers,
  getTeams,
  type PaginatedResponse,
  type Player,
} from "../../services/api";
import { Loader } from "../../components/ui/Loader";
import { Field, LightboxImage, Select, Spinner } from "../../components/ui";
import { FootballIcon } from "../../components/icons/FootballIcon";
import { CrownIcon } from "../../components/icons/CrownIcon";
import {
  ArrowRightIcon,
  ShieldCheckIcon,
  TrophyIcon,
} from "@heroicons/react/24/outline";
import { StarIcon as StarSolidIcon } from "@heroicons/react/24/solid";

const PAGE_SIZE = 20;

type PublicTeam = {
  id: string;
  name: string;
  status?: string;
};

export const PlayersPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedTeamId, setSelectedTeamId] = useState<string>(
    searchParams.get("team") ?? "",
  );

  // Keep state in sync if user navigates between team-card links.
  useEffect(() => {
    const t = searchParams.get("team") ?? "";
    if (t !== selectedTeamId) {
      const timer = setTimeout(() => {
        setSelectedTeamId(t);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [searchParams, selectedTeamId]);

  const handleTeamChange = (id: string) => {
    setSelectedTeamId(id);
    const next = new URLSearchParams(searchParams);
    if (id) next.set("team", id);
    else next.delete("team");
    setSearchParams(next, { replace: true });
  };

  const { data: teamsData, isLoading: loadingTeams } = useQuery({
    queryKey: ["publicTeams"],
    queryFn: () => getTeams(1, 100),
  });
  const teams: PublicTeam[] = (
    Array.isArray(teamsData?.data)
      ? teamsData.data
      : Array.isArray(teamsData)
        ? teamsData
        : []
  ).filter((team: PublicTeam) => team.status !== "inactive");

  const {
    data: infinitePlayersData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage: playersLoadingMore,
    isLoading: initialPlayersLoading,
  } = useInfiniteQuery({
    queryKey: ["publicPlayersInfinite", selectedTeamId],
    queryFn: ({ pageParam = 1 }) =>
      getPlayers(selectedTeamId || undefined, pageParam as number, PAGE_SIZE),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage?.total_pages) return undefined;
      return allPages.length < lastPage.total_pages
        ? allPages.length + 1
        : undefined;
    },
  });

  const players: Player[] =
    infinitePlayersData?.pages?.reduce(
      (acc: Player[], p: PaginatedResponse<Player>) =>
        acc.concat(p?.data || []),
      [],
    ) || [];
  const hasMore = hasNextPage;

  // Auto-load next page when the last card scrolls into view.
  const observer = useRef<IntersectionObserver | null>(null);
  const lastCardRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (playersLoadingMore) return;
      if (observer.current) observer.current.disconnect();
      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasNextPage) {
          fetchNextPage();
        }
      });
      if (node) observer.current.observe(node);
    },
    [playersLoadingMore, hasNextPage, fetchNextPage],
  );

  if (loadingTeams) return <Loader />;

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Header - High Density */}
      <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3 bg-sffl-navy text-white p-4 md:p-8 rounded-xl md:rounded-2xl shadow-xl">
        <div className="min-w-0">
          <h1 className="text-3xl md:text-5xl font-black italic tracking-tighter">
            PLAYERS
          </h1>
          <p className="text-gray-300 mt-1 text-sm md:text-lg">
            Meet the stars
          </p>
        </div>

        {/* Team Filter - Condensed */}
        {teams.length > 0 && (
          <div className="w-full md:w-auto">
            <Field label="Filter by Team" htmlFor="players-team-filter" tone="dark">
              <Select
                id="players-team-filter"
                tone="dark"
                value={selectedTeamId}
                onChange={(e) => handleTeamChange(e.target.value)}
                className="md:min-w-65"
              >
                <option value="" className="text-black bg-white">
                  All Teams
                </option>
                {teams.map((t: PublicTeam) => (
                  <option
                    key={t.id}
                    value={t.id}
                    className="text-black bg-white"
                  >
                    {t.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        )}
      </div>

      {/* Initial-load Indicator */}
      {initialPlayersLoading && (
        <Spinner label="Loading players…" className="py-8" />
      )}

      {/* Players List View (Universal List View starting with photo) */}
      {!initialPlayersLoading && players.length === 0 ? (
        <div className="bg-gray-100 dark:bg-gray-800 p-8 md:p-16 rounded-xl text-center">
          <FootballIcon
            className="w-10 h-10 md:w-14 md:h-14 mx-auto mb-4 text-gray-400"
            aria-hidden="true"
          />
          <p className="text-gray-500 text-base md:text-lg font-semibold">
            No players found.
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl md:rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden divide-y divide-gray-100 dark:divide-gray-700/60">
          {players.map((player: Player, idx: number) => {
            const isLast = idx === players.length - 1;
            const profileUrl = `/players/${player.id}${selectedTeamId ? `?team=${selectedTeamId}` : ""}`;
            return (
              <div
                key={player.id}
                ref={isLast ? lastCardRef : null}
                title={isDeletedPlayer(player) ? DELETED_TITLE : undefined}
                className={`p-4 sm:p-5 hover:bg-gray-50/80 dark:hover:bg-gray-700/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  isDeletedPlayer(player) ? "opacity-50 grayscale" : ""
                }`}
              >
                <div className="flex items-start sm:items-center gap-4 min-w-0">
                  {/* Player Picture Thumbnail (Left-most) */}
                  {player.image ? (
                    <LightboxImage
                      src={player.image}
                      alt={player.name}
                      thumbnailClassName="w-14 h-14 sm:w-16 sm:h-16 rounded-xl object-cover border border-gray-200 dark:border-gray-700 shadow-sm shrink-0"
                    />
                  ) : (
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-sffl-navy/10 dark:bg-sffl-navy/50 border border-sffl-navy/20 dark:border-gray-700 flex items-center justify-center text-lg font-black text-sffl-navy dark:text-gray-200 shrink-0">
                      #{player.jersey_number || "?"}
                    </div>
                  )}

                  {/* Player Info */}
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        to={profileUrl}
                        className={`min-w-0 max-w-full text-base sm:text-lg font-black transition-colors truncate ${
                          isDeletedPlayer(player)
                            ? "text-gray-400 dark:text-gray-500 line-through decoration-1"
                            : "text-sffl-navy dark:text-white hover:text-sffl-red dark:hover:text-sffl-red"
                        }`}
                      >
                        {player.name}
                      </Link>
                      {isDeletedPlayer(player) && (
                        <span
                          title={DELETED_TITLE}
                          className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-gray-100 text-gray-500 border border-gray-300 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600"
                        >
                          Deleted
                        </span>
                      )}
                      {player.jersey_number > 0 && (
                        <span className="bg-sffl-red/10 text-sffl-red px-2 py-0.5 rounded-md text-xs font-black">
                          #{player.jersey_number}
                        </span>
                      )}
                      <span className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded-md text-xs font-extrabold uppercase">
                        {player.position}
                      </span>
                      {player.secondary_position && (
                        <span className="bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 px-2 py-0.5 rounded-md text-xs font-extrabold uppercase">
                          Sec: {player.secondary_position}
                        </span>
                      )}
                      {player.gender && (
                        <span
                          className={`px-2 py-0.5 rounded-md text-[11px] font-extrabold ${
                            player.gender === "F"
                              ? "bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300"
                              : "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                          }`}
                        >
                          {player.gender === "F" ? "Female (F)" : "Male (M)"}
                        </span>
                      )}
                      {player.tier && player.tier !== "Prospect" && (
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-black uppercase tracking-wider border ${
                            player.tier === "Superstar"
                              ? "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800"
                              : player.tier === "Star"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
                                : "bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800"
                          }`}
                        >
                          {player.tier === "Superstar" ? (
                            <CrownIcon className="w-3.5 h-3.5" />
                          ) : player.tier === "Star" ? (
                            <StarSolidIcon
                              className="w-3.5 h-3.5"
                              aria-hidden="true"
                            />
                          ) : (
                            <ShieldCheckIcon
                              className="w-3.5 h-3.5"
                              aria-hidden="true"
                            />
                          )}
                          {player.tier === "Superstar"
                            ? "Superstar"
                            : player.tier === "Star"
                              ? "Star"
                              : "Starter"}
                        </span>
                      )}
                      {(player.mvp_count ?? 0) > 0 && (
                        <span className="inline-flex items-center gap-1 bg-yellow-50 text-yellow-800 border border-yellow-300 dark:bg-yellow-950/40 dark:text-yellow-300 dark:border-yellow-700 px-2 py-0.5 rounded-md text-xs font-black">
                          <TrophyIcon className="w-3.5 h-3.5" aria-hidden="true" />
                          {player.mvp_count} MVP
                          {player.mvp_count === 1 ? "" : "s"}
                        </span>
                      )}
                      {player.team?.name && (
                        <span className="inline-flex items-center gap-1.5 max-w-full min-w-0 px-2.5 py-0.5 bg-gray-50 dark:bg-gray-700/60 border border-gray-200 dark:border-gray-600 rounded-md text-xs font-bold text-gray-700 dark:text-gray-200">
                          {player.team.logo && (
                            <img
                              src={player.team.logo}
                              alt=""
                              className="w-3.5 h-3.5 rounded-full object-cover"
                            />
                          )}
                          <span className="truncate">{player.team.name}</span>
                        </span>
                      )}
                    </div>

                    {player.bio && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1 italic">
                        "{player.bio}"
                      </p>
                    )}
                  </div>
                </div>

                {/* Link Action */}
                <div className="flex items-center self-start sm:self-auto shrink-0">
                  <Link
                    to={profileUrl}
                    className="flex items-center gap-1.5 min-h-11 text-xs sm:text-sm font-bold text-sffl-red hover:text-[#A52323] px-3.5 py-2 rounded-xl bg-sffl-red/5 hover:bg-sffl-red/10 dark:bg-sffl-red/10 dark:hover:bg-sffl-red/20 border border-sffl-red/20 transition-all group"
                  >
                    <span>View Profile</span>
                    <ArrowRightIcon
                      className="w-4 h-4 group-hover:translate-x-1 transition-transform"
                      aria-hidden="true"
                    />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Infinite Scroll Loader */}
      {playersLoadingMore && (
        <Spinner size="sm" label="Loading more players…" className="py-6" />
      )}

      {!hasMore && players.length > 0 && (
        <div className="text-center py-6 text-gray-400 font-medium">
          No more players to load.
        </div>
      )}
    </div>
  );
};
