import type { ComponentType } from "react";

type Icon = ComponentType<{ className?: string }>;

export type DashboardNavLink = {
  name: string;
  path: string;
  icon: Icon;
  /** Active only on this exact path, not on the pages under it (a portal's home link). */
  end?: boolean;
  /** One line saying what the page is for, for quick-action lists. */
  description?: string;
};

export type DashboardNavSection = {
  title: string;
  links: DashboardNavLink[];
};

/** A phone bottom-nav shortcut: outline icon normally, solid when it's the current page. */
export type DashboardBottomNavItem = {
  name: string;
  path: string;
  end?: boolean;
  icon: Icon;
  solidIcon: Icon;
};

export const isNavLinkActive = (
  link: { path: string; end?: boolean },
  pathname: string,
) =>
  link.end
    ? pathname === link.path || pathname === link.path + "/"
    : pathname === link.path || pathname.startsWith(link.path + "/");

export const ROLE_LABELS: Record<string, string> = {
  app_admin: "App Admin",
  admin: "Admin",
  ticketer: "Ticketer",
  referee: "Referee",
  stats: "Stats",
  team_head: "Team Head",
  player: "Player",
  seller: "Store Seller",
};
