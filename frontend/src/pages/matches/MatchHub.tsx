import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  getCompetitions,
  getMatches,
  getStandings,
  getTeams,
  sortCompetitionsBySeason,
  dropdownCompetitionsFor,
} from "../../services/api";
import type { PaginatedResponse, Match, Competition } from "../../types";
import { Loader, Button, ButtonLink, Field, Select, Spinner, MatchCard, MatchStandingsTable, BracketView, CompactMatchesWidget, SeasonStageTabs, FootballIcon } from "../../components";
import { lagosToday } from "../../utils";
import {
  ChevronDownIcon,
  TrophyIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

// The server returns an unfiltered match list oldest-first, so the newest
// matches would sit on the last page of the infinite scroll. The "All" tab
// loads the whole competition in one request and reorders it here instead.
const ALL_TAB_LIMIT = 500;

export const MatchHub = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const compParam = searchParams.get("comp");
  const teamParam = searchParams.get("team");

  // The competition filter is NOT persisted across visits — we always
  // recompute the default from the most recent match so users land on the
  // active stage, not whatever they last picked. The status filter still
  // persists within the tab since it's a personal preference.
  const [selectedCompetitionId, setSelectedCompetitionId] =
    useState<string>("");
  const [statusFilter, setStatusFilter] = useState<
    "ALL" | "LIVE" | "FINISHED" | "SCHEDULED"
  >(() => {
    return (
      (sessionStorage.getItem("sffl_matches_status") as
        | "ALL"
        | "LIVE"
        | "FINISHED"
        | "SCHEDULED"
        | null) || "ALL"
    );
  });
  const [collapsedDates, setCollapsedDates] = useState<Record<string, boolean>>(
    {},
  );
  const navigate = useNavigate();

  useEffect(() => {
    sessionStorage.setItem("sffl_matches_status", statusFilter);
  }, [statusFilter]);

  // When the page is opened via /matches?team=X (e.g. from a Team Hub
  // quick-link), look up the team so we can label the active filter.
  const { data: teamsLookupData } = useQuery({
    queryKey: ["publicTeamsLookup"],
    queryFn: () => getTeams(1, 100),
    enabled: !!teamParam,
  });
  const filterTeam = teamParam
    ? teamsLookupData?.data?.find((t) => t.id === teamParam)
    : undefined;

  const clearTeamFilter = () => {
    const params = new URLSearchParams(searchParams);
    params.delete("team");
    setSearchParams(params, { replace: true });
  };

  const { data: competitionsData, isLoading: loadingComps } = useQuery({
    queryKey: ["publicCompetitions"],
    queryFn: () => getCompetitions(1, 100),
  });
  const competitions = sortCompetitionsBySeason(
    (competitionsData?.data || []).filter((c) => c.status !== "inactive"),
  );
  const leagueComps = competitions.filter(
    (c) => (c.format || "SEASON") === "SEASON",
  );
  const selectedComp = competitions.find((c) => c.id === selectedCompetitionId);

  const dropdownComps = dropdownCompetitionsFor(competitions, selectedComp);

  // Anchor the default selection to the most recently PLAYED match's
  // competition (FINISHED only). Without the status filter, future scheduled
  // playoff matches would be "newer" than the regular season's last result,
  // so the page would switch to the playoffs before any playoff is played.
  const { data: latestMatchPage, isFetched: latestMatchFetched } = useQuery({
    queryKey: ["publicLatestMatchForDefault"],
    queryFn: () => getMatches(undefined, 1, 1, "FINISHED"),
    staleTime: 60_000,
  });
  const latestMatchCompetitionId = latestMatchPage?.data?.[0]?.competition?.id;

  // Seed once on mount: honor ?comp= from the URL (e.g. "View All" from the
  // home page) when valid; otherwise pick the competition of the most recent
  // match; finally fall back to the first active competition. After seeding
  // we never override the user's manual dropdown choice.
  useEffect(() => {
    if (competitions.length === 0) return;

    const timer = setTimeout(() => {
      // If URL has a specific compParam, always prioritize it.
      if (compParam && competitions.some((c) => c.id === compParam)) {
        if (selectedCompetitionId !== compParam) {
          setSelectedCompetitionId(compParam);
        }
        return;
      }

      // Otherwise, if we already have a selected competition, do nothing.
      if (selectedCompetitionId) return;

      let initialCompId = "";
      if (latestMatchFetched) {
        if (
          latestMatchCompetitionId &&
          competitions.some((c) => c.id === latestMatchCompetitionId)
        ) {
          initialCompId = latestMatchCompetitionId;
        } else {
          initialCompId = leagueComps[0]?.id || competitions[0]?.id;
        }
      }

      if (initialCompId) {
        setSelectedCompetitionId(initialCompId);
        const params = new URLSearchParams(searchParams);
        params.set("comp", initialCompId);
        setSearchParams(params, { replace: true });
      }
    }, 0);

    return () => clearTimeout(timer);
  }, [
    competitions,
    selectedCompetitionId,
    compParam,
    latestMatchFetched,
    latestMatchCompetitionId,
    leagueComps,
    searchParams,
    setSearchParams,
  ]);

  const selectedCompetition = competitions.find(
    (c) => c.id === selectedCompetitionId,
  );
  const isCompleted = selectedCompetition?.status === "completed";
  const compFormat = (selectedCompetition?.format || "SEASON").toUpperCase();
  // Playoffs competitions show the bracket instead of standings.
  const isKnockout = compFormat === "PLAYOFFS";
  const isPreseason = compFormat === "PRESEASON";
  const isCup = compFormat === "CUP";
  const isMatchesOnly = isPreseason || isCup;

  const { data: standingsData, isLoading: standingsLoading } = useQuery({
    queryKey: ["publicStandings", selectedCompetitionId],
    queryFn: () => getStandings(selectedCompetitionId),
    enabled: !!selectedCompetitionId && !isKnockout && !isMatchesOnly,
  });
  const standings = standingsData || [];

  const {
    data: infiniteMatchesData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage: matchesLoading,
    isLoading: initialMatchesLoading,
  } = useInfiniteQuery({
    queryKey: [
      "publicMatchesInfinite",
      selectedCompetitionId,
      statusFilter,
      teamParam,
    ],
    queryFn: ({ pageParam = 1 }) =>
      getMatches(
        selectedCompetitionId,
        pageParam as number,
        statusFilter === "ALL" ? ALL_TAB_LIMIT : 10,
        statusFilter === "ALL" ? undefined : statusFilter,
        undefined,
        teamParam || undefined,
      ),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.total_pages) return undefined;
      return allPages.length < lastPage.total_pages
        ? allPages.length + 1
        : undefined;
    },
    enabled: !!selectedCompetitionId,
  });

  // No client-side team filtering: ?team= is pushed into the query above. Doing
  // it here meant a club's fixtures were spread across pages that were never
  // fetched — and with the visible list too short to scroll, the infinite-scroll
  // observer never fired to fetch them.
  //
  // The "All" tab reads most-recent-first: today and past match days newest
  // first, then upcoming fixtures soonest first.
  const matches = useMemo(() => {
    const loaded =
      infiniteMatchesData?.pages?.reduce(
        (acc: Match[], p: PaginatedResponse<Match>) =>
          acc.concat(p?.data || []),
        [],
      ) || [];
    if (statusFilter !== "ALL") return loaded;

    const today = lagosToday();
    const day = (m: Match) => m.date.substring(0, 10);
    return [...loaded].sort((a, b) => {
      const da = day(a);
      const db = day(b);
      const aUpcoming = da > today;
      const bUpcoming = db > today;
      if (aUpcoming !== bUpcoming) return aUpcoming ? 1 : -1;
      // Same day: keep the server's kickoff order (sort is stable).
      if (da === db) return 0;
      return aUpcoming ? da.localeCompare(db) : db.localeCompare(da);
    });
  }, [infiniteMatchesData, statusFilter]);
  const hasMore = hasNextPage;
  const loading = loadingComps || initialMatchesLoading;

  // Intersection Observer callback ref
  const observer = useRef<IntersectionObserver | null>(null);
  const lastMatchElementRef = useCallback(
    (node: HTMLDivElement) => {
      if (matchesLoading) return;

      if (observer.current) observer.current.disconnect();
      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasNextPage) {
          fetchNextPage();
        }
      });

      if (node) observer.current.observe(node);
    },
    [matchesLoading, hasNextPage, fetchNextPage],
  );

  const handleCompetitionChange = (compId: string) => {
    setSelectedCompetitionId(compId);
    const params = new URLSearchParams(searchParams);
    params.set("comp", compId);
    setSearchParams(params, { replace: true });
  };

  const toggleDateCollapse = (date: string) => {
    setCollapsedDates((prev) => ({
      ...prev,
      [date]: !prev[date],
    }));
  };

  // Grouping Matches by Date (assuming match.date is formatted logically e.g., 'YYYY-MM-DD' or similar)
  const groupedMatches = matches.reduce(
    (acc: Record<string, Match[]>, match: Match) => {
      const dateStr = match.date.substring(0, 10);
      if (!acc[dateStr]) acc[dateStr] = [];
      acc[dateStr].push(match);
      return acc;
    },
    {},
  );

  if (loading && competitions.length === 0) return <Loader />;

  return (
    <div className="space-y-4 md:space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 bg-sffl-navy text-white p-4 md:p-8 rounded-xl md:rounded-2xl shadow-xl">
        <div className="min-w-0">
          <h1 className="text-3xl md:text-5xl font-black italic tracking-tighter">
            MATCH HUB
          </h1>
          <p className="text-gray-300 mt-2 text-sm md:text-lg">
            Scores, Fixtures & Standings
          </p>
          <div className="mt-4 lg:hidden">
            <ButtonLink
              to={`/standings?comp=${selectedCompetitionId}`}
              variant="secondary"
              tone="dark"
              size="sm"
              icon={isKnockout || isMatchesOnly ? FootballIcon : TrophyIcon}
            >
              {isKnockout
                ? "View Playoff Bracket"
                : isPreseason
                  ? "View Preseason Games"
                  : isCup
                    ? "View Cup Matches"
                    : "View Full Standings"}
            </ButtonLink>
          </div>
        </div>

        {/* Competition Selector — picks which competition/season. The
                    Season|Playoffs toggle now lives in the content area below. */}
        {competitions.length > 0 && (
          <Field
            label="Competition"
            htmlFor="match-hub-competition"
            tone="dark"
            className="w-full md:w-70 shrink-0"
          >
            <Select
              id="match-hub-competition"
              tone="dark"
              value={selectedCompetitionId}
              onChange={(e) => handleCompetitionChange(e.target.value)}
            >
              {dropdownComps.map((c: Competition) => (
                <option key={c.id} value={c.id}>
                  {c.name}{" "}
                  {c.status && !["active", "completed"].includes(c.status)
                    ? `[${c.status.toUpperCase()}]`
                    : ""}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </div>

      {filterTeam && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-sffl-red/10 border border-sffl-red/30 text-sffl-red dark:bg-sffl-red/20 dark:text-white px-4 py-2 rounded-xl">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 min-w-0 text-xs md:text-sm font-bold uppercase tracking-wider">
            <span>Filtering matches for</span>
            <span className="font-black">{filterTeam.name}</span>
          </div>
          <Button variant="primary" size="sm" icon={XMarkIcon} iconPosition="right" onClick={clearTeamFilter}>
            Clear
          </Button>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Matches (2/3 width) */}
        <div className="lg:col-span-2 space-y-6">
          <SeasonStageTabs
            competitions={competitions}
            currentId={selectedCompetitionId}
            onChange={handleCompetitionChange}
          />
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="text-xl sm:text-2xl font-bold text-sffl-navy dark:text-white flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full bg-sffl-red shrink-0"
                aria-hidden="true"
              />
              Fixtures & Results
            </h2>

            {/* Status Filter */}
            <div className="bg-gray-100 dark:bg-gray-800 p-1 rounded-lg flex gap-1 w-full sm:w-auto">
              {(["ALL", "LIVE", "FINISHED", "SCHEDULED"] as const).map((f) => (
                <Button
                  key={f}
                  size="sm"
                  variant={statusFilter === f ? "navy" : "ghost"}
                  className="flex-1 sm:flex-none"
                  aria-pressed={statusFilter === f}
                  onClick={() => setStatusFilter(f)}
                >
                  {f === "SCHEDULED" ? "UPCOMING" : f}
                </Button>
              ))}
            </div>
          </div>

          {initialMatchesLoading ? (
            <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl shadow-sm">
              <Spinner label="Loading matches…" className="py-16" />
            </div>
          ) : matches.length === 0 && !matchesLoading ? (
            <div className="bg-gray-100 dark:bg-gray-800 p-6 sm:p-12 rounded-xl text-center">
              <FootballIcon
                className="w-10 h-10 mx-auto mb-3 text-gray-400"
                aria-hidden="true"
              />
              <p className="text-gray-500 text-base sm:text-lg font-semibold">
                No matches found for this filter.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedMatches).map(
                ([dateStr, dayMatches]: [string, Match[]], groupIndex) => (
                  <div
                    key={dateStr}
                    className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm"
                  >
                    <button
                      type="button"
                      onClick={() => toggleDateCollapse(dateStr)}
                      aria-expanded={!collapsedDates[dateStr]}
                      className="w-full flex items-center justify-between gap-2 p-3 sm:p-4 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors border-b border-gray-100 dark:border-gray-700/50"
                    >
                      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                        <span className="font-bold text-gray-500 dark:text-gray-400 text-base sm:text-lg">
                          {new Date(dateStr).getFullYear()}
                        </span>
                        <div className="bg-sffl-navy text-white w-10 h-10 shrink-0 rounded-lg flex flex-col items-center justify-center font-bold">
                          <span className="text-xs tracking-wider uppercase">
                            {new Date(dateStr).toLocaleString("default", {
                              month: "short",
                            })}
                          </span>
                          <span className="text-sm leading-none">
                            {new Date(dateStr).getDate()}
                          </span>
                        </div>
                        <span className="font-bold text-gray-800 dark:text-gray-200 text-base sm:text-lg truncate">
                          {new Date(dateStr).toLocaleDateString("default", {
                            weekday: "long",
                          })}
                        </span>
                      </div>
                      <div className="text-gray-400 dark:text-gray-500 bg-white dark:bg-gray-700 w-8 h-8 shrink-0 rounded-full flex items-center justify-center shadow-sm">
                        <ChevronDownIcon
                          className={`w-5 h-5 transition-transform duration-200 ${collapsedDates[dateStr] ? "rotate-180" : ""}`}
                          strokeWidth={2.5}
                          aria-hidden="true"
                        />
                      </div>
                    </button>

                    {!collapsedDates[dateStr] && (
                      <div className="p-3 sm:p-4 grid grid-cols-1 gap-4">
                        {dayMatches.map((match: Match, index: number) => {
                          // Check if this is the absolute last match globally to attach the infinite scroll ref
                          const isLastOverall =
                            groupIndex ===
                              Object.keys(groupedMatches).length - 1 &&
                            index === dayMatches.length - 1;

                          return (
                            <div
                              ref={isLastOverall ? lastMatchElementRef : null}
                              key={match.id}
                            >
                              <MatchCard
                                match={match}
                                onClick={() => {
                                  const params = new URLSearchParams();
                                  if (selectedCompetitionId)
                                    params.set("comp", selectedCompetitionId);
                                  if (teamParam) params.set("team", teamParam);
                                  navigate(
                                    `/matches/${match.id}?${params.toString()}`,
                                  );
                                }}
                              />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ),
              )}
            </div>
          )}

          {/* Infinite Scroll Loader */}
          {matchesLoading && (
            <Spinner size="sm" label="Loading more matches…" className="py-6" />
          )}

          {!hasMore && matches.length > 0 && (
            <div className="text-center py-6 text-gray-400 font-medium">
              No more matches to load.
            </div>
          )}
        </div>

        {/* Right Column: Standings, Bracket, or Matches Widget (1/3 width) — sticky sidebar */}
        <div className="hidden lg:block lg:col-span-1 lg:sticky lg:top-[calc(var(--chrome-h,8rem)+1rem)] self-start space-y-6">
          {isKnockout ? (
            <div className="space-y-6">
              <BracketView
                competitionId={selectedCompetitionId}
                compact
                viewAllLink={`/standings?comp=${selectedCompetitionId}`}
              />

              <div className="bg-linear-to-br from-purple-600 to-indigo-700 rounded-xl p-6 text-white shadow-lg">
                <h3 className="text-xl font-bold mb-2">Join the Action!</h3>
                <p className="text-sm text-purple-100 mb-4">
                  Don't miss a single moment of the SFFL season.
                </p>
                <ButtonLink to="/tickets" variant="navy" tone="dark" fullWidth>
                  Get Tickets
                </ButtonLink>
              </div>
            </div>
          ) : isMatchesOnly ? (
            <div className="space-y-6">
              <CompactMatchesWidget
                competitionId={selectedCompetitionId}
                title={
                  isPreseason
                    ? "Preseason Matches"
                    : isCup
                      ? "Cup Matches"
                      : "Matches"
                }
                viewAllLink={`/standings?comp=${selectedCompetitionId}`}
              />

              <div className="bg-linear-to-br from-purple-600 to-indigo-700 rounded-xl p-6 text-white shadow-lg">
                <h3 className="text-xl font-bold mb-2">Join the Action!</h3>
                <p className="text-sm text-purple-100 mb-4">
                  Don't miss a single moment of the SFFL season.
                </p>
                <ButtonLink to="/tickets" variant="navy" tone="dark" fullWidth>
                  Get Tickets
                </ButtonLink>
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
                isPlayoffs={selectedComp?.format === "PLAYOFFS"}
                viewAllLink={`/standings?comp=${selectedCompetitionId}`}
              />

              <div className="bg-linear-to-br from-purple-600 to-indigo-700 rounded-xl p-6 text-white shadow-lg">
                <h3 className="text-xl font-bold mb-2">Join the Action!</h3>
                <p className="text-sm text-purple-100 mb-4">
                  Don't miss a single moment of the SFFL season.
                </p>
                <ButtonLink to="/tickets" variant="navy" tone="dark" fullWidth>
                  Get Tickets
                </ButtonLink>
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
