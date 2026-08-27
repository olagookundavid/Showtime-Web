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
            <div className="fixed inset-0 -z-50 bg-slate-200 dark:bg-black">
                <div 
                    className="absolute inset-0 bg-[url('/images/branding/home-bg.jpeg')] bg-cover bg-center opacity-40 dark:opacity-20 transition-opacity duration-700" 
                    style={{ backgroundAttachment: 'fixed' }}
                />
                
                {/* Dynamic Tints */}
                <div className="absolute inset-0 bg-gradient-to-br from-sffl-red/10 via-white/50 dark:via-transparent to-sffl-navy/20 dark:from-sffl-red/5 dark:to-sffl-navy/60" />
                
                {/* Vignette for depth */}
                <div className="absolute inset-0 [background:radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.05)_100%)] dark:[background:radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.4)_100%)]" />
            </div>
            {/* Header */}
            <header className="bg-sffl-navy text-white shadow-md sticky top-0 z-50">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
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
            <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 w-full">
                <Outlet />
            </main>
        </div>
    );
};
