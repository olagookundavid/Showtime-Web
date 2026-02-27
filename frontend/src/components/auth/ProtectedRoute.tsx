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

    if (requireAdmin && user?.role !== 'admin') {
        return <Navigate to="/" replace />;
    }

    if (requireRole) {
        const roles = Array.isArray(requireRole) ? requireRole : [requireRole];
        if (!roles.includes(user?.role || '')) {
            return <Navigate to="/" replace />;
        }
    }

    return <>{children}</>;
};
