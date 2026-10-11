// Game formats: how many players a side fields. Cup competitions are played 5v5;
// every other competition is 7v7. Team sheets (the manager's builder and the
// public Team Sheets tab) and Team of the Week all read their shape from here.
//
// KEEP IN SYNC with backend/internal/domain/game_format.go. The server is the
// authority and re-checks every save; this file adds the labels and pitch
// layouts the server doesn't know about. A mismatch shows up as a server error.

export type GameFormatId = "7V7" | "5V5";

type Coord = [x: number, y: number];

/** One attacking position on a team sheet. */
export interface OffenseSlotSpec {
  /** Saved with the team sheet as `position_slot`. */
  key: string;
  /** Builder label, e.g. "Wide Receiver 1". */
  label: string;
  /** Public tab label, e.g. "Receiver 1". */
  publicLabel: string;
  shortRole: string;
  /** The player position that best fits (used by Auto-Fill and the picker). */
  recommendedPosition: "QB" | "Center" | "Receiver";
  /** The slot only takes this gender (7v7 Male QB / Female QB). */
  requiredGender?: "M" | "F";
  /** Lowercase positions that fit, for projecting a lineup nobody has submitted. */
  positions: string[];
  /** Other keys older sheets or projections use for the same position. */
  aliases: string[];
  /** Spot on the builder's attack pitch, in %. */
  builder: { x: number; y: number };
  /** Spot on the public tab's combined pitch (attack is the bottom half), in %. */
  pitch: { x: number; y: number };
}

/** A defensive scheme (Cover N) and where its defenders stand. */
export interface SchemeSpec {
  name: string;
  tagline: string;
  description: string;
  /** Builder's defence pitch: deep and underneath defenders. The rusher is fixed. */
  builder: { deep: Coord[]; under: Coord[] };
  /** Public pitch (defence is the top half): the rusher first, then each defender. */
  pitch: Array<{ x: number; y: number; role: string }>;
}

export interface GameFormatSpec {
  id: GameFormatId;
  label: string;
  offense: OffenseSlotSpec[];
  /** RUSHER, then DEF_1..DEF_n (underneath defenders first, then deep). */
  defenseSlotKeys: string[];
  offenseSize: number;
  defenseSize: number;
  startersTotal: number;
  /** Women each unit must start, so a lineup needs this in attack and in defence. */
  minFemalePerUnit: number;
  squadCap: number;
  /** Cover schemes on offer. */
  coverages: number[];
  defaultCoverage: number;
  schemes: Record<number, SchemeSpec>;
  offenseSummary: string;
  /** Longer wording for the builder's attack heading. */
  offenseDetail: string;
  defenseSummary: string;
  totw: {
    /** "Starting XIV" / "Starting X". */
    title: string;
    /** Slot codes a Team of the Week edition uses (see AdminTOTW). */
    slotCodes: string[];
  };
}

const RECEIVER_POSITIONS = ["receiver", "allrounder"];

