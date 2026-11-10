import type { FantasySlot, FantasyPlayerListItem } from "../types";

export interface SlotDefinition {
    slot: FantasySlot;
    label: string;
    unit: "OFFENSE" | "DEFENSE";
    /**
     * Positions eligible for this slot. Receiver slots also accept Centers —
     * Center is a real position here and the rating engine scores it with the
     * Receiver formula verbatim.
     */
    allowedPositions: string[];
    requiredGender?: "M" | "F";
}

// An All-Rounder plays anywhere their gender is eligible to play. Mirrors
// domain.SlotSpec.Accepts on the server: the position requirement is waived, the
// gender requirement never is — the female-only slots exist to guarantee women on
// the field, so a male All-Rounder filling one would defeat the rule.
const ALLROUNDER_SPELLINGS = ["ALLROUNDER", "ALL-ROUNDER", "ALL ROUNDER", "AR"];

export function isAllrounderPosition(position?: string | null): boolean {
    return ALLROUNDER_SPELLINGS.includes((position || "").trim().toUpperCase());
}

/** Whether a player may occupy a slot, position-wise. Gender is checked separately. */
export function positionFitsSlot(
    def: SlotDefinition,
    position?: string | null,
): boolean {
    if (isAllrounderPosition(position)) return true;
    return def.allowedPositions.includes(position || "");
}

export const SLOT_DEFINITIONS: SlotDefinition[] = [
    // Offense (7)
    {
        slot: "QB_M",
        label: "Male Starting QB",
        unit: "OFFENSE",
        allowedPositions: ["QB"],
        requiredGender: "M",
    },
    // Takes a QB or a receiver, not a QB alone — mirrors femaleStarterPositions
    // in backend/internal/domain/fantasy.go. The rule exists to put three women
    // on offence, and it does not care which of them throws.
    {
        slot: "QB_F",
        label: "Female QB or Receiver",
        unit: "OFFENSE",
        allowedPositions: ["QB", "Receiver", "Center"],
        requiredGender: "F",
    },
    {
        slot: "REC_1",
        label: "Wide Receiver 1",
        unit: "OFFENSE",
        allowedPositions: ["Receiver", "Center"],
    },
    {
        slot: "REC_2",
        label: "Wide Receiver 2",
        unit: "OFFENSE",
        allowedPositions: ["Receiver", "Center"],
    },
    {
        slot: "REC_3",
        label: "Wide Receiver 3",
        unit: "OFFENSE",
        allowedPositions: ["Receiver", "Center"],
    },
    {
        slot: "REC_4",
        label: "Wide Receiver 4",
        unit: "OFFENSE",
        allowedPositions: ["Receiver", "Center"],
    },
    {
        slot: "REC_5",
        label: "Wide Receiver 5",
        unit: "OFFENSE",
        allowedPositions: ["Receiver", "Center"],
    },
    // Defense (7)
    {
        slot: "RUSHER",
        label: "Pass Rusher",
        unit: "DEFENSE",
        allowedPositions: ["Rusher"],
    },
    {
        slot: "DEF_1",
        label: "Defender 1",
        unit: "DEFENSE",
        allowedPositions: ["Defender"],
    },
    {
        slot: "DEF_2",
        label: "Defender 2",
        unit: "DEFENSE",
        allowedPositions: ["Defender"],
    },
    {
        slot: "DEF_3",
        label: "Defender 3",
        unit: "DEFENSE",
        allowedPositions: ["Defender"],
    },
    {
        slot: "DEF_4",
        label: "Defender 4",
        unit: "DEFENSE",
        allowedPositions: ["Defender"],
    },
    {
        slot: "DEF_5",
        label: "Defender 5",
        unit: "DEFENSE",
        allowedPositions: ["Defender"],
    },
    {
        slot: "DEF_6",
        label: "Defender 6",
        unit: "DEFENSE",
        allowedPositions: ["Defender"],
    },
];

export const emptySquad = (): Record<FantasySlot, FantasyPlayerListItem | null> => ({
    QB_M: null,
    QB_F: null,
    REC_1: null,
    REC_2: null,
    REC_3: null,
    REC_4: null,
    REC_5: null,
    RUSHER: null,
    DEF_1: null,
    DEF_2: null,
    DEF_3: null,
    DEF_4: null,
    DEF_5: null,
    DEF_6: null,
});

/** "Receiver" / "Receiver or Center" — reads naturally in the modal caption. */
export const formatPositions = (positions: string[]): string =>
    positions.length <= 1
        ? positions[0] || ""
        : `${positions.slice(0, -1).join(", ")} or ${positions[positions.length - 1]}`;

/** Names as prose: "A", "A and B", "A, B and C". */
export const joinNames = (names: string[]): string =>
    names.length <= 1
        ? names[0] || ""
        : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;

/** A player with the position they play, for messages: "Bakare (Receiver)". */
export const describePlayer = (name: string, position?: string | null): string =>
    position && position !== "-" ? `${name} (${position})` : name;

export const isFemale = (g?: string): boolean =>
    (g || "").toUpperCase().startsWith("F");

export const unitOf = (position: string): "offense" | "defense" =>
    position === "Rusher" || position === "Defender" ? "defense" : "offense";

export const getDefaultTeamName = (userName?: string | null): string => {
    const clean = (userName || "").trim();
    return clean ? `${clean} Team` : "Showtime Team";
};

/** Canonical display order for position-grouped views (the Transfers page's
 *  Player Selection / Your Squad panes, any future grouped-squad screen) —
 *  offense first (QB, Receiver, Center), then defense (Rusher, Defender),
 *  with All-Rounder last since it's a catch-all, not a specific role.
 *  Distinct from PLAYER_POSITIONS (constants/players.ts), which lists raw
 *  backend spellings for admin/edit forms with no intended display order. */
export const POSITION_GROUP_ORDER = [
    "QB",
    "Receiver",
    "Center",
    "Rusher",
    "Defender",
    "All-Rounder",
] as const;

/** Collapses the position spellings a roster accumulates — mirrors
 *  FantasyPitch's local normalizePosition — into one of the six canonical
 *  groups above. */
export function normalizeFantasyPosition(position?: string | null): string {
    if (isAllrounderPosition(position)) return "All-Rounder";
    const p = (position || "").trim();
    return p.toUpperCase() === "CENTRE" ? "Center" : p;
}

/** Buckets any list of players by position, always in POSITION_GROUP_ORDER
 *  (including empty groups, so a caller can choose to show gaps or filter
 *  them out). A position outside the six canonical groups still gets its
 *  own bucket, appended after them, so a bad record is never silently
 *  dropped from view. */
export function groupPlayersByPosition<T>(
    items: T[],
    getPosition: (item: T) => string | null | undefined,
): { label: string; players: T[] }[] {
    const buckets = new Map<string, T[]>();
    for (const label of POSITION_GROUP_ORDER) buckets.set(label, []);
    for (const item of items) {
        const key = normalizeFantasyPosition(getPosition(item)) || "Other";
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key)!.push(item);
    }
    return [...buckets.entries()].map(([label, players]) => ({ label, players }));
}
