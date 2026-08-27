import { Link, useLocation } from 'react-router-dom';
import {
    CalendarIcon,
    TableCellsIcon,
    TicketIcon,
    ShoppingBagIcon,
    ChartBarIcon,
    HomeIcon,
} from '@heroicons/react/24/outline';
import {
    CalendarIcon as CalendarSolid,
    TableCellsIcon as TableSolid,
    TicketIcon as TicketSolid,
    ShoppingBagIcon as ShoppingBagSolid,
    ChartBarIcon as ChartBarSolid,
    HomeIcon as HomeSolid,
} from '@heroicons/react/24/solid';

interface BottomNavProps {
    onMoreClick?: () => void;
}

export const BottomNav = (_props: BottomNavProps) => {
    const location = useLocation();

    const navItems = [
        { name: 'Home', path: '/', icon: HomeIcon, solidIcon: HomeSolid, exact: true },
        { name: 'Matches', path: '/matches', icon: CalendarIcon, solidIcon: CalendarSolid },
        { name: 'Standings', path: '/standings', icon: TableCellsIcon, solidIcon: TableSolid },
        { name: 'Stats', path: '/stats', icon: ChartBarIcon, solidIcon: ChartBarSolid },
        { name: 'Tickets', path: '/tickets', icon: TicketIcon, solidIcon: TicketSolid },
        { name: 'Store', path: '/store', icon: ShoppingBagIcon, solidIcon: ShoppingBagSolid },
    ];

    const isActive = (path: string, exact = false) => {
        return exact ? location.pathname === path : location.pathname.startsWith(path);
    };

    return (
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-[calc(3.5rem+env(safe-area-inset-bottom,0px))] pb-[env(safe-area-inset-bottom,0px)] bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-t border-gray-200/80 dark:border-gray-800 flex items-center justify-around px-1 z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
            {navItems.map((item) => {
                const active = isActive(item.path, item.exact);
                const Icon = active ? item.solidIcon : item.icon;

                return (
                    <Link
                        key={item.name}
                        to={item.path}
                        className={`flex flex-col items-center justify-center w-full h-14 py-1 transition-colors ${
                            active ? 'text-sffl-red' : 'text-gray-500 dark:text-gray-400'
                        }`}
                    >
                        <Icon className="w-5 h-5 mb-0.5 shrink-0" />
                        <span className="text-[10px] font-bold leading-none">{item.name}</span>
                    </Link>
                );
            })}
        </nav>
    );
};
