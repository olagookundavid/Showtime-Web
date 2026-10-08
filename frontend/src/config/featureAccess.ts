import { type User } from "../contexts";

export type Role = User["role"];
export type AccessLevel = "full" | "view" | "none";

export type FeatureKey =
  | "dashboard"
  | "user_management"
  | "competitions"
  | "teams_standings"
  | "matches"
  | "play_by_play"
  | "play_by_play_commit"
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
  | "tickets"
  | "referrals"
  | "event_days"
  | "season_admission_tiers"
  | "game_pass_discounts"
  | "store"
  | "inventory"
  | "news"
  | "hero_slides"
  | "gallery"
  | "live_stream"
  | "season_mvps"
  | "app_settings"
  | "seller_tools"
  | "administrator_tools";

/**
 * Mirrors backend/internal/middlewares/permissions.go's FeatureAccess map,
 * transcribed from Admin_Roles_Features_Matrix_filled.xlsx (the chairman's
 * signed-off matrix). Keep the two in sync whenever the matrix changes.
 *
 * app_admin is never listed — it's always full access (see usePermissions).
 * team_head's own scoped contracts/transfers access is handled separately
 * by its existing portal (TeamHeadOrAdminMiddleware on the backend) and is
 * deliberately not represented here.
 */
export const FEATURE_ACCESS: Record<FeatureKey, Partial<Record<Role, AccessLevel>>> = {
  // See the matching comment in permissions.go: the chairman checked every
  // role on this row, including player/user/player_pending. Kept to its
  // pre-existing admin-only access here; those three roles get a landing
  // screen via the new self-service Profile page instead.
  dashboard: { admin: "full" },
  user_management: { admin: "full" },
  competitions: { admin: "full", commissioner: "full" },
  teams_standings: {
    admin: "full", commissioner: "full", head_referee: "full", stats: "full",
    fantasy_commissioner: "view",
  },
  matches: {
    admin: "full", broadcast: "full", commissioner: "full", head_referee: "full",
    referee: "full", stats: "full", fantasy_commissioner: "view",
  },
  play_by_play: {
    admin: "full", commissioner: "full", head_referee: "full", referee: "full",
    stats: "full",
  },
  play_by_play_commit: { admin: "full", commissioner: "full", head_referee: "full" },
  broadcast_studio: { admin: "full", broadcast: "full", content_creator: "full" },
  stats_edit: { admin: "full", commissioner: "full", head_referee: "full" },
  players: {
    admin: "full", commissioner: "full", head_referee: "full", referee: "full",
    stats: "full", news_head: "view", content_creator: "view",
  },
  totw: { admin: "full", commissioner: "full", fantasy_commissioner: "view" },
  badges: { admin: "full", commissioner: "full", fantasy_commissioner: "view" },
  fantasy: { admin: "full", fantasy_commissioner: "full", commissioner: "view" },
  claims: { admin: "full", commissioner: "full" },
  contracts: { admin: "full", commissioner: "full" },
  transfers: { admin: "full", commissioner: "full" },
  transfer_windows: {
    admin: "full", commissioner: "full", news_head: "view", content_creator: "view",
  },
  team_budgets: { admin: "full", commissioner: "full" },
  tickets: { admin: "full", ticketer: "full" },
  referrals: { admin: "full", ticketer: "full", store_manager: "full" },
  event_days: {
    admin: "full", commissioner: "full", news_head: "full", content_creator: "full",
    referee: "full", stats: "full", store_manager: "full", fantasy_commissioner: "view",
  },
  season_admission_tiers: { admin: "full", ticketer: "full" },
  game_pass_discounts: { admin: "full", ticketer: "full" },
  store: { admin: "full", store_manager: "full" },
  inventory: { admin: "full", store_manager: "full" },
  news: { admin: "full", news_head: "full", content_creator: "full" },
  hero_slides: { admin: "full", content_creator: "full" },
  gallery: { admin: "full", content_creator: "full" },
  live_stream: { admin: "full" },
  season_mvps: {
    admin: "full", commissioner: "full", fantasy_commissioner: "view",
    news_head: "view", content_creator: "view",
  },
  app_settings: { admin: "full", commissioner: "full" },
  seller_tools: { admin: "full", store_manager: "full", seller: "full" },
  // Not a row in the chairman's filled sheet — left at its pre-existing
  // app_admin-only access (app_admin bypass in usePermissions).
  administrator_tools: {},
};

export function accessFor(role: Role | undefined, feature: FeatureKey): AccessLevel {
  if (!role) return "none";
  if (role === "app_admin") return "full";
  return FEATURE_ACCESS[feature]?.[role] ?? "none";
}
