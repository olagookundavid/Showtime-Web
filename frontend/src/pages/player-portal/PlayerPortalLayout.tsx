import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { NotificationBell } from '../../components/common/NotificationBell';

export const PlayerPortalLayout: React.FC = () => {
    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white flex flex-col">
            {/* Header */}
            <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <NavLink to="/player-portal" className="text-xl font-black text-sffl-navy dark:text-white tracking-tight flex items-center gap-2">
                            <span>⚡</span> SHOWTIME <span className="text-xs px-2 py-0.5 bg-sffl-red text-white rounded-full font-bold">PLAYER PORTAL</span>
                        </NavLink>

                        <nav className="hidden sm:flex items-center gap-1">
                            <NavLink
                                to="/player-portal"
                                end
                                className={({ isActive }) =>
                                    `px-3 py-2 rounded-lg text-sm font-bold transition-colors ${
                                        isActive ? 'bg-sffl-navy/10 text-sffl-navy dark:bg-white/10 dark:text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                                    }`
                                }
                            >
                                Overview
                            </NavLink>
                            <NavLink
                                to="/player-portal/contracts"
                                className={({ isActive }) =>
                                    `px-3 py-2 rounded-lg text-sm font-bold transition-colors ${
                                        isActive ? 'bg-sffl-navy/10 text-sffl-navy dark:bg-white/10 dark:text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                                    }`
                                }
                            >
                                My Contracts
                            </NavLink>
                            <NavLink
                                to="/player-portal/transfers"
                                className={({ isActive }) =>
                                    `px-3 py-2 rounded-lg text-sm font-bold transition-colors ${
                                        isActive ? 'bg-sffl-navy/10 text-sffl-navy dark:bg-white/10 dark:text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                                    }`
                                }
                            >
                                Transfer History
                            </NavLink>
                        </nav>
                    </div>

                    <div className="flex items-center gap-3">
                        <NotificationBell />
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
                <Outlet />
            </main>
        </div>
    );
};

export default PlayerPortalLayout;
