import { Link, useLocation } from 'react-router-dom';
import {
    Squares2X2Icon,
    UserGroupIcon,
    TicketIcon,
    Bars3Icon
} from '@heroicons/react/24/outline';
import {
    Squares2X2Icon as SquaresSolid,
    UserGroupIcon as UsersSolid,
    TicketIcon as TicketSolid,
} from '@heroicons/react/24/solid';

interface TeamHeadBottomNavProps {
    onMoreClick?: () => void;
}

export const TeamHeadBottomNav = ({ onMoreClick }: TeamHeadBottomNavProps) => {
    const location = useLocation();

    const navItems = [
        { name: 'Home', path: '/team-head', exact: true, icon: Squares2X2Icon, solidIcon: SquaresSolid },
        { name: 'Players', path: '/team-head/players', icon: UserGroupIcon, solidIcon: UsersSolid },
        { name: 'Tickets', path: '/team-head/tickets', icon: TicketIcon, solidIcon: TicketSolid },
    ];

    const isActive = (item: any) => {
        if (item.exact) return location.pathname === item.path || location.pathname === item.path + '/';
        return location.pathname.startsWith(item.path);
    };

    return (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 h-14 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex items-center justify-around px-2 z-50 pb-safe shadow-lg">
            {navItems.map((item) => {
                const active = isActive(item);
                const Icon = active ? item.solidIcon : item.icon;

                return (
                    <Link
                        key={item.name}
                        to={item.path}
                        className={`flex flex-col items-center justify-center w-full h-full transition-colors ${active ? 'text-sffl-red' : 'text-gray-400'
                            }`}
                    >
                        <Icon className="w-5 h-5 mb-0.5" />
                        <span className="text-[10px] font-bold leading-none uppercase">{item.name}</span>
                    </Link>
                );
            })}

            <button
                onClick={onMoreClick}
                className="flex flex-col items-center justify-center w-full h-full text-gray-400"
            >
                <Bars3Icon className="w-5 h-5 mb-0.5" />
                <span className="text-[10px] font-bold leading-none uppercase">Back</span>
            </button>
        </nav>
    );
};
