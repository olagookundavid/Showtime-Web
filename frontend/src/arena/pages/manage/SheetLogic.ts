import type { ArenaFormation, ArenaPlayer, ArenaSheetEditor, ArenaSheetSave, ArenaTeamSheet } from '../../../types';

export const SLOTS = 11;
export const MAX_BENCH = 7;

/** A sheet as the manager is editing it. `starters` has one entry per slot; '' is an empty slot. */
export interface SheetDraft {
  formation: string;
  starters: string[];
  bench: string[];
  captain: string;
}

export type PlayerMap = ReadonlyMap<string, ArenaPlayer>;

export const playerMap = (roster: ArenaPlayer[]): PlayerMap => new Map(roster.map((p) => [p.id, p]));

export const isGK = (p: ArenaPlayer | undefined): boolean => p?.primary_position === 'GK';

/** The goalkeeper slot takes goalkeepers and every other slot takes outfielders. */
export const fitsSlot = (slotPosition: string, p: ArenaPlayer | undefined): boolean => !!p && (slotPosition === 'GK') === isGK(p);

/** Keeps a draft consistent: starters win over the bench, the bench is unique and short, and the captain starts. */
export const normalise = (d: SheetDraft): SheetDraft => {
  const inXI = new Set(d.starters.filter(Boolean));
  const bench = d.bench.filter((id, i, all) => !inXI.has(id) && all.indexOf(id) === i).slice(0, MAX_BENCH);
  return { ...d, bench, captain: inXI.has(d.captain) ? d.captain : '' };
};

/** Builds a draft from a server sheet, dropping anyone who has left the squad. `removed` counts them. */
export const draftFromSheet = (sheet: ArenaTeamSheet, roster: PlayerMap): { draft: SheetDraft; removed: number } => {
  let removed = 0;
  const starters = Array<string>(SLOTS).fill('');
  for (const s of sheet.starters ?? []) {
    if (s.index < 0 || s.index >= SLOTS || !s.player_id) continue;
    if (roster.has(s.player_id)) starters[s.index] = s.player_id;
    else removed++;
  }
  const bench = (sheet.bench ?? []).filter((id) => {
    const ok = roster.has(id);
    if (!ok) removed++;
    return ok;
  });
  return {
    draft: normalise({ formation: sheet.formation, starters, bench, captain: sheet.captain_player_id ?? '' }),
    removed,
  };
};

export const draftFromEditor = (editor: ArenaSheetEditor) => draftFromSheet(editor.sheet, playerMap(editor.roster));

export const sameDraft = (a: SheetDraft, b: SheetDraft): boolean =>
  a.formation === b.formation &&
  a.captain === b.captain &&
  a.starters.every((id, i) => id === b.starters[i]) &&
  a.bench.length === b.bench.length &&
  [...a.bench].sort().every((id, i) => id === [...b.bench].sort()[i]);

/** Puts a player in a slot (or empties it with ''). A player already starting elsewhere swaps places. */
export const assignSlot = (d: SheetDraft, slot: number, playerId: string, formation: ArenaFormation, roster: PlayerMap): SheetDraft => {
  const starters = [...d.starters];
  if (playerId === '') {
    starters[slot] = '';
  } else {
    const displaced = starters[slot];
    const from = starters.indexOf(playerId);
    if (from >= 0 && from !== slot) {
      starters[from] = fitsSlot(formation.slots[from], roster.get(displaced)) ? displaced : '';
    }
    starters[slot] = playerId;
  }
  return normalise({ ...d, starters });
};

/**
 * Moves to another formation. Everyone already starting keeps a place: first in a slot
 * with exactly their position, then in any slot of the right kind (goalkeeper or outfield).
 */
export const changeFormation = (d: SheetDraft, next: ArenaFormation, roster: PlayerMap): SheetDraft => {
  const current = d.starters.filter(Boolean);
  const starters = Array<string>(SLOTS).fill('');
  const used = new Set<string>();
  const place = (match: (slotPosition: string, p: ArenaPlayer | undefined) => boolean) => {
    next.slots.forEach((pos, i) => {
      if (starters[i]) return;
      const id = current.find((c) => !used.has(c) && match(pos, roster.get(c)));
      if (id) {
        starters[i] = id;
        used.add(id);
      }
    });
  };
  place((pos, p) => p?.primary_position === pos);
  place((pos, p) => fitsSlot(pos, p));
  return normalise({ ...d, formation: next.name, starters });
};

/** The plain-words reasons this sheet can't be submitted yet. The wording matches the server's. */
export const sheetProblems = (d: SheetDraft, formation: ArenaFormation | undefined, roster: PlayerMap): string[] => {
  const out: string[] = [];
  if (!formation) return ['Choose one of the available formations.'];
  const chosen = d.starters.filter(Boolean);
  if (chosen.length < SLOTS) out.push('Select all 11 starting players.');
  if (new Set(chosen).size !== chosen.length) out.push('Each player can appear only once in the starting XI.');
  formation.slots.forEach((pos, i) => {
    const id = d.starters[i];
    if (!id) return;
    if (!roster.has(id)) {
      out.push('A selected player is no longer registered to this club.');
    } else if (pos === 'GK' && !isGK(roster.get(id))) {
      out.push('Choose a goalkeeper for the GK position.');
    } else if (pos !== 'GK' && isGK(roster.get(id))) {
      out.push('A goalkeeper cannot fill an outfield slot.');
    }
  });
  if (!d.captain || !chosen.includes(d.captain)) out.push('Select a captain from the starting XI.');
  return [...new Set(out)];
};

export const toSaveBody = (d: SheetDraft, submit: boolean): ArenaSheetSave => ({
  formation: d.formation,
  starters: Object.fromEntries(d.starters.flatMap((id, i) => (id ? [[String(i), id]] : []))),
  bench: d.bench,
  captain: d.captain,
  submit,
});
