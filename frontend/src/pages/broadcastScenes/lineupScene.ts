// The starting-lineup scene's layout, one team at a time: where each of the
// team's starters stands (its offence on the left half of the field, its
// defence on the right), the order they are introduced in, and its bench.
// Placement comes from the same helpers as the public Team Sheets tab, so the
// broadcast and the website always show the same lineup.

import {
  gameFormatOfCompetitionFormat,
  placeStarters,
  schemeFor,
  splitLineup,
  validCoverage,
} from '../../utils';
import type { SceneData, ScenePlayer, TeamSheetPlayer } from '../../types';

export type LineupUnit = 'offense' | 'defense';

export interface LineupNode {
  /** The player's id: stable across renders, so moving into place animates. */
  key: string;
  unit: LineupUnit;
  player: ScenePlayer;
  /** Short role on the player's field card, e.g. "WR 1", "RUSHER". */
  role: string;
  /** Full role for the introduction card, e.g. "Receiver 1", "Deep Safety". */
  roleLong: string;
  slotKey: string;
  /** Spot on the broadcast field, in % (offence left, defence right of centre). */
  x: number;
  y: number;
}

export interface SceneLineup {
  side: 'home' | 'away';
  team: SceneData['home'];
  /** Starters in introduction order: the offence (QBs, center, receivers), then the defence. */
  nodes: LineupNode[];
  bench: ScenePlayer[];
  /**
   * Introduction steps: one per starter, then one for the bench as a whole
   * (left out when the team has no substitutes). A cursor at `steps` or
   * beyond means the introductions are done and the full lineup shows.
   */
  steps: number;
  offenseLabel: string;
  defenseLabel: string;
  /** Starters per unit in this format (7 in 7v7, 5 in a cup). */
  perUnit: number;
  /** The lineup comes from the team's submitted sheet rather than a projection. */
  confirmed: boolean;
}

const toSheetPlayer = (p: ScenePlayer): TeamSheetPlayer => ({
  player_id: p.id,
  name: p.name,
  jersey_number: p.number,
  position: p.position,
  gender: p.gender,
  image: p.image || '',
  is_starter: p.is_starter,
  starter_unit: p.unit,
  position_slot: p.slot,
});

const OFFENSE_ROLE: Record<string, string> = {
  MALE_QB: 'QB',
  FEMALE_QB: 'FEMALE QB',
  QB: 'QB',
  CENTER: 'CENTER',
};

const DEFENSE_ROLE: Record<string, string> = {
  Rusher: 'RUSHER',
  'Underneath Defender': 'UNDERNEATH',
  'Deep Safety': 'SAFETY',
  'Deep Zone Defender': 'DEEP ZONE',
  'Quarter Defender': 'QUARTERS',
};

const offenseRole = (slotKey: string, label: string) =>
  OFFENSE_ROLE[slotKey] ?? (slotKey.startsWith('WR_') ? `WR ${slotKey.slice(3)}` : label.toUpperCase());

// The Team Sheets pitch is vertical (defence in the top half, attack in the
// bottom). The broadcast field is horizontal: the offence on the left half and
// the defence on the right, each spot's depth becoming its distance from the
// centre line at x = 50.
const DEPTH = 1.05;
const fieldY = (pitchX: number) => 8 + pitchX * 0.84;
const offenseX = (pitchY: number) => 50 - (pitchY - 50) * DEPTH;
const defenseX = (pitchY: number) => 50 + (50 - pitchY) * DEPTH;

const QB_FIRST = { QB: 0, Center: 1, Receiver: 2 } as const;

export function buildSceneLineup(data: SceneData, side: 'home' | 'away'): SceneLineup {
  const format = gameFormatOfCompetitionFormat(data.match.competition_format);
  const team = side === 'home' ? data.home : data.away;

  const sheet = splitLineup(team.players.map(toSheetPlayer), format);
  const scheme = schemeFor(format, validCoverage(format, team.coverage));
  const { offense, defense } = placeStarters(sheet.offensiveStarters, sheet.defensiveStarters, format, scheme);

  const byId = new Map(team.players.map((p) => [p.id, p]));
  const slotPriority = new Map(format.offense.map((s) => [s.key, QB_FIRST[s.recommendedPosition]]));

  const offenseNodes: LineupNode[] = [];
  [...offense]
    .sort((a, b) => (slotPriority.get(a.slotKey) ?? 9) - (slotPriority.get(b.slotKey) ?? 9))
    .forEach((n) => {
      const player = n.player && byId.get(n.player.player_id);
      if (!player) return;
      offenseNodes.push({
        key: player.id,
        unit: 'offense',
        player,
        role: offenseRole(n.slotKey, n.role),
        roleLong: n.role,
        slotKey: n.slotKey,
        x: offenseX(n.y),
        y: fieldY(n.x),
      });
    });

  const defenseNodes: LineupNode[] = [];
  defense.forEach((n) => {
    const player = n.player && byId.get(n.player.player_id);
    if (!player) return;
    defenseNodes.push({
      key: player.id,
      unit: 'defense',
      player,
      role: DEFENSE_ROLE[n.role] ?? n.role.toUpperCase(),
      roleLong: n.role,
      slotKey: n.slotKey,
      x: defenseX(n.y),
      y: fieldY(n.x),
    });
  });

  const nodes = [...offenseNodes, ...defenseNodes];
  const bench = sheet.substitutes.flatMap((p) => byId.get(p.player_id) ?? []);
  return {
    side,
    team,
    nodes,
    bench,
    steps: nodes.length + (bench.length ? 1 : 0),
    offenseLabel: `${format.label} offense`,
    defenseLabel: `${scheme.name} defense`,
    perUnit: format.offenseSize,
    confirmed: sheet.confirmed,
  };
}

export interface SpotlightStat {
  label: string;
  value: string;
}

/** The three season numbers that suit a starter's role, or null with no season yet. */
export function spotlightStats(node: LineupNode): SpotlightStat[] | null {
  const s = node.player.season;
  if (!s) return null;
  const apps = { label: 'APPS', value: String(s.apps) };
  if (node.unit === 'offense') {
    if (node.slotKey.includes('QB')) {
      const pct = s.passing_attempts ? `${Math.round((s.completed_passes * 100) / s.passing_attempts)}%` : '—';
      return [{ label: 'COMP %', value: pct }, { label: 'PASS TD', value: String(s.passing_tds) }, apps];
    }
    return [
      { label: 'CATCHES', value: String(s.receptions) },
      { label: 'TOUCHDOWNS', value: String(s.receiving_tds + s.rushing_tds) },
      apps,
    ];
  }
  if (node.slotKey === 'RUSHER') {
    return [{ label: 'SACKS', value: String(s.sacks) }, { label: 'FLAG PULLS', value: String(s.flag_pulls) }, apps];
  }
  return [
    { label: 'FLAG PULLS', value: String(s.flag_pulls) },
    { label: 'INTERCEPTIONS', value: String(s.interceptions) },
    { label: 'BAT DOWNS', value: String(s.bat_downs) },
  ];
}

const BENCH_POSITION: Record<string, string> = {
  qb: 'QB',
  receiver: 'WR',
  center: 'C',
  rusher: 'RSH',
  defender: 'DEF',
  allrounder: 'AR',
};

export const benchPosition = (position: string) =>
  BENCH_POSITION[(position || '').toLowerCase()] ?? (position || '').toUpperCase().slice(0, 3);
