import type { ComponentType, SVGProps } from "react";
import { TrophyIcon } from "@heroicons/react/24/outline";
import type { Competition } from "../../services/api";

// The stages a season can have, in the order the Standings tabs show them.
// `slug` is what links use (`/standings?stage=cup`): the header can't know
// competition ids, so it names a stage and the Standings page resolves it.
// Shared by SeasonStageTabs, StandingsPage and the League menus so the four
// never disagree on what a stage is called.
export type StageSlug = "preseason" | "season" | "playoffs" | "cup";

export const STAGES: {
  format: string;
  slug: StageSlug;
  label: string;
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
}[] = [
  { format: "PRESEASON", slug: "preseason", label: "Preseason" },
  { format: "SEASON", slug: "season", label: "Season" },
  { format: "PLAYOFFS", slug: "playoffs", label: "Playoffs", icon: TrophyIcon },
  { format: "CUP", slug: "cup", label: "Cup" },
];

// The Standings shortcuts in the League menus (desktop dropdown and the mobile
// More sheet), in the order the menus list them.
export const STANDINGS_MENU: { slug: StageSlug; label: string }[] = [
  { slug: "season", label: "Season Standings" },
  { slug: "cup", label: "5v5 Cup" },
  { slug: "playoffs", label: "Playoffs" },
  { slug: "preseason", label: "Preseason" },
];

export const standingsStagePath = (slug: StageSlug) =>
  `/standings?stage=${slug}`;

export const isStageSlug =(value: string | null): value is StageSlug =>
  STAGES.some((s) => s.slug === value);

export const stageSlugOf = (comp: Competition): StageSlug =>
  STAGES.find((s) => s.format === (comp.format || "SEASON"))?.slug ?? "season";

// The SEASON competition a competition belongs to: itself for a season, its
// season link for a stage. Undefined for an orphaned stage.
export const seasonIdOf = (comp: Competition): string | undefined =>
  (comp.format || "SEASON") === "SEASON" ? comp.id : comp.season_id;

// The competition for `slug` in season `seasonId`. When that season has no such
// stage (no Cup yet, say), falls back to the most recent one from any season,
// so a menu link never lands on an empty page. `competitions` must be sorted
// newest season first (sortCompetitionsBySeason).
export const resolveStageCompetition = (
  competitions: Competition[],
  slug: StageSlug,
  seasonId?: string,
): Competition | undefined => {
  const format = STAGES.find((s) => s.slug === slug)?.format;
  const ofFormat = competitions.filter((c) => (c.format || "SEASON") === format);
  return ofFormat.find((c) => seasonId && seasonIdOf(c) === seasonId) ?? ofFormat[0];
};
