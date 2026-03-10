import { useAuth } from '../../contexts/AuthContext';
import { Link, useLocation } from 'react-router-dom';
import {
    Squares2X2Icon,
    CalendarIcon,
    TicketIcon,
    NewspaperIcon,
    Bars3Icon
} from '@heroicons/react/24/outline';
import {
    Squares2X2Icon as SquaresSolid,
    CalendarIcon as CalendarSolid,
    TicketIcon as TicketSolid,
    NewspaperIcon as NewspaperSolid,
} from '@heroicons/react/24/solid';

interface AdminBottomNavProps {
    onMoreClick?: () => void;
}

export const AdminBottomNav = ({ onMoreClick }: AdminBottomNavProps) => {
    const location = useLocation();
    const { user } = useAuth();

    if (user?.role === 'ticketer') {
        return null;
    }

    const navItems = [
        { name: 'Dash', path: '/admin', exact: true, icon: Squares2X2Icon, solidIcon: SquaresSolid },
        { name: 'Match', path: '/admin/matches', icon: CalendarIcon, solidIcon: CalendarSolid },
        { name: 'Ticket', path: '/admin/tickets', icon: TicketIcon, solidIcon: TicketSolid },
        { name: 'News', path: '/admin/news', icon: NewspaperIcon, solidIcon: NewspaperSolid },
    ];

    const isActive = (item: any) => {
        if (item.exact) return location.pathname === item.path || location.pathname === item.path + '/';
        return location.pathname.startsWith(item.path);
    };

    return (
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-14 bg-sffl-navy border-t border-gray-700 flex items-center justify-around px-2 z-50 pb-safe shadow-2xl">
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
                <span className="text-[10px] font-bold leading-none uppercase">More</span>
            </button>
        </nav>
    );
};
