import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getTeamStats } from "../../services/api";
import type { Competition, TeamStat } from "../../types";
import { useStatsCompetitionFilter } from "../../hooks";
import {
  Field,
  IconButton,
  Input,
  Select,
  TeamStatsTable,
  StatsLegend,
  StatsPaginationFooter,
  SeasonStageTabs,
} from "../../components";
import { MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/24/outline";

// A stable empty list, so the filter memo below doesn't rerun every render.
const NO_STATS: TeamStat[] = [];

export const TeamStats = () => {
  const {
    competitions,
    dropdownComps,
    selectedCompetitionId,
    selectedDate,
    setSelectedDate,
    setSelectedCompetitionId,
    statDates,
  } = useStatsCompetitionFilter();

  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState("");
  const [teamSearch, setTeamSearch] = useState("");
  const limit = 20;

  const handleSortChange = (key: string) => {
    setSortBy(key);
    setPage(1);
  };

  const { data: teamStatsPagination, isLoading: loadingTeams } = useQuery({
    queryKey: [
      "teamStatsFiltered",
      selectedCompetitionId,
      selectedDate,
      page,
      sortBy,
    ],
    queryFn: () =>
      getTeamStats(
        selectedCompetitionId,
        selectedDate,
        page,
        limit,
        sortBy || undefined,
      ),
  });

  const teamStats = teamStatsPagination?.data || NO_STATS;
  const totalPages = teamStatsPagination?.total_pages || 0;
  const totalItems = teamStatsPagination?.total || 0;

  // Client-side filter — the whole league fits on one fetched page, so a
  // server round-trip isn't needed just to narrow the list by name.
  const filteredTeamStats = useMemo(() => {
    const query = teamSearch.trim().toLowerCase();
    if (!query) return teamStats;
    return teamStats.filter(
      (t) =>
        (t.team_name || "").toLowerCase().includes(query) ||
        (t.team_short_name || "").toLowerCase().includes(query),
    );
  }, [teamStats, teamSearch]);

  return (
    <div className="space-y-4 md:space-y-8">
      {/* Header */}
      <div className="flex flex-col xl:flex-row items-start xl:items-center xl:justify-between bg-sffl-navy text-white p-4 md:p-8 rounded-none shadow-xl gap-5 md:gap-8 xl:gap-12">
        <div className="xl:shrink-0 min-w-0">
          <h1 className="text-3xl md:text-5xl font-black italic tracking-tighter uppercase">
            Team Stats
          </h1>
          <p className="text-gray-300 mt-0.5 text-xs md:text-lg">
            Team Performance
          </p>
        </div>

        {/* Filters Group */}
        <div className="flex flex-col md:flex-row md:items-end gap-4 md:gap-6 w-full xl:w-auto">
          <div className="w-full md:w-auto min-w-0 overflow-visible">
            <Field label="Search Teams" htmlFor="team-stats-search" tone="dark">
              <Input
                id="team-stats-search"
                type="text"
                tone="dark"
                shape="square"
                icon={MagnifyingGlassIcon}
                placeholder="Team name..."
                value={teamSearch}
                onChange={(e) => setTeamSearch(e.target.value)}
                className="md:min-w-60"
                action={
                  teamSearch ? (
                    <IconButton
                      tone="dark"
                      variant="ghost"
                      icon={XMarkIcon}
                      label="Clear search"
                      className="h-full"
                      onClick={() => setTeamSearch("")}
                    />
                  ) : undefined
                }
              />
            </Field>
          </div>

          <div className="w-full flex flex-col gap-2 md:w-50">
            <div className="w-full">
              <Field label="Competition" htmlFor="team-stats-competition" tone="dark">
                <Select
                  id="team-stats-competition"
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
            <Field label="Event Day" htmlFor="team-stats-event-day" tone="dark">
              <Select
                id="team-stats-event-day"
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
        </div>
      </div>

      {/* Season | Playoffs toggle for the selected competition */}
      <SeasonStageTabs
        competitions={competitions}
        currentId={selectedCompetitionId}
        onChange={setSelectedCompetitionId}
      />

      {/* Content */}
      <div className="space-y-4">
        <StatsLegend showTeamCategory />

        <TeamStatsTable
          stats={filteredTeamStats}
          sortBy={sortBy}
          onSortChange={handleSortChange}
          isLoading={loadingTeams}
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
