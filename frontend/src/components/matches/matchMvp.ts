// Match MVP scoring shared by the match summary tab and the match page header.
import type {
  Match,
  MatchTeamSheet,
  TeamSheetPlayer,
  UnifiedMvpResult,
  PlayerStat,
} from "../../types";
import { formatStatNumber } from "../../utils";

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
  const passDeflections =
    (s.pass_deflections || s.batted_down_passes || 0) * 0.25;
  const ints = (s.interceptions || 0) * 1.25;
  const defSacks = (s.def_sacks || 0) * 0.75;
  const defTds = (s.defensive_tds || 0) * 2.0;
  const defXpTds = (s.defensive_xp_tds || 0) * 1.0;
  const safety = (s.safety || 0) * 1.25;

  const total =
    passYds +
    passTds +
    intThrown +
    qbSacks +
    rushYds +
    rushTds +
    rec +
    recYds +
    recTds +
    drops +
    xpGood +
    xpTds +
    flagPulls +
    passDeflections +
    ints +
    defSacks +
    defTds +
    defXpTds +
    safety;
  return Math.max(0, Math.round(total * 10) / 10);
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
  playerStats: PlayerStat[],
): UnifiedMvpResult | null {
  const homeScore = match.home_score ?? 0;
  const awayScore = match.away_score ?? 0;
  const homeTeamId = match.home_team?.id;
  const awayTeamId = match.away_team?.id;
  const winningTeamId =
    homeScore > awayScore
      ? homeTeamId
      : awayScore > homeScore
        ? awayTeamId
        : null;

  const allSheet = [
    ...(teamSheet?.home_team || []),
    ...(teamSheet?.away_team || []),
  ];
  const sheetMap = new Map(allSheet.map((p) => [p.player_id, p]));
  const pStatMap = new Map((playerStats || []).map((p) => [p.player_id, p]));

  // 0. Official MVP persisted on match record takes precedence (e.g. manual Admin Override)
  if (match.mvp_player_id) {
    const pStat = pStatMap.get(match.mvp_player_id);
    const sheetEntry = sheetMap.get(match.mvp_player_id);
    const fp = pStat ? calculatePlayerFantasyPoints(pStat) : 0;
    const rating = sheetEntry?.rating ?? null;
    const statParts: string[] = [];
    if (pStat) {
      if (pStat.passing_tds)
        statParts.push(`${formatStatNumber(pStat.passing_tds)} Pass TD`);
      if (pStat.passing_yards)
        statParts.push(`${formatStatNumber(pStat.passing_yards)} Pass Yds`);
      if (pStat.receiving_tds)
        statParts.push(`${formatStatNumber(pStat.receiving_tds)} Rec TD`);
      if (pStat.receiving_yards)
        statParts.push(`${formatStatNumber(pStat.receiving_yards)} Rec Yds`);
      if (pStat.rushing_tds)
        statParts.push(`${formatStatNumber(pStat.rushing_tds)} Rush TD`);
      if (pStat.flag_pulls)
        statParts.push(`${formatStatNumber(pStat.flag_pulls)} Pulls`);
      if (pStat.interceptions)
        statParts.push(`${formatStatNumber(pStat.interceptions)} INT`);
      if (pStat.def_sacks)
        statParts.push(`${formatStatNumber(pStat.def_sacks)} Sacks`);
    } else if (rating) {
      statParts.push(`Match Rating ${rating.toFixed(1)}`);
    }

    const isHome = teamSheet?.home_team?.some(
      (p) => p.player_id === match.mvp_player_id,
    );
    const teamId =
      pStat?.team_id ||
      (isHome ? match.home_team?.id : match.away_team?.id) ||
      "";
    const teamName =
      pStat?.team_name ||
      (isHome ? match.home_team?.name : match.away_team?.name) ||
      "";

    return {
      playerId: match.mvp_player_id,
      playerName:
        pStat?.player_name || sheetEntry?.name || "Official Match MVP",
      playerImage: pStat?.player_image || sheetEntry?.image,
      playerJerseyNumber:
        pStat?.player_jersey_number || sheetEntry?.jersey_number,
      playerPosition: pStat?.player_position || sheetEntry?.position,
      teamName,
      teamId,
      fp,
      rating,
      statSummary:
        statParts.length > 0 ? statParts.slice(0, 3).join(" · ") : undefined,
    };
  }

  // 1. Unified Automated MVP Selection
  // Aggregate all participating players across both stats and team sheets
  const playerIds = new Set<string>();
  (playerStats || []).forEach((p) => playerIds.add(p.player_id));
  allSheet.forEach((p) => playerIds.add(p.player_id));

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

  playerIds.forEach((pid) => {
    const pStat = pStatMap.get(pid);
    const sheetEntry = sheetMap.get(pid);
    const fp = pStat ? calculatePlayerFantasyPoints(pStat) : 0;

    const isRateable = Boolean(
      sheetEntry &&
      sheetEntry.position !== "-" &&
      sheetEntry.rating_status !== "UNRATED" &&
      sheetEntry.rating != null &&
      sheetEntry.rating > 0,
    );
    const rating = isRateable ? (sheetEntry!.rating ?? null) : null;

    const isHome = teamSheet?.home_team?.some((p) => p.player_id === pid);
    const teamId = pStat?.team_id || (isHome ? homeTeamId : awayTeamId) || "";
    const teamName =
      pStat?.team_name ||
      (teamId === homeTeamId ? match.home_team?.name : match.away_team?.name) ||
      "";
    const isWinningTeam = winningTeamId ? teamId === winningTeamId : true;

    // Player qualifies if they have a recognized match rating (>= 5.0) or positive fantasy points
    if ((rating !== null && rating >= 5.0) || fp > 0) {
      candidates.push({
        playerId: pid,
        playerName: pStat?.player_name || sheetEntry?.name || "Player",
        playerImage: pStat?.player_image || sheetEntry?.image,
        playerJerseyNumber:
          pStat?.player_jersey_number ?? sheetEntry?.jersey_number,
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
  let pool = candidates.filter((c) => c.isWinningTeam);
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
    if (p.passing_tds)
      statParts.push(`${formatStatNumber(p.passing_tds)} Pass TD`);
    if (p.passing_yards)
      statParts.push(`${formatStatNumber(p.passing_yards)} Pass Yds`);
    if (p.receiving_tds)
      statParts.push(`${formatStatNumber(p.receiving_tds)} Rec TD`);
    if (p.receiving_yards)
      statParts.push(`${formatStatNumber(p.receiving_yards)} Rec Yds`);
    if (p.rushing_tds)
      statParts.push(`${formatStatNumber(p.rushing_tds)} Rush TD`);
    if (p.flag_pulls) statParts.push(`${formatStatNumber(p.flag_pulls)} Pulls`);
    if (p.interceptions)
      statParts.push(`${formatStatNumber(p.interceptions)} INT`);
    if (p.def_sacks) statParts.push(`${formatStatNumber(p.def_sacks)} Sacks`);
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
    statSummary:
      statParts.length > 0 ? statParts.slice(0, 3).join(" · ") : undefined,
  };
}
