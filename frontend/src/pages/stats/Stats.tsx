import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getCompetitions,
  getPlayerStats,
  getTeamStats,
  getStatDates,
  getTeams,
  sortCompetitionsBySeason,
  dropdownCompetitionsFor,
} from "../../services/api";
import type { Competition } from "../../types/matches";
import { Button, Field, IconButton, Input, Select, Tabs } from "../../components/ui";
import { Loader } from "../../components/ui/Loader";
import { StatsTable } from "../../components/stats/StatsTable";
import { SeasonStageTabs } from "../../components/domain/SeasonStageTabs";
import { useSearchParams } from "react-router-dom";
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  InformationCircleIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { FootballIcon } from "../../components/icons/FootballIcon";

export const Stats = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlComp = searchParams.get("comp");
  const urlDate = searchParams.get("date");
  const urlPlayerId = searchParams.get("player_id");
  const urlSearch = searchParams.get("search");
  const urlTeam = searchParams.get("team");
  const urlTab = searchParams.get("tab");
  const urlPos = searchParams.get("pos");

  const [selectedCompetitionId, setSelectedCompetitionId] = useState<string>(
    () => {
      return urlComp || sessionStorage.getItem("sffl_stats_comp") || "";
    },
  );
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return urlDate || sessionStorage.getItem("sffl_stats_date") || "";
  });
  const [searchQuery, setSearchQuery] = useState(() => {
    return urlSearch || sessionStorage.getItem("sffl_stats_search") || "";
  });
  const [positionFilter, setPositionFilter] = useState<string>(() => {
    return urlPos || "QB";
  });
  const [activeTab, setActiveTab] = useState<"players" | "teams">(() => {
    const storedTab = sessionStorage.getItem("sffl_stats_tab");
    if (urlTab === "teams" || urlTab === "players") return urlTab;
    if (storedTab === "teams" || storedTab === "players") return storedTab;
    return "players";
  });
  const urlState = JSON.stringify([
    urlComp,
    urlDate,
    urlSearch,
    urlTab,
    urlPos,
  ]);
  const [previousUrlState, setPreviousUrlState] = useState(urlState);
  if (urlState !== previousUrlState) {
    setPreviousUrlState(urlState);
    if (urlComp && urlComp !== selectedCompetitionId)
      setSelectedCompetitionId(urlComp);
    if (urlDate !== null && urlDate !== selectedDate) setSelectedDate(urlDate);
    if (urlSearch !== null && urlSearch !== searchQuery)
      setSearchQuery(urlSearch);
    if (urlPos !== null && urlPos !== positionFilter)
      setPositionFilter(urlPos || "QB");

    const targetTab = urlTab === "teams" ? "teams" : "players";
    if (urlTab && targetTab !== activeTab) setActiveTab(targetTab);
  }
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState("");
  const [showLegend, setShowLegend] = useState(false);
  const limit = 20;

  const handleSortChange = (key: string) => {
    setSortBy(key);
    setPage(1);
  };

  const handleTabChange = (tab: "players" | "teams") => {
    setActiveTab(tab);
    setSortBy("");
    setPage(1);
    const params = new URLSearchParams(searchParams);
    params.set("tab", tab);
    setSearchParams(params, { replace: true });
  };

  // Persist filters to sessionStorage on change
  useEffect(() => {
    sessionStorage.setItem("sffl_stats_comp", selectedCompetitionId);
  }, [selectedCompetitionId]);

  useEffect(() => {
    sessionStorage.setItem("sffl_stats_date", selectedDate);
  }, [selectedDate]);

  useEffect(() => {
    sessionStorage.setItem("sffl_stats_search", searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    sessionStorage.setItem("sffl_stats_tab", activeTab);
  }, [activeTab]);

  // Sync restored/default state back to URL parameters if they are missing
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    let updated = false;

    if (selectedCompetitionId && !params.has("comp")) {
      params.set("comp", selectedCompetitionId);
      updated = true;
    }
    if (selectedDate && !params.has("date")) {
      params.set("date", selectedDate);
      updated = true;
    }
    if (searchQuery && !params.has("search")) {
      params.set("search", searchQuery);
      updated = true;
    }
    if (positionFilter && !params.has("pos")) {
      params.set("pos", positionFilter);
      updated = true;
    }
    if (activeTab && !params.has("tab")) {
      params.set("tab", activeTab);
      updated = true;
    }

    if (updated) {
      setSearchParams(params, { replace: true });
    }
  }, [
    selectedCompetitionId,
    selectedDate,
    searchQuery,
    positionFilter,
    activeTab,
    searchParams,
    setSearchParams,
  ]);

  const { data: competitionsData, isLoading: compLoading } = useQuery({
    queryKey: ["publicCompetitions"],
    queryFn: () => getCompetitions(1, 100),
  });
  const competitions = sortCompetitionsBySeason(
    (competitionsData?.data || []).filter((c) => c.status !== "inactive"),
  );
  const selectedComp = competitions.find((c) => c.id === selectedCompetitionId);

  const dropdownComps = dropdownCompetitionsFor(competitions, selectedComp);

  const handleCompChange = (compId: string) => {
    setSelectedCompetitionId(compId);
    setSelectedDate("");
    const params = new URLSearchParams(searchParams);
    if (compId) params.set("comp", compId);
    else params.delete("comp");
    params.delete("date");
    setSearchParams(params, { replace: true });
  };

  const { data: datesData, isLoading: datesLoading } = useQuery({
    queryKey: ["statDates", selectedCompetitionId],
    queryFn: () => getStatDates(selectedCompetitionId),
  });
  const statDates = datesData || [];

  const { data: playerStatsPagination, isLoading: loadingPlayers } = useQuery({
    queryKey: [
      "playerStatsFiltered",
      selectedCompetitionId,
      selectedDate,
      page,
      urlPlayerId,
      searchQuery,
      sortBy,
      urlTeam,
      positionFilter,
    ],
    queryFn: () =>
      getPlayerStats(
        selectedCompetitionId,
        selectedDate,
        page,
        limit,
        urlPlayerId || undefined,
        searchQuery || undefined,
        sortBy || undefined,
        urlTeam || undefined,
        positionFilter || undefined,
      ),
    enabled: activeTab === "players",
  });

  const { data: teamStatsPagination, isLoading: loadingTeams } = useQuery({
    queryKey: [
      "teamStatsFiltered",
      selectedCompetitionId,
      selectedDate,
      page,
      sortBy,
      urlTeam,
    ],
    queryFn: () =>
      getTeamStats(
        selectedCompetitionId,
        selectedDate,
        page,
        limit,
        sortBy || undefined,
        urlTeam || undefined,
      ),
    enabled: activeTab === "teams",
  });

  const loading =
    compLoading ||
    datesLoading ||
    (activeTab === "players" ? loadingPlayers : loadingTeams);

  const pagination =
    activeTab === "players" ? playerStatsPagination : teamStatsPagination;
  const playerStats = playerStatsPagination?.data || [];
  const teamStats = teamStatsPagination?.data || [];
  const totalPages = pagination?.total_pages || 0;
  const totalItems = pagination?.total || 0;

  // Look up all teams for the dropdown selector
  const { data: teamsLookupData } = useQuery({
    queryKey: ["publicTeamsLookup"],
    queryFn: () => getTeams(1, 100),
  });
  const teamsList = teamsLookupData?.data || [];
  const filterTeam = urlTeam
    ? teamsList.find((t) => t.id === urlTeam)
    : undefined;

  const handleTeamChange = (teamId: string) => {
    setPage(1);
    const params = new URLSearchParams(searchParams);
    if (teamId) {
      params.set("team", teamId);
    } else {
      params.delete("team");
    }
    setSearchParams(params, { replace: true });
  };

  const clearTeamFilter = () => {
    handleTeamChange("");
  };

  return (
    <div className="space-y-4 md:space-y-8">
      {/* Header */}
      <div className="flex flex-col xl:flex-row items-start xl:items-center bg-sffl-navy text-white p-4 md:p-8 rounded-xl md:rounded-2xl shadow-xl gap-5 md:gap-8 xl:gap-12">
        <div className="xl:shrink-0 min-w-0">
          <h1 className="text-3xl md:text-5xl font-black italic tracking-tighter uppercase">
            League Stats
          </h1>
          <p className="text-gray-300 mt-0.5 text-xs md:text-lg">
            Player & Team Performance
          </p>
        </div>

        {/* Filters Group */}
        <div className="flex flex-col md:flex-row md:items-end gap-4 md:gap-6 w-full xl:w-auto">
          <div
            className={`w-full md:w-auto min-w-0 overflow-visible transition-opacity duration-300 ${activeTab === "players" ? "opacity-100" : "opacity-0 pointer-events-none"}`}
          >
            <Field label="Search Players" htmlFor="stats-player-search" tone="dark">
              <Input
                id="stats-player-search"
                type="text"
                tone="dark"
                icon={MagnifyingGlassIcon}
                placeholder="Player name..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                  const params = new URLSearchParams(searchParams);
                  if (e.target.value) {
                    params.set("search", e.target.value);
                  } else {
                    params.delete("search");
                    params.delete("player_id");
                  }
                  setSearchParams(params, { replace: true });
                }}
                className="md:min-w-60"
                action={
                  searchQuery ? (
                    <IconButton
                      tone="dark"
                      variant="ghost"
                      icon={XMarkIcon}
                      label="Clear search"
                      className="h-full"
                      onClick={() => {
                        setSearchQuery("");
                        setPage(1);
                        const params = new URLSearchParams(searchParams);
                        params.delete("search");
                        params.delete("player_id");
                        setSearchParams(params, { replace: true });
                      }}
                    />
                  ) : undefined
                }
              />
            </Field>
          </div>

          <div className="w-full flex flex-col gap-2 md:w-50">
            <div className="w-full">
              <Field label="Competition" htmlFor="stats-competition" tone="dark">
                <Select
                  id="stats-competition"
                  tone="dark"
                  value={selectedCompetitionId}
                  onChange={(e) => handleCompChange(e.target.value)}
                >
                  <option value="" className="text-black bg-white">
                    All Competitions
                  </option>
                  {dropdownComps.map((c: Competition) => (
                    <option
                      key={c.id}
                      value={c.id}
                      className="text-black bg-white"
                    >
                      {c.name}{" "}
                      {c.status && !["active", "completed"].includes(c.status)
                        ? `[${c.status.toUpperCase()}]`
                        : ""}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </div>

          <div
            className={`w-full md:w-auto transition-opacity duration-300 ${!selectedCompetitionId ? "opacity-40" : "opacity-100"}`}
          >
            <Field label="Event Day" htmlFor="stats-event-day" tone="dark">
              <Select
                id="stats-event-day"
                tone="dark"
                value={selectedDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  const params = new URLSearchParams(searchParams);
                  params.set("date", e.target.value);
                  setSearchParams(params, { replace: true });
                }}
                disabled={!selectedCompetitionId}
                className="md:min-w-37.5"
              >
                <option value="" className="text-black bg-white">
                  All Event Days
                </option>
                {statDates.map((date: string) => (
                  <option
                    key={date}
                    value={date}
                    className="text-black bg-white"
                  >
                    {date}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </div>
      </div>

      {filterTeam && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-sffl-red/10 border border-sffl-red/30 text-sffl-red dark:bg-sffl-red/20 dark:text-white px-4 py-2 rounded-xl">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 min-w-0 text-xs md:text-sm font-bold uppercase tracking-wider">
            <span>Filtering stats for</span>
            <span className="font-black">{filterTeam.name}</span>
          </div>
          <Button
            variant="secondary"
            size="sm"
            icon={XMarkIcon}
            iconPosition="right"
            onClick={clearTeamFilter}
          >
            Clear
          </Button>
        </div>
      )}

      {/* Season | Playoffs toggle for the selected competition */}
      <SeasonStageTabs
        competitions={competitions}
        currentId={selectedCompetitionId}
        onChange={handleCompChange}
      />

      {/* Tabs */}
      <Tabs
        aria-label="Stats view"
        items={[
          { value: "players", label: "Player Stats" },
          { value: "teams", label: "Team Stats" },
        ]}
        value={activeTab}
        onChange={handleTabChange}
      />

      {/* Content */}
      {loading && !playerStats && !teamStats ? (
        <Loader />
      ) : (
        <div className="space-y-4">
          {/* Legend / Key - Pro Style (Togglable) */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
            <button
              type="button"
              aria-expanded={showLegend}
              className="w-full min-h-11 p-4 flex items-center justify-between gap-3 text-left cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              onClick={() => setShowLegend(!showLegend)}
            >
              <span className="flex items-center gap-2">
                <InformationCircleIcon
                  className="w-5 h-5 text-sffl-red"
                  aria-hidden="true"
                />
                <span className="font-black text-xs md:text-sm text-sffl-navy dark:text-white uppercase tracking-wider">
                  Statistical Key
                </span>
              </span>
              <span className="inline-flex items-center gap-1 shrink-0 text-[11px] font-black uppercase tracking-tight text-sffl-red">
                {showLegend ? "Close Info" : "See Info"}
                {showLegend ? (
                  <ChevronUpIcon className="w-3.5 h-3.5" aria-hidden="true" />
                ) : (
                  <ChevronDownIcon className="w-3.5 h-3.5" aria-hidden="true" />
                )}
              </span>
            </button>

            {showLegend && (
              <div className="p-4 sm:p-6 pt-0 sm:pt-0 border-t border-gray-50 dark:border-gray-700">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 py-4">
                  {/* Category: General */}
                  <div className="space-y-2">
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-l-2 border-gray-200 pl-2">
                      General
                    </h4>
                    <div className="flex flex-wrap gap-2 text-[10px] font-bold">
                      <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-700/50 px-2 py-1 rounded-full border border-gray-100 dark:border-gray-600">
                        <span className="text-sffl-red">APPS:</span>{" "}
                        <span className="text-gray-600 dark:text-gray-300">
                          Appearances
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Category: Passing */}
                  <div className="space-y-2">
                    <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-widest border-l-2 border-blue-200 pl-2">
                      Passing
                    </h4>
                    <div className="flex flex-wrap gap-2 text-[10px] font-bold">
                      {[
                        { a: "Passing ATT", f: "Pass Attempts" },
                        { a: "Passing COMP", f: "Pass Completions" },
                        { a: "Passing TDs", f: "Passing Touchdowns" },
                        { a: "Passing INT", f: "Interceptions Thrown" },
                        { a: "QB Sacks", f: "QB Sacks Accounted" },
                      ].map((s) => (
                        <div
                          key={s.a}
                          className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded-full border border-blue-100 dark:border-blue-800"
                        >
                          <span className="text-blue-600"> {s.a}:</span>{" "}
                          <span className="text-blue-800/80 dark:text-blue-300/80">
                            {s.f}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Category: Rushing & Receiving */}
                  <div className="space-y-2">
                    <h4 className="text-[10px] font-black text-green-400 uppercase tracking-widest border-l-2 border-green-200 pl-2">
                      Offense
                    </h4>
                    <div className="flex flex-wrap gap-2 text-[10px] font-bold">
                      {[
                        { a: "Rush ATT", f: "Rush Attempts", c: "green" },
                        { a: "Rush TDs", f: "Rushing Touchdowns", c: "green" },
                        { a: "Rec", f: "Receptions", c: "yellow" },
                        { a: "RC TDs", f: "Receiving Touchdowns", c: "yellow" },
                        { a: "Drops", f: "Drops", c: "yellow" },
                        {
                          a: "X-Pts TDs",
                          f: "Extra Point Touchdowns",
                          c: "purple",
                        },
                      ].map((s) => (
                        <div
                          key={s.a}
                          className={`flex items-center gap-1.5 bg-${s.c}-50 dark:bg-${s.c}-900/20 px-2 py-1 rounded-full border border-${s.c}-100 dark:border-${s.c}-800`}
                        >
                          <span className={`text-${s.c}-600`}> {s.a}:</span>{" "}
                          <span
                            className={`text-${s.c}-800/80 dark:text-${s.c}-300/80`}
                          >
                            {s.f}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Category: Defense */}
                  <div className="space-y-2">
                    <h4 className="text-[10px] font-black text-red-400 uppercase tracking-widest border-l-2 border-red-200 pl-2">
                      Defense
                    </h4>
                    <div className="flex flex-wrap gap-2 text-[10px] font-bold">
                      {[
                        { a: "Flag Pulls", f: "Flag Pulls (Tackles)" },
                        { a: "Pass Defl", f: "Pass Deflections" },
                        { a: "Def INT", f: "Interceptions Caught" },
                        { a: "Def Sacks", f: "Defensive Sacks" },
                        { a: "Def TDs", f: "Defensive Touchdowns" },
                        {
                          a: "Def XP TDs",
                          f: "Defensive Extra-Point TDs (INT returned on an extra point)",
                        },
                        { a: "Safety", f: "Safeties" },
                      ].map((s) => (
                        <div
                          key={s.a}
                          className="flex items-center gap-1.5 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded-full border border-red-100 dark:border-red-800"
                        >
                          <span className="text-red-600"> {s.a}:</span>{" "}
                          <span className="text-red-800/80 dark:text-red-300/80">
                            {s.f}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Position Filter Pills (When Player Stats Tab is Active) */}
          {activeTab === "players" && (
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide py-1 bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
              <span className="text-xs font-black uppercase tracking-wider text-gray-400 dark:text-gray-400 shrink-0 mr-1 flex items-center gap-1.5">
                <FootballIcon className="w-4 h-4" aria-hidden="true" />
                Position:
              </span>
              {[
                { id: "QB", label: "Quarterbacks (QB)" },
                { id: "REC", label: "Receivers / Centers (REC)" },
                { id: "RUSH", label: "Rushers (RUSH)" },
                { id: "DEF", label: "Defenders (DEF)" },
                { id: "ALLROUNDER", label: "All-Rounders (AR)" },
              ].map((pos) => {
                const isActive = (positionFilter || "QB") === pos.id;
                return (
                  <Button
                    key={pos.id}
                    size="sm"
                    variant={isActive ? "navy" : "secondary"}
                    className="shrink-0"
                    aria-pressed={isActive}
                    onClick={() => {
                      setPositionFilter(pos.id);
                      setSortBy("");
                      setPage(1);
                      const params = new URLSearchParams(searchParams);
                      params.set("pos", pos.id);
                      setSearchParams(params, { replace: true });
                    }}
                  >
                    {pos.label}
                  </Button>
                );
              })}
            </div>
          )}

          <StatsTable
            type={activeTab}
            playerStats={playerStats}
            teamStats={teamStats}
            sortBy={sortBy}
            onSortChange={handleSortChange}
            isLoading={activeTab === "players" ? loadingPlayers : loadingTeams}
            positionFilter={positionFilter}
          />

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm mt-6">
              <div className="text-xs md:text-sm text-gray-500 dark:text-gray-400 font-medium">
                Showing{" "}
                <span className="text-sffl-navy dark:text-white font-bold">
                  {(page - 1) * limit + 1}
                </span>{" "}
                to{" "}
                <span className="text-sffl-navy dark:text-white font-bold">
                  {Math.min(page * limit, totalItems)}
                </span>{" "}
                of{" "}
                <span className="text-sffl-navy dark:text-white font-bold">
                  {totalItems}
                </span>{" "}
                entries
              </div>
              <div className="flex flex-wrap items-center justify-center gap-1 sm:gap-2">
                <IconButton
                  variant="secondary"
                  icon={ChevronLeftIcon}
                  label="Previous page"
                  disabled={page === 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                />
                {[...Array(totalPages)].map((_, i) => {
                  const p = i + 1;
                  // Logic to show limited page numbers if totalPages is large
                  if (totalPages > 5) {
                    if (p !== 1 && p !== totalPages && Math.abs(p - page) > 1) {
                      if (p === 2 && page > 3)
                        return (
                          <span key="dots1" aria-hidden="true">
                            …
                          </span>
                        );
                      if (p === totalPages - 1 && page < totalPages - 2)
                        return (
                          <span key="dots2" aria-hidden="true">
                            …
                          </span>
                        );
                      return null;
                    }
                  }
                  return (
                    <Button
                      key={p}
                      size="sm"
                      variant={page === p ? "primary" : "ghost"}
                      className="min-w-11"
                      onClick={() => setPage(p)}
                      aria-label={`Page ${p}`}
                      aria-current={page === p ? "page" : undefined}
                    >
                      {p}
                    </Button>
                  );
                })}
                <IconButton
                  variant="secondary"
                  icon={ChevronRightIcon}
                  label="Next page"
                  disabled={page === totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
