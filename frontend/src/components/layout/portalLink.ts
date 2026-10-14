import type { User } from "../../contexts";
import { adminSectionsFor } from "../admin/adminNav";

export type PortalKind = "app_admin" | "staff" | "team_head" | "player" | "seller" | "account";

export interface PortalLink {
  to: string;
  label: string;
  kind: PortalKind;
}

/**
 * Where a signed-in user's "portal" link should go. Fixed roles have a portal of
 * their own; anyone else who holds an admin feature goes to the first admin page
 * they can open, so a role created today needs no entry here.
 */
export const portalLinkFor = (user: User | null | undefined): PortalLink | undefined => {
  if (!user) return undefined;

  switch (user.role) {
    case "app_admin":
      return { to: "/admin", label: "App Admin", kind: "app_admin" };
    case "team_head":
      return { to: "/team-head", label: "My Team", kind: "team_head" };
    case "player":
      return { to: "/player-portal", label: "Player Portal", kind: "player" };
    case "seller":
      return { to: "/seller", label: "Store Portal", kind: "seller" };
    case "player_pending":
      return undefined;
  }

  if (user.isStaff) {
    const first = adminSectionsFor(user)[0]?.links[0]?.path ?? "/admin";
    return { to: first, label: `${user.roleName} Portal`, kind: "staff" };
  }

  // A fan, or a role that holds no admin features: their only landing page is their profile.
  return { to: "/account", label: "My Account", kind: "account" };
};
