import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { AdminBottomNav } from './AdminBottomNav';
import {
    XMarkIcon,
    ChartBarIcon,
    ShieldCheckIcon,
    UserGroupIcon,
    PhotoIcon,
    UsersIcon,
    CalendarIcon,
    TicketIcon,
    NewspaperIcon,
    BuildingStorefrontIcon,
    GiftIcon,
} from '@heroicons/react/24/outline';

export const AdminLayout = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
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
        { name: 'Play by Play', path: '/admin/play-by-play', icon: CalendarIcon },
        { name: 'Teams', path: '/admin/teams', icon: ShieldCheckIcon },
        { name: 'Competitions', path: '/admin/competitions', icon: ShieldCheckIcon },
        { name: 'Players', path: '/admin/players', icon: UserGroupIcon },
        { name: 'Contracts', path: '/admin/contracts', icon: UserGroupIcon },
        { name: 'Transfers', path: '/admin/transfers', icon: UserGroupIcon },
        { name: 'Transfer Windows', path: '/admin/transfer-windows', icon: CalendarIcon },
        { name: 'Stats', path: '/admin/stats', icon: ChartBarIcon },
        // { name: 'Team of the Week', path: '/admin/totw', icon: TrophyIcon }, // disabled — see App.tsx
        { name: 'Standings', path: '/admin/standings', icon: ChartBarIcon },
        { name: 'Tickets', path: '/admin/tickets', icon: TicketIcon },
        { name: 'Referrals', path: '/admin/referrals', icon: TicketIcon },
        { name: 'Event Days', path: '/admin/event-days', icon: CalendarIcon },
        { name: 'News', path: '/admin/news', icon: NewspaperIcon },
        // { name: 'Gallery', path: '/admin/gallery', icon: PhotoIcon },
        { name: 'Hero Slides', path: '/admin/hero-slides', icon: PhotoIcon },
        { name: 'Users', path: '/admin/users', icon: UsersIcon },
        { name: 'Inventory', path: '/admin/inventory', icon: BuildingStorefrontIcon },
        { name: 'Online Store', path: '/admin/store', icon: BuildingStorefrontIcon },
        { name: 'Administrator', path: '/admin/administrator', icon: GiftIcon },
    ];

    const adminLinks = (() => {
        if (!user) return [];
        // app_admin is the superuser: sees everything, including the Administrator (gift) section.
        if (user.role === 'app_admin') return allLinks;
        // admin sees everything an app_admin does EXCEPT Administrator (gift ticket) —
        // that section alone stays app_admin-only.
        if (user.role === 'admin') return allLinks.filter(l => l.name !== 'Administrator');
        if (user.role === 'ticketer') return allLinks.filter(l => ['Tickets', 'Referrals'].includes(l.name));

        if (user.role === 'referee') return allLinks.filter(l => ['Matches', 'Play by Play', 'Standings', 'Stats', 'Players', 'Teams', 'Team of the Week'].includes(l.name));
        if (user.role === 'stats') return allLinks.filter(l => ['Matches', 'Play by Play', 'Standings', 'Stats', 'Teams', 'Team of the Week'].includes(l.name));
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
        <div className={`h-screen flex overflow-hidden bg-transparent w-full`}>
            {/* Global Background - Atmospheric version */}
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
            {/* Mobile Admin Header */}
            <div className="lg:hidden fixed top-0 left-0 right-0 h-20 bg-sffl-navy text-white flex items-center justify-between px-4 z-30 shadow-md border-b border-sffl-red/30">
                <div className="flex items-center gap-3">
                    <span className="font-black italic text-2xl tracking-tighter uppercase leading-none">ADMIN <span className="text-sffl-red">MODULE</span></span>
                </div>
                <div className="flex items-center gap-3">
                    <Link to="/" className="text-sm font-bold bg-white/10 px-4 py-2 rounded-xl active:scale-95 transition-transform uppercase">Back to App</Link>
                </div>
            </div>


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
            <main className="flex-1 w-full min-w-0 p-2 lg:p-8 pt-22 lg:pt-8 overflow-y-auto overscroll-y-none bg-transparent pb-20 lg:pb-8 relative z-10">
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
