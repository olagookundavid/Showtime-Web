import { useAuth } from "../contexts";
import { accessFor, type AccessLevel, type FeatureKey } from "../config/featureAccess";

/** Reads the signed-in user's role against the shared admin feature-access matrix. */
export function usePermissions() {
  const { user } = useAuth();

  const can = (feature: FeatureKey): AccessLevel => accessFor(user?.role, feature);
  const canEdit = (feature: FeatureKey): boolean => can(feature) === "full";
  const canView = (feature: FeatureKey): boolean => can(feature) !== "none";

  return { can, canEdit, canView };
}
