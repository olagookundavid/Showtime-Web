import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { ProtectedRoute } from '../components';
import type { FeatureKey } from '../config/featureAccess';
import { usePermissions } from '../hooks';
import { Loader } from '../components';
import { useArenaMe } from './hooks';

/** Signed-in users only. Visitors get the sign-in prompt, then come straight back. */
export const RequireSignIn = ({ children, actionText }: { children: ReactNode; actionText: string }) => (
  <ProtectedRoute actionText={actionText}>{children}</ProtectedRoute>
);

/** Signed in and holding one of the listed Arena features (any access level). */
export const RequireFeature = ({ features, children }: { features: FeatureKey[]; children: ReactNode }) => {
  const { canView } = usePermissions();
  return (
    <RequireSignIn actionText="open the organiser area">
      {features.some(canView) ? children : <Navigate to="/" replace />}
    </RequireSignIn>
  );
};

/** Signed in as the manager of a club. */
export const RequireManager = ({ children }: { children: ReactNode }) => {
  const me = useArenaMe();
  return (
    <RequireSignIn actionText="manage your club">
      {me.isLoading ? <Loader /> : me.data?.managed_club ? children : <Navigate to="/me" replace />}
    </RequireSignIn>
  );
};
