import type { Competition } from "../types";

const KNOCKOUT_ROUNDS = new Set(["QUARTERFINAL", "SEMIFINAL", "FINAL", "COMPLETED"]);

/**
 * How a competition's Cup tournament should be shown publicly:
 * - "none": not a CUP competition.
 * - "matches": a cup not yet started from the admin Cup manager, or an older
 *   cup that predates it; shown as a plain match list.
 * - "swiss": Rounds 1–3; shown as the Swiss table.
 * - "knockout": quarterfinals onwards, and once completed; shown as the bracket.
 */
export const cupStageOf = (comp?: Competition): "none" | "matches" | "swiss" | "knockout" => {
  if ((comp?.format || "").toUpperCase() !== "CUP") return "none";
  if (!comp?.cup_round) return "matches";
  return KNOCKOUT_ROUNDS.has(comp.cup_round) ? "knockout" : "swiss";
};
