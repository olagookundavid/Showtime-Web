import type { User } from "../contexts";

export type AccessLevel = "full" | "view" | "none";

/**
 * Every admin-panel feature a role can be given access to. Which roles hold
 * which feature is NOT decided here: it is data, edited on the Roles &
 * Permissions page and delivered with the signed-in user (user.permissions).
 * The keys live in code because a page has to name the feature it belongs to;
 * keep them in step with backend/internal/domain/role.go's FeatureCatalog.
 */
export type FeatureKey =
  | "dashboard"
  | "user_management"
  | "roles"
  | "competitions"
  | "teams_standings"
  | "matches"
  | "play_by_play"
  | "play_by_play_commit"
  | "play_by_play_lock"
  | "broadcast_studio"
  | "stats_edit"
  | "players"
  | "totw"
  | "badges"
  | "fantasy"
  | "claims"
  | "contracts"
  | "transfers"
  | "transfer_windows"
  | "team_budgets"
  | "team_portal"
  | "tickets"
  | "referrals"
  | "event_days"
  | "store"
  | "inventory"
  | "news"
  | "hero_slides"
  | "fantasy_carousel"
  | "faqs"
  | "media"
  | "live_stream"
  | "comment_moderation"
  | "season_mvps"
  | "app_settings"
  | "seller_tools"
  | "administrator_tools";

type AccessUser = Pick<User, "role" | "permissions"> | null | undefined;

/** A user's access to one feature. app_admin is the superuser: full on everything. */
export function accessFor(user: AccessUser, feature: FeatureKey): AccessLevel {
  if (!user) return "none";
  if (user.role === "app_admin") return "full";
  return user.permissions?.[feature] ?? "none";
}
