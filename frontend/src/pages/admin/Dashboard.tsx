import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
    ArchiveBoxIcon,
    BanknotesIcon,
    CalendarDaysIcon,
    NewspaperIcon,
    ShoppingCartIcon,
    TicketIcon,
    UsersIcon,
} from '@heroicons/react/24/outline';
import { Loader } from '../../components/ui/Loader';
import { FootballIcon } from '../../components/icons/FootballIcon';
import { getAdminAnalytics } from '../../services/api';

// Simple Nigerian Naira formatter
const formatNaira = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
        style: 'currency',
        currency: 'NGN',
        minimumFractionDigits: 0,
    }).format(amount);
};

const QUICK_ACTIONS = [
    {
        to: '/admin/matches',
        title: 'Add Match',
        subtitle: 'Schedule game',
        icon: FootballIcon,
        iconClass: 'bg-red-50 dark:bg-red-900/30 text-sffl-red',
        hoverClass: 'hover:border-sffl-red dark:hover:border-sffl-red hover:bg-red-50',
    },
    {
        to: '/admin/news',
        title: 'Publish News',
        subtitle: 'Write article',
        icon: NewspaperIcon,
        iconClass: 'bg-blue-50 dark:bg-blue-900/30 text-sffl-navy dark:text-blue-400',
        hoverClass: 'hover:border-sffl-navy dark:hover:border-blue-500 hover:bg-blue-50',
    },
    {
        to: '/admin/event-days',
        title: 'Event Day',
        subtitle: 'Create event',
        icon: CalendarDaysIcon,
        iconClass: 'bg-green-50 dark:bg-green-900/30 text-green-600',
        hoverClass: 'hover:border-green-500 dark:hover:border-green-500 hover:bg-green-50',
    },
    // {
    //     to: '/admin/gallery',
    //     title: 'Upload Photos',
    //     subtitle: 'Add to gallery',
    //     icon: PhotoIcon,
    //     iconClass: 'bg-purple-50 dark:bg-purple-900/30 text-purple-600',
    //     hoverClass: 'hover:border-purple-500 dark:hover:border-purple-500 hover:bg-purple-50',
    // },
    {
        to: '/admin/inventory',
        title: 'Warehouse Stock',
        subtitle: 'Physical logistics',
        icon: ArchiveBoxIcon,
        iconClass: 'bg-yellow-50 dark:bg-yellow-900/30 text-yellow-600',
        hoverClass: 'hover:border-yellow-500 dark:hover:border-yellow-500 hover:bg-yellow-50',
    },
    {
        to: '/admin/store',
        title: 'Online Store',
        subtitle: 'Manage e-comm',
        icon: ShoppingCartIcon,
        iconClass: 'bg-orange-50 dark:bg-orange-900/30 text-orange-600',
        hoverClass: 'hover:border-orange-500 dark:hover:border-orange-500 hover:bg-orange-50',
    },
];

export const Dashboard = () => {
    const {
        data: analytics,
        isLoading: loading,
        error: queryError,
    } = useQuery({
        queryKey: ['adminAnalytics'], // reuse the same key to share cache with AdminAnalytics
        queryFn: async () => {
            const res = await getAdminAnalytics();
            return res.data;
        }
    });

    const error = queryError
        ? (queryError as { response?: { data?: { error?: string } } }).response?.data?.error || 'Failed to load dashboard data'
        : '';

    if (loading) {
        return <Loader />;
    }

    if (error) {
        return (
            <div className="bg-red-50 text-red-600 p-4 rounded-lg my-4">
                <strong>Error:</strong> {error}
            </div>
        );
    }

    const {
        total_revenue = 0,
        total_tickets_sold = 0,
        total_users = 0
    } = analytics || {};

    return (
        <div className="space-y-6 sm:space-y-8 animate-fade-in">
            {/* Header */}
            <div>
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-sffl-navy dark:text-white mb-2">Dashboard</h1>
                <p className="text-gray-600 dark:text-gray-400">Welcome back! Here's a quick overview of SFFL performance.</p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-xl shadow-md border-l-4 border-sffl-red hover:shadow-lg transition min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-red-50 dark:bg-red-900/30 text-sffl-red rounded-lg">
                            <BanknotesIcon className="w-5 h-5" aria-hidden="true" />
                        </div>
                        <div className="text-gray-500 dark:text-gray-400 text-sm font-bold">Total Revenue</div>
                    </div>
                    <div className="text-2xl sm:text-3xl xl:text-4xl font-black text-sffl-navy dark:text-white wrap-break-word">{formatNaira(total_revenue)}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">All time ticket sales</div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-xl shadow-md border-l-4 border-sffl-navy hover:shadow-lg transition min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-blue-50 dark:bg-blue-900/30 text-sffl-navy dark:text-blue-400 rounded-lg">
                            <TicketIcon className="w-5 h-5" aria-hidden="true" />
                        </div>
                        <div className="text-gray-500 dark:text-gray-400 text-sm font-bold">Tickets Sold</div>
                    </div>
                    <div className="text-2xl sm:text-3xl xl:text-4xl font-black text-sffl-navy dark:text-white wrap-break-word">{total_tickets_sold.toLocaleString()}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">Paid and checked-in tickets</div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-xl shadow-md border-l-4 border-green-500 hover:shadow-lg transition min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-green-50 dark:bg-green-900/30 text-green-600 rounded-lg">
                            <UsersIcon className="w-5 h-5" aria-hidden="true" />
                        </div>
                        <div className="text-gray-500 dark:text-gray-400 text-sm font-bold">Registered Users</div>
                    </div>
                    <div className="text-2xl sm:text-3xl xl:text-4xl font-black text-sffl-navy dark:text-white wrap-break-word">{total_users.toLocaleString()}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">Total platform signups</div>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4 sm:p-6">
                <h2 className="text-xl sm:text-2xl font-black text-sffl-navy dark:text-white mb-4">Quick Actions</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5 gap-4">
                    {QUICK_ACTIONS.map(({ to, title, subtitle, icon: Icon, iconClass, hoverClass }) => (
                        <Link
                            key={to}
                            to={to}
                            className={`flex items-center gap-3 p-4 min-h-11 border-2 border-gray-100 dark:border-gray-700 rounded-lg dark:hover:bg-gray-700 transition-all duration-300 hover:scale-[1.02] active:scale-95 ${hoverClass}`}
                        >
                            <div className={`shrink-0 p-2 rounded-lg ${iconClass}`}>
                                <Icon className="w-5 h-5" aria-hidden="true" />
                            </div>
                            <div className="min-w-0">
                                <div className="font-bold text-sffl-navy dark:text-white wrap-break-word">{title}</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">{subtitle}</div>
                            </div>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
};
