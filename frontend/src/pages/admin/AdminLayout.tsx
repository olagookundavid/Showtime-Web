import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export const AdminLayout = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const linkClass = (path: string) => {
        const isActive = path === '/admin' ? location.pathname === '/admin' : location.pathname.startsWith(path);
        return `block px-4 py-3 rounded-lg transition font-bold ${isActive ? 'bg-sffl-red text-white' : 'hover:bg-sffl-red/70'}`;
    };

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    return (
        <div className="min-h-screen bg-gray-100 flex">
            {/* Sidebar */}
            <aside className="w-64 bg-sffl-navy text-white flex flex-col">
                <div className="p-6 border-b border-gray-700">
                    <h1 className="text-2xl font-black italic">ADMIN PANEL</h1>
                    <p className="text-sm text-gray-400 mt-1">{user?.name}</p>
                </div>

                <nav className="flex-1 p-4 space-y-1">
                    <Link to="/admin" className={linkClass('/admin')}>📊 Dashboard</Link>
                    <Link to="/admin/matches" className={linkClass('/admin/matches')}>🏈 Matches</Link>
                    <Link to="/admin/players" className={linkClass('/admin/players')}>🏃 Players</Link>
                    <Link to="/admin/standings" className={linkClass('/admin/standings')}>🏆 Standings</Link>
                    <Link to="/admin/tickets" className={linkClass('/admin/tickets')}>🎟️ Tickets</Link>
                    <Link to="/admin/event-days" className={linkClass('/admin/event-days')}>📅 Event Days</Link>
                    <Link to="/admin/news" className={linkClass('/admin/news')}>📰 News</Link>
                    <Link to="/admin/gallery" className={linkClass('/admin/gallery')}>📸 Gallery</Link>
                </nav>

                <div className="p-4 border-t border-gray-700">
                    <button
                        onClick={handleLogout}
                        className="w-full px-4 py-3 bg-red-600 hover:bg-red-700 rounded-lg font-bold transition"
                    >
                        Logout
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 p-8">
                <Outlet />
            </main>
        </div>
    );
};
