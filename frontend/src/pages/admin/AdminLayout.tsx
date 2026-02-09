import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export const AdminLayout = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

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

                <nav className="flex-1 p-4 space-y-2">
                    <Link
                        to="/admin"
                        className="block px-4 py-3 rounded-lg hover:bg-sffl-red transition font-bold"
                    >
                        📊 Dashboard
                    </Link>
                    <Link
                        to="/admin/matches"
                        className="block px-4 py-3 rounded-lg hover:bg-sffl-red transition font-bold"
                    >
                        🏈 Matches
                    </Link>
                    <Link
                        to="/admin/news"
                        className="block px-4 py-3 rounded-lg hover:bg-sffl-red transition font-bold"
                    >
                        📰 News
                    </Link>
                    <Link
                        to="/admin/gallery"
                        className="block px-4 py-3 rounded-lg hover:bg-sffl-red transition font-bold"
                    >
                        📸 Gallery
                    </Link>
                    <Link
                        to="/admin/users"
                        className="block px-4 py-3 rounded-lg hover:bg-sffl-red transition font-bold"
                    >
                        👥 Users
                    </Link>
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
