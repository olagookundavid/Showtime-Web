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
  VideoCameraIcon,
} from "@heroicons/react/24/outline";
import {
  Squares2X2Icon as SquaresSolid,
  CalendarIcon as CalendarSolid,
  TicketIcon as TicketSolid,
  NewspaperIcon as NewspaperSolid,
  ChartBarIcon as ChartBarSolid,
  UserGroupIcon as UserGroupSolid,
  ShieldCheckIcon as ShieldCheckSolid,
  VideoCameraIcon as VideoCameraSolid,
} from "@heroicons/react/24/solid";
import type {
  DashboardBottomNavItem,
  DashboardNavSection,
} from "../dashboard/dashboardNav";
import { accessFor, type FeatureKey, type Role } from "../../config/featureAccess";

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
      {
        name: "Broadcast Studio",
        path: "/admin/broadcast",
        icon: VideoCameraIcon,
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

/** Every nav link's name mapped to the shared feature-access key that gates it. */
const NAV_FEATURE: Record<string, FeatureKey> = {
  Dashboard: "dashboard",
  Analytics: "dashboard",
  Matches: "matches",
  "Play by Play": "play_by_play",
  "Broadcast Studio": "broadcast_studio",
  Competitions: "competitions",
  Teams: "teams_standings",
  Standings: "teams_standings",
  Stats: "stats_edit",
  "Team of the Week": "totw",
  "Badges & Honors": "badges",
  Fantasy: "fantasy",
  Players: "players",
  "Account Claims": "claims",
  Contracts: "contracts",
  Transfers: "transfers",
  "Transfer Windows": "transfer_windows",
  Tickets: "tickets",
  "Event Days": "event_days",
  Referrals: "referrals",
  "Online Store": "store",
  Inventory: "inventory",
  News: "news",
  "Hero Slides": "hero_slides",
  "Live Stream": "live_stream",
  Users: "user_management",
  "App Settings": "app_settings",
  Administrator: "administrator_tools",
};

const allowLink = (role: Role | undefined, name: string) => {
  const feature = NAV_FEATURE[name];
  if (!feature) return false;
  return accessFor(role, feature) !== "none";
};

/** The sections a role may see, with their disallowed links and any empty sections removed. */
export const adminSectionsFor = (role: Role | undefined): DashboardNavSection[] =>
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
const BROADCAST: DashboardBottomNavItem = {
  name: "Broadcast",
  path: "/admin/broadcast",
  icon: VideoCameraIcon,
  solidIcon: VideoCameraSolid,
};

/** The phone bottom-nav shortcuts for a role. Ticketers have no bottom nav. */
export const adminBottomNavFor = (role: Role | undefined): DashboardBottomNavItem[] => {
  if (role === "ticketer") return [];
  if (role === "broadcast") return [BROADCAST, MATCH];
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
    return [MATCH, STATS, { name: "Teams", path: "/admin/teams", icon: ShieldCheckIcon, solidIcon: ShieldCheckSolid }];
  if (role === "admin" || role === "app_admin") {
    return [
      { name: "Dash", path: "/admin", end: true, icon: Squares2X2Icon, solidIcon: SquaresSolid },
      MATCH,
      { name: "Ticket", path: "/admin/tickets", icon: TicketIcon, solidIcon: TicketSolid },
      { name: "News", path: "/admin/news", icon: NewspaperIcon, solidIcon: NewspaperSolid },
    ];
  }
  // Every other role (team_head, seller, and the newer commissioner-family
  // roles) gets a generic shortcut bar built from whatever it can see — the
  // fixed lists above would otherwise point at pages those roles can't open.
  return adminSectionsFor(role)
    .flatMap((s) => s.links)
    .slice(0, 4)
    .map((l) => ({ name: l.name, path: l.path, end: l.end, icon: l.icon, solidIcon: l.icon }));
};
