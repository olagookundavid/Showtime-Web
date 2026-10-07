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

export const CUP_ELIMINATED_ROW = "bg-red-50/40 dark:bg-red-950/20 text-gray-500 dark:text-gray-400";
