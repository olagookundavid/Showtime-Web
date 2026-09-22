import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
    getPublicMatchStats,
    getMatchPlays,
    type Match,
    type MatchTeamSheet,
    type TeamSheetPlayer,
    type PlayerStat,
    type GamePlay
} from '../../services/api';
import { LightboxImage } from '../ui';
import { Spinner } from '../ui/Spinner';

// Calibrated SFFL Fantasy scoring arithmetic (domain.FantasyWeights)
export function calculatePlayerFantasyPoints(s: PlayerStat): number {
    // Offensive
    const passYds = (s.passing_yards || 0) * 0.01;
    const passTds = (s.passing_tds || 0) * 2.0;
    const intThrown = (s.interceptions_thrown || 0) * -0.5;
    const qbSacks = (s.qb_sacks || 0) * -0.25;
    const rushYds = (s.rushing_yards || 0) * 0.025;
    const rushTds = (s.rushing_tds || 0) * 2.0;
    const rec = (s.receptions || 0) * 0.25;
    const recYds = (s.receiving_yards || 0) * 0.025;
    const recTds = (s.receiving_tds || 0) * 2.0;
    const drops = (s.drops || 0) * -0.25;
    const xpGood = (s.xp_good || 0) * 0.25;
    const xpTds = (s.extra_points_tds || 0) * 0.25;

    // Defensive
    const flagPulls = (s.flag_pulls || 0) * 0.05;
    const passDeflections = (s.pass_deflections || s.batted_down_passes || 0) * 0.25;
    const ints = (s.interceptions || 0) * 1.25;
    const defSacks = (s.def_sacks || 0) * 0.75;
    const defTds = (s.defensive_tds || 0) * 2.0;
    const defXpTds = (s.defensive_xp_tds || 0) * 1.0;
    const safety = (s.safety || 0) * 1.25;

    const total = passYds + passTds + intThrown + qbSacks + rushYds + rushTds + rec + recYds + recTds + drops + xpGood + xpTds +
        flagPulls + passDeflections + ints + defSacks + defTds + defXpTds + safety;
    return Math.max(0, Math.round(total * 10) / 10);
}

export interface UnifiedMvpResult {
    playerId: string;
    playerName: string;
    playerImage?: string;
    playerJerseyNumber?: number;
    playerPosition?: string;
    teamName?: string;
    teamId?: string;
    fp: number;
    rating?: number | null;
    statSummary?: string;
}

/**
 * Unified Match MVP calculation across the Showtime platform.
 * 1. Winning Team priority (unless tie or no positive contributors on winning team).
 * 2. Composite Impact Score = SFFL Fantasy Points (volume + big plays) + Rating efficiency bonus.
 * 3. Fallback to roster rating if detailed stats are not yet recorded.
 */
