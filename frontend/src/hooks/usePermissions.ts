import { useAuth } from "../contexts";
import { accessFor, type AccessLevel, type FeatureKey } from "../config/featureAccess";

/** Reads what the signed-in user's role may do, as delivered by the server with the profile. */
export function usePermissions() {
  const { user } = useAuth();

  const can = (feature: FeatureKey): AccessLevel => accessFor(user, feature);
  const canEdit = (feature: FeatureKey): boolean => can(feature) === "full";
  const canView = (feature: FeatureKey): boolean => can(feature) !== "none";
  /** Can open the admin panel at all (holds at least one admin feature). */
  const isStaff = Boolean(user?.isStaff || user?.role === "app_admin");

  return { can, canEdit, canView, isStaff };
}
