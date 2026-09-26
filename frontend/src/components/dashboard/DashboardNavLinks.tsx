import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "react-router-dom";
import { isNavLinkActive, type DashboardNavSection } from "./dashboardNav";

interface DashboardNavLinksProps {
  sections: DashboardNavSection[];
  /** Names the nav for screen readers, e.g. "Admin". */
  ariaLabel: string;
  /** Counts shown on links, keyed by link path. Zero shows nothing. */
  badges?: Record<string, number>;
  /** Icon-only rail: labels and headings stay for screen readers, and hovering a link shows its name. */
  collapsed?: boolean;
  onNavigate?: () => void;
}

type Hint = { label: string; top: number; left: number };

/**
 * A dashboard's link list, shared by the desktop sidebar and the phone drawer. It is
 * its own scroller, with the scrollbar hidden, so the brand block above it stays
 * put. A fade at the bottom hints that there is more to scroll to.
 */
export const DashboardNavLinks = ({
  sections,
  ariaLabel,
  badges,
  collapsed = false,
  onNavigate,
}: DashboardNavLinksProps) => {
  const { pathname } = useLocation();
  const idPrefix = useId();
  // One tooltip for the collapsed rail. It is portalled and fixed because the
  // scroller's overflow would clip anything that pokes out to the right.
  const [hint, setHint] = useState<Hint | null>(null);
  const navRef = useRef<HTMLElement>(null);

  // Bring the current page's link into view, so landing on a page low in the
  // list (News, Users) still shows where you are. Only the list scrolls.
  useEffect(() => {
    const nav = navRef.current;
    const link = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!nav || !link) return;
    const n = nav.getBoundingClientRect();
    const r = link.getBoundingClientRect();
    if (r.top < n.top || r.bottom > n.bottom) {
      nav.scrollTop += r.top - n.top - (n.height - r.height) / 2;
    }
  }, [pathname]);

  const showHint = (label: string, el: HTMLElement) => {
    if (!collapsed) return;
    const r = el.getBoundingClientRect();
    setHint({ label, top: r.top + r.height / 2, left: r.right + 12 });
  };
  const hideHint = () => setHint(null);

  const linkClass = (active: boolean) =>
    `relative flex items-center gap-3 min-h-11 rounded-lg text-sm font-bold whitespace-nowrap outline-none transition-colors focus-visible:ring-2 focus-visible:ring-sffl-navy/40 dark:focus-visible:ring-white/70 ${
      collapsed ? "justify-center px-0" : "px-3"
    } ${
      active
        ? "bg-sffl-red/10 text-sffl-red dark:bg-sffl-red dark:text-white dark:shadow-md before:absolute before:left-0 before:inset-y-2 before:w-[3px] before:rounded-r-full before:bg-sffl-red"
        : "text-gray-600 hover:bg-gray-100 hover:text-sffl-navy dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-white"
    }`;

  return (
    <nav
      ref={navRef}
      aria-label={ariaLabel}
      onScroll={hideHint}
      className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain no-scrollbar"
    >
      <div className={`px-3 pt-4 pb-8 ${collapsed ? "space-y-2" : "space-y-5"}`}>
        {sections.map((section, i) => {
          const headingId = `${idPrefix}-${i}`;
          return (
            <div key={section.title} role="group" aria-labelledby={headingId}>
              <p
                id={headingId}
                className={
                  collapsed
                    ? "sr-only"
                    : "px-3 mb-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500"
                }
              >
                {section.title}
              </p>
              {collapsed && i > 0 && (
                <div aria-hidden="true" className="mx-3 mb-2 border-t border-gray-200 dark:border-white/10" />
              )}
              <ul className="space-y-1">
                {section.links.map((link) => {
                  const active = isNavLinkActive(link, pathname);
                  const count = badges?.[link.path] ?? 0;
                  // The active link is solid red in dark mode, so its badge flips to white.
                  const badgeColour = active
                    ? "bg-sffl-red text-white dark:bg-white dark:text-sffl-red"
                    : "bg-sffl-red text-white";
                  return (
                    <li key={link.path}>
                      <Link
                        to={link.path}
                        onClick={onNavigate}
                        aria-current={active ? "page" : undefined}
                        onMouseEnter={(e) => showHint(link.name, e.currentTarget)}
                        onMouseLeave={hideHint}
                        onFocus={(e) => showHint(link.name, e.currentTarget)}
                        onBlur={hideHint}
                        className={linkClass(active)}
                      >
                        <span className="relative shrink-0">
                          <link.icon className="w-5 h-5" aria-hidden="true" />
                          {collapsed && count > 0 && (
                            <span
                              aria-hidden="true"
                              className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full ring-2 ring-white dark:ring-sffl-navy ${badgeColour}`}
                            />
                          )}
                        </span>
                        <span className={collapsed ? "sr-only" : "truncate"}>{link.name}</span>
                        {count > 0 &&
                          (collapsed ? (
                            <span className="sr-only">({count} pending)</span>
                          ) : (
                            <span className={`ml-auto shrink-0 min-w-5 px-1.5 py-0.5 rounded-full text-[10px] font-black text-center ${badgeColour}`}>
                              {count}
                              <span className="sr-only"> pending</span>
                            </span>
                          ))}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none sticky bottom-0 -mt-6 h-6 bg-linear-to-t from-white dark:from-sffl-navy transition-colors"
      />
      {collapsed &&
        hint &&
        createPortal(
          <span
            aria-hidden="true"
            style={{ top: hint.top, left: hint.left }}
            className="fixed z-90 -translate-y-1/2 px-2.5 py-1.5 rounded-md text-xs font-bold whitespace-nowrap shadow-lg pointer-events-none bg-sffl-navy text-white dark:bg-white dark:text-sffl-navy"
          >
            {hint.label}
          </span>,
          document.body,
        )}
    </nav>
  );
};
