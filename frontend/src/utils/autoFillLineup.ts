import type { GameFormatSpec, OffenseSlotSpec } from "./gameFormat";

// Auto-Fill for the team sheet builder: picks a lineup from a club's squad for
// whichever game format the match is (7v7 or 5v5), including the women's quota.

/** What Auto-Fill needs to know about a player. */
export interface LineupCandidate {
  id: string;
  position?: string | null;
  secondary_position?: string | null;
  gender?: string | null;
  rating?: number | null;
}

export type LineupBoard<P> = Record<string, P | null>;

export interface AutoFillResult<P> {
  offense: LineupBoard<P>;
  defense: LineupBoard<P>;
  /** Everyone else, up to the squad cap. */
  bench: P[];
}

const isWoman = (p: LineupCandidate) => (p.gender || "").toUpperCase() === "F";

const hasRole = (p: LineupCandidate, role: string) =>
  p.position === role || p.secondary_position === role;

/** Whether a player suits an attacking slot: the right role, and gender if the slot has a rule. */
const suitsSlot = (slot: OffenseSlotSpec, p: LineupCandidate) => {
  const roleOk =
    slot.recommendedPosition === "QB"
      ? hasRole(p, "QB") ||
        (slot.requiredGender === "F" && p.position === "Receiver")
      : slot.recommendedPosition === "Center"
        ? hasRole(p, "Center")
        : p.position === "Receiver";
  const genderOk =
    slot.requiredGender === "F"
      ? p.gender === "F"
      : slot.requiredGender === "M"
        ? p.gender === "M" || !p.gender
        : true;
  return roleOk && genderOk;
};

const emptyBoard = <P>(keys: string[]): LineupBoard<P> =>
  Object.fromEntries(keys.map((k) => [k, null]));

// Quarterbacks are placed first, then the center, then receivers, so a flexible
// player isn't spent before the specialist slot that needs them.
const PRIORITY = { QB: 0, Center: 1, Receiver: 2 } as const;

/**
 * Assigns the best-rated fitting players to every starter slot of the format,
 * then swaps women into slots with no gender rule until each unit has its
 * minimum. If the squad has too few women the quota simply can't be met and the
 * builder's own validation says so.
 */
export function buildAutoFillLineup<P extends LineupCandidate>(
  roster: P[],
  format: GameFormatSpec,
): AutoFillResult<P> {
  // Highest rated first, so auto-fill picks the top performers.
  const available = [...roster].sort(
    (a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0),
  );
  const assigned = new Set<string>();

  const pickNext = (fits: (p: P) => boolean): P | null => {
    const found = available.find((p) => !assigned.has(p.id) && fits(p));
    if (found) {
      assigned.add(found.id);
      return found;
    }
    // Nobody fits: fall back to any remaining player.
    const fallback = available.find((p) => !assigned.has(p.id));
    if (fallback) {
      assigned.add(fallback.id);
      return fallback;
    }
    return null;
  };

  const offense = emptyBoard<P>(format.offense.map((slot) => slot.key));
  [...format.offense]
    .sort((a, b) => PRIORITY[a.recommendedPosition] - PRIORITY[b.recommendedPosition])
    .forEach((slot) => {
      offense[slot.key] = pickNext((p) => suitsSlot(slot, p));
    });

  const defense = emptyBoard<P>(format.defenseSlotKeys);
  defense.RUSHER = pickNext((p) => hasRole(p, "Rusher"));
  format.defenseSlotKeys
    .filter((key) => key !== "RUSHER")
    .forEach((key) => {
      defense[key] = pickNext((p) => hasRole(p, "Defender"));
    });

  // Bring a unit up to its women's quota: put a woman in for a man, preferring a
  // woman whose position fits that slot. The displaced man returns to the pool.
  const ensureWomen = (
    board: LineupBoard<P>,
    keys: string[],
    fits: (key: string, p: P) => boolean,
  ) => {
    let women = keys.filter((k) => board[k] && isWoman(board[k]!)).length;
    for (const key of keys) {
      if (women >= format.minFemalePerUnit) break;
      const current = board[key];
      if (!current || isWoman(current)) continue;
      const woman =
        available.find((p) => !assigned.has(p.id) && isWoman(p) && fits(key, p)) ||
        available.find((p) => !assigned.has(p.id) && isWoman(p));
      if (!woman) break;
      assigned.delete(current.id);
      assigned.add(woman.id);
      board[key] = woman;
      women++;
    }
  };

  // Slots with their own gender rule (7v7 Male QB / Female QB) are left alone,
  // and quarterback slots are the last to give up their player.
  const swappableOffense = format.offense
    .filter((slot) => !slot.requiredGender)
    .sort((a, b) => PRIORITY[b.recommendedPosition] - PRIORITY[a.recommendedPosition])
    .map((slot) => slot.key);
  ensureWomen(offense, swappableOffense, (key, p) => {
    const slot = format.offense.find((s) => s.key === key);
    return slot ? suitsSlot(slot, p) : true;
  });
  ensureWomen(
    defense,
    format.defenseSlotKeys.filter((key) => key !== "RUSHER"),
    (_key, p) => hasRole(p, "Defender"),
  );

  const bench: P[] = [];
  for (const p of available) {
    if (!assigned.has(p.id) && assigned.size + bench.length < format.squadCap) {
      bench.push(p);
    }
  }

  return { offense, defense, bench };
}