export function getUnifiedMatchMvp(
    match: Match,
    teamSheet: MatchTeamSheet,
    playerStats: PlayerStat[]
): UnifiedMvpResult | null {
    const homeScore = match.home_score ?? 0;
    const awayScore = match.away_score ?? 0;
    const homeTeamId = match.home_team?.id;
    const awayTeamId = match.away_team?.id;
    const winningTeamId = homeScore > awayScore ? homeTeamId : awayScore > homeScore ? awayTeamId : null;

    const allSheet = [...(teamSheet?.home_team || []), ...(teamSheet?.away_team || [])];
    const sheetMap = new Map(allSheet.map(p => [p.player_id, p]));
    const pStatMap = new Map((playerStats || []).map(p => [p.player_id, p]));

    // 0. Official MVP persisted on match record takes precedence (e.g. manual Admin Override)
    if (match.mvp_player_id) {
        const pStat = pStatMap.get(match.mvp_player_id);
        const sheetEntry = sheetMap.get(match.mvp_player_id);
        if (pStat || sheetEntry) {
            const fp = pStat ? calculatePlayerFantasyPoints(pStat) : 0;
            const rating = sheetEntry?.rating ?? null;
            const statParts: string[] = [];
            if (pStat) {
                if (pStat.passing_tds) statParts.push(`${pStat.passing_tds} Pass TD`);
                if (pStat.passing_yards) statParts.push(`${pStat.passing_yards} Pass Yds`);
                if (pStat.receiving_tds) statParts.push(`${pStat.receiving_tds} Rec TD`);
                if (pStat.receiving_yards) statParts.push(`${pStat.receiving_yards} Rec Yds`);
                if (pStat.rushing_tds) statParts.push(`${pStat.rushing_tds} Rush TD`);
                if (pStat.flag_pulls) statParts.push(`${pStat.flag_pulls} Pulls`);
                if (pStat.interceptions) statParts.push(`${pStat.interceptions} INT`);
                if (pStat.def_sacks) statParts.push(`${pStat.def_sacks} Sacks`);
            } else if (rating) {
                statParts.push(`Match Rating ${rating.toFixed(1)}`);
            }

            const isHome = teamSheet?.home_team?.some(p => p.player_id === match.mvp_player_id);
            const teamId = pStat?.team_id || (isHome ? match.home_team?.id : match.away_team?.id) || '';
            const teamName = pStat?.team_name || (isHome ? match.home_team?.name : match.away_team?.name) || '';

            return {
                playerId: match.mvp_player_id,
                playerName: pStat?.player_name || sheetEntry?.name || 'Match MVP',
                playerImage: pStat?.player_image || sheetEntry?.image,
                playerJerseyNumber: pStat?.player_jersey_number || sheetEntry?.jersey_number,
                playerPosition: pStat?.player_position || sheetEntry?.position,
                teamName,
                teamId,
                fp,
                rating,
                statSummary: statParts.length > 0 ? statParts.slice(0, 3).join(' · ') : undefined,
            };
        }
    }

    // 1. Unified Automated MVP Selection
    // Aggregate all participating players across both stats and team sheets
    const playerIds = new Set<string>();
    (playerStats || []).forEach(p => playerIds.add(p.player_id));
    allSheet.forEach(p => playerIds.add(p.player_id));

    interface Candidate {
        playerId: string;
        playerName: string;
        playerImage?: string;
        playerJerseyNumber?: number;
        playerPosition?: string;
        teamName: string;
        teamId: string;
        fp: number;
        rating: number | null;
        isRateable: boolean;
        isWinningTeam: boolean;
        pStat?: PlayerStat;
        sheetEntry?: TeamSheetPlayer;
    }

    const candidates: Candidate[] = [];

    playerIds.forEach(pid => {
        const pStat = pStatMap.get(pid);
        const sheetEntry = sheetMap.get(pid);
        const fp = pStat ? calculatePlayerFantasyPoints(pStat) : 0;

        const isRateable = Boolean(
            sheetEntry &&
            sheetEntry.position !== '-' &&
            sheetEntry.rating_status !== 'UNRATED' &&
            sheetEntry.rating != null &&
            sheetEntry.rating > 0
        );
        const rating = isRateable ? (sheetEntry!.rating ?? null) : null;

        const isHome = teamSheet?.home_team?.some(p => p.player_id === pid);
        const teamId = pStat?.team_id || (isHome ? homeTeamId : awayTeamId) || '';
        const teamName = pStat?.team_name || (teamId === homeTeamId ? match.home_team?.name : match.away_team?.name) || '';
        const isWinningTeam = winningTeamId ? teamId === winningTeamId : true;

        // Player qualifies if they have a recognized match rating (>= 5.0) or positive fantasy points
        if ((rating !== null && rating >= 5.0) || fp > 0) {
            candidates.push({
                playerId: pid,
                playerName: pStat?.player_name || sheetEntry?.name || 'Player',
                playerImage: pStat?.player_image || sheetEntry?.image,
                playerJerseyNumber: pStat?.player_jersey_number ?? sheetEntry?.jersey_number,
                playerPosition: pStat?.player_position || sheetEntry?.position,
                teamName,
                teamId,
                fp,
                rating,
                isRateable,
                isWinningTeam,
                pStat,
                sheetEntry,
            });
        }
    });

    if (candidates.length === 0) return null;

    // Filter by winning team first
    let pool = candidates.filter(c => c.isWinningTeam);
    if (pool.length === 0) {
        pool = candidates;
    }

    // Sort: highest rated player wins MVP; among rated players, exact rating
    // ties break on Fantasy Points. A player with no official rating (or one
    // below the 5.0 floor) is ranked on Fantasy Points alone, except an
    // exceptional unrated day (fp >= 20) is treated as on par with a strong
    // ~6.0 rating so it can still contend for MVP.
    //
    // This mirrors the backend's rescoring logic in play_stats.go and must
    // reduce to a plain lexicographic (rankKey, fp) compare for the same
    // reason: comparing each pair's own fp against fixed thresholds (as an
    // earlier version of this function did) is relative to the specific
    // opponent, so the relation isn't transitive — three candidates can each
    // rank above the next in a cycle, leaving Array.sort's result dependent
    // on unspecified input order rather than on the stats.
    const rankKey = (c: Candidate): number => {
        const hasRating = c.rating !== null && c.rating >= 5.0;
        if (hasRating) return c.rating as number;
        return c.fp >= 20.0 ? 6.0 : -1.0;
    };
    pool.sort((a, b) => {
        const ak = rankKey(a);
        const bk = rankKey(b);
        if (ak !== bk) return bk - ak;
        return b.fp - a.fp;
    });

    const best = pool[0];
    const p = best.pStat;
    const statParts: string[] = [];
    if (p) {
        if (p.passing_tds) statParts.push(`${p.passing_tds} Pass TD`);
        if (p.passing_yards) statParts.push(`${p.passing_yards} Pass Yds`);
        if (p.receiving_tds) statParts.push(`${p.receiving_tds} Rec TD`);
        if (p.receiving_yards) statParts.push(`${p.receiving_yards} Rec Yds`);
        if (p.rushing_tds) statParts.push(`${p.rushing_tds} Rush TD`);
        if (p.flag_pulls) statParts.push(`${p.flag_pulls} Pulls`);
        if (p.interceptions) statParts.push(`${p.interceptions} INT`);
        if (p.def_sacks) statParts.push(`${p.def_sacks} Sacks`);
    } else if (best.rating) {
        statParts.push(`Match Rating ${best.rating.toFixed(1)}`);
    }

    return {
        playerId: best.playerId,
        playerName: best.playerName,
        playerImage: best.playerImage,
        playerJerseyNumber: best.playerJerseyNumber,
        playerPosition: best.playerPosition,
        teamName: best.teamName,
        teamId: best.teamId,
        fp: best.fp,
        rating: best.rating,
        statSummary: statParts.length > 0 ? statParts.slice(0, 3).join(' · ') : undefined,
    };
}

