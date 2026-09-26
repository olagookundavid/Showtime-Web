import { Link, useLocation } from "react-router-dom";
import { Bars3Icon } from "@heroicons/react/24/outline";
import { isNavLinkActive, type DashboardBottomNavItem } from "./dashboardNav";

interface DashboardBottomNavProps {
  /** The shortcuts. None renders no bottom nav at all. */
  items: DashboardBottomNavItem[];
  /** Names the nav for screen readers, e.g. "Admin shortcuts". */
  ariaLabel: string;
  /** Names the More button for screen readers, e.g. "More admin pages". */
  moreLabel: string;
  onMoreClick: () => void;
  /** Pending items on pages behind More. Shows a dot on the button. */
  moreBadge?: number;
}

/** The phone and tablet tab bar: a few shortcuts, then More, which opens the drawer. */
export const DashboardBottomNav = ({
  items,
  ariaLabel,
  moreLabel,
  onMoreClick,
  moreBadge = 0,
}: DashboardBottomNavProps) => {
  const { pathname } = useLocation();

  if (items.length === 0) return null;

  return (
    <nav
      aria-label={ariaLabel}
      className="lg:hidden fixed bottom-0 left-0 right-0 h-[calc(3.5rem+env(safe-area-inset-bottom,0px))] pb-[env(safe-area-inset-bottom,0px)] bg-white dark:bg-sffl-navy border-t border-gray-200 dark:border-gray-700 flex items-center justify-around px-1 z-50 shadow-2xl transition-colors"
    >
      {items.map((item) => {
        const active = isNavLinkActive(item, pathname);
        const Icon = active ? item.solidIcon : item.icon;

        return (
          <Link
            key={item.name}
            to={item.path}
            aria-current={active ? "page" : undefined}
            className={`flex flex-col items-center justify-center w-full h-14 py-1 transition-colors ${
              active ? "text-sffl-red" : "text-gray-500 dark:text-gray-400"
            }`}
          >
            <Icon className="w-5 h-5 mb-0.5 shrink-0" aria-hidden="true" />
            <span className="text-[10px] font-bold leading-none uppercase">
              {item.name}
            </span>
          </Link>
        );
      })}

      <button
        type="button"
        onClick={onMoreClick}
        aria-label={moreBadge > 0 ? `${moreLabel} (${moreBadge} pending)` : moreLabel}
        className="flex flex-col items-center justify-center w-full h-14 py-1 text-gray-500 dark:text-gray-400 transition-colors"
      >
        <span className="relative mb-0.5">
          <Bars3Icon className="w-5 h-5 shrink-0" aria-hidden="true" />
          {moreBadge > 0 && (
            <span
              aria-hidden="true"
              className="absolute -top-1 -right-1.5 w-2.5 h-2.5 rounded-full bg-sffl-red ring-2 ring-white dark:ring-sffl-navy"
            />
          )}
        </span>
        <span className="text-[10px] font-bold leading-none uppercase">
          More
        </span>
      </button>
    </nav>
  );
};
