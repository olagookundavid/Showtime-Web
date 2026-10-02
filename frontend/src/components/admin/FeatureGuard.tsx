import { Navigate } from "react-router-dom";
import { usePermissions } from "../../hooks/usePermissions";
import type { FeatureKey } from "../../config/featureAccess";

/**
 * Closes a gap the old single parent-level ProtectedRoute left open: any role
 * allowed into /admin at all could reach any nested admin page by direct URL,
 * regardless of what the nav showed. Wrap each nested <Route element> with
 * this so a role with no access to a feature can't bypass the nav by typing
 * the URL — it bounces to /admin instead.
 */
export const FeatureGuard = ({
  feature,
  children,
}: {
  feature: FeatureKey;
  children: React.ReactNode;
}) => {
  const { canView } = usePermissions();
  if (!canView(feature)) {
    return <Navigate to="/admin" replace />;
  }
  return <>{children}</>;
};
