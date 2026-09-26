import type { ComponentType } from "react";
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

export type AdminNavLink = {
  name: string;
  path: string;
  icon: ComponentType<{ className?: string }>;
};

export type AdminNavSection = {
  title: string;
  links: AdminNavLink[];
};

// Every link has its own icon: in the collapsed rail the icon is all there is.
export const ADMIN_NAV_SECTIONS: AdminNavSection[] = [
  {
    title: "Overview",
    links: [
      { name: "Dashboard", path: "/admin", icon: Squares2X2Icon },
      { name: "Analytics", path: "/admin/analytics", icon: PresentationChartLineIcon },
    ],
  },
  {
    title: "League",
    links: [
      { name: "Matches", path: "/admin/matches", icon: CalendarIcon },
      { name: "Play by Play", path: "/admin/play-by-play", icon: PlayCircleIcon },
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
      { name: "Account Claims", path: "/admin/player-claims", icon: IdentificationIcon },
      { name: "Contracts", path: "/admin/contracts", icon: DocumentTextIcon },
      { name: "Transfers", path: "/admin/transfers", icon: ArrowsRightLeftIcon },
      { name: "Transfer Windows", path: "/admin/transfer-windows", icon: ClockIcon },
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
      { name: "Online Store", path: "/admin/store", icon: BuildingStorefrontIcon },
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
    return ["Matches", "Play by Play", "Standings", "Stats", "Players", "Teams"].includes(name);
  if (role === "stats")
    return ["Matches", "Play by Play", "Standings", "Stats", "Teams"].includes(name);
  return false;
};

/** The sections a role may see, with their disallowed links and any empty sections removed. */
export const adminSectionsFor = (role: string | undefined): AdminNavSection[] =>
  ADMIN_NAV_SECTIONS.map((s) => ({
    ...s,
    links: s.links.filter((l) => allowLink(role, l.name)),
  })).filter((s) => s.links.length > 0);

export const isAdminLinkActive = (path: string, pathname: string) =>
  path === "/admin"
    ? pathname === "/admin" || pathname === "/admin/"
    : pathname === path || pathname.startsWith(path + "/");

export const ROLE_LABELS: Record<string, string> = {
  app_admin: "App Admin",
  admin: "Admin",
  ticketer: "Ticketer",
  referee: "Referee",
  stats: "Stats",
};
