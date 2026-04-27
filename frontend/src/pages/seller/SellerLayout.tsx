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
        <div className={`min-h-screen bg-transparent w-full relative`}>
            {/* Global Background */}
            <div className="fixed inset-0 -z-50 bg-gray-50 dark:bg-gray-950">
                <div 
                    className="absolute inset-0 bg-[url('/images/branding/home-bg.jpeg')] bg-cover bg-center opacity-20 dark:opacity-30" 
                    style={{ backgroundAttachment: 'fixed' }}
                />
                {/* Atmospheric overlays */}
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-white dark:to-gray-950" />
                <div className="absolute inset-0 bg-gradient-to-br from-sffl-red/5 via-transparent to-sffl-navy/10 dark:from-sffl-red/10 dark:to-sffl-navy/40" />
            </div>
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
