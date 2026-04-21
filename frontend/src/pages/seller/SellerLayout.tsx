import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export const SellerLayout = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    return (
        <div className={`min-h-screen bg-gray-50 dark:bg-gray-900 w-full`}>
            {/* Header */}
            <header className="bg-sffl-navy text-white shadow-md sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <div className="flex items-center gap-4">
                            <span className="font-black italic text-xl tracking-tighter uppercase leading-none">
                                SELLER <span className="text-sffl-red">PORTAL</span>
                            </span>
                        </div>
                        <div className="flex items-center gap-4">
                            <span className="text-sm font-medium hidden sm:block text-gray-300">
                                {user?.name}
                            </span>
                            <button
                                onClick={handleLogout}
                                className="text-sm font-bold bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg transition-colors"
                            >
                                Logout
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
                <Outlet />
            </main>
        </div>
    );
};
