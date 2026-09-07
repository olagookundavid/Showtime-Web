import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { AuthRequiredDialog } from './AuthRequiredDialog';

interface ProtectedRouteProps {
    children: React.ReactNode;
    requireAdmin?: boolean;
    requireRole?: string | string[];
    /** Finishes "You need to be logged in to …" on the sign-in gate. Naming the
     *  feature is what turns a bounce into an explanation. */
    actionText?: string;
    /** Where Go Back lands when there is no history to go back to — someone who
     *  opened the link directly. Usually the feature's public landing page. */
    fallbackPath?: string;
}

export const ProtectedRoute = ({
    children,
    requireAdmin = false,
    requireRole,
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
                    window.history.length > 1 ? navigate(-1) : navigate(fallbackPath)
                }
            />
        );
    }

    // app_admin is the superuser: it can reach anything an admin can.
    const isSuperUser = user?.role === 'admin' || user?.role === 'app_admin';

    // A player_pending user is an account claimant whose team manager has not approved
    // them yet. They have a real login but no privileges, so bounce them to the one
    // screen that means something to them rather than dumping them on the landing page
    // with no explanation of why they were turned away.
    const deniedRedirect = user?.role === 'player_pending' ? '/claim/status' : '/';

    if (requireAdmin && !isSuperUser) {
        return <Navigate to={deniedRedirect} replace />;
    }

    if (requireRole) {
        const roles = Array.isArray(requireRole) ? requireRole : [requireRole];
        const allowed = roles.includes(user?.role || '') || (isSuperUser && roles.includes('admin'));
        if (!allowed) {
            return <Navigate to={deniedRedirect} replace />;
        }
    }

    return <>{children}</>;
};
