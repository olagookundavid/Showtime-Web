// The 10-team Cup's Swiss table: ranks 1–4 and 5–8 go through to the
// quarterfinals (1v5, 2v6, 3v7, 4v8), ranks 9–10 are eliminated.
export type CupZone = "qfTop" | "qfBottom" | "out";

export const cupZoneOf = (index: number): CupZone =>
  index < 4 ? "qfTop" : index < 8 ? "qfBottom" : "out";

// Colour of the bar beside a team's name, and of its legend swatch.
export const CUP_ZONE_BAR: Record<CupZone, string> = {
  qfTop: "bg-emerald-500 dark:bg-emerald-400",
  qfBottom: "bg-blue-500 dark:bg-blue-400",
  out: "bg-red-500 dark:bg-red-400",
};

export const CUP_ZONE_LEGEND: { zone: CupZone; label: string }[] = [
  { zone: "qfTop", label: "Quarterfinal, seeds 1–4" },
  { zone: "qfBottom", label: "Quarterfinal, seeds 5–8" },
  { zone: "out", label: "Eliminated" },
];

// A plain, muted inactive row - distinct from both the live "bg-white dark:bg-gray-900"
// resting row and its "hover:bg-gray-50 dark:hover:bg-gray-800" hover state (gray-100/
// gray-950 sit one step further out on each side than those, so eliminated rows never
// visually collide with an ordinary row being hovered or with the table's own gray-800
// card chrome). Which zone a team is in stays on the accent bar alone (CUP_ZONE_BAR);
// this is only "still alive vs eliminated".
export const CUP_ELIMINATED_ROW =
  "bg-gray-100 dark:bg-gray-950 text-gray-500 dark:text-gray-400";
