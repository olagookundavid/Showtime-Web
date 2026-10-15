// Head-to-head team totals for a match, from its derived player stats and its
// play log. The public match page's comparison and the broadcast's attack and
// defence scenes both read from here, so the stream and the website always
// show the same numbers.

import type { GamePlay, PlayerStat } from '../types';

export interface TeamTotals {
  plays: number;
  yards: number;
  catches: number;
  drops: number;
  passAttempts: number;
  completions: number;
  punts: number;
  turnovers: number;
  totalTDs: number;
  femaleTDs: number;
  flagPulls: number;
  interceptions: number;
  batDowns: number;
  infractions: number;
  sacks: number;
  pickSix: number;
}

export interface TeamComparison {
  home: TeamTotals;
  away: TeamTotals;
  homeCompPct: number;
  awayCompPct: number;
}

const initTotals = (): TeamTotals => ({
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

export function computeTeamComparison({
  playerStats,
  plays,
  homeTeamId,
  awayTeamId,
  isFemale,
}: {
  playerStats: PlayerStat[];
  plays: GamePlay[];
  homeTeamId?: string;
  awayTeamId?: string;
  /** Whether the player is a woman, from the side's team sheet. */
  isFemale: (side: 'home' | 'away', playerId: string) => boolean;
}): TeamComparison {
  const home = initTotals();
  const away = initTotals();

  playerStats.forEach((p) => {
    const isHome = p.team_id === homeTeamId;
    const target = isHome ? home : away;

    target.plays += (p.passing_attempts || 0) + (p.rushing_attempts || 0);
    target.yards += (p.passing_yards || 0) + (p.rushing_yards || 0);
    target.catches += p.receptions || 0;
    target.drops += p.drops || 0;
    target.passAttempts += p.passing_attempts || 0;
    target.completions += p.completed_passes || 0;
    target.turnovers += p.interceptions_thrown || 0;
    target.totalTDs += (p.passing_tds || 0) + (p.rushing_tds || 0);
    if (isFemale(isHome ? 'home' : 'away', p.player_id)) {
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
  plays.forEach((pl) => {
    if (pl.play_type === 'PUNT') {
      if (pl.offense_team_id === homeTeamId) home.punts += 1;
      else if (pl.offense_team_id === awayTeamId) away.punts += 1;
    }
    const isTO =
      pl.result === 'TO' ||
      pl.result === 'INT' ||
      pl.play_type === 'INT' ||
      (pl.play_type === 'BADSNAP' && pl.result === 'TO');
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
}

/** One head-to-head line: what each side shows, and the numbers its bar is split by. */
export interface ComparisonRow {
  label: string;
  homeText: string | number;
  awayText: string | number;
  homeValue: number;
  awayValue: number;
}

const row = (label: string, home: number, away: number): ComparisonRow => ({
  label,
  homeText: home,
  awayText: away,
  homeValue: home,
  awayValue: away,
});

/** The Attack & Possession lines, in display order. */
export function attackRows({ home, away, homeCompPct, awayCompPct }: TeamComparison): ComparisonRow[] {
  return [
    row('Total Plays', home.plays, away.plays),
    row('Total Yards', home.yards, away.yards),
    {
      label: 'Pass Completion %',
      homeText: `${homeCompPct}%`,
      awayText: `${awayCompPct}%`,
      homeValue: homeCompPct,
      awayValue: awayCompPct,
    },
    row('Catches', home.catches, away.catches),
    row('Drops', home.drops, away.drops),
    row('Turnovers', home.turnovers, away.turnovers),
    row('Punts', home.punts, away.punts),
    row('Total Touchdowns', home.totalTDs, away.totalTDs),
    row('Female Touchdowns', home.femaleTDs, away.femaleTDs),
  ];
}

/** The Defence & Discipline lines, in display order. */
export function defenceRows({ home, away }: TeamComparison): ComparisonRow[] {
  return [
    row('Flag Pulls', home.flagPulls, away.flagPulls),
    row('Interceptions', home.interceptions, away.interceptions),
    row('Bat Downs / Deflections', home.batDowns, away.batDowns),
    row('QB / Def Sacks', home.sacks, away.sacks),
    row('Infractions (Penalties)', home.infractions, away.infractions),
    row('Pick 6 Scores', home.pickSix, away.pickSix),
  ];
}
