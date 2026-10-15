// The starting-lineup scene's layout: which team attacks, where each starter
// stands on the field, the order they are introduced in, and the benches.
// Placement comes from the same helpers as the public Team Sheets tab, so the
// broadcast and the website always show the same lineup.

import {
  gameFormatOfCompetitionFormat,
  placeStarters,
  schemeFor,
  splitLineup,
  validCoverage,
} from '../../utils';
import type { SceneData, ScenePlayer, SceneTeam, TeamSheetPlayer } from '../../types';

export type LineupSide = 'left' | 'right';

export interface LineupNode {
  /** The player's id: stable across renders, so moving into place animates. */
  key: string;
  side: LineupSide;
  player: ScenePlayer;
  /** Short role on the player's field card, e.g. "WR 1", "RUSHER". */
  role: string;
  /** Full role for the introduction card, e.g. "Receiver 1", "Deep Safety". */
  roleLong: string;
  slotKey: string;
  /** Spot on the broadcast field, in % (attack left, line of scrimmage at 50). */
  x: number;
  y: number;
}

export interface SceneLineup {
  attackSide: 'home' | 'away';
  attack: SceneTeam;
  defend: SceneTeam;
  /** Starters in introduction order: the attack (QBs, center, receivers), then the defence. */
  nodes: LineupNode[];
  attackBench: ScenePlayer[];
  defendBench: ScenePlayer[];
  offenseLabel: string;
  defenseLabel: string;
  /** Starters per unit in this format (7 in 7v7, 5 in a cup). */
  perUnit: number;
  /** Both units come from submitted team sheets rather than a projection. */
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
// bottom). The broadcast field is horizontal with the attack on the left, so a
// spot's depth becomes its distance from the line of scrimmage at x = 50.
const DEPTH = 1.05;
const fieldY = (pitchX: number) => 8 + pitchX * 0.84;
const attackX = (pitchY: number) => 50 - (pitchY - 50) * DEPTH;
const defendX = (pitchY: number) => 50 + (50 - pitchY) * DEPTH;

const QB_FIRST = { QB: 0, Center: 1, Receiver: 2 } as const;

export function buildSceneLineup(data: SceneData, attackSide: 'home' | 'away'): SceneLineup {
  const format = gameFormatOfCompetitionFormat(data.match.competition_format);
  const attack = attackSide === 'home' ? data.home : data.away;
  const defend = attackSide === 'home' ? data.away : data.home;

  const attackSheet = splitLineup(attack.players.map(toSheetPlayer), format);
  const defendSheet = splitLineup(defend.players.map(toSheetPlayer), format);
  const scheme = schemeFor(format, validCoverage(format, defend.coverage));

  const { offense } = placeStarters(attackSheet.offensiveStarters, [], format, scheme);
  const { defense } = placeStarters([], defendSheet.defensiveStarters, format, scheme);

  const attackById = new Map(attack.players.map((p) => [p.id, p]));
  const defendById = new Map(defend.players.map((p) => [p.id, p]));
  const slotPriority = new Map(format.offense.map((s) => [s.key, QB_FIRST[s.recommendedPosition]]));

  const offenseNodes: LineupNode[] = [];
  [...offense]
    .sort((a, b) => (slotPriority.get(a.slotKey) ?? 9) - (slotPriority.get(b.slotKey) ?? 9))
    .forEach((n) => {
      const player = n.player && attackById.get(n.player.player_id);
      if (!player) return;
      offenseNodes.push({
        key: player.id,
        side: 'left',
        player,
        role: offenseRole(n.slotKey, n.role),
        roleLong: n.role,
        slotKey: n.slotKey,
        x: attackX(n.y),
        y: fieldY(n.x),
      });
    });

  const defenseNodes: LineupNode[] = [];
  defense.forEach((n) => {
    const player = n.player && defendById.get(n.player.player_id);
    if (!player) return;
    defenseNodes.push({
      key: player.id,
      side: 'right',
      player,
      role: DEFENSE_ROLE[n.role] ?? n.role.toUpperCase(),
      roleLong: n.role,
      slotKey: n.slotKey,
      x: defendX(n.y),
      y: fieldY(n.x),
    });
  });

  return {
    attackSide,
    attack,
    defend,
    nodes: [...offenseNodes, ...defenseNodes],
    attackBench: attackSheet.substitutes.flatMap((p) => attackById.get(p.player_id) ?? []),
    defendBench: defendSheet.substitutes.flatMap((p) => defendById.get(p.player_id) ?? []),
    offenseLabel: `${format.label} offense`,
    defenseLabel: `${scheme.name} defense`,
    perUnit: format.offenseSize,
    confirmed: attackSheet.confirmed && defendSheet.confirmed,
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
  if (node.side === 'left') {
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
