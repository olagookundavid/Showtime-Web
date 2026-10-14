import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts';
import { accessFor, type FeatureKey } from '../../config/featureAccess';
import { AuthRequiredDialog } from './AuthRequiredDialog';

interface ProtectedRouteProps {
    children: React.ReactNode;
    /** Anyone whose role can open the admin panel (holds at least one admin feature). */
    requireStaff?: boolean;
    /** A fixed role (or roles) with its own portal, e.g. 'team_head'. */
    requireRole?: string | string[];
    /** Also let in anyone with full access to this feature, whatever their role. */
    orFeature?: FeatureKey;
    /** Finishes "You need to be logged in to …" on the sign-in gate. Naming the
     *  feature is what turns a bounce into an explanation. */
    actionText?: string;
    /** Where Go Back lands when there is no history to go back to — someone who
     *  opened the link directly. Usually the feature's public landing page. */
    fallbackPath?: string;
}

export const ProtectedRoute = ({
    children,
    requireStaff = false,
    requireRole,
    orFeature,
    actionText,
    fallbackPath = '/',
}: ProtectedRouteProps) => {
    const { isAuthenticated, user, isLoading } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();

    if (isLoading) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-gray-50 dark:bg-gray-900">
                <div className="flex flex-col items-center">
                    <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-300 border-t-sffl-red dark:border-gray-700"></div>
                </div>
            </div>
        );
    }

    // Explain the wall rather than teleporting them to /login with no idea why.
    // The dialogue carries them to sign-in and straight back afterwards, and
    // Go Back returns them to wherever they came from.
    if (!isAuthenticated) {
        const returnUrl = `${location.pathname}${location.search}${location.hash}`;
        return (
            <AuthRequiredDialog
                open
                returnUrl={returnUrl}
                actionText={actionText ?? 'open this page'}
                closeLabel="Go Back"
                onClose={() =>
                    // Someone who opened this URL directly has nothing behind
                    // them; send them to the feature's public page instead of
                    // off the site.
                    (window.history.state?.idx ?? 0) > 0 ? navigate(-1) : navigate(fallbackPath)
                }
            />
        );
    }

    // app_admin is the superuser: it can reach anything.
    const isSuperUser = user?.role === 'app_admin';

    // A player_pending user is an account claimant whose team manager has not approved
    // them yet. They have a real login but no privileges, so bounce them to the one
    // screen that means something to them rather than dumping them on the landing page
    // with no explanation of why they were turned away.
    const deniedRedirect = user?.role === 'player_pending' ? '/claim/status' : '/';

    // Admin-panel access is whatever the user's role has been given on the Roles
    // page, not a list of role names kept here.
    if (requireStaff && !isSuperUser && !user?.isStaff) {
        return <Navigate to={deniedRedirect} replace />;
    }

    if (requireRole) {
        const roles = Array.isArray(requireRole) ? requireRole : [requireRole];
        const allowed =
            isSuperUser ||
            roles.includes(user?.role || '') ||
            (orFeature !== undefined && accessFor(user, orFeature) === 'full');
        if (!allowed) {
            return <Navigate to={deniedRedirect} replace />;
        }
    }

    return <>{children}</>;
};
