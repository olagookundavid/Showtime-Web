import {
  Squares2X2Icon,
  DocumentTextIcon,
  ArrowsRightLeftIcon,
} from "@heroicons/react/24/outline";
import {
  Squares2X2Icon as SquaresSolid,
  DocumentTextIcon as DocumentSolid,
  ArrowsRightLeftIcon as ArrowsSolid,
} from "@heroicons/react/24/solid";
import type {
  DashboardBottomNavItem,
  DashboardNavSection,
} from "../dashboard/dashboardNav";

export const PLAYER_PORTAL_HOME = "/player-portal";
export const PLAYER_PORTAL_CONTRACTS_PATH = "/player-portal/contracts";
const TRANSFERS_PATH = "/player-portal/transfers";

// Every link has its own icon: in the collapsed rail the icon is all there is.
export const PLAYER_PORTAL_NAV_SECTIONS: DashboardNavSection[] = [
  {
    title: "Overview",
    links: [{ name: "Overview", path: PLAYER_PORTAL_HOME, icon: Squares2X2Icon, end: true }],
  },
  {
    title: "Career",
    links: [
      { name: "Contracts", path: PLAYER_PORTAL_CONTRACTS_PATH, icon: DocumentTextIcon },
      { name: "Transfers", path: TRANSFERS_PATH, icon: ArrowsRightLeftIcon },
    ],
  },
];

export const PLAYER_PORTAL_BOTTOM_NAV: DashboardBottomNavItem[] = [
  { name: "Home", path: PLAYER_PORTAL_HOME, end: true, icon: Squares2X2Icon, solidIcon: SquaresSolid },
  { name: "Contracts", path: PLAYER_PORTAL_CONTRACTS_PATH, icon: DocumentTextIcon, solidIcon: DocumentSolid },
  { name: "Transfers", path: TRANSFERS_PATH, icon: ArrowsRightLeftIcon, solidIcon: ArrowsSolid },
];
