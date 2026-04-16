import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { AdminBottomNav } from './AdminBottomNav';
import {
    XMarkIcon,
    ChartBarIcon,
    ShieldCheckIcon,
    TrophyIcon,
    UserGroupIcon,
    PhotoIcon,
    UsersIcon,
    CalendarIcon,
    TicketIcon,
    NewspaperIcon,
    BuildingStorefrontIcon
} from '@heroicons/react/24/outline';

export const AdminLayout = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const { isDarkMode, toggleDarkMode } = useTheme();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    // Close sidebar on route change
    useEffect(() => {
        setIsSidebarOpen(false);
    }, [location.pathname]);

    // Prevent body scroll when sidebar is open on mobile
    useEffect(() => {
        if (isSidebarOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => { document.body.style.overflow = 'unset'; };
    }, [isSidebarOpen]);

    const linkClass = (path: string) => {
        const isActive = path === '/admin'
            ? location.pathname === '/admin' || location.pathname === '/admin/'
            : location.pathname.startsWith(path);

        const baseClass = "block px-3 py-1.5 md:px-4 md:py-2.5 min-h-[36px] md:min-h-[44px] text-[10px] md:text-base rounded-lg transition-all duration-300 font-bold";
        const activeClass = "bg-sffl-red text-white";
        const inactiveClass = "text-gray-300 hover:bg-sffl-red/70 hover:text-white dark:hover:bg-gray-700 dark:text-gray-300";

        return `${baseClass} ${isActive ? activeClass : inactiveClass}`;
    };

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    const allLinks = [
        { name: 'Dashboard', path: '/admin', icon: ChartBarIcon },
        { name: 'Analytics', path: '/admin/analytics', icon: ChartBarIcon },
        { name: 'Matches', path: '/admin/matches', icon: CalendarIcon },
        { name: 'Teams', path: '/admin/teams', icon: ShieldCheckIcon },
        { name: 'Competitions', path: '/admin/competitions', icon: TrophyIcon },
        { name: 'Players', path: '/admin/players', icon: UserGroupIcon },
        { name: 'Stats', path: '/admin/stats', icon: ChartBarIcon },
        { name: 'Team of the Week', path: '/admin/totw', icon: TrophyIcon },
        { name: 'Standings', path: '/admin/standings', icon: TrophyIcon },
        { name: 'Tickets', path: '/admin/tickets', icon: TicketIcon },
        { name: 'Event Days', path: '/admin/event-days', icon: CalendarIcon },
        { name: 'News', path: '/admin/news', icon: NewspaperIcon },
        { name: 'Gallery', path: '/admin/gallery', icon: PhotoIcon },
        { name: 'Users', path: '/admin/users', icon: UsersIcon },
        { name: 'Inventory', path: '/admin/inventory', icon: BuildingStorefrontIcon },
    ];

    const adminLinks = (() => {
        if (!user) return [];
        if (user.role === 'admin') return allLinks;
        if (user.role === 'ticketer') return allLinks.filter(l => ['Tickets'].includes(l.name));
        if (user.role === 'referee') return allLinks.filter(l => ['Matches', 'Standings', 'Stats', 'Players', 'Teams', 'Team of the Week'].includes(l.name));
        if (user.role === 'stats') return allLinks.filter(l => ['Matches', 'Standings', 'Stats', 'Teams', 'Team of the Week'].includes(l.name));
        return [];
    })();

    // Redirect users away from Dashboard if they lack permission
    useEffect(() => {
        if (!user) return;
        const isDashboard = location.pathname === '/admin' || location.pathname === '/admin/';
        
        if (isDashboard) {
            if (user.role === 'ticketer') {
                navigate('/admin/tickets');
            } else if (user.role === 'referee' || user.role === 'stats') {
                navigate('/admin/matches');
            }
        }
    }, [user, location.pathname, navigate]);

    return (
        <div className={`h-screen flex overflow-hidden ${isDarkMode ? 'dark' : ''} bg-gray-100 dark:bg-gray-900 w-full`}>
            {/* Mobile Admin Header */}
            <div className="lg:hidden fixed top-0 left-0 right-0 h-20 bg-sffl-navy text-white flex items-center justify-between px-4 z-30 shadow-md border-b border-sffl-red/30">
                <div className="flex items-center gap-3">
                    <span className="font-black italic text-2xl tracking-tighter uppercase leading-none">ADMIN <span className="text-sffl-red">MODULE</span></span>
                </div>
                <div className="flex items-center gap-3">
                    <Link to="/" className="text-sm font-bold bg-white/10 px-4 py-2 rounded-xl active:scale-95 transition-transform uppercase">Back to App</Link>
                    <button onClick={toggleDarkMode} className="p-2 text-gray-400 active:scale-90 transition-transform">
                        {isDarkMode ? <span className="text-yellow-400 text-2xl">☀️</span> : <span className="text-2xl">🌙</span>}
                    </button>
                </div>
            </div>

            {/* Absolute Top-Right Dark Mode Toggle (Desktop) */}
            <button
                onClick={toggleDarkMode}
                className="hidden lg:flex absolute top-4 right-6 p-2 min-h-[44px] min-w-[44px] items-center justify-center hover:scale-110 transition-transform focus:outline-none z-50 text-gray-500 dark:text-yellow-400"
                aria-label="Toggle dark mode"
            >
                {isDarkMode ? (
                    <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                    </svg>
                ) : (
                    <svg className="w-5 h-5 text-gray-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                    </svg>
                )}
            </button>

            {/* Mobile Overlay Background */}
            <div
                className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100 visible' : 'opacity-0 invisible pointer-events-none'}`}
                onClick={() => setIsSidebarOpen(false)}
            />

            {/* Sidebar (Desktop Only or Drawer on More) */}
            <aside className={`
                fixed inset-y-0 left-0 z-50 w-[220px] lg:w-64 transform transition-transform duration-300 ease-out
                lg:relative lg:translate-x-0
                ${isSidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}
                flex-shrink-0 bg-sffl-navy dark:bg-gray-800 text-white flex flex-col h-full
            `}>
                <div className="p-3 md:p-6 border-b border-sffl-navy-light dark:border-gray-700 flex justify-between items-start">
                    <div className="w-full">
                        <h1 className="text-base md:text-2xl font-black italic">ADMIN PANEL</h1>
                        <div className="flex items-center justify-between mt-2">
                            <p className="text-xs md:text-sm text-gray-400 truncate max-w-[130px]" title={user?.name}>{user?.name}</p>
                            <Link to="/" className="text-[10px] md:text-xs font-bold bg-white/10 hover:bg-white/20 px-2 md:px-3 py-1.5 md:py-2 min-h-[32px] md:min-h-[44px] flex items-center justify-center rounded-lg text-gray-300 hover:text-white transition-all ml-2 whitespace-nowrap">
                                ← App
                            </Link>
                        </div>
                    </div>
                </div>

                <nav className="flex-1 p-3 md:p-4 space-y-1 overflow-y-auto font-medium">
                    {adminLinks.map(link => (
                        <Link key={link.path} to={link.path} className={linkClass(link.path)}>
                            {link.name}
                        </Link>
                    ))}
                </nav>

                <div className="p-3 md:p-4 border-t border-sffl-navy-light dark:border-gray-700 space-y-3">
                    <button
                        onClick={handleLogout}
                        className="w-full px-4 py-2 md:py-3 min-h-[40px] md:min-h-[44px] bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-xs md:text-base transition-all duration-300 hover:scale-[1.02] active:scale-95"
                    >
                        Logout
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 w-full min-w-0 p-2 lg:p-8 pt-22 lg:pt-8 overflow-y-auto bg-gray-100 dark:bg-gray-900 pb-20 lg:pb-8">
                <Outlet />
            </main>

            {/* Admin Bottom Nav */}
            <AdminBottomNav onMoreClick={() => setIsSidebarOpen(true)} />

            {/* Admin "More" Drawer Mobile */}
            <div
                className={`fixed inset-y-0 left-0 z-50 w-[260px] transform transition-transform duration-300 ease-out flex flex-col bg-sffl-navy lg:hidden ${isSidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}`}
            >
                <div className="p-4 border-b border-white/10 flex items-center justify-between">
                    <span className="font-black italic text-white tracking-widest uppercase text-sm">Admin Menu</span>
                    <button onClick={() => setIsSidebarOpen(false)} className="text-gray-400">
                        <XMarkIcon className="w-6 h-6" />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {adminLinks.map(link => {
                        const active = location.pathname === link.path || (link.path !== '/admin' && location.pathname.startsWith(link.path));
                        return (
                            <Link
                                key={link.path}
                                to={link.path}
                                onClick={() => setIsSidebarOpen(false)}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-colors ${active ? 'bg-sffl-red text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-white/5'
                                    }`}
                            >
                                <link.icon className="w-5 h-5 flex-shrink-0" />
                                {link.name}
                            </Link>
                        );
                    })}
                </div>
                <div className="p-4 border-t border-white/10">
                    <button
                        onClick={handleLogout}
                        className="w-full py-3 bg-red-600/20 hover:bg-red-600 text-white rounded-xl font-black transition-all text-xs uppercase tracking-widest"
                    >
                        Logout
                    </button>
                </div>
            </div>
        </div>
    );
};
