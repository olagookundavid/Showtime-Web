import {
  Squares2X2Icon,
  UserGroupIcon,
  ClipboardDocumentListIcon,
  IdentificationIcon,
  DocumentTextIcon,
  ArrowsRightLeftIcon,
  BanknotesIcon,
  TicketIcon,
} from "@heroicons/react/24/outline";
import {
  Squares2X2Icon as SquaresSolid,
  UserGroupIcon as UsersSolid,
  TicketIcon as TicketSolid,
  ClipboardDocumentListIcon as ClipboardSolid,
} from "@heroicons/react/24/solid";
import type {
  DashboardBottomNavItem,
  DashboardNavSection,
} from "../dashboard/dashboardNav";

export const TEAM_HEAD_HOME = "/team-head";
export const TEAM_HEAD_CLAIMS_PATH = "/team-head/claims";

// Every link has its own icon: in the collapsed rail the icon is all there is.
// The descriptions feed the Overview page's quick actions.
export const TEAM_HEAD_NAV_SECTIONS: DashboardNavSection[] = [
  {
    title: "Overview",
    links: [{ name: "Overview", path: TEAM_HEAD_HOME, icon: Squares2X2Icon, end: true }],
  },
  {
    title: "Squad",
    links: [
      { name: "Players", path: "/team-head/players", icon: UserGroupIcon, description: "View your roster and move players between squads." },
      { name: "Team Sheets", path: "/team-head/team-sheets", icon: ClipboardDocumentListIcon, description: "Set the starting 14, defensive cover and bench." },
      { name: "Account Claims", path: TEAM_HEAD_CLAIMS_PATH, icon: IdentificationIcon, description: "Confirm the players claiming their accounts." },
    ],
  },
  {
    title: "Market",
    links: [
      { name: "Contracts", path: "/team-head/contracts", icon: DocumentTextIcon, description: "Offer, extend and release player contracts." },
      { name: "Transfer Market", path: "/team-head/transfers", icon: ArrowsRightLeftIcon, description: "List, bid on and request players." },
      { name: "Team Budget", path: "/team-head/budget", icon: BanknotesIcon, description: "Check what your team has spent and has left." },
    ],
  },
  {
    title: "Match Day",
    links: [
      { name: "Match Tickets", path: "/team-head/tickets", icon: TicketIcon, description: "Send your team's complimentary tickets." },
    ],
  },
];

export const TEAM_HEAD_BOTTOM_NAV: DashboardBottomNavItem[] = [
  { name: "Home", path: TEAM_HEAD_HOME, end: true, icon: Squares2X2Icon, solidIcon: SquaresSolid },
  { name: "Lineup", path: "/team-head/team-sheets", icon: ClipboardDocumentListIcon, solidIcon: ClipboardSolid },
  { name: "Players", path: "/team-head/players", icon: UserGroupIcon, solidIcon: UsersSolid },
  { name: "Tickets", path: "/team-head/tickets", icon: TicketIcon, solidIcon: TicketSolid },
];
