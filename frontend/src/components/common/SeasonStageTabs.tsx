import type { ComponentType, SVGProps } from "react";
import { TrophyIcon } from "@heroicons/react/24/outline";
import type { Competition } from "../../services/api";
import { Button } from "../ui";

interface SeasonStageTabsProps {
  competitions: Competition[];
  currentId: string;
  onChange: (id: string) => void;
  className?: string;
}

const STAGES: {
  format: string;
  label: string;
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
}[] = [
  { format: "PRESEASON", label: "Preseason" },
  { format: "SEASON", label: "Season" },
  { format: "PLAYOFFS", label: "Playoffs", icon: TrophyIcon },
  { format: "CUP", label: "Cup" },
];

// Up to four tabs (Preseason | Season | Playoffs | Cup) that switch the
// selected competition between every stage attached to the same season. The
// active tab uses the brand red (sffl-red) for urgency; a stage with no
// competition for this season is disabled rather than hidden, so the layout
// stays stable as seasons gain/lose stages over time.
// Derives everything from the competitions list + the current id, so pages
// just pass their existing competition-change handler.
export const SeasonStageTabs = ({
  competitions,
  currentId,
  onChange,
  className = "",
}: SeasonStageTabsProps) => {
  const current = competitions.find((c) => c.id === currentId);
  if (!current) return null; // e.g. "All Competitions" / nothing selected — no context for tabs

  const seasonId = current.format === "SEASON" ? current.id : current.season_id;
  if (!seasonId) return null; // an orphaned stage with no season link has nothing to switch between

  const stageComps = STAGES.map((stage) => ({
    ...stage,
    comp:
      stage.format === "SEASON"
        ? competitions.find((c) => c.id === seasonId)
        : competitions.find(
            (c) => c.season_id === seasonId && c.format === stage.format,
          ),
  }));

  return (
    <div
      className={`flex flex-wrap gap-2 sm:gap-3 w-full sm:w-auto ${className}`}
    >
      {stageComps.map(({ format, label, icon: Icon, comp }) => {
        const isActive = comp?.id === currentId;
        return (
          <Button
            key={format}
            size="lg"
            variant={isActive ? "primary" : "secondary"}
            className="flex-1 sm:flex-none md:px-10 uppercase tracking-wide"
            icon={Icon}
            disabled={!comp}
            onClick={() => {
              if (comp && !isActive) onChange(comp.id);
            }}
          >
            {label}
          </Button>
        );
      })}
    </div>
  );
};
