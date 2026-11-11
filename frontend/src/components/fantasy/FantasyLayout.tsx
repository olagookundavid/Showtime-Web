import { Outlet, matchPath, useLocation } from "react-router-dom";
import { PageHeader } from "../ui";
import { FantasyNavCarousel } from "./FantasyNavCarousel";
import { FANTASY_NAV } from "./fantasyNav";

const PILLS = FANTASY_NAV.filter((item) => item.pill !== false);

/**
 * Wraps every /fantasy/* page with one shared hero whose title/subtitle swap
 * to match the active page, and a nav strip (inside the hero) that reaches
 * every other Fantasy page — mirrors AboutLayout.tsx.
 */
export const FantasyLayout = () => {
  const { pathname } = useLocation();
  const active =
    FANTASY_NAV.find((item) => item.to === pathname) ??
    FANTASY_NAV.find((item) =>
      item.matchPaths?.some((pattern) => matchPath({ path: pattern, end: true }, pathname)),
    ) ??
    FANTASY_NAV[0];

  return (
    <div className="space-y-4 md:space-y-8">
      {/* Full-bleed to the real viewport edges — see AboutLayout.tsx for the
          same technique. -mt cancels <main>'s own top padding so this sits
          flush under whatever chrome precedes it (navbar / scores strip). */}
      <div className="relative -mt-3 w-[var(--viewport-w)] ml-[calc(50%_-_var(--viewport-w)/2)] md:-mt-8">
        <PageHeader eyebrow={active.eyebrow} title={active.title} subtitle={active.subtitle}>
          <FantasyNavCarousel items={PILLS} activeTo={active.to} />
        </PageHeader>
      </div>
      <Outlet />
    </div>
  );
};