interface MatchSummaryTabProps {
    match: Match;
    teamSheet?: MatchTeamSheet;
}

export const MatchSummaryTab = ({ match, teamSheet = { home_team: [], away_team: [] } }: MatchSummaryTabProps) => {
    const homeTeam = match.home_team;
    const awayTeam = match.away_team;
    const homeTeamId = homeTeam?.id;
    const awayTeamId = awayTeam?.id;

    // Sub-view toggle inside summary tab: 'all' | 'comparison' | 'boxscore'
    const [viewMode, setViewMode] = useState<'comparison' | 'boxscore'>('comparison');

    // 1. Fetch public match stats (derived player stats)
    const { data: statsData, isLoading: statsLoading } = useQuery({
        queryKey: ['publicMatchStatsCompare', match.id],
        queryFn: () => getPublicMatchStats(match.id),
        enabled: !!match.id,
    });

    // 2. Fetch match plays for halves calculation and discipline metrics
    const { data: plays = [], isLoading: playsLoading } = useQuery({
        queryKey: ['publicMatchPlays', match.id],
        queryFn: () => getMatchPlays(match.id),
        enabled: !!match.id,
    });

    const playerStats: PlayerStat[] = useMemo(() => {
        return statsData?.derived || statsData?.current || [];
    }, [statsData]);

    // Map players with calculated Fantasy Points
    const playersWithFP = useMemo(() => {
        return playerStats.map(p => ({
            ...p,
            fp: calculatePlayerFantasyPoints(p),
        }));
    }, [playerStats]);

    // ── Score by Period / Half ──
    const periodScores = useMemo(() => {
        if (!plays || plays.length === 0) {
            return {
                hasHalves: false,
                home1H: '-',
                away1H: '-',
                home2H: '-',
                away2H: '-',
                homeFT: match.home_score ?? 0,
                awayFT: match.away_score ?? 0,
            };
        }

        // Q1 plays (1st Half in SFFL)
        const q1Plays = plays.filter(p => (p.quarter ?? 1) === 1);
        let lastQ1WithScore: GamePlay | undefined;
        for (let i = q1Plays.length - 1; i >= 0; i--) {
            if (q1Plays[i].home_score_after != null && q1Plays[i].away_score_after != null) {
                lastQ1WithScore = q1Plays[i];
                break;
            }
        }

        if (lastQ1WithScore && lastQ1WithScore.home_score_after != null && lastQ1WithScore.away_score_after != null) {
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
            home1H: '-',
            away1H: '-',
            home2H: '-',
            away2H: '-',
            homeFT: match.home_score ?? 0,
            awayFT: match.away_score ?? 0,
        };
    }, [plays, match.home_score, match.away_score]);

    // ── Team Head-to-Head Stats Comparison ──
    const teamComparison = useMemo(() => {
        const homeSheet = teamSheet?.home_team || [];
        const awaySheet = teamSheet?.away_team || [];

        const isFemale = (sheet: TeamSheetPlayer[], playerId: string) => {
            const found = sheet.find(p => p.player_id === playerId);
            if (!found?.gender) return false;
            const g = found.gender.toLowerCase().trim();
            return g === 'female' || g === 'f';
        };

        const initStats = () => ({
            plays: 0,
            yards: 0,
            catches: 0,
            drops: 0,
            passAttempts: 0,
            completions: 0,
            punts: 0,
            turnovers: 0,
            totalTDs: 0,
            femaleTDs: 0,
            flagPulls: 0,
            interceptions: 0,
            batDowns: 0,
            infractions: 0,
            sacks: 0,
            pickSix: 0,
        });

        const home = initStats();
        const away = initStats();

        playerStats.forEach(p => {
            const isHome = p.team_id === homeTeamId;
            const target = isHome ? home : away;
            const sheet = isHome ? homeSheet : awaySheet;

            target.plays += (p.passing_attempts || 0) + (p.rushing_attempts || 0);
            target.yards += (p.passing_yards || 0) + (p.rushing_yards || 0);
            target.catches += p.receptions || 0;
            target.drops += p.drops || 0;
            target.passAttempts += p.passing_attempts || 0;
            target.completions += p.completed_passes || 0;
            target.turnovers += p.interceptions_thrown || 0;
            target.totalTDs += (p.passing_tds || 0) + (p.rushing_tds || 0);
            if (isFemale(sheet, p.player_id)) {
                target.femaleTDs += (p.receiving_tds || 0) + (p.rushing_tds || 0);
            }
            target.flagPulls += p.flag_pulls || 0;
            target.interceptions += p.interceptions || 0;
            target.batDowns += (p.batted_down_passes || 0) + (p.pass_deflections || 0);
            target.sacks += p.def_sacks || 0;
        });

        // If plays exist, compute precise turnovers (TO on downs, INTs, bad snaps) from play-by-play
        if (plays.length > 0) {
            home.turnovers = 0;
            away.turnovers = 0;
        }

        // Derive punts, turnovers, penalties (infractions) and pick-sixes from plays
        plays.forEach(pl => {
            if (pl.play_type === 'PUNT') {
                if (pl.offense_team_id === homeTeamId) home.punts += 1;
                else if (pl.offense_team_id === awayTeamId) away.punts += 1;
            }
            const isTO = pl.result === 'TO' || 
                         pl.result === 'INT' || 
                         pl.play_type === 'INT' || 
                         pl.play_type === 'BADSNAP';
            if (isTO) {
                if (pl.offense_team_id === homeTeamId) home.turnovers += 1;
                else if (pl.offense_team_id === awayTeamId) away.turnovers += 1;
            }
            if (pl.penalty) {
                if (pl.penalty_team_id === homeTeamId) home.infractions += 1;
                else if (pl.penalty_team_id === awayTeamId) away.infractions += 1;
            }
            if ((pl.result === 'INT' || pl.play_type === 'INT') && pl.returned_for_td) {
                // Defender's team gets the pick 6
                if (pl.offense_team_id === homeTeamId) away.pickSix += 1;
                else if (pl.offense_team_id === awayTeamId) home.pickSix += 1;
            }
        });

        const homeCompPct = home.passAttempts > 0 ? Math.round((home.completions / home.passAttempts) * 100) : 0;
        const awayCompPct = away.passAttempts > 0 ? Math.round((away.completions / away.passAttempts) * 100) : 0;

        return { home, away, homeCompPct, awayCompPct };
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
            .filter(p => (p.passing_attempts || 0) > 0 || (p.receptions || 0) > 0 || (p.rushing_attempts || 0) > 0 || (p.passing_yards || 0) > 0 || (p.receiving_yards || 0) > 0)
            .sort((a, b) => b.fp - a.fp)
            .slice(0, 6);
    }, [playersWithFP]);

    // ── Defensive Box Score ──
    const defensiveBoxScore = useMemo(() => {
        return playersWithFP
            .filter(p => (p.flag_pulls || 0) > 0 || (p.pass_deflections || 0) > 0 || (p.batted_down_passes || 0) > 0 || (p.interceptions || 0) > 0 || (p.def_sacks || 0) > 0)
            .sort((a, b) => b.fp - a.fp)
            .slice(0, 6);
    }, [playersWithFP]);

    if (statsLoading || playsLoading) {
        return (
            <div className="py-16 text-center">
                <Spinner size="lg" className="mx-auto text-sffl-red" />
                <p className="mt-3 text-sm font-semibold text-gray-500 dark:text-gray-400">Loading match summary...</p>
            </div>
        );
    }

    const { home, away, homeCompPct, awayCompPct } = teamComparison;

    // Helper for rendering horizontal comparison bar
    const renderComparisonRow = (
        label: string,
        homeVal: number | string,
        awayVal: number | string,
        rawHome: number,
        rawAway: number
    ) => {
        const total = rawHome + rawAway;
        const homeWidthPct = total > 0 ? Math.max(8, Math.min(92, Math.round((rawHome / total) * 100))) : 50;

        return (
            <div className="py-2.5 border-b border-gray-100 dark:border-gray-700/60 last:border-0">
                <div className="flex items-center justify-between text-xs mb-1.5 px-1">
                    <span className="font-black tabular-nums text-sffl-navy dark:text-gray-100 w-12 text-left">
                        {homeVal}
                    </span>
                    <span className="font-semibold text-gray-600 dark:text-gray-300 text-center flex-1 px-2 text-[11px] md:text-xs">
                        {label}
                    </span>
                    <span className="font-black tabular-nums text-sffl-red dark:text-red-400 w-12 text-right">
                        {awayVal}
                    </span>
                </div>
                <div className="h-1.5 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden flex">
                    <div
                        className="h-full bg-sffl-navy dark:bg-blue-500 transition-all duration-500"
                        style={{ width: `${homeWidthPct}%` }}
                        title={`${homeTeam?.name || 'Home'}: ${homeVal}`}
                    />
                    <div
                        className="h-full bg-sffl-red dark:bg-red-500 transition-all duration-500 flex-1"
                        title={`${awayTeam?.name || 'Away'}: ${awayVal}`}
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
                <div className="lg:col-span-5 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-5 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-4 border-b border-gray-100 dark:border-gray-700 pb-3">
                            <div>
                                <span className="text-[10px] font-black tracking-widest uppercase text-gray-500 dark:text-gray-400">Score by Half</span>
                                <h3 className="text-base font-black text-sffl-navy dark:text-white uppercase tracking-tight">Period Breakdown</h3>
                            </div>
                            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 tabular-nums">
                                {match.status === 'FINISHED' ? 'Final' : match.status}
                            </span>
                        </div>

                        {/* Halves Table */}
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700 font-bold uppercase text-[10px]">
                                        <th className="py-2 text-left">Team</th>
                                        <th className="py-2 text-center w-12">1H</th>
                                        <th className="py-2 text-center w-12">2H</th>
                                        <th className="py-2 text-right w-12 font-black text-sffl-navy dark:text-white">FT</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60 font-semibold">
                                    <tr>
                                        <td className="py-3 flex items-center gap-2 text-sffl-navy dark:text-gray-200 font-black truncate max-w-[140px]">
                                            {homeTeam?.logo ? (
                                                <img src={homeTeam.logo} alt={homeTeam.name} className="w-5 h-5 object-contain flex-shrink-0" />
                                            ) : (
                                                <span className="w-5 h-5 rounded-full bg-sffl-navy text-white text-[9px] flex items-center justify-center font-black">
                                                    {homeTeam?.short_name?.slice(0, 2) || 'H'}
                                                </span>
                                            )}
                                            <span className="truncate">{homeTeam?.name || 'Home'}</span>
                                        </td>
                                        <td className="py-3 text-center tabular-nums text-gray-700 dark:text-gray-300">{periodScores.home1H}</td>
                                        <td className="py-3 text-center tabular-nums text-gray-700 dark:text-gray-300">{periodScores.home2H}</td>
                                        <td className="py-3 text-right tabular-nums font-black text-sm text-sffl-navy dark:text-white">{periodScores.homeFT}</td>
                                    </tr>
                                    <tr>
                                        <td className="py-3 flex items-center gap-2 text-sffl-navy dark:text-gray-200 font-black truncate max-w-[140px]">
                                            {awayTeam?.logo ? (
                                                <img src={awayTeam.logo} alt={awayTeam.name} className="w-5 h-5 object-contain flex-shrink-0" />
                                            ) : (
                                                <span className="w-5 h-5 rounded-full bg-sffl-red text-white text-[9px] flex items-center justify-center font-black">
                                                    {awayTeam?.short_name?.slice(0, 2) || 'A'}
                                                </span>
                                            )}
                                            <span className="truncate">{awayTeam?.name || 'Away'}</span>
                                        </td>
                                        <td className="py-3 text-center tabular-nums text-gray-700 dark:text-gray-300">{periodScores.away1H}</td>
                                        <td className="py-3 text-center tabular-nums text-gray-700 dark:text-gray-300">{periodScores.away2H}</td>
                                        <td className="py-3 text-right tabular-nums font-black text-sm text-sffl-red dark:text-red-400">{periodScores.awayFT}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
                        <span>📍 {match.venue || 'Showtime Stadium'}</span>
                        <span>{match.date ? new Date(match.date).toLocaleDateString() : ''}</span>
                    </div>
                </div>

                {/* MVP & Top Performers Card (7 cols) */}
                <div className="lg:col-span-7 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
                    <div className="flex items-center justify-between mb-4 border-b border-gray-100 dark:border-gray-700 pb-3">
                        <div>
                            <span className="text-[10px] font-black tracking-widest uppercase text-amber-600 dark:text-amber-400">Showtime Spotlight</span>
                            <h3 className="text-base font-black text-sffl-navy dark:text-white uppercase tracking-tight">Match MVP & Top Performers</h3>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 uppercase tracking-wider">
                            Rating & Fantasy Calibrated
                        </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                        {/* MVP Spotlight Banner (6 cols) */}
                        {mvpPlayer ? (
                            <div className="md:col-span-6 bg-gradient-to-br from-amber-50 to-orange-50/40 dark:from-gray-700/60 dark:to-gray-800 p-4 rounded-xl border border-amber-200/70 dark:border-gray-600 relative overflow-hidden">
                                <div className="flex items-center gap-3">
                                    {mvpPlayer.playerImage ? (
                                        <div className="w-14 h-14 rounded-full overflow-hidden ring-2 ring-amber-400 dark:ring-amber-500 shadow-md flex-shrink-0">
                                            <LightboxImage
                                                src={mvpPlayer.playerImage}
                                                alt={mvpPlayer.playerName}
                                                thumbnailClassName="w-full h-full"
                                                imgClassName="w-full h-full object-cover"
                                            />
                                        </div>
                                    ) : (
                                        <div className="w-14 h-14 rounded-full bg-amber-500 text-white flex items-center justify-center font-black text-base shadow-md flex-shrink-0">
                                            #{mvpPlayer.playerJerseyNumber || 'MVP'}
                                        </div>
                                    )}
                                    <div className="min-w-0 flex-1">
                                        <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500 text-white inline-block mb-1">
                                            ⭐ MATCH MVP
                                        </span>
                                        <Link
                                            to={`/players/${mvpPlayer.playerId}?match=${match.id}`}
                                            className="block font-black text-sm text-sffl-navy dark:text-white truncate hover:text-sffl-red transition-colors"
                                        >
                                            {mvpPlayer.playerName}
                                        </Link>
                                        <p className="text-[11px] text-gray-600 dark:text-gray-300 font-semibold truncate">
                                            {mvpPlayer.teamName} · {mvpPlayer.playerPosition}
                                        </p>
                                    </div>
                                </div>
                                <div className="mt-3 pt-2.5 border-t border-amber-200/60 dark:border-gray-600 flex items-center justify-between">
                                    <div className="text-[11px] text-gray-600 dark:text-gray-300 font-medium truncate max-w-[180px]">
                                        {mvpPlayer.statSummary || (mvpPlayer.rating ? `Rating: ${mvpPlayer.rating.toFixed(1)}` : 'Impact Player')}
                                    </div>
                                    <div className="text-right flex-shrink-0 flex items-center gap-2">
                                        {mvpPlayer.rating != null && (
                                            <div className="flex flex-col items-end">
                                                <div className="flex items-baseline gap-0.5">
                                                    <span className="text-lg font-black text-amber-600 dark:text-amber-400 tabular-nums leading-none">
                                                        {mvpPlayer.rating.toFixed(1)}
                                                    </span>
                                                    <span className="text-[9px] font-black text-amber-500">★</span>
                                                </div>
                                                <span className="text-[8px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Rating</span>
                                            </div>
                                        )}
                                        {mvpPlayer.fp > 0 && (
                                            <div className={`flex flex-col items-end ${mvpPlayer.rating != null ? 'pl-2 border-l border-amber-200/80 dark:border-gray-600' : ''}`}>
                                                <span className="text-lg font-black text-gray-800 dark:text-gray-100 tabular-nums leading-none">
                                                    {mvpPlayer.fp.toFixed(1)}
                                                </span>
                                                <span className="text-[8px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">FP</span>
                                            </div>
                                        )}
                                        {mvpPlayer.rating == null && mvpPlayer.fp <= 0 && (
                                            <span className="text-xs font-black text-amber-600 dark:text-amber-400">MVP</span>
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
                                        className="flex items-center justify-between p-2 rounded-xl bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group"
                                    >
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <span className="w-5 h-5 rounded-full bg-sffl-navy/10 dark:bg-white/10 text-sffl-navy dark:text-gray-300 font-black text-[10px] flex items-center justify-center flex-shrink-0">
                                                {idx + 1}
                                            </span>
                                            <div className="truncate min-w-0">
                                                <div className="font-bold text-xs text-sffl-navy dark:text-white truncate group-hover:text-sffl-red transition-colors">
                                                    {tp.player_name}
                                                </div>
                                                <div className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                                                    {tp.team_short_name || tp.team_name} · {tp.player_position}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right flex-shrink-0 ml-2 font-black text-xs text-amber-600 dark:text-amber-400 tabular-nums">
                                            {tp.fp.toFixed(1)} <span className="text-[9px] font-normal text-gray-400">FP</span>
                                        </div>
                                    </Link>
                                ))
                            ) : (
                                <p className="text-gray-400 text-xs italic py-2">No fantasy points recorded yet.</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Sub-Toggle: Team Comparison vs Key Box Score ── */}
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-2">
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setViewMode('comparison')}
                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-tight transition-all ${viewMode === 'comparison'
                            ? 'bg-sffl-navy text-white shadow-sm'
                            : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                            }`}
                    >
                        📊 Team Comparison
                    </button>
                    <button
                        type="button"
                        onClick={() => setViewMode('boxscore')}
                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-tight transition-all ${viewMode === 'boxscore'
                            ? 'bg-sffl-navy text-white shadow-sm'
                            : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                            }`}
                    >
                        📋 Key Box Score
                    </button>
                </div>
                <div className="hidden sm:flex items-center gap-4 text-xs font-bold">
                    <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-sffl-navy dark:bg-blue-500" />
                        <span className="text-gray-700 dark:text-gray-300">{homeTeam?.name || 'Home'}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-sffl-red dark:bg-red-500" />
                        <span className="text-gray-700 dark:text-gray-300">{awayTeam?.name || 'Away'}</span>
                    </div>
                </div>
            </div>

            {/* ── VIEW 1: Head-to-Head Team Comparison ── */}
            {viewMode === 'comparison' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                    {/* Group A: Attack & Possession */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
                        <div className="flex items-center justify-between mb-3 border-b border-gray-100 dark:border-gray-700 pb-3">
                            <h4 className="text-xs font-black tracking-widest uppercase text-sffl-navy dark:text-white flex items-center gap-2">
                                <span>🏈</span> Attack & Possession
                            </h4>
                            <span className="text-[10px] font-bold text-gray-400 uppercase">Match Comparison</span>
                        </div>
                        <div className="divide-y divide-gray-50 dark:divide-gray-700/40">
                            {renderComparisonRow('Total Plays', home.plays, away.plays, home.plays, away.plays)}
                            {renderComparisonRow('Total Yards', home.yards, away.yards, home.yards, away.yards)}
                            {renderComparisonRow('Pass Completion %', `${homeCompPct}%`, `${awayCompPct}%`, homeCompPct, awayCompPct)}
                            {renderComparisonRow('Catches', home.catches, away.catches, home.catches, away.catches)}
                            {renderComparisonRow('Drops', home.drops, away.drops, home.drops, away.drops)}
                            {renderComparisonRow('Turnovers', home.turnovers, away.turnovers, home.turnovers, away.turnovers)}
                            {renderComparisonRow('Punts', home.punts, away.punts, home.punts, away.punts)}
                            {renderComparisonRow('Total Touchdowns', home.totalTDs, away.totalTDs, home.totalTDs, away.totalTDs)}
                            {renderComparisonRow('Female Touchdowns', home.femaleTDs, away.femaleTDs, home.femaleTDs, away.femaleTDs)}
                        </div>
                    </div>

                    {/* Group B: Defence & Discipline */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
                        <div className="flex items-center justify-between mb-3 border-b border-gray-100 dark:border-gray-700 pb-3">
                            <h4 className="text-xs font-black tracking-widest uppercase text-sffl-navy dark:text-white flex items-center gap-2">
                                <span>🛡️</span> Defence & Discipline
                            </h4>
                            <span className="text-[10px] font-bold text-gray-400 uppercase">Match Comparison</span>
                        </div>
                        <div className="divide-y divide-gray-50 dark:divide-gray-700/40">
                            {renderComparisonRow('Flag Pulls', home.flagPulls, away.flagPulls, home.flagPulls, away.flagPulls)}
                            {renderComparisonRow('Interceptions', home.interceptions, away.interceptions, home.interceptions, away.interceptions)}
                            {renderComparisonRow('Bat Downs / Deflections', home.batDowns, away.batDowns, home.batDowns, away.batDowns)}
                            {renderComparisonRow('QB / Def Sacks', home.sacks, away.sacks, home.sacks, away.sacks)}
                            {renderComparisonRow('Infractions (Penalties)', home.infractions, away.infractions, home.infractions, away.infractions)}
                            {renderComparisonRow('Pick 6 Scores', home.pickSix, away.pickSix, home.pickSix, away.pickSix)}
                        </div>

                        {/* Discipline Note */}
                        {(home.infractions > 0 || away.infractions > 0) && (
                            <div className="mt-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-900 dark:text-amber-200 flex items-start gap-2">
                                <span>⚠️</span>
                                <span>
                                    {homeTeam?.short_name || 'Home'}: <strong>{home.infractions}</strong> penalty call{home.infractions === 1 ? '' : 's'} · {awayTeam?.short_name || 'Away'}: <strong>{away.infractions}</strong> penalty call{away.infractions === 1 ? '' : 's'}.
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── VIEW 2: Key Performers Box Score ── */}
            {viewMode === 'boxscore' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                    {/* Offensive Box Score */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                            <h4 className="font-black text-sm text-sffl-navy dark:text-white uppercase tracking-tight flex items-center gap-2">
                                <span>⚡</span> Offensive Highlights
                            </h4>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                                TOP 6
                            </span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs text-left">
                                <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 font-bold uppercase text-[10px] border-b border-gray-200 dark:border-gray-700">
                                    <tr>
                                        <th className="py-2.5 px-4">Player</th>
                                        <th className="py-2.5 px-3 text-center">CMP/ATT</th>
                                        <th className="py-2.5 px-3 text-center">YDS</th>
                                        <th className="py-2.5 px-3 text-center">TD</th>
                                        <th className="py-2.5 px-4 text-right">FP</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60 font-semibold">
                                    {offensiveBoxScore.length > 0 ? (
                                        offensiveBoxScore.map(p => (
                                            <tr key={p.player_id} className="hover:bg-gray-50/80 dark:hover:bg-gray-700/40 transition-colors">
                                                <td className="py-3 px-4">
                                                    <Link
                                                        to={`/players/${p.player_id}?match=${match.id}`}
                                                        className="font-black text-sffl-navy dark:text-white hover:text-sffl-red transition-colors block truncate max-w-[150px]"
                                                    >
                                                        {p.player_name}
                                                    </Link>
                                                    <span className="text-[10px] text-gray-500 dark:text-gray-400 block truncate">
                                                        {p.team_short_name || p.team_name} · {p.player_position}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-3 text-center tabular-nums text-gray-700 dark:text-gray-300">
                                                    {p.passing_attempts > 0 ? `${p.completed_passes}/${p.passing_attempts}` : p.receptions > 0 ? `${p.receptions} REC` : '-'}
                                                </td>
                                                <td className="py-3 px-3 text-center tabular-nums text-gray-700 dark:text-gray-300">
                                                    {(p.passing_yards || 0) + (p.receiving_yards || 0) + (p.rushing_yards || 0)}
                                                </td>
                                                <td className="py-3 px-3 text-center tabular-nums font-bold text-sffl-navy dark:text-white">
                                                    {(p.passing_tds || 0) + (p.receiving_tds || 0) + (p.rushing_tds || 0)}
                                                </td>
                                                <td className="py-3 px-4 text-right tabular-nums font-black text-amber-600 dark:text-amber-400">
                                                    {p.fp.toFixed(1)}
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={5} className="py-8 text-center text-gray-400 italic">No offensive statistics recorded yet.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Defensive Box Score */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                            <h4 className="font-black text-sm text-sffl-navy dark:text-white uppercase tracking-tight flex items-center gap-2">
                                <span>🛡️</span> Defensive Highlights
                            </h4>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                                TOP 6
                            </span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs text-left">
                                <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 font-bold uppercase text-[10px] border-b border-gray-200 dark:border-gray-700">
                                    <tr>
                                        <th className="py-2.5 px-4">Player</th>
                                        <th className="py-2.5 px-3 text-center">PULL</th>
                                        <th className="py-2.5 px-3 text-center">BAT</th>
                                        <th className="py-2.5 px-3 text-center">INT</th>
                                        <th className="py-2.5 px-4 text-right">FP</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60 font-semibold">
                                    {defensiveBoxScore.length > 0 ? (
                                        defensiveBoxScore.map(p => (
                                            <tr key={p.player_id} className="hover:bg-gray-50/80 dark:hover:bg-gray-700/40 transition-colors">
                                                <td className="py-3 px-4">
                                                    <Link
                                                        to={`/players/${p.player_id}?match=${match.id}`}
                                                        className="font-black text-sffl-navy dark:text-white hover:text-sffl-red transition-colors block truncate max-w-[150px]"
                                                    >
                                                        {p.player_name}
                                                    </Link>
                                                    <span className="text-[10px] text-gray-500 dark:text-gray-400 block truncate">
                                                        {p.team_short_name || p.team_name} · {p.player_position}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-3 text-center tabular-nums text-gray-700 dark:text-gray-300">
                                                    {p.flag_pulls || 0}
                                                </td>
                                                <td className="py-3 px-3 text-center tabular-nums text-gray-700 dark:text-gray-300">
                                                    {(p.pass_deflections || 0) + (p.batted_down_passes || 0)}
                                                </td>
                                                <td className="py-3 px-3 text-center tabular-nums font-bold text-sffl-navy dark:text-white">
                                                    {p.interceptions || 0}
                                                </td>
                                                <td className="py-3 px-4 text-right tabular-nums font-black text-amber-600 dark:text-amber-400">
                                                    {p.fp.toFixed(1)}
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={5} className="py-8 text-center text-gray-400 italic">No defensive statistics recorded yet.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};