const SPEC_7V7: GameFormatSpec = {
  id: "7V7",
  label: "7v7",
  offense: [
    {
      key: "WR_1",
      label: "Wide Receiver 1",
      publicLabel: "Receiver 1",
      shortRole: "Receiver",
      recommendedPosition: "Receiver",
      positions: RECEIVER_POSITIONS,
      aliases: ["WR_1", "WR1", "OFF_WR1"],
      builder: { x: 12, y: 28 },
      pitch: { x: 12, y: 64 },
    },
    {
      key: "WR_2",
      label: "Wide Receiver 2",
      publicLabel: "Receiver 2",
      shortRole: "Receiver",
      recommendedPosition: "Receiver",
      positions: RECEIVER_POSITIONS,
      aliases: ["WR_2", "WR2", "OFF_WR2"],
      builder: { x: 36, y: 24 },
      pitch: { x: 31, y: 66 },
    },
    {
      key: "CENTER",
      label: "Center (Snapper)",
      publicLabel: "Center (Snapper)",
      shortRole: "Center",
      recommendedPosition: "Center",
      positions: ["center"],
      aliases: ["CENTER", "C", "OFF_C"],
      builder: { x: 50, y: 54 },
      pitch: { x: 50, y: 56 },
    },
    {
      key: "WR_3",
      label: "Wide Receiver 3",
      publicLabel: "Receiver 3",
      shortRole: "Receiver",
      recommendedPosition: "Receiver",
      positions: RECEIVER_POSITIONS,
      aliases: ["WR_3", "WR3", "OFF_WR3"],
      builder: { x: 64, y: 24 },
      pitch: { x: 69, y: 66 },
    },
    {
      key: "WR_4",
      label: "Wide Receiver 4",
      publicLabel: "Receiver 4",
      shortRole: "Receiver",
      recommendedPosition: "Receiver",
      positions: RECEIVER_POSITIONS,
      aliases: ["WR_4", "WR4", "OFF_WR4"],
      builder: { x: 88, y: 28 },
      pitch: { x: 88, y: 64 },
    },
    {
      key: "MALE_QB",
      label: "Male QB",
      publicLabel: "Male QB",
      shortRole: "Male QB",
      recommendedPosition: "QB",
      requiredGender: "M",
      positions: ["qb"],
      aliases: ["MALE_QB", "QB_M", "OFF_QB_M", "OFF_QB", "QB"],
      builder: { x: 38, y: 77 },
      pitch: { x: 38, y: 79 },
    },
    {
      key: "FEMALE_QB",
      label: "Female QB / Rec",
      publicLabel: "Female QB / Rec",
      shortRole: "Female QB",
      recommendedPosition: "QB",
      requiredGender: "F",
      positions: ["qb", "receiver"],
      aliases: ["FEMALE_QB", "QB_F", "OFF_QB_F", "OFF_FQB", "FQB"],
      builder: { x: 62, y: 77 },
      pitch: { x: 62, y: 79 },
    },
  ],
  defenseSlotKeys: ["RUSHER", "DEF_1", "DEF_2", "DEF_3", "DEF_4", "DEF_5", "DEF_6"],
  offenseSize: 7,
  defenseSize: 7,
  startersTotal: 14,
  minFemalePerUnit: 3,
  squadCap: 25,
  coverages: [1, 2, 3, 4],
  defaultCoverage: 2,
  schemes: {
    1: {
      name: "Cover 1",
      tagline: "1 Rusher · 5 Underneath · 1 Deep",
      description: "Aggressive man coverage underneath with a single deep center-field safety.",
      builder: {
        deep: [[50, 18]],
        under: [[12, 42], [31, 40], [50, 43], [69, 40], [88, 42]],
      },
      pitch: [
        { x: 50, y: 42, role: "Rusher" },
        { x: 14, y: 33, role: "Underneath Defender" },
        { x: 32, y: 31, role: "Underneath Defender" },
        { x: 50, y: 33, role: "Underneath Defender" },
        { x: 68, y: 31, role: "Underneath Defender" },
        { x: 86, y: 33, role: "Underneath Defender" },
        { x: 50, y: 17, role: "Deep Safety" },
      ],
    },
    2: {
      name: "Cover 2",
      tagline: "1 Rusher · 4 Underneath · 2 Deep",
      description: "Balanced coverage with two deep safeties protecting the sidelines and seams.",
      builder: {
        deep: [[32, 18], [68, 18]],
        under: [[14, 42], [38, 40], [62, 40], [86, 42]],
      },
      pitch: [
        { x: 50, y: 42, role: "Rusher" },
        { x: 16, y: 33, role: "Underneath Defender" },
        { x: 38, y: 31, role: "Underneath Defender" },
        { x: 62, y: 31, role: "Underneath Defender" },
        { x: 84, y: 33, role: "Underneath Defender" },
        { x: 33, y: 17, role: "Deep Safety" },
        { x: 67, y: 17, role: "Deep Safety" },
      ],
    },
    3: {
      name: "Cover 3",
      tagline: "1 Rusher · 3 Underneath · 3 Deep",
      description: "Three deep zone defenders guarding deep thirds, backed by central underneath coverage.",
      builder: {
        deep: [[20, 18], [50, 15], [80, 18]],
        under: [[18, 42], [50, 40], [82, 42]],
      },
      pitch: [
        { x: 50, y: 42, role: "Rusher" },
        { x: 22, y: 33, role: "Underneath Defender" },
        { x: 50, y: 31, role: "Underneath Defender" },
        { x: 78, y: 33, role: "Underneath Defender" },
        { x: 20, y: 17, role: "Deep Zone Defender" },
        { x: 50, y: 16, role: "Deep Safety" },
        { x: 80, y: 17, role: "Deep Zone Defender" },
      ],
    },
    4: {
      name: "Cover 4",
      tagline: "1 Rusher · 2 Underneath · 4 Deep",
      description: "Quarters defense with four deep safeties for maximum deep-ball and prevent protection.",
      builder: {
        deep: [[14, 18], [38, 16], [62, 16], [86, 18]],
        under: [[32, 42], [68, 42]],
      },
      pitch: [
        { x: 50, y: 42, role: "Rusher" },
        { x: 35, y: 33, role: "Underneath Defender" },
        { x: 65, y: 33, role: "Underneath Defender" },
        { x: 15, y: 18, role: "Quarter Defender" },
        { x: 38, y: 16, role: "Quarter Defender" },
        { x: 62, y: 16, role: "Quarter Defender" },
        { x: 85, y: 18, role: "Quarter Defender" },
      ],
    },
  },
  offenseSummary: "2 QBs · 1 C · 4 WRs",
  offenseDetail: "2 QBs (1 Male · 1 Female) · 1 Center · 4 Receivers",
  defenseSummary: "1 Rusher · 6 Defenders",
  totw: {
    title: "Starting XIV",
    slotCodes: ["QB", "FQB", "C", "WR1", "WR2", "WR3", "WR4", "R", "DEF1", "DEF2", "DEF3", "DEF4", "S1", "S2"],
  },
};

