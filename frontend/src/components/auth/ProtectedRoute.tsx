import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

interface ProtectedRouteProps {
    children: React.ReactNode;
    requireAdmin?: boolean;
    requireRole?: string | string[];
}

export const ProtectedRoute = ({ children, requireAdmin = false, requireRole }: ProtectedRouteProps) => {
    const { isAuthenticated, user, isLoading } = useAuth();

    if (isLoading) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-gray-50 dark:bg-gray-900">
                <div className="flex flex-col items-center">
                    <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-300 border-t-sffl-red dark:border-gray-700"></div>
                </div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
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
