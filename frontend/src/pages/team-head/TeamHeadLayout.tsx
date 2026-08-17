import { useQuery } from '@tanstack/react-query';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import api, { teamHeadClaimsApi } from '../../services/api';
import { TeamHeadBottomNav } from './TeamHeadBottomNav';
import {
    Squares2X2Icon,
    UserGroupIcon,
    TicketIcon
} from '@heroicons/react/24/outline';

interface TeamInfo {
    id: string;
    name: string;
    short_name: string;
    logo: string;
}

const TeamHeadLayout = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    useEffect(() => {
        setIsSidebarOpen(false);
    }, [location.pathname]);

    useEffect(() => {
        if (isSidebarOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => { document.body.style.overflow = 'unset'; };
    }, [isSidebarOpen]);

    // Surfaces how many players are waiting on this manager to confirm who they are.
    // Without a badge the queue is invisible, and a claim nobody looks at is a player
    // who never gets an account.
    const { data: pendingClaims } = useQuery({
        queryKey: ['teamHeadPendingClaims'],
        queryFn: async () => {
            const res = await teamHeadClaimsApi.list({ status: 'PENDING', limit: 1 });
            return res.total || 0;
        },
        refetchOnWindowFocus: true,
    });

    const { data: teamData, isLoading: loading } = useQuery({
        queryKey: ['myTeamHead'],
        queryFn: async () => {
            const res = await api.get('/team-head/my-team');
            return res.data.data as TeamInfo;
        },
        retry: false,
    });

    const team = teamData || null;

    const linkClass = (path: string) => {
        const isActive = location.pathname === path || (path !== '/team-head' && location.pathname.startsWith(path));
        return `block px-3 py-1.5 md:px-4 md:py-2.5 rounded-lg font-bold text-[10px] md:text-sm transition-all duration-200 ${isActive
            ? 'bg-sffl-red text-white shadow-md'
            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`;
    };

    return (
        <div className={`flex h-screen overflow-hidden bg-transparent w-full relative`}>
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
            {/* Mobile Team Header */}
            <div className="md:hidden fixed top-0 left-0 right-0 h-12 bg-white dark:bg-gray-800 text-sffl-navy dark:text-white border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-3 z-30 shadow-sm">
                <div className="flex items-center gap-2">
                    <span className="font-black text-xs max-w-[150px] truncate uppercase tracking-tighter">
                        {team?.short_name || 'TEAM'} <span className="text-sffl-red">HEAD</span>
                    </span>
                </div>
            </div>

            {/* Sidebar (Desktop Only) */}
            <aside className="hidden md:flex w-64 flex-col bg-white dark:bg-gray-800 shadow-xl border-r border-gray-200 dark:border-gray-700 h-full">
                <div className="p-5 border-b border-gray-200 dark:border-gray-700">
                    {loading ? (
                        <div className="h-10 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg" />
                    ) : team && (
                        <div className="flex items-center gap-3">
                            <img src={team.logo} alt={team.name} className="w-10 h-10 rounded-lg object-contain bg-gray-50" />
                            <div>
                                <h2 className="font-black text-sffl-navy dark:text-white text-sm line-clamp-1 uppercase">{team.name}</h2>
                                <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Team Head</span>
                            </div>
                        </div>
                    )}
                </div>
                <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                    <Link to="/team-head" className={linkClass('/team-head')}>
                        <div className="flex items-center gap-3 px-1">
                            <Squares2X2Icon className="w-5 h-5 flex-shrink-0" />
                            <span>Overview</span>
                        </div>
                    </Link>
                    <Link to="/team-head/players" className={linkClass('/team-head/players')}>
                        <div className="flex items-center gap-3 px-1">
                            <UserGroupIcon className="w-5 h-5 flex-shrink-0" />
                            <span>Players</span>
                        </div>
                    </Link>
                    <Link to="/team-head/contracts" className={linkClass('/team-head/contracts')}>
                        <div className="flex items-center gap-3 px-1">
                            <span className="text-base">📝</span>
                            <span>Contracts</span>
                        </div>
                    </Link>
                    <Link to="/team-head/transfers" className={linkClass('/team-head/transfers')}>
                        <div className="flex items-center gap-3 px-1">
                            <span className="text-base">🔄</span>
                            <span>Transfer Market</span>
                        </div>
                    </Link>
                    <Link to="/team-head/budget" className={linkClass('/team-head/budget')}>
                        <div className="flex items-center gap-3 px-1">
                            <span className="text-base">💰</span>
                            <span>Team Budget</span>
                        </div>
                    </Link>
                    <Link to="/team-head/tickets" className={linkClass('/team-head/tickets')}>
                        <div className="flex items-center gap-3 px-1">
                            <TicketIcon className="w-5 h-5 flex-shrink-0" />
                            <span>Match Tickets</span>
                        </div>
                    </Link>
                    <Link to="/team-head/claims" className={linkClass('/team-head/claims')}>
                        <div className="flex items-center gap-3 px-1">
                            <span className="text-base">🆔</span>
                            <span>Account Claims</span>
                            {!!pendingClaims && (
                                <span className="ml-auto px-2 py-0.5 rounded-full bg-sffl-red text-white text-[10px] font-black">
                                    {pendingClaims}
                                </span>
                            )}
                        </div>
                    </Link>
                </nav>
                <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                    <Link to="/" className="text-sm font-bold text-sffl-red hover:text-red-700 py-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                        ← Back to Site
                    </Link>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 w-full min-w-0 p-2 md:p-8 pt-14 md:pt-8 overflow-y-auto pb-20 md:pb-8">
                <Outlet context={{ team }} />
            </main>

            {/* Team Head Bottom Nav */}
            <TeamHeadBottomNav onMoreClick={() => navigate('/')} />
        </div>
    );
};

export default TeamHeadLayout;
