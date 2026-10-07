import { useEffect, useState, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  getCompetitions,
  getStandings,
  getMatches,
  sortCompetitionsBySeason,
  dropdownCompetitionsFor,
  type Competition,
  type Match,
} from "../../services/api";
import { Loader } from "../../components/ui/Loader";
import { Field, Select } from "../../components/ui";
import { StandingsTable } from "../../components/matches/StandingsTable";
import { BracketView } from "../../components/matches/BracketView";
import { MatchCard } from "../../components/matches/MatchCard";
import { SeasonStageTabs } from "../../components/domain/SeasonStageTabs";
import {
  isStageSlug,
  resolveStageCompetition,
  seasonIdOf,
  stageSlugOf,
} from "../../components/domain/seasonStages";
import { Spinner } from "../../components/ui/Spinner";
import { FootballIcon } from "../../components/icons/FootballIcon";
import { cupStageOf } from "../../utils/cupStage";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  TrophyIcon,
} from "@heroicons/react/24/outline";

const STORAGE_KEY = "sffl_standings_comp";

export const StandingsPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const compParam = searchParams.get("comp");
  const stageParam = searchParams.get("stage");
  const teamParam = searchParams.get("team");
  // The last competition picked here, so a bare /standings visit returns to it.
  const [selectedCompetitionId, setSelectedCompetitionId] = useState<string>(
    () => sessionStorage.getItem(STORAGE_KEY) || "",
  );
  const [showLegend, setShowLegend] = useState(false);

  const { data: competitionsData, isLoading: compLoading } = useQuery({
    queryKey: ["publicCompetitions"],
    queryFn: () => getCompetitions(1, 100),
  });
  const competitions = sortCompetitionsBySeason(
    (competitionsData?.data || []).filter((c) => c.status !== "inactive"),
  );
  const leagueComps = competitions.filter(
    (c) => (c.format || "SEASON") === "SEASON",
  );
  // The URL is the source of truth when a valid competition is supplied.
  // This avoids mirroring the query parameter into state from an effect.
  const urlComp = compParam
    ? competitions.find((c) => c.id === compParam)
    : undefined;
  const activeCompetitionId = urlComp?.id ?? selectedCompetitionId;
  const selectedComp = competitions.find((c) => c.id === activeCompetitionId);

  useEffect(() => {
    if (activeCompetitionId) {
      sessionStorage.setItem(STORAGE_KEY, activeCompetitionId);
    }
  }, [activeCompetitionId]);

  const dropdownComps = dropdownCompetitionsFor(competitions, selectedComp);

  // Pick the competition of the most recent match so the default lands on
  // the currently-running stage (regular season → playoffs → bowl) instead
  // of just the newest competition row. Its season is also the "current
  // season" a stage link (?stage=cup) resolves in.
  const { data: latestMatchPage, isFetched: latestMatchFetched } = useQuery({
    queryKey: ["publicLatestMatchForDefault"],
    queryFn: () => getMatches(undefined, 1, 1, "FINISHED"),
    staleTime: 60_000,
  });
  const latestMatchCompetitionId = latestMatchPage?.data?.[0]?.competition?.id;
  const latestMatchComp = competitions.find(
    (c) => c.id === latestMatchCompetitionId,
  );
  const currentSeasonId =
    (latestMatchComp && seasonIdOf(latestMatchComp)) || leagueComps[0]?.id;

  // Keeps ?comp and ?stage naming the same competition. ?stage is what the
  // League menu links with (it can't know competition ids) and what the menu
  // reads to highlight the open stage; ?comp is what the page shows. Order:
  //   1. ?comp valid and ?stage matches it → nothing to do.
  //   2. ?comp valid, no ?stage (a Match Hub or team link) → add its stage.
  //   3. ?stage given → that stage in ?comp's season, else the current
  //      season, else the most recent one from any season.
  //   4. Neither → the last pick here, then the latest match's competition.
  useEffect(() => {
    if (competitions.length === 0) return;
    const stage = isStageSlug(stageParam) ? stageParam : null;
    if (urlComp && stage === stageSlugOf(urlComp)) return;

    let target: Competition | undefined;
    if (urlComp && !stage) {
      target = urlComp;
    } else if (stage) {
      const seasonId = urlComp ? seasonIdOf(urlComp) : currentSeasonId;
      if (!urlComp && !latestMatchFetched) return;
      target = resolveStageCompetition(competitions, stage, seasonId);
    }

    // A bare visit, or a stage no season has ever had.
    if (!target) {
      const remembered = competitions.find(
        (c) => c.id === selectedCompetitionId,
      );
      if (!remembered && !latestMatchFetched) return;
      target =
        remembered ?? latestMatchComp ?? leagueComps[0] ?? competitions[0];
    }
    if (!target) return;

    const params = new URLSearchParams(searchParams);
    params.set("comp", target.id);
    params.set("stage", stageSlugOf(target));
    setSearchParams(params, { replace: true });
  }, [
    competitions,
    urlComp,
    stageParam,
    selectedCompetitionId,
    currentSeasonId,
    latestMatchFetched,
    latestMatchComp,
    leagueComps,
    searchParams,
    setSearchParams,
  ]);

  const handleCompetitionChange = (compId: string) => {
    const comp = competitions.find((c) => c.id === compId);
    if (!comp) return;
    setSelectedCompetitionId(compId);
    const params = new URLSearchParams(searchParams);
    params.set("comp", compId);
    params.set("stage", stageSlugOf(comp));
    setSearchParams(params, { replace: true });
  };

  // When arriving with ?team=X, scroll the highlighted row into the viewport
  // so the user can see their team immediately even if the table is long.
  useEffect(() => {
    if (!teamParam) return;
    const t = setTimeout(() => {
      const row = document.querySelector<HTMLTableRowElement>(
        `tr[data-team-id="${teamParam}"]`,
      );
      row?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 250);
    return () => clearTimeout(t);
  }, [teamParam, activeCompetitionId]);

  // Find selected competition name
  const selectedCompetition = competitions.find(
    (c) => c.id === activeCompetitionId,
  );
  const compFormat = selectedCompetition?.format;
  const cupStage = cupStageOf(selectedCompetition);
  const isCup = cupStage !== "none";
  // Knockout competitions (playoffs + bowl, or a cup from its quarterfinals)
  // have a bracket instead of standings.
  const isKnockout = compFormat === "PLAYOFFS" || cupStage === "knockout";
  const isPreseason = compFormat === "PRESEASON";
  const isMatchesOnly = isPreseason || cupStage === "matches";

  const { data: standingsData, isLoading: dataLoading } = useQuery({
    queryKey: ["publicStandings", activeCompetitionId],
    queryFn: () => getStandings(activeCompetitionId),
    enabled: !!activeCompetitionId && !isKnockout && !isMatchesOnly,
  });
  const standings = standingsData || [];

  // Preseason and unstarted/older Cups have no standings table; query their matches ordered latest match first
  const { data: compMatchesData, isLoading: matchesLoading } = useQuery({
    queryKey: ["standingsCompMatches", activeCompetitionId],
    queryFn: () => getMatches(activeCompetitionId, 1, 100),
    enabled: !!activeCompetitionId && isMatchesOnly,
  });
  const matches = useMemo(() => {
    const list = compMatchesData?.data || [];
    return [...list].sort((a: Match, b: Match) => {
      const d = b.date.localeCompare(a.date);
      if (d !== 0) return d;
      return (b.start_time || "").localeCompare(a.start_time || "");
    });
  }, [compMatchesData]);

  const loading = compLoading;

  if (loading && competitions.length === 0) return <Loader />;

  return (
    <div className="space-y-4 md:space-y-8">
      {/* Header - Condensed */}
      <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3 bg-sffl-navy text-white p-4 md:p-8 rounded-xl md:rounded-2xl shadow-xl">
        <div className="min-w-0">
          <h1 className="text-3xl md:text-5xl font-black italic tracking-tighter">
            {isCup
              ? "CUP"
              : isKnockout
                ? "PLAYOFFS"
                : isPreseason
                  ? "PRESEASON"
                  : "STANDINGS"}
          </h1>
          <p className="text-gray-300 mt-0.5 text-xs md:text-lg">
            {cupStage === "knockout"
              ? "Bracket & Road to the Final"
              : cupStage === "swiss"
                ? "Swiss Table & the Race for the Quarterfinals"
                : isCup
                  ? "Cup Matches & Results"
                  : isKnockout
                    ? "Bracket & Road to the Bowl"
                    : isPreseason
                      ? "Preseason Matches & Results"
                      : "Rankings & Tables"}
          </p>
        </div>

        {/* Competition Selector - Mobile Optimized */}
        {competitions.length > 0 && (
          <div className="w-full md:w-auto flex flex-col md:flex-row md:items-end gap-3">
            <div className="flex-1 w-full md:min-w-65">
              <Field label="Competition" htmlFor="standings-competition" tone="dark">
                <Select
                  id="standings-competition"
                  tone="dark"
                  value={activeCompetitionId}
                  onChange={(e) => handleCompetitionChange(e.target.value)}
                >
                  {dropdownComps.map((c) => (
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
        )}
      </div>

      {competitions.length > 0 && (
        <SeasonStageTabs
          competitions={competitions}
          currentId={activeCompetitionId}
          onChange={handleCompetitionChange}
        />
      )}

      {dataLoading && !isKnockout && !isMatchesOnly && (
        <Spinner label="Loading standings…" className="py-12" />
      )}

      {matchesLoading && isMatchesOnly && (
        <Spinner label="Loading matches…" className="py-12" />
      )}

      {/* Knockout: bracket replaces the standings table */}
      {isKnockout && activeCompetitionId && (
        <div className="space-y-3 md:space-y-6">
          <div className="flex items-center gap-2 min-w-0">
            <FootballIcon
              className="w-5 h-5 md:w-7 md:h-7 shrink-0 text-sffl-red"
              aria-hidden="true"
            />
            <h2 className="min-w-0 wrap-break-word text-sm md:text-2xl font-black text-sffl-navy dark:text-white uppercase tracking-tight">
              {selectedCompetition?.name}
            </h2>
          </div>
          <BracketView competitionId={activeCompetitionId} cup={isCup} />
        </div>
      )}

      {/* Matches-only (Preseason & Cup): matches list sorted latest first */}
      {isMatchesOnly && activeCompetitionId && !matchesLoading && (
        <div className="space-y-4 md:space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              {selectedCompetition?.logo ? (
                <img
                  src={selectedCompetition.logo}
                  alt={selectedCompetition.name}
                  className="w-6 h-6 md:w-8 md:h-8 object-contain"
                />
              ) : (
                isPreseason ? (
                  <FootballIcon
                    className="w-5 h-5 md:w-7 md:h-7 shrink-0 text-sffl-red"
                    aria-hidden="true"
                  />
                ) : (
                  <TrophyIcon
                    className="w-5 h-5 md:w-7 md:h-7 shrink-0 text-amber-500"
                    aria-hidden="true"
                  />
                )
              )}
              <h2 className="min-w-0 wrap-break-word text-sm md:text-2xl font-black text-sffl-navy dark:text-white uppercase tracking-tight">
                {selectedCompetition?.name}
                {selectedCompetition?.status &&
                  !["active", "completed"].includes(
                    selectedCompetition.status,
                  ) && (
                    <span className="text-red-500 text-sm ml-2 align-middle">
                      [{selectedCompetition.status.toUpperCase()}]
                    </span>
                  )}
              </h2>
            </div>
            <span className="text-xs font-bold text-gray-500 dark:text-gray-400">
              {matches.length} {matches.length === 1 ? "Match" : "Matches"}
            </span>
          </div>

          {matches.length === 0 ? (
            <div className="bg-gray-100 dark:bg-gray-800 p-8 sm:p-16 rounded-xl text-center">
              {isPreseason ? (
                <FootballIcon
                  className="w-12 h-12 mx-auto mb-4 text-gray-400"
                  aria-hidden="true"
                />
              ) : (
                <TrophyIcon
                  className="w-12 h-12 mx-auto mb-4 text-gray-400"
                  aria-hidden="true"
                />
              )}
              <p className="text-gray-500 text-base sm:text-lg font-semibold">
                No matches scheduled for this competition yet.
              </p>
              <p className="text-gray-400 mt-2">
                Check back soon for schedule updates.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {matches.map((m) => (
                <MatchCard
                  key={m.id}
                  match={m}
                  onClick={() => {
                    const params = new URLSearchParams();
                    if (activeCompetitionId)
                      params.set("comp", activeCompetitionId);
                    navigate(`/matches/${m.id}?${params.toString()}`);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Standings Table with Compact Legend */}
      {!isKnockout && !isMatchesOnly && !dataLoading && standings.length > 0 ? (
        <div className="space-y-3 md:space-y-6">
          <div className="flex items-center gap-2.5 min-w-0">
            {selectedCompetition?.logo ? (
              <img
                src={selectedCompetition.logo}
                alt={selectedCompetition.name}
                className="w-6 h-6 md:w-8 md:h-8 object-contain"
              />
            ) : (
              <TrophyIcon
                className="w-5 h-5 md:w-7 md:h-7 shrink-0 text-amber-500"
                aria-hidden="true"
              />
            )}
            <h2 className="min-w-0 wrap-break-word text-sm md:text-2xl font-black text-sffl-navy dark:text-white uppercase tracking-tight">
              {selectedCompetition?.name || "League"}
              {selectedCompetition?.status &&
                !["active", "completed"].includes(
                  selectedCompetition.status,
                ) && (
                  <span className="text-red-500 text-sm ml-2 align-middle">
                    [{selectedCompetition.status.toUpperCase()}]
                  </span>
                )}
            </h2>
          </div>

          {/* Abbreviation Legend - Descriptive and Colorful (Togglable) */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden mb-6">
            <button
              type="button"
              aria-expanded={showLegend}
              className="w-full min-h-11 p-4 flex items-center justify-between gap-3 text-left cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              onClick={() => setShowLegend(!showLegend)}
            >
              <span className="flex items-center gap-2">
                <span className="p-1 px-2 bg-sffl-navy text-white text-[10px] font-black rounded box-border leading-none uppercase">
                  Legend
                </span>
                <span className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                  Table Key
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
              <div className="p-4 pt-0 border-t border-gray-50 dark:border-gray-700">
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-[10px] md:text-xs py-3">
                  {[
                    {
                      abbr: "GP",
                      full: "Games Played",
                      color: "bg-blue-50 text-blue-600 border-blue-100",
                    },
                    {
                      abbr: "W",
                      full: "Wins",
                      color: "bg-green-50 text-green-600 border-green-100",
                    },
                    {
                      abbr: "D",
                      full: "Draws",
                      color: "bg-gray-50 text-gray-600 border-gray-100",
                    },
                    {
                      abbr: "L",
                      full: "Losses",
                      color: "bg-red-50 text-red-600 border-red-100",
                    },
                    {
                      abbr: "PF",
                      full: "Points For",
                      color: "bg-yellow-50 text-yellow-700 border-yellow-100",
                    },
                    {
                      abbr: "PA",
                      full: "Points Against",
                      color: "bg-yellow-50 text-yellow-700 border-yellow-100",
                    },
                    {
                      abbr: "PD",
                      full: "Point Difference",
                      color: "bg-purple-50 text-purple-600 border-purple-100",
                    },
                    {
                      abbr: "PCT",
                      full: "Percentage",
                      color: "bg-indigo-50 text-indigo-600 border-indigo-100",
                    },
                  ].map((item) => (
                    <div
                      key={item.abbr}
                      className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border ${item.color} font-bold`}
                    >
                      <span className="opacity-70">{item.abbr}:</span>
                      <span>{item.full}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <StandingsTable
            standings={standings}
            isCompleted={selectedCompetition?.status === "completed"}
            highlightTeamId={teamParam || undefined}
            isPlayoffs={isKnockout}
            isCup={isCup}
          />
        </div>
      ) : !isKnockout && !isMatchesOnly && !dataLoading ? (
        <div className="bg-gray-100 dark:bg-gray-800 p-8 sm:p-16 rounded-xl text-center">
          <TrophyIcon
            className="w-12 h-12 mx-auto mb-4 text-gray-400"
            aria-hidden="true"
          />
          <p className="text-gray-500 text-base sm:text-lg font-semibold">
            No standings available for this competition yet.
          </p>
          <p className="text-gray-400 mt-2">
            Check back once matches have been played.
          </p>
        </div>
      ) : null}
    </div>
  );
};
