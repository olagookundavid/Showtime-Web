import {
  Squares2X2Icon,
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
  TagIcon,
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
  GlobeAltIcon,
  KeyIcon,
  QuestionMarkCircleIcon,
  FolderOpenIcon,
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
import type { User } from "../../contexts";
import { accessFor, type FeatureKey } from "../../config/featureAccess";

type NavUser = Pick<User, "role" | "roleName" | "permissions"> | null | undefined;

/** The panel's title: the signed-in role's own name, so a role created today is labelled today. */
export const adminBrandLabelFor = (user: NavUser) => {
  if (!user) return "Admin Panel";
  if (user.role === "app_admin") return "Super Admin Panel";
  return user.roleName ? `${user.roleName} Portal` : "Admin Panel";
};

// Every link has its own icon: in the collapsed rail the icon is all there is.
export const ADMIN_NAV_SECTIONS: DashboardNavSection[] = [
  {
    title: "Overview",
    links: [
      { name: "Dashboard", path: "/admin", icon: Squares2X2Icon, end: true },
      { name: "Traffic", path: "/admin/traffic", icon: GlobeAltIcon },
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
      {
        name: "Ticket Products",
        path: "/admin/ticket-products",
        icon: TagIcon,
      },
      { name: "Match Days", path: "/admin/event-days", icon: CalendarDaysIcon },
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
      { name: "Hero Slides", path: "/admin/hero-slides", icon: PhotoIcon },
      { name: "FAQs", path: "/admin/faqs", icon: QuestionMarkCircleIcon },
      { name: "Media Library", path: "/admin/media", icon: FolderOpenIcon },
      { name: "Live Stream", path: "/admin/live-stream", icon: SignalIcon },
    ],
  },
  {
    title: "System",
    links: [
      { name: "Users", path: "/admin/users", icon: UsersIcon },
      { name: "Roles & Permissions", path: "/admin/roles", icon: KeyIcon },
      { name: "App Settings", path: "/admin/settings", icon: Cog6ToothIcon },
      { name: "Administrator", path: "/admin/administrator", icon: GiftIcon },
    ],
  },
];

/** Every nav link's name mapped to the shared feature-access key that gates it. */
const NAV_FEATURE: Record<string, FeatureKey> = {
  Dashboard: "dashboard",
  Traffic: "dashboard",
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
  "Ticket Products": "tickets",
  "Match Days": "event_days",
  Referrals: "referrals",
  "Online Store": "store",
  Inventory: "inventory",
  News: "news",
  "Hero Slides": "hero_slides",
  FAQs: "faqs",
  "Media Library": "media",
  "Live Stream": "live_stream",
  Users: "user_management",
  "Roles & Permissions": "roles",
  "App Settings": "app_settings",
  Administrator: "administrator_tools",
};

const allowLink = (user: NavUser, name: string) => {
  const feature = NAV_FEATURE[name];
  if (!feature) return false;
  return accessFor(user, feature) !== "none";
};

/** The sections a user may see, with their disallowed links and any empty sections removed. */
export const adminSectionsFor = (user: NavUser): DashboardNavSection[] =>
  ADMIN_NAV_SECTIONS.map((s) => ({
    ...s,
    links: s.links.filter((l) => allowLink(user, l.name)),
  })).filter((s) => s.links.length > 0);

/** Short labels and solid icons for the pages most worth a thumb-reach shortcut. */
const BOTTOM_NAV_PREFERENCE: Record<
  string,
  Pick<DashboardBottomNavItem, "name" | "solidIcon">
> = {
  "/admin": { name: "Dash", solidIcon: SquaresSolid },
  "/admin/matches": { name: "Match", solidIcon: CalendarSolid },
  "/admin/tickets": { name: "Ticket", solidIcon: TicketSolid },
  "/admin/news": { name: "News", solidIcon: NewspaperSolid },
  "/admin/broadcast": { name: "Broadcast", solidIcon: VideoCameraSolid },
  "/admin/stats": { name: "Stats", solidIcon: ChartBarSolid },
  "/admin/players": { name: "Players", solidIcon: UserGroupSolid },
  "/admin/teams": { name: "Teams", solidIcon: ShieldCheckSolid },
};

/**
 * The phone bottom-nav shortcuts: up to four of the pages the user can open,
 * preferring the busiest ones and filling the rest from whatever else they can
 * see. Derived from permissions rather than listed per role, so a role created
 * today gets a sensible bar without a code change.
 */
export const adminBottomNavFor = (user: NavUser): DashboardBottomNavItem[] => {
  const links = adminSectionsFor(user).flatMap((s) => s.links);
  const byPath = new Map(links.map((l) => [l.path, l]));

  const preferred = Object.keys(BOTTOM_NAV_PREFERENCE)
    .filter((path) => byPath.has(path))
    .map((path) => byPath.get(path)!);
  const rest = links.filter((l) => !BOTTOM_NAV_PREFERENCE[l.path]);

  return [...preferred, ...rest].slice(0, 4).map((l) => {
    const pref = BOTTOM_NAV_PREFERENCE[l.path];
    return {
      name: pref?.name ?? l.name,
      path: l.path,
      end: l.end,
      icon: l.icon,
      solidIcon: pref?.solidIcon ?? l.icon,
    };
  });
};
