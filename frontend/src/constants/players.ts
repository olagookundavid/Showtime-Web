// Center is rated identically to Receiver (same formula) — see
// backend/internal/domain/player_rating.go RateByPosition.
/** The six playable roles a player can be assigned. */
export const PLAYER_POSITIONS = ["Defender", "Receiver", "Center", "QB", "Rusher", "Allrounder"];

/** No role assigned yet. */
export const UNASSIGNED_POSITION = "-";

/** Every selectable position, including "unassigned" — for admin/team-head edit forms. */
export const PLAYER_POSITIONS_WITH_UNASSIGNED = [...PLAYER_POSITIONS, UNASSIGNED_POSITION];

// All-Rounder already means "plays anywhere", so it says nothing as a second
// role — it is a main role only, and the server refuses it as a secondary.
export const SECONDARY_PLAYER_POSITIONS = PLAYER_POSITIONS.filter(
  (p) => p !== "Allrounder",
);
