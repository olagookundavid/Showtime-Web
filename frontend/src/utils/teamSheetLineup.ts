// Turning a team sheet into a lineup: who starts in attack and defence, and
// which position each starter takes. Shared by the public Team Sheets tab and
// the broadcast's starting-lineup scene, so both always agree.

import type { PitchStarterNode, TeamSheetPlayer } from '../types';
import type { GameFormatSpec, SchemeSpec } from './gameFormat';

/** Whether a player is a woman, from the gender stored on the team sheet. */
export const isWomanPlayer = (p: TeamSheetPlayer) => (p.gender || '').toUpperCase().startsWith('F');

// Picks the lineup for a team nobody has submitted a sheet for: the best-fitting
// players of the squad for each position of the match's format. Quarterbacks are
// placed first, then the center, then receivers, so a position-flexible player
// isn't spent before the specialist slot that needs them.
export const projectLineup = (squad: TeamSheetPlayer[], format: GameFormatSpec) => {
  const used = new Set<string>();
  const posOf = (p: TeamSheetPlayer) => (p.position || '').toLowerCase();
  const take = (fits: (p: TeamSheetPlayer) => boolean) => {
    const found = squad.find((p) => !used.has(p.player_id) && fits(p));
    if (found) used.add(found.player_id);
    return found;
  };
  const priority = { QB: 0, Center: 1, Receiver: 2 } as const;

  const off: TeamSheetPlayer[] = [];
  [...format.offense]
    .sort((a, b) => priority[a.recommendedPosition] - priority[b.recommendedPosition])
    .forEach((slot) => {
      const genderOk = (p: TeamSheetPlayer) =>
        slot.requiredGender === 'F' ? isWomanPlayer(p) : slot.requiredGender === 'M' ? !isWomanPlayer(p) : true;
      let player = take((p) => slot.positions.includes(posOf(p)) && genderOk(p));
      // A men's QB slot settles for any QB; a women's slot for any woman.
      if (!player && slot.requiredGender === 'M') {
        player = take((p) => posOf(p) === 'qb');
      }
      if (!player && slot.requiredGender === 'F') player = take(isWomanPlayer);
      if (player) off.push({ ...player, position_slot: slot.key });
    });
  // Anyone still missing is filled from whoever is left.
  while (off.length < format.offenseSize) {
    const extra = take(() => true);
    if (!extra) break;
    off.push(extra);
  }

  const def: TeamSheetPlayer[] = [];
  const rusher = take((p) => posOf(p) === 'rusher');
  if (rusher) def.push({ ...rusher, position_slot: 'RUSHER' });
  for (let i = 1; i < format.defenseSize; i++) {
    const defender = take((p) => posOf(p) === 'defender' || posOf(p) === 'allrounder');
    if (!defender) break;
    def.push({ ...defender, position_slot: `DEF_${i}` });
  }
  while (def.length < format.defenseSize) {
    const extra = take(() => true);
    if (!extra) break;
    def.push(extra);
  }

  return {
    off,
    def,
    subs: squad.filter((p) => !used.has(p.player_id)),
  };
};

/**
 * Splits a team sheet into starters and substitutes. A sheet counts as
 * confirmed only when its starters fill the match's format; one saved for a
 * different format (a competition switched to or from a cup) or left half-built
 * would misplace players, so it falls back to a projection of the squad.
 */
export const splitLineup = (sheet: TeamSheetPlayer[], format: GameFormatSpec) => {
  const starters = (unit: string) => sheet.filter((p) => p.is_starter && p.starter_unit === unit);
  const confirmed =
    starters('OFFENSE').length === format.offenseSize && starters('DEFENSE').length === format.defenseSize;

  if (confirmed) {
    return {
      confirmed,
      offensiveStarters: starters('OFFENSE'),
      defensiveStarters: starters('DEFENSE'),
      substitutes: sheet.filter((p) => !p.is_starter),
    };
  }
  const { off, def, subs } = projectLineup(sheet, format);
  return { confirmed, offensiveStarters: off, defensiveStarters: def, substitutes: subs };
};

/**
 * Places starters on the format's positions: attack on its offence slots (by the
 * slot saved on the sheet, else by position and gender, else anyone left), and
 * defence on the scheme's spots, the rusher first. Coordinates are the public
 * pitch's, in % (attack in the bottom half, defence in the top half).
 */
export const placeStarters = (
  offensiveStarters: TeamSheetPlayer[],
  defensiveStarters: TeamSheetPlayer[],
  format: GameFormatSpec,
  scheme: SchemeSpec,
): { offense: PitchStarterNode[]; defense: PitchStarterNode[] } => {
  const assignedOffIds = new Set<string>();
  const offense: PitchStarterNode[] = format.offense.map((slotDef) => {
    let player = offensiveStarters.find(
      (p) =>
        !assignedOffIds.has(p.player_id) &&
        p.position_slot &&
        slotDef.aliases.some((alias) => alias.toUpperCase() === p.position_slot!.toUpperCase()),
    );

    if (!player) {
      player = offensiveStarters.find((p) => {
        if (assignedOffIds.has(p.player_id)) return false;
        if (!slotDef.positions.includes((p.position || '').toLowerCase())) {
          return false;
        }
        if (slotDef.requiredGender === 'F') return isWomanPlayer(p);
        if (slotDef.requiredGender === 'M') return !isWomanPlayer(p);
        return true;
      });
    }

    if (!player) {
      player = offensiveStarters.find((p) => !assignedOffIds.has(p.player_id));
    }

    if (player) {
      assignedOffIds.add(player.player_id);
    }

    return {
      player,
      role: slotDef.publicLabel,
      unit: 'OFFENSE' as const,
      x: slotDef.pitch.x,
      y: slotDef.pitch.y,
      slotKey: slotDef.key,
    };
  });

  const assignedDefIds = new Set<string>();
  const defense: PitchStarterNode[] = scheme.pitch.map((pt, idx) => {
    const aliases = idx === 0 ? ['RUSHER', 'RUSH', 'DEF_R'] : [`DEF_${idx}`, `DEF${idx}`];

    let player = defensiveStarters.find(
      (p) =>
        !assignedDefIds.has(p.player_id) &&
        p.position_slot &&
        aliases.some((a) => a.toUpperCase() === p.position_slot!.toUpperCase()),
    );

    if (!player && idx === 0) {
      player = defensiveStarters.find(
        (p) => !assignedDefIds.has(p.player_id) && (p.position || '').toLowerCase() === 'rusher',
      );
    }

    if (!player) {
      player = defensiveStarters.find((p) => !assignedDefIds.has(p.player_id));
    }

    if (player) {
      assignedDefIds.add(player.player_id);
    }

    return {
      player,
      role: pt.role,
      unit: 'DEFENSE' as const,
      x: pt.x,
      y: pt.y,
      slotKey: idx === 0 ? 'RUSHER' : `DEF_${idx}`,
    };
  });

  return { offense, defense };
};
