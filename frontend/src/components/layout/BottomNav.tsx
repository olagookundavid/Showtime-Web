import { Link, useLocation } from 'react-router-dom';
import {
    CalendarIcon,
    TableCellsIcon,
    TicketIcon,
    UserGroupIcon,
    Bars3Icon,
    ChartBarIcon
} from '@heroicons/react/24/outline';
import {
    CalendarIcon as CalendarSolid,
    TableCellsIcon as TableSolid,
    TicketIcon as TicketSolid,
    UserGroupIcon as UserGroupSolid,
    ChartBarIcon as ChartBarSolid,
} from '@heroicons/react/24/solid';

interface BottomNavProps {
    onMoreClick?: () => void;
}

export const BottomNav = ({ onMoreClick }: BottomNavProps) => {
    const location = useLocation();

    const navItems = [
        { name: 'Matches', path: '/matches', icon: CalendarIcon, solidIcon: CalendarSolid },
        { name: 'Standings', path: '/standings', icon: TableCellsIcon, solidIcon: TableSolid },
        { name: 'Stats', path: '/stats', icon: ChartBarIcon, solidIcon: ChartBarSolid },
        { name: 'Tickets', path: '/tickets', icon: TicketIcon, solidIcon: TicketSolid },
        { name: 'Players', path: '/players', icon: UserGroupIcon, solidIcon: UserGroupSolid },
    ];

    const isActive = (path: string) => {
        return location.pathname.startsWith(path);
    };

    return (
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-14 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 flex items-center justify-around px-2 z-50 pb-safe shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
            {navItems.map((item) => {
                const active = isActive(item.path);
                const Icon = active ? item.solidIcon : item.icon;

                return (
                    <Link
                        key={item.name}
                        to={item.path}
                        className={`flex flex-col items-center justify-center w-full h-full transition-colors ${active ? 'text-sffl-red' : 'text-gray-500 dark:text-gray-400'
                            }`}
                    >
                        <Icon className="w-5 h-5 mb-0.5" />
                        <span className="text-[10px] font-medium leading-none">{item.name}</span>
                    </Link>
                );
            })}

            <button
                onClick={onMoreClick}
                className="flex flex-col items-center justify-center w-full h-full text-gray-500 dark:text-gray-400"
            >
                <Bars3Icon className="w-5 h-5 mb-0.5" />
                <span className="text-[10px] font-medium leading-none">More</span>
            </button>
        </nav>
    );
};