const SPEC_5V5: GameFormatSpec = {
  id: "5V5",
  label: "5v5",
  offense: [
    {
      key: "WR_1",
      label: "Wide Receiver 1",
      publicLabel: "Receiver 1",
      shortRole: "Receiver",
      recommendedPosition: "Receiver",
      positions: RECEIVER_POSITIONS,
      aliases: ["WR_1", "WR1", "OFF_WR1"],
      builder: { x: 16, y: 28 },
      pitch: { x: 14, y: 64 },
    },
    {
      key: "WR_2",
      label: "Wide Receiver 2",
      publicLabel: "Receiver 2",
      shortRole: "Receiver",
      recommendedPosition: "Receiver",
      positions: RECEIVER_POSITIONS,
      aliases: ["WR_2", "WR2", "OFF_WR2"],
      builder: { x: 50, y: 22 },
      pitch: { x: 68, y: 67 },
    },
    {
      key: "CENTER",
      label: "Center (Snapper)",
      publicLabel: "Center (Snapper)",
      shortRole: "Center",
      recommendedPosition: "Center",
      positions: ["center"],
      aliases: ["CENTER", "C", "OFF_C"],
      builder: { x: 50, y: 54 },
      pitch: { x: 50, y: 56 },
    },
    {
      key: "WR_3",
      label: "Wide Receiver 3",
      publicLabel: "Receiver 3",
      shortRole: "Receiver",
      recommendedPosition: "Receiver",
      positions: RECEIVER_POSITIONS,
      aliases: ["WR_3", "WR3", "OFF_WR3"],
      builder: { x: 84, y: 28 },
      pitch: { x: 86, y: 64 },
    },
    {
      key: "QB",
      label: "Quarterback",
      publicLabel: "Quarterback",
      shortRole: "QB",
      recommendedPosition: "QB",
      positions: ["qb"],
      aliases: ["QB", "MALE_QB", "FEMALE_QB", "QB_M", "QB_F", "OFF_QB"],
      builder: { x: 50, y: 77 },
      pitch: { x: 50, y: 79 },
    },
  ],
  defenseSlotKeys: ["RUSHER", "DEF_1", "DEF_2", "DEF_3", "DEF_4"],
  offenseSize: 5,
  defenseSize: 5,
  startersTotal: 10,
  minFemalePerUnit: 2,
  squadCap: 25,
  // Cover 4 (four deep) would leave nobody underneath with only four defenders.
  coverages: [1, 2, 3],
  defaultCoverage: 2,
  schemes: {
    1: {
      name: "Cover 1",
      tagline: "1 Rusher · 3 Underneath · 1 Deep",
      description: "Aggressive man coverage underneath with a single deep center-field safety.",
      builder: {
        deep: [[50, 18]],
        under: [[20, 42], [50, 43], [80, 42]],
      },
      pitch: [
        { x: 50, y: 42, role: "Rusher" },
        { x: 20, y: 33, role: "Underneath Defender" },
        { x: 50, y: 31, role: "Underneath Defender" },
        { x: 80, y: 33, role: "Underneath Defender" },
        { x: 50, y: 17, role: "Deep Safety" },
      ],
    },
    2: {
      name: "Cover 2",
      tagline: "1 Rusher · 2 Underneath · 2 Deep",
      description: "Balanced coverage with two deep safeties protecting the sidelines and seams.",
      builder: {
        deep: [[32, 18], [68, 18]],
        under: [[28, 42], [72, 42]],
      },
      pitch: [
        { x: 50, y: 42, role: "Rusher" },
        { x: 28, y: 33, role: "Underneath Defender" },
        { x: 72, y: 33, role: "Underneath Defender" },
        { x: 33, y: 17, role: "Deep Safety" },
        { x: 67, y: 17, role: "Deep Safety" },
      ],
    },
    3: {
      name: "Cover 3",
      tagline: "1 Rusher · 1 Underneath · 3 Deep",
      description: "Three deep zone defenders guarding deep thirds, backed by one central underneath defender.",
      builder: {
        deep: [[20, 18], [50, 15], [80, 18]],
        under: [[50, 41]],
      },
      pitch: [
        { x: 50, y: 42, role: "Rusher" },
        { x: 50, y: 32, role: "Underneath Defender" },
        { x: 20, y: 17, role: "Deep Zone Defender" },
        { x: 50, y: 16, role: "Deep Safety" },
        { x: 80, y: 17, role: "Deep Zone Defender" },
      ],
    },
  },
  offenseSummary: "1 QB · 1 C · 3 WRs",
  offenseDetail: "1 QB · 1 Center · 3 Receivers",
  defenseSummary: "1 Rusher · 4 Defenders",
  totw: {
    title: "Starting X",
    slotCodes: ["QB", "C", "WR1", "WR2", "WR3", "R", "DEF1", "DEF2", "DEF3", "DEF4"],
  },
};

export const GAME_FORMATS: Record<GameFormatId, GameFormatSpec> = {
  "7V7": SPEC_7V7,
  "5V5": SPEC_5V5,
};

/** The format played in a competition: cups are 5v5, everything else 7v7. */
export const gameFormatOfCompetitionFormat = (competitionFormat?: string | null): GameFormatSpec =>
  (competitionFormat ?? "").trim().toUpperCase() === "CUP" ? SPEC_5V5 : SPEC_7V7;

/** The format of anything carrying a competition (a match, a Team of the Week). */
export const gameFormatOf = (competition?: { format?: string | null } | null): GameFormatSpec =>
  gameFormatOfCompetitionFormat(competition?.format);

/** Everything the builder needs to know about the match's defence for a chosen scheme. */
export const schemeFor = (spec: GameFormatSpec, coverage: number): SchemeSpec =>
  spec.schemes[coverage] ?? spec.schemes[spec.defaultCoverage];

/** A coverage the format offers, falling back to its default (e.g. a saved Cover 4 on a 5v5 match). */
export const validCoverage = (spec: GameFormatSpec, coverage?: number | null): number =>
  coverage != null && spec.coverages.includes(coverage) ? coverage : spec.defaultCoverage;
