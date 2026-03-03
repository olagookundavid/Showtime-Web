import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';

export const AdminLayout = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const { isDarkMode, toggleDarkMode } = useTheme();

    const linkClass = (path: string) => {
        const isActive = path === '/admin'
            ? location.pathname === '/admin' || location.pathname === '/admin/'
            : location.pathname.startsWith(path);

        const baseClass = "block px-4 py-3 rounded-lg transition font-bold";
        const activeClass = "bg-sffl-red text-white";
        const inactiveClass = "text-gray-300 hover:bg-sffl-red/70 hover:text-white dark:hover:bg-gray-700 dark:text-gray-300";

        return `${baseClass} ${isActive ? activeClass : inactiveClass}`;
    };

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    return (
        <div className={`h-screen flex overflow-hidden ${isDarkMode ? 'dark' : ''} relative`}>
            {/* Absolute Top-Right Dark Mode Toggle */}
            <button
                onClick={toggleDarkMode}
                className="absolute top-4 right-6 p-2 hover:scale-110 transition-transform focus:outline-none z-50 text-gray-500 dark:text-yellow-400"
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

            {/* Sidebar */}
            <aside className="w-64 flex-shrink-0 bg-sffl-navy dark:bg-gray-800 text-white flex flex-col h-full transition-colors duration-200">
                <div className="p-6 border-b border-sffl-navy-light dark:border-gray-700">
                    <h1 className="text-2xl font-black italic">ADMIN PANEL</h1>
                    <div className="flex items-center justify-between mt-1">
                        <p className="text-sm text-gray-400 truncate" title={user?.name}>{user?.name}</p>
                        <Link to="/" className="text-[10px] font-bold bg-white/10 hover:bg-white/20 px-2 py-1 rounded text-gray-300 hover:text-white transition whitespace-nowrap ml-2">
                            ← App
                        </Link>
                    </div>
                </div>

                <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                    <Link to="/admin" className={linkClass('/admin')}>📊 Dashboard</Link>
                    <Link to="/admin/analytics" className={linkClass('/admin/analytics')}>📈 Analytics</Link>
                    <Link to="/admin/matches" className={linkClass('/admin/matches')}>🏈 Matches</Link>
                    <Link to="/admin/teams" className={linkClass('/admin/teams')}>🛡️ Teams</Link>
                    <Link to="/admin/competitions" className={linkClass('/admin/competitions')}>🏆 Competitions</Link>
                    <Link to="/admin/players" className={linkClass('/admin/players')}>🏃 Players</Link>
                    <Link to="/admin/standings" className={linkClass('/admin/standings')}>🏆 Standings</Link>
                    <Link to="/admin/tickets" className={linkClass('/admin/tickets')}>🎟️ Tickets</Link>
                    <Link to="/admin/event-days" className={linkClass('/admin/event-days')}>📅 Event Days</Link>
                    <Link to="/admin/news" className={linkClass('/admin/news')}>📰 News</Link>
                    <Link to="/admin/gallery" className={linkClass('/admin/gallery')}>📸 Gallery</Link>
                    <Link to="/admin/users" className={linkClass('/admin/users')}>👥 Users</Link>
                </nav>

                <div className="p-4 border-t border-sffl-navy-light dark:border-gray-700 space-y-3">
                    <button
                        onClick={handleLogout}
                        className="w-full px-4 py-3 bg-red-600 hover:bg-red-700 rounded-lg font-bold transition"
                    >
                        Logout
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 p-8 overflow-y-auto bg-gray-100 dark:bg-gray-900 transition-colors duration-200">
                <Outlet />
            </main>
        </div>
    );
};
