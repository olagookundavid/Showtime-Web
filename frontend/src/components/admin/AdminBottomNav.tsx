import { useAuth } from "../../contexts/AuthContext";
import { Link, useLocation } from "react-router-dom";
import {
  Squares2X2Icon,
  CalendarIcon,
  TicketIcon,
  NewspaperIcon,
  Bars3Icon,
  ChartBarIcon,
  UserGroupIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";
import {
  Squares2X2Icon as SquaresSolid,
  CalendarIcon as CalendarSolid,
  TicketIcon as TicketSolid,
  NewspaperIcon as NewspaperSolid,
  ChartBarIcon as ChartBarSolid,
  UserGroupIcon as UserGroupSolid,
  ShieldCheckIcon as ShieldCheckSolid,
} from "@heroicons/react/24/solid";

interface AdminBottomNavProps {
  onMoreClick?: () => void;
}

export const AdminBottomNav = ({ onMoreClick }: AdminBottomNavProps) => {
  const location = useLocation();
  const { user } = useAuth();

  if (user?.role === "ticketer") {
    return null;
  }

  const navItems = (() => {
    if (user?.role === "referee") {
      return [
        {
          name: "Match",
          path: "/admin/matches",
          icon: CalendarIcon,
          solidIcon: CalendarSolid,
        },
        {
          name: "Stats",
          path: "/admin/stats",
          icon: ChartBarIcon,
          solidIcon: ChartBarSolid,
        },
        {
          name: "Players",
          path: "/admin/players",
          icon: UserGroupIcon,
          solidIcon: UserGroupSolid,
        },
      ];
    }
    if (user?.role === "stats") {
      return [
        {
          name: "Match",
          path: "/admin/matches",
          icon: CalendarIcon,
          solidIcon: CalendarSolid,
        },
        {
          name: "Stats",
          path: "/admin/stats",
          icon: ChartBarIcon,
          solidIcon: ChartBarSolid,
        },
        {
          name: "Teams",
          path: "/admin/teams",
          icon: ShieldCheckIcon,
          solidIcon: ShieldCheckSolid,
        },
      ];
    }
    // Admin default
    return [
      {
        name: "Dash",
        path: "/admin",
        exact: true,
        icon: Squares2X2Icon,
        solidIcon: SquaresSolid,
      },
      {
        name: "Match",
        path: "/admin/matches",
        icon: CalendarIcon,
        solidIcon: CalendarSolid,
      },
      {
        name: "Ticket",
        path: "/admin/tickets",
        icon: TicketIcon,
        solidIcon: TicketSolid,
      },
      {
        name: "News",
        path: "/admin/news",
        icon: NewspaperIcon,
        solidIcon: NewspaperSolid,
      },
    ];
  })();

  const isActive = (item: { path: string; exact?: boolean }) => {
    if (item.exact)
      return (
        location.pathname === item.path || location.pathname === item.path + "/"
      );
    return location.pathname.startsWith(item.path);
  };

  return (
    <nav
      aria-label="Admin shortcuts"
      className="lg:hidden fixed bottom-0 left-0 right-0 h-[calc(3.5rem+env(safe-area-inset-bottom,0px))] pb-[env(safe-area-inset-bottom,0px)] bg-white dark:bg-sffl-navy border-t border-gray-200 dark:border-gray-700 flex items-center justify-around px-1 z-50 shadow-2xl transition-colors"
    >
      {navItems.map((item) => {
        const active = isActive(item);
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
        aria-label="More admin pages"
        className="flex flex-col items-center justify-center w-full h-14 py-1 text-gray-500 dark:text-gray-400 transition-colors"
      >
        <Bars3Icon className="w-5 h-5 mb-0.5 shrink-0" aria-hidden="true" />
        <span className="text-[10px] font-bold leading-none uppercase">
          More
        </span>
      </button>
    </nav>
  );
};
