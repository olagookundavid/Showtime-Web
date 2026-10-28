import { Fragment, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  getPublicMatchStats,
  getMatchPlays,
} from "../../services";
import type {
  Match,
  MatchTeamSheet,
  TeamSheetPlayer,
  GamePlay,
  PlayerStat,
} from "../../types";
import { Button, LightboxImage, DataTable } from "../ui";
import {
  BoltIcon,
  ChartBarIcon,
  ClipboardDocumentListIcon,
  ExclamationTriangleIcon,
  MapPinIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";
import { StarIcon as StarSolidIcon } from "@heroicons/react/24/solid";
import { FootballIcon } from "../icons/FootballIcon";
import { TeamLink } from "../domain";
import { Spinner } from "../ui/Spinner";
import {
  attackRows,
  computeTeamComparison,
  defenceRows,
  formatStatNumber,
  formatStatDecimal,
} from "../../utils";
import { calculatePlayerFantasyPoints, getUnifiedMatchMvp } from "./matchMvp";

// A stable empty list, so memos keyed on the stats don't rerun every render.
const NO_STATS: PlayerStat[] = [];


interface MatchSummaryTabProps {
  match: Match;
  teamSheet?: MatchTeamSheet;
}

export const MatchSummaryTab = ({
  match,
  teamSheet = { home_team: [], away_team: [] },
}: MatchSummaryTabProps) => {
  const homeTeam = match.home_team;
  const awayTeam = match.away_team;
  const homeTeamId = homeTeam?.id;
  const awayTeamId = awayTeam?.id;

  // Sub-view toggle inside summary tab: 'all' | 'comparison' | 'boxscore'
  const [viewMode, setViewMode] = useState<"comparison" | "boxscore">(
    "comparison",
  );

  // 1. Fetch public match stats (derived player stats)
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ["publicMatchStatsCompare", match.id],
    queryFn: () => getPublicMatchStats(match.id),
    enabled: !!match.id,
  });

  // 2. Fetch match plays for halves calculation and discipline metrics
  const { data: plays = [], isLoading: playsLoading } = useQuery({
    queryKey: ["publicMatchPlays", match.id],
    queryFn: () => getMatchPlays(match.id),
    enabled: !!match.id,
  });

  const playerStats: PlayerStat[] =
    statsData?.derived || statsData?.current || NO_STATS;

  // Map players with calculated Fantasy Points
  const playersWithFP = useMemo(() => {
    return playerStats.map((p) => ({
      ...p,
      fp: calculatePlayerFantasyPoints(p),
    }));
  }, [playerStats]);

  // ── Score by Period / Half ──
  const periodScores = useMemo(() => {
    if (!plays || plays.length === 0) {
      return {
        hasHalves: false,
        home1H: "-",
        away1H: "-",
        home2H: "-",
        away2H: "-",
        homeFT: match.home_score ?? 0,
        awayFT: match.away_score ?? 0,
      };
    }

    // Q1 plays (1st Half in SFFL)
    const q1Plays = plays.filter((p) => (p.quarter ?? 1) === 1);
    let lastQ1WithScore: GamePlay | undefined;
    for (let i = q1Plays.length - 1; i >= 0; i--) {
      if (
        q1Plays[i].home_score_after != null &&
        q1Plays[i].away_score_after != null
      ) {
        lastQ1WithScore = q1Plays[i];
        break;
      }
    }

    if (
      lastQ1WithScore &&
      lastQ1WithScore.home_score_after != null &&
      lastQ1WithScore.away_score_after != null
    ) {
      const h1 = lastQ1WithScore.home_score_after;
      const a1 = lastQ1WithScore.away_score_after;
      const homeFT = match.home_score ?? 0;
      const awayFT = match.away_score ?? 0;
      const h2 = Math.max(0, homeFT - h1);
      const a2 = Math.max(0, awayFT - a1);
      return {
        hasHalves: true,
        home1H: h1,
        away1H: a1,
        home2H: h2,
        away2H: a2,
        homeFT,
        awayFT,
      };
    }

    return {
      hasHalves: false,
      home1H: "-",
      away1H: "-",
      home2H: "-",
      away2H: "-",
      homeFT: match.home_score ?? 0,
      awayFT: match.away_score ?? 0,
    };
  }, [plays, match.home_score, match.away_score]);

  // ── Team Head-to-Head Stats Comparison ──
  const teamComparison = useMemo(() => {
    const homeSheet = teamSheet?.home_team || [];
    const awaySheet = teamSheet?.away_team || [];

    const isFemale = (sheet: TeamSheetPlayer[], playerId: string) => {
      const found = sheet.find((p) => p.player_id === playerId);
      if (!found?.gender) return false;
      const g = found.gender.toLowerCase().trim();
      return g === "female" || g === "f";
    };

    return computeTeamComparison({
      playerStats,
      plays,
      homeTeamId,
      awayTeamId,
      isFemale: (side, playerId) =>
        isFemale(side === "home" ? homeSheet : awaySheet, playerId),
    });
  }, [playerStats, plays, homeTeamId, awayTeamId, teamSheet]);

  // ── Unified Match MVP & Top Performers ──
  const mvpPlayer = useMemo(() => {
    return getUnifiedMatchMvp(match, teamSheet, playerStats);
  }, [match, teamSheet, playerStats]);

  const topPerformers = useMemo(() => {
    if (playersWithFP.length === 0) return [];
    return [...playersWithFP].sort((a, b) => b.fp - a.fp).slice(0, 3);
  }, [playersWithFP]);

  // ── Offensive Box Score ──
  const offensiveBoxScore = useMemo(() => {
    return playersWithFP
      .filter(
        (p) =>
          (p.passing_attempts || 0) > 0 ||
          (p.receptions || 0) > 0 ||
          (p.rushing_attempts || 0) > 0 ||
          (p.passing_yards || 0) > 0 ||
          (p.receiving_yards || 0) > 0,
      )
      .sort((a, b) => b.fp - a.fp)
      .slice(0, 6);
  }, [playersWithFP]);

  // ── Defensive Box Score ──
  const defensiveBoxScore = useMemo(() => {
    return playersWithFP
      .filter(
        (p) =>
          (p.flag_pulls || 0) > 0 ||
          (p.pass_deflections || 0) > 0 ||
          (p.batted_down_passes || 0) > 0 ||
          (p.interceptions || 0) > 0 ||
          (p.def_sacks || 0) > 0,
      )
      .sort((a, b) => b.fp - a.fp)
      .slice(0, 6);
  }, [playersWithFP]);

  if (statsLoading || playsLoading) {
    return (
      <Spinner size="lg" label="Loading match summary…" className="py-16" />
    );
  }

  const { home, away } = teamComparison;

  // Helper for rendering horizontal comparison bar
  const renderComparisonRow = (
    label: string,
    homeVal: number | string,
    awayVal: number | string,
    rawHome: number,
    rawAway: number,
  ) => {
    const total = rawHome + rawAway;
    const homeWidthPct =
      total > 0
        ? Math.max(8, Math.min(92, Math.round((rawHome / total) * 100)))
        : 50;

    return (
      <div className="py-2.5 border-b border-gray-100 dark:border-gray-700/60 last:border-0">
        <div className="flex items-center justify-between text-xs mb-1.5 px-1">
          <span className="font-black tabular-nums text-sffl-navy dark:text-gray-100 w-12 text-left">
            {typeof homeVal === "number" ? formatStatNumber(homeVal) : homeVal}
          </span>
          <span className="font-semibold text-gray-600 dark:text-gray-300 text-center flex-1 px-2 text-[11px] md:text-xs">
            {label}
          </span>
          <span className="font-black tabular-nums text-sffl-red dark:text-red-400 w-12 text-right">
            {typeof awayVal === "number" ? formatStatNumber(awayVal) : awayVal}
          </span>
        </div>
        <div className="h-1.5 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden flex">
          <div
            className="h-full bg-sffl-navy dark:bg-blue-500 transition-all duration-500"
            style={{ width: `${homeWidthPct}%` }}
            title={`${homeTeam?.name || "Home"}: ${homeVal}`}
          />
          <div
            className="h-full bg-sffl-red dark:bg-red-500 transition-all duration-500 flex-1"
            title={`${awayTeam?.name || "Away"}: ${awayVal}`}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* ── Top Row: Period Scoreboard & MVP Spotlight ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Halves Period Scoreboard (5 cols) */}
        <div className="lg:col-span-5 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 border-b border-gray-100 dark:border-gray-700 pb-3">
              <div>
                <span className="text-[10px] font-black tracking-widest uppercase text-gray-500 dark:text-gray-400">
                  Score by Half
                </span>
                <h3 className="text-base font-black text-sffl-navy dark:text-white uppercase tracking-tight">
                  Period Breakdown
                </h3>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 tabular-nums">
                {match.status === "FINISHED" ? "Final" : match.status}
              </span>
            </div>

            {/* Halves Table */}
            <DataTable
              compact
              searchable={false}
              paginated={false}
              getRowId={(r) => r.key}
              data={[
                {
                  key: "home",
                  teamId: homeTeam?.id,
                  name: homeTeam?.name || "Home",
                  logo: homeTeam?.logo,
                  initials: homeTeam?.short_name?.slice(0, 2) || "H",
                  badge: "bg-sffl-navy",
                  h1: periodScores.home1H,
                  h2: periodScores.home2H,
                  ft: periodScores.homeFT,
                  ftClass: "text-sffl-navy dark:text-white",
                },
                {
                  key: "away",
                  teamId: awayTeam?.id,
                  name: awayTeam?.name || "Away",
                  logo: awayTeam?.logo,
                  initials: awayTeam?.short_name?.slice(0, 2) || "A",
                  badge: "bg-sffl-red",
                  h1: periodScores.away1H,
                  h2: periodScores.away2H,
                  ft: periodScores.awayFT,
                  ftClass: "text-sffl-red dark:text-red-400",
                },
              ]}
              columns={[
                {
                  header: "Team",
                  className: "px-3 py-3 text-xs font-semibold",
                  cell: (r) => (
                    <span className="flex items-center gap-2 min-w-0 font-black text-sffl-navy dark:text-gray-200">
                      {r.logo ? (
                        <img src={r.logo} alt={r.name} className="w-5 h-5 object-contain shrink-0" />
                      ) : (
                        <span
                          className={`w-5 h-5 rounded-full ${r.badge} text-white text-[9px] flex items-center justify-center font-black shrink-0`}
                        >
                          {r.initials}
                        </span>
                      )}
                      <TeamLink id={r.teamId} className="truncate">
                        {r.name}
                      </TeamLink>
                    </span>
                  ),
                },
                {
                  header: "1H",
                  align: "center",
                  className: "px-3 py-3 text-xs tabular-nums text-gray-700 dark:text-gray-300",
                  cell: (r) => r.h1,
                },
                {
                  header: "2H",
                  align: "center",
                  className: "px-3 py-3 text-xs tabular-nums text-gray-700 dark:text-gray-300",
                  cell: (r) => r.h2,
                },
                {
                  header: "FT",
                  align: "right",
                  className: "px-3 py-3 text-xs tabular-nums",
                  cell: (r) => <span className={`font-black text-sm ${r.ftClass}`}>{r.ft}</span>,
                },
              ]}
            />
          </div>

          <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700 flex flex-wrap items-center justify-between gap-2 text-[11px] text-gray-500 dark:text-gray-400">
            <span className="inline-flex items-center gap-1 min-w-0">
              <MapPinIcon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">
                {match.venue || "Showtime Stadium"}
              </span>
            </span>
            <span>
              {match.date ? new Date(match.date).toLocaleDateString() : ""}
            </span>
          </div>
        </div>

        {/* MVP & Top Performers Card (7 cols) */}
        <div className="lg:col-span-7 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4 border-b border-gray-100 dark:border-gray-700 pb-3">
            <div className="min-w-0">
              <span className="text-[10px] font-black tracking-widest uppercase text-amber-600 dark:text-amber-400">
                Showtime Spotlight
              </span>
              <h3 className="text-base font-black text-sffl-navy dark:text-white uppercase tracking-tight">
                Match MVP & Top Performers
              </h3>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 uppercase tracking-wider">
              Rating & Fantasy Calibrated
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
            {/* MVP Spotlight Banner (6 cols) */}
            {mvpPlayer ? (
              <div className="md:col-span-6 bg-linear-to-br from-amber-50 to-orange-50/40 dark:from-gray-700/60 dark:to-gray-800 p-4 rounded-xl border border-amber-200/70 dark:border-gray-600 relative overflow-hidden">
                <div className="flex items-center gap-3">
                  {mvpPlayer.playerImage ? (
                    <div className="w-14 h-14 rounded-full overflow-hidden ring-2 ring-amber-400 dark:ring-amber-500 shadow-md shrink-0">
                      <LightboxImage
                        src={mvpPlayer.playerImage}
                        alt={mvpPlayer.playerName}
                        thumbnailClassName="w-full h-full"
                        imgClassName="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-amber-500 text-white flex items-center justify-center font-black text-base shadow-md shrink-0">
                      #{mvpPlayer.playerJerseyNumber || "MVP"}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500 text-white inline-flex items-center gap-1 mb-1">
                      <StarSolidIcon className="w-3 h-3" aria-hidden="true" />
                      MATCH MVP
                    </span>
                    <Link
                      to={`/players/${mvpPlayer.playerId}?match=${match.id}`}
                      className="block font-black text-sm text-sffl-navy dark:text-white truncate hover:text-sffl-red transition-colors"
                    >
                      {mvpPlayer.playerName}
                    </Link>
                    <p className="text-[11px] text-gray-600 dark:text-gray-300 font-semibold truncate">
                      <TeamLink id={mvpPlayer.teamId}>{mvpPlayer.teamName}</TeamLink> ·{" "}
                      {mvpPlayer.playerPosition}
                    </p>
                  </div>
                </div>
                <div className="mt-3 pt-2.5 border-t border-amber-200/60 dark:border-gray-600 flex items-center justify-between gap-2">
                  <div className="min-w-0 text-[11px] text-gray-600 dark:text-gray-300 font-medium truncate max-w-45">
                    {mvpPlayer.statSummary ||
                      (mvpPlayer.rating
                        ? `Rating: ${mvpPlayer.rating.toFixed(1)}`
                        : "Impact Player")}
                  </div>
                  <div className="text-right shrink-0 flex items-center gap-2">
                    {mvpPlayer.rating != null && (
                      <div className="flex flex-col items-end">
                        <div className="flex items-baseline gap-0.5">
                          <span className="text-lg font-black text-amber-600 dark:text-amber-400 tabular-nums leading-none">
                            {mvpPlayer.rating.toFixed(1)}
                          </span>
                          <StarSolidIcon
                            className="w-3 h-3 text-amber-500"
                            aria-hidden="true"
                          />
                        </div>
                        <span className="text-[8px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Rating
                        </span>
                      </div>
                    )}
                    {mvpPlayer.fp > 0 && (
                      <div
                        className={`flex flex-col items-end ${mvpPlayer.rating != null ? "pl-2 border-l border-amber-200/80 dark:border-gray-600" : ""}`}
                      >
                        <span className="text-lg font-black text-gray-800 dark:text-gray-100 tabular-nums leading-none">
                          {mvpPlayer.fp.toFixed(1)}
                        </span>
                        <span className="text-[8px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          FP
                        </span>
                      </div>
                    )}
                    {mvpPlayer.rating == null && mvpPlayer.fp <= 0 && (
                      <span className="text-xs font-black text-amber-600 dark:text-amber-400">
                        MVP
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="md:col-span-6 p-4 text-center text-gray-400 dark:text-gray-500 text-xs italic">
                MVP available once match stats are recorded.
              </div>
            )}

            {/* Top Performers List (6 cols) */}
            <div className="md:col-span-6 space-y-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-gray-500 dark:text-gray-400 block px-1">
                Top Fantasy Scorers
              </span>
              {topPerformers.length > 0 ? (
                topPerformers.map((tp, idx) => (
                  <Link
                    key={tp.player_id}
                    to={`/players/${tp.player_id}?match=${match.id}`}
                    className="flex items-center justify-between min-h-11 p-2 rounded-xl bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-5 h-5 rounded-full bg-sffl-navy/10 dark:bg-white/10 text-sffl-navy dark:text-gray-300 font-black text-[10px] flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <div className="truncate min-w-0">
                        <div className="font-bold text-xs text-sffl-navy dark:text-white truncate group-hover:text-sffl-red transition-colors">
                          {tp.player_name}
                        </div>
                        <div className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                          {tp.team_short_name || tp.team_name} ·{" "}
                          {tp.player_position}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-2 font-black text-xs text-amber-600 dark:text-amber-400 tabular-nums">
                      {formatStatDecimal(tp.fp, 1)}{" "}
                      <span className="text-[9px] font-normal text-gray-400">
                        FP
                      </span>
                    </div>
                  </Link>
                ))
              ) : (
                <p className="text-gray-400 text-xs italic py-2">
                  No fantasy points recorded yet.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Sub-Toggle: Team Comparison vs Key Box Score ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-200 dark:border-gray-700 pb-2">
        <div className="grid grid-cols-2 sm:flex items-center gap-2">
          <Button
            variant={viewMode === "comparison" ? "navy" : "ghost"}
            size="sm"
            icon={ChartBarIcon}
            aria-pressed={viewMode === "comparison"}
            className="uppercase tracking-tight"
            onClick={() => setViewMode("comparison")}
          >
            Team Comparison
          </Button>
          <Button
            variant={viewMode === "boxscore" ? "navy" : "ghost"}
            size="sm"
            icon={ClipboardDocumentListIcon}
            aria-pressed={viewMode === "boxscore"}
            className="uppercase tracking-tight"
            onClick={() => setViewMode("boxscore")}
          >
            Key Box Score
          </Button>
        </div>
        {/* Colour key for the comparison bars, on every screen size */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-bold">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-sffl-navy dark:bg-blue-500" />
            <span className="text-gray-700 dark:text-gray-300">
              {homeTeam?.name || "Home"}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-sffl-red dark:bg-red-500" />
            <span className="text-gray-700 dark:text-gray-300">
              {awayTeam?.name || "Away"}
            </span>
          </div>
        </div>
      </div>

      {/* ── VIEW 1: Head-to-Head Team Comparison ── */}
      {viewMode === "comparison" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Group A: Attack & Possession */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3 border-b border-gray-100 dark:border-gray-700 pb-3">
              <h4 className="text-xs font-black tracking-widest uppercase text-sffl-navy dark:text-white flex items-center gap-2">
                <FootballIcon className="w-4 h-4 shrink-0" aria-hidden="true" />
                Attack & Possession
              </h4>
              <span className="text-[10px] font-bold text-gray-400 uppercase">
                Match Comparison
              </span>
            </div>
            <div className="divide-y divide-gray-50 dark:divide-gray-700/40">
              {attackRows(teamComparison).map((r) => (
                <Fragment key={r.label}>
                  {renderComparisonRow(
                    r.label,
                    r.homeText,
                    r.awayText,
                    r.homeValue,
                    r.awayValue,
                  )}
                </Fragment>
              ))}
            </div>
          </div>

          {/* Group B: Defence & Discipline */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3 border-b border-gray-100 dark:border-gray-700 pb-3">
              <h4 className="text-xs font-black tracking-widest uppercase text-sffl-navy dark:text-white flex items-center gap-2">
                <ShieldCheckIcon
                  className="w-4 h-4 shrink-0"
                  aria-hidden="true"
                />
                Defence & Discipline
              </h4>
              <span className="text-[10px] font-bold text-gray-400 uppercase">
                Match Comparison
              </span>
            </div>
            <div className="divide-y divide-gray-50 dark:divide-gray-700/40">
              {defenceRows(teamComparison).map((r) => (
                <Fragment key={r.label}>
                  {renderComparisonRow(
                    r.label,
                    r.homeText,
                    r.awayText,
                    r.homeValue,
                    r.awayValue,
                  )}
                </Fragment>
              ))}
            </div>

            {/* Discipline Note */}
            {(home.infractions > 0 || away.infractions > 0) && (
              <div className="mt-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-900 dark:text-amber-200 flex items-start gap-2">
                <ExclamationTriangleIcon
                  className="w-4 h-4 shrink-0"
                  aria-hidden="true"
                />
                <span>
                  {homeTeam?.short_name || "Home"}:{" "}
                  <strong>{home.infractions}</strong> penalty call
                  {home.infractions === 1 ? "" : "s"} ·{" "}
                  {awayTeam?.short_name || "Away"}:{" "}
                  <strong>{away.infractions}</strong> penalty call
                  {away.infractions === 1 ? "" : "s"}.
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── VIEW 2: Key Performers Box Score ── */}
      {viewMode === "boxscore" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Offensive Box Score */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-4 sm:px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-2">
              <h4 className="font-black text-sm text-sffl-navy dark:text-white uppercase tracking-tight flex items-center gap-2">
                <BoltIcon className="w-4 h-4 shrink-0" aria-hidden="true" />
                Offensive Highlights
              </h4>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                TOP 6
              </span>
            </div>
            <DataTable
              compact
              searchable={false}
              paginated={false}
              getRowId={(p) => p.player_id}
              data={offensiveBoxScore}
              emptyMessage="No offensive statistics recorded yet."
              columns={[
                {
                  header: "Player",
                  className: "px-4 py-3 text-xs font-semibold",
                  cell: (p) => (
                    <>
                      <Link
                        to={`/players/${p.player_id}?match=${match.id}`}
                        className="font-black text-sffl-navy dark:text-white hover:text-sffl-red transition-colors block truncate max-w-37.5"
                      >
                        {p.player_name}
                      </Link>
                      <span className="text-[10px] text-gray-500 dark:text-gray-400 block truncate">
                        {p.team_short_name || p.team_name} · {p.player_position}
                      </span>
                    </>
                  ),
                },
                {
                  header: "CMP/ATT",
                  align: "center",
                  className: "px-3 py-3 text-xs tabular-nums text-gray-700 dark:text-gray-300",
                  cell: (p) =>
                    p.passing_attempts > 0
                      ? `${formatStatNumber(p.completed_passes)}/${formatStatNumber(p.passing_attempts)}`
                      : p.receptions > 0
                        ? `${formatStatNumber(p.receptions)} REC`
                        : "-",
                },
                {
                  header: "YDS",
                  align: "center",
                  className: "px-3 py-3 text-xs tabular-nums text-gray-700 dark:text-gray-300",
                  cell: (p) =>
                    formatStatNumber(
                      (p.passing_yards || 0) + (p.receiving_yards || 0) + (p.rushing_yards || 0),
                    ),
                },
                {
                  header: "TD",
                  align: "center",
                  className: "px-3 py-3 text-xs tabular-nums font-bold text-sffl-navy dark:text-white",
                  cell: (p) =>
                    formatStatNumber((p.passing_tds || 0) + (p.receiving_tds || 0) + (p.rushing_tds || 0)),
                },
                {
                  header: "FP",
                  align: "right",
                  className: "px-4 py-3 text-xs tabular-nums font-black text-amber-600 dark:text-amber-400",
                  cell: (p) => formatStatDecimal(p.fp, 1),
                },
              ]}
            />
          </div>

          {/* Defensive Box Score */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-4 sm:px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-2">
              <h4 className="font-black text-sm text-sffl-navy dark:text-white uppercase tracking-tight flex items-center gap-2">
                <ShieldCheckIcon
                  className="w-4 h-4 shrink-0"
                  aria-hidden="true"
                />
                Defensive Highlights
              </h4>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                TOP 6
              </span>
            </div>
            <DataTable
              compact
              searchable={false}
              paginated={false}
              getRowId={(p) => p.player_id}
              data={defensiveBoxScore}
              emptyMessage="No defensive statistics recorded yet."
              columns={[
                {
                  header: "Player",
                  className: "px-4 py-3 text-xs font-semibold",
                  cell: (p) => (
                    <>
                      <Link
                        to={`/players/${p.player_id}?match=${match.id}`}
                        className="font-black text-sffl-navy dark:text-white hover:text-sffl-red transition-colors block truncate max-w-37.5"
                      >
                        {p.player_name}
                      </Link>
                      <span className="text-[10px] text-gray-500 dark:text-gray-400 block truncate">
                        {p.team_short_name || p.team_name} · {p.player_position}
                      </span>
                    </>
                  ),
                },
                {
                  header: "PULL",
                  align: "center",
                  className: "px-3 py-3 text-xs tabular-nums text-gray-700 dark:text-gray-300",
                  cell: (p) => formatStatNumber(p.flag_pulls || 0),
                },
                {
                  header: "BAT",
                  align: "center",
                  className: "px-3 py-3 text-xs tabular-nums text-gray-700 dark:text-gray-300",
                  cell: (p) => formatStatNumber((p.pass_deflections || 0) + (p.batted_down_passes || 0)),
                },
                {
                  header: "INT",
                  align: "center",
                  className: "px-3 py-3 text-xs tabular-nums font-bold text-sffl-navy dark:text-white",
                  cell: (p) => formatStatNumber(p.interceptions || 0),
                },
                {
                  header: "FP",
                  align: "right",
                  className: "px-4 py-3 text-xs tabular-nums font-black text-amber-600 dark:text-amber-400",
                  cell: (p) => formatStatDecimal(p.fp, 1),
                },
              ]}
            />
          </div>
        </div>
      )}
    </div>
  );
};
