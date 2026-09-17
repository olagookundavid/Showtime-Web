import { Link, useLocation } from 'react-router-dom';
import {
    TableCellsIcon,
    ChartBarIcon,
    HomeIcon,
    TrophyIcon,
    Bars3Icon,
} from '@heroicons/react/24/outline';
import {
    TableCellsIcon as TableSolid,
    ChartBarIcon as ChartBarSolid,
    HomeIcon as HomeSolid,
    TrophyIcon as TrophySolid,
    Bars3Icon as Bars3Solid,
} from '@heroicons/react/24/solid';

interface BottomNavProps {
    onMoreClick?: () => void;
    isMoreOpen?: boolean;
}

export const BottomNav = ({ onMoreClick, isMoreOpen = false }: BottomNavProps) => {
    const location = useLocation();

    const navItems = [
        { name: 'Home', path: '/', icon: HomeIcon, solidIcon: HomeSolid, exact: true },
        { name: 'Standings', path: '/standings', icon: TableCellsIcon, solidIcon: TableSolid },
        { name: 'Stats', path: '/stats', icon: ChartBarIcon, solidIcon: ChartBarSolid },
        { name: 'Fantasy', path: '/fantasy', icon: TrophyIcon, solidIcon: TrophySolid, isFantasy: true },
    ];

    const isActive = (path: string, exact = false) => {
        return exact ? location.pathname === path : location.pathname.startsWith(path);
    };

    return (
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-[calc(3.5rem+env(safe-area-inset-bottom,0px))] pb-[env(safe-area-inset-bottom,0px)] bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-t border-gray-200/80 dark:border-gray-800 flex items-center justify-around px-1 z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
            {navItems.map((item) => {
                const active = isActive(item.path, item.exact);
                const Icon = active ? item.solidIcon : item.icon;

                const colorClasses = item.isFantasy
                    ? active
                        ? 'text-yellow-600 dark:text-yellow-300 font-black'
                        : 'text-amber-500 dark:text-yellow-400 font-bold hover:text-yellow-600 dark:hover:text-yellow-300'
                    : active
                        ? 'text-sffl-red'
                        : 'text-gray-500 dark:text-gray-400';

                return (
                    <Link
                        key={item.name}
                        to={item.path}
                        className={`flex flex-col items-center justify-center w-full h-14 py-1 transition-colors ${colorClasses}`}
                    >
                        <Icon className="w-5 h-5 mb-0.5 shrink-0" />
                        <span className="text-[10px] font-bold leading-none">{item.name}</span>
                    </Link>
                );
            })}

            {/* More Drawer Button */}
            <button
                type="button"
                onClick={onMoreClick}
                className={`flex flex-col items-center justify-center w-full h-14 py-1 transition-colors ${
                    isMoreOpen
                        ? 'text-sffl-red font-black'
                        : 'text-gray-500 dark:text-gray-400 hover:text-sffl-navy dark:hover:text-white'
                }`}
                aria-label="Open More Menu"
                aria-expanded={isMoreOpen}
            >
                {isMoreOpen ? (
                    <Bars3Solid className="w-5 h-5 mb-0.5 shrink-0" />
                ) : (
                    <Bars3Icon className="w-5 h-5 mb-0.5 shrink-0" />
                )}
                <span className="text-[10px] font-bold leading-none">More</span>
            </button>
        </nav>
    );
};
