import {
  Squares2X2Icon,
  PresentationChartLineIcon,
  CalendarIcon,
  PlayCircleIcon,
  TrophyIcon,
  ShieldCheckIcon,
  TableCellsIcon,
  ChartBarIcon,
  StarIcon,
  CheckBadgeIcon,
  SparklesIcon,
  UserGroupIcon,
  IdentificationIcon,
  DocumentTextIcon,
  ArrowsRightLeftIcon,
  ClockIcon,
  TicketIcon,
  CalendarDaysIcon,
  UserPlusIcon,
  BuildingStorefrontIcon,
  ArchiveBoxIcon,
  NewspaperIcon,
  PhotoIcon,
  SignalIcon,
  UsersIcon,
  Cog6ToothIcon,
  GiftIcon,
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
import type {
  DashboardBottomNavItem,
  DashboardNavSection,
} from "../dashboard/dashboardNav";

const ADMIN_BRAND_LABELS: Record<string, string> = {
  app_admin: "Super Admin Panel",
  admin: "Admin Panel",
  ticketer: "Ticketing Portal",
  referee: "Referee Portal",
  stats: "Stats Portal",
};

export const adminBrandLabelFor = (role?: string) =>
  (role && ADMIN_BRAND_LABELS[role]) || "Admin Panel";

// Every link has its own icon: in the collapsed rail the icon is all there is.
export const ADMIN_NAV_SECTIONS: DashboardNavSection[] = [
  {
    title: "Overview",
    links: [
      { name: "Dashboard", path: "/admin", icon: Squares2X2Icon, end: true },
      {
        name: "Analytics",
        path: "/admin/analytics",
        icon: PresentationChartLineIcon,
      },
    ],
  },
  {
    title: "League",
    links: [
      { name: "Matches", path: "/admin/matches", icon: CalendarIcon },
      {
        name: "Play by Play",
        path: "/admin/play-by-play",
        icon: PlayCircleIcon,
      },
      { name: "Competitions", path: "/admin/competitions", icon: TrophyIcon },
      { name: "Teams", path: "/admin/teams", icon: ShieldCheckIcon },
      { name: "Standings", path: "/admin/standings", icon: TableCellsIcon },
      { name: "Stats", path: "/admin/stats", icon: ChartBarIcon },
      { name: "Team of the Week", path: "/admin/totw", icon: StarIcon },
      { name: "Badges & Honors", path: "/admin/badges", icon: CheckBadgeIcon },
      { name: "Fantasy", path: "/admin/fantasy", icon: SparklesIcon },
    ],
  },
  {
    title: "Players",
    links: [
      { name: "Players", path: "/admin/players", icon: UserGroupIcon },
      {
        name: "Account Claims",
        path: "/admin/player-claims",
        icon: IdentificationIcon,
      },
      { name: "Contracts", path: "/admin/contracts", icon: DocumentTextIcon },
      {
        name: "Transfers",
        path: "/admin/transfers",
        icon: ArrowsRightLeftIcon,
      },
      {
        name: "Transfer Windows",
        path: "/admin/transfer-windows",
        icon: ClockIcon,
      },
    ],
  },
  {
    title: "Ticketing",
    links: [
      { name: "Tickets", path: "/admin/tickets", icon: TicketIcon },
      { name: "Event Days", path: "/admin/event-days", icon: CalendarDaysIcon },
      { name: "Referrals", path: "/admin/referrals", icon: UserPlusIcon },
    ],
  },
  {
    title: "Store",
    links: [
      {
        name: "Online Store",
        path: "/admin/store",
        icon: BuildingStorefrontIcon,
      },
      { name: "Inventory", path: "/admin/inventory", icon: ArchiveBoxIcon },
    ],
  },
  {
    title: "Content",
    links: [
      { name: "News", path: "/admin/news", icon: NewspaperIcon },
      // { name: 'Gallery', path: '/admin/gallery', icon: PhotoIcon },
      { name: "Hero Slides", path: "/admin/hero-slides", icon: PhotoIcon },
      { name: "Live Stream", path: "/admin/live-stream", icon: SignalIcon },
    ],
  },
  {
    title: "System",
    links: [
      { name: "Users", path: "/admin/users", icon: UsersIcon },
      { name: "App Settings", path: "/admin/settings", icon: Cog6ToothIcon },
      { name: "Administrator", path: "/admin/administrator", icon: GiftIcon },
    ],
  },
];

const allowLink = (role: string | undefined, name: string) => {
  // app_admin is the superuser: sees everything, including the Administrator (gift) section.
  if (role === "app_admin") return true;
  // admin sees everything an app_admin does EXCEPT Administrator (gift ticket) —
  // that section alone stays app_admin-only.
  if (role === "admin") return name !== "Administrator";
  if (role === "ticketer") return ["Tickets", "Referrals"].includes(name);
  if (role === "referee")
    return [
      "Matches",
      "Play by Play",
      "Standings",
      "Stats",
      "Players",
      "Teams",
    ].includes(name);
  if (role === "stats")
    return ["Matches", "Play by Play", "Standings", "Stats", "Teams"].includes(
      name,
    );
  return false;
};

/** The sections a role may see, with their disallowed links and any empty sections removed. */
export const adminSectionsFor = (
  role: string | undefined,
): DashboardNavSection[] =>
  ADMIN_NAV_SECTIONS.map((s) => ({
    ...s,
    links: s.links.filter((l) => allowLink(role, l.name)),
  })).filter((s) => s.links.length > 0);

const MATCH: DashboardBottomNavItem = {
  name: "Match",
  path: "/admin/matches",
  icon: CalendarIcon,
  solidIcon: CalendarSolid,
};
const STATS: DashboardBottomNavItem = {
  name: "Stats",
  path: "/admin/stats",
  icon: ChartBarIcon,
  solidIcon: ChartBarSolid,
};

/** The phone bottom-nav shortcuts for a role. Ticketers have no bottom nav. */
export const adminBottomNavFor = (
  role: string | undefined,
): DashboardBottomNavItem[] => {
  if (role === "ticketer") return [];
  if (role === "referee")
    return [
      MATCH,
      STATS,
      {
        name: "Players",
        path: "/admin/players",
        icon: UserGroupIcon,
        solidIcon: UserGroupSolid,
      },
    ];
  if (role === "stats")
    return [
      MATCH,
      STATS,
      {
        name: "Teams",
        path: "/admin/teams",
        icon: ShieldCheckIcon,
        solidIcon: ShieldCheckSolid,
      },
    ];
  return [
    {
      name: "Dash",
      path: "/admin",
      end: true,
      icon: Squares2X2Icon,
      solidIcon: SquaresSolid,
    },
    MATCH,
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
};
