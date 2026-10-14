import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts";
import { usePermissions } from "../../hooks";
import type { FeatureKey } from "../../config/featureAccess";
import { adminSectionsFor } from "./adminNav";

/**
 * Closes a gap the old single parent-level ProtectedRoute left open: any role
 * allowed into /admin at all could reach any nested admin page by direct URL,
 * regardless of what the nav showed. Wrap each nested <Route element> with
 * this so a role with no access to a feature can't bypass the nav by typing
 * the URL.
 *
 * It sends them to the first admin page they can open, not to /admin: a role
 * without the dashboard would otherwise be bounced to /admin, refused again,
 * and left on a blank screen.
 */
export const FeatureGuard = ({
  feature,
  children,
}: {
  feature: FeatureKey;
  children: React.ReactNode;
}) => {
  const { user } = useAuth();
  const { canView } = usePermissions();
  const { pathname } = useLocation();

  if (!canView(feature)) {
    const home = adminSectionsFor(user)[0]?.links[0]?.path;
    return <Navigate to={home && home !== pathname ? home : "/"} replace />;
  }
  return <>{children}</>;
};
