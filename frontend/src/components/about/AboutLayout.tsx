import { useEffect, useRef } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { PageHeader } from "../ui";
import { AboutNavCarousel } from "./AboutNavCarousel";
import { ABOUT_NAV } from "./aboutNav";

/**
 * Wraps every /about/* page with one shared hero whose title/subtitle/background
 * swap to match the active page, and a nav strip (inside the hero) that reaches
 * every other About page — the section's only entry point besides the footer.
 */
export const AboutLayout = () => {
  const { pathname } = useLocation();
  const active = ABOUT_NAV.find((item) => item.to === pathname) ?? ABOUT_NAV[0];

  // Landing on the section fresh (e.g. from the footer) shows the hero first;
  // switching between About pages via the nav strip instead scrolls straight
  // to where that page's own content starts, since the hero itself barely
  // changes page to page. The ref starts true so the very first render (the
  // fresh landing) is skipped.
  const isFirstRender = useRef(true);
  const contentRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    contentRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [pathname]);

  return (
    <div className="space-y-4 md:space-y-8">
      {/* Full-bleed to the real viewport edges, regardless of <main>'s own
          max-width/padding — see PageHeader usage elsewhere for the normal,
          contained case. Uses --viewport-w (Layout.tsx), not raw vw units,
          so a desktop scrollbar's width doesn't push the right edge into
          overflow. -mt cancels <main>'s own top padding so this sits flush
          under the navbar's red line (no scores strip on /about/*). */}
      <div className="relative -mt-3 w-[var(--viewport-w)] ml-[calc(50%_-_var(--viewport-w)/2)] md:-mt-8">
        <PageHeader
          eyebrow={active.eyebrow}
          title={active.title}
          subtitle={active.subtitle}
          actions={active.actions}
          backgroundImage={active.backgroundImage}
        >
          <AboutNavCarousel activeTo={active.to} />
        </PageHeader>
      </div>
      <div ref={contentRef} className="scroll-mt-[calc(var(--chrome-h)+1rem)]">
        <Outlet />
      </div>
    </div>
  );
};
