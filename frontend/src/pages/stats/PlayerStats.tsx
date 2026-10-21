import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getPlayerStats, getTeams } from "../../services/api";
import type { Competition } from "../../types";
import { useStatsCompetitionFilter } from "../../hooks";
import {
  Button,
  ButtonLink,
  Field,
  IconButton,
  Input,
  Select,
  PlayerStatsTable,
  StatsLegend,
  StatsPaginationFooter,
  SeasonStageTabs,
  FootballIcon,
  TeamLink,
} from "../../components";
import { useSearchParams } from "react-router-dom";
import {
  ArrowsRightLeftIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

export const PlayerStats = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlPlayerId = searchParams.get("player_id");
  const urlSearch = searchParams.get("search");
  const urlTeam = searchParams.get("team");
  const urlPos = searchParams.get("pos");

  const {
    competitions,
    dropdownComps,
    selectedCompetitionId,
    selectedDate,
    setSelectedDate,
    setSelectedCompetitionId,
    statDates,
  } = useStatsCompetitionFilter();

  const [searchQuery, setSearchQuery] = useState(() => {
    return urlSearch || sessionStorage.getItem("sffl_stats_search") || "";
  });
  const [positionFilter, setPositionFilter] = useState<string>(() => {
    return urlPos || "QB";
  });

  const urlState = JSON.stringify([urlSearch, urlPos]);
  const [previousUrlState, setPreviousUrlState] = useState(urlState);
  if (urlState !== previousUrlState) {
    setPreviousUrlState(urlState);
    if (urlSearch !== null && urlSearch !== searchQuery)
      setSearchQuery(urlSearch);
    if (urlPos !== null && urlPos !== positionFilter)
      setPositionFilter(urlPos || "QB");
  }
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState("");
  const limit = 20;

  const handleSortChange = (key: string) => {
    setSortBy(key);
    setPage(1);
  };

  // Persist filters to sessionStorage on change
  useEffect(() => {
    sessionStorage.setItem("sffl_stats_search", searchQuery);
  }, [searchQuery]);

  // Sync restored/default state back to URL parameters if they are missing
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    let updated = false;

    if (searchQuery && !params.has("search")) {
      params.set("search", searchQuery);
      updated = true;
    }
    if (positionFilter && !params.has("pos")) {
      params.set("pos", positionFilter);
      updated = true;
    }

    if (updated) {
      setSearchParams(params, { replace: true });
    }
  }, [searchQuery, positionFilter, searchParams, setSearchParams]);

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
  });

  const playerStats = playerStatsPagination?.data || [];
  const totalPages = playerStatsPagination?.total_pages || 0;
  const totalItems = playerStatsPagination?.total || 0;

  // Look up all teams for the dropdown selector
  const { data: teamsLookupData } = useQuery({
    queryKey: ["publicTeamsLookup"],
    queryFn: () => getTeams(1, 100),
  });
  const teamsList = teamsLookupData?.data || [];
  const filterTeam = urlTeam
    ? teamsList.find((t) => t.id === urlTeam)
    : undefined;

  const clearTeamFilter = () => {
    setPage(1);
    const params = new URLSearchParams(searchParams);
    params.delete("team");
    setSearchParams(params, { replace: true });
  };

  return (
    <div className="space-y-4 md:space-y-8">
      {/* Header */}
      <div className="flex flex-col xl:flex-row items-start xl:items-center bg-sffl-navy text-white p-4 md:p-8 rounded-none shadow-xl gap-5 md:gap-8 xl:gap-12">
        <div className="xl:shrink-0 min-w-0">
          <h1 className="text-3xl md:text-5xl font-black italic tracking-tighter uppercase">
            Player Stats
          </h1>
          <p className="text-gray-300 mt-0.5 text-xs md:text-lg">
            Player Performance
          </p>
        </div>

        {/* Filters Group */}
        <div className="flex flex-col md:flex-row md:items-end gap-4 md:gap-6 w-full xl:w-auto">
          <div className="w-full md:w-auto min-w-0 overflow-visible">
            <Field label="Search Players" htmlFor="stats-player-search" tone="dark">
              <Input
                id="stats-player-search"
                type="text"
                tone="dark"
                shape="square"
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
                  shape="square"
                  value={selectedCompetitionId}
                  onChange={(e) => setSelectedCompetitionId(e.target.value)}
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
                shape="square"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
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

          <div className="w-full md:w-auto flex items-end">
            <ButtonLink
              to="/players/compare"
              tone="dark"
              variant="secondary"
              icon={ArrowsRightLeftIcon}
              fullWidth
              className="md:w-auto"
            >
              Compare
            </ButtonLink>
          </div>
        </div>
      </div>

      {filterTeam && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-sffl-red/10 border border-sffl-red/30 text-sffl-red dark:bg-sffl-red/20 dark:text-white px-4 py-2 rounded-none">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 min-w-0 text-xs md:text-sm font-bold uppercase tracking-wider">
            <span>Filtering stats for</span>
            <TeamLink id={filterTeam.id} className="font-black">
              {filterTeam.name}
            </TeamLink>
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
        onChange={setSelectedCompetitionId}
      />

      {/* Content */}
      <div className="space-y-4">
        <StatsLegend />

        {/* Position Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide py-1 bg-white dark:bg-gray-800 p-3 rounded-none border border-gray-100 dark:border-gray-700 shadow-sm">
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

        <PlayerStatsTable
          stats={playerStats}
          sortBy={sortBy}
          onSortChange={handleSortChange}
          isLoading={loadingPlayers}
          positionFilter={positionFilter}
          shape="square"
        />

        <StatsPaginationFooter
          page={page}
          totalPages={totalPages}
          totalItems={totalItems}
          limit={limit}
          onPageChange={setPage}
        />
      </div>
    </div>
  );
};
