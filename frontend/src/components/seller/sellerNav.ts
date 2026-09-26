import { ShoppingCartIcon, ClockIcon } from "@heroicons/react/24/outline";
import {
  ShoppingCartIcon as CartSolid,
  ClockIcon as ClockSolid,
} from "@heroicons/react/24/solid";
import type {
  DashboardBottomNavItem,
  DashboardNavSection,
} from "../dashboard/dashboardNav";

export const SELLER_HOME = "/seller";
export const SELLER_SALES_PATH = "/seller/sales";

// Every link has its own icon: in the collapsed rail the icon is all there is.
export const SELLER_NAV_SECTIONS: DashboardNavSection[] = [
  {
    title: "Store",
    links: [
      { name: "Log Sale", path: SELLER_HOME, icon: ShoppingCartIcon, end: true },
      { name: "Sales History", path: SELLER_SALES_PATH, icon: ClockIcon },
    ],
  },
];

export const SELLER_BOTTOM_NAV: DashboardBottomNavItem[] = [
  { name: "Sell", path: SELLER_HOME, end: true, icon: ShoppingCartIcon, solidIcon: CartSolid },
  { name: "History", path: SELLER_SALES_PATH, icon: ClockIcon, solidIcon: ClockSolid },
];
