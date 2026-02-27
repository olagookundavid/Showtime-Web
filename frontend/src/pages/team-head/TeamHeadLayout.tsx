import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import api from '../../services/api';

interface TeamInfo {
    id: string;
    name: string;
    short_name: string;
    logo: string;
}

const TeamHeadLayout = () => {
    const location = useLocation();
    const [team, setTeam] = useState<TeamInfo | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchMyTeam = async () => {
            try {
                const res = await api.get('/team-head/my-team');
                setTeam(res.data.data);
            } catch {
                setTeam(null);
            } finally {
                setLoading(false);
            }
        };
        fetchMyTeam();
    }, []);

    const linkClass = (path: string) => {
        const isActive = location.pathname === path || (path !== '/team-head' && location.pathname.startsWith(path));
        return `block px-4 py-2.5 rounded-lg font-bold text-sm transition-all duration-200 ${isActive
                ? 'bg-sffl-red text-white shadow-md'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`;
    };

    return (
        <div className="flex min-h-screen bg-gray-50 dark:bg-gray-900">
            {/* Sidebar */}
            <aside className="w-64 bg-white dark:bg-gray-800 shadow-xl border-r border-gray-200 dark:border-gray-700 flex flex-col">
                {/* Team Header */}
                <div className="p-5 border-b border-gray-200 dark:border-gray-700">
                    {loading ? (
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gray-200 dark:bg-gray-600 rounded-lg animate-pulse" />
                            <div className="flex-1">
                                <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded animate-pulse mb-1" />
                                <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded animate-pulse w-2/3" />
                            </div>
                        </div>
                    ) : team ? (
                        <div className="flex items-center gap-3">
                            {team.logo ? (
                                <img src={team.logo} alt={team.name} className="w-10 h-10 rounded-lg object-contain bg-gray-50 p-0.5" />
                            ) : (
                                <div className="w-10 h-10 rounded-lg bg-sffl-red/10 flex items-center justify-center text-lg font-black text-sffl-red">
                                    {team.short_name?.slice(0, 2) || '🛡️'}
                                </div>
                            )}
                            <div>
                                <h2 className="font-black text-sffl-navy dark:text-white text-sm">{team.name}</h2>
                                <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Team Head Panel</span>
                            </div>
                        </div>
                    ) : (
                        <div className="text-sm text-red-500 font-bold">⚠️ No team assigned</div>
                    )}
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-4 space-y-1">
                    <Link to="/team-head" className={linkClass('/team-head')}>📊 Overview</Link>
                    <Link to="/team-head/players" className={linkClass('/team-head/players')}>🏃 Players</Link>
                </nav>

                {/* Back to site */}
                <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                    <Link to="/" className="block text-center text-sm font-bold text-sffl-red hover:text-red-700 py-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                        ← Back to Site
                    </Link>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 p-8">
                <Outlet context={{ team }} />
            </main>
        </div>
    );
};

export default TeamHeadLayout;
