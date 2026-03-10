import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Loader } from '../../components/ui/Loader';
import { getAdminAnalytics } from '../../services/api';

// Simple Nigerian Naira formatter
const formatNaira = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
        style: 'currency',
        currency: 'NGN',
        minimumFractionDigits: 0,
    }).format(amount);
};

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

    const error = queryError ? (queryError as any).response?.data?.error || 'Failed to load dashboard data' : '';

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
        <div className="space-y-8 animate-fade-in">
            {/* Header */}
            <div>
                <h1 className="text-4xl font-black text-sffl-navy dark:text-white mb-2">Dashboard</h1>
                <p className="text-gray-600 dark:text-gray-400">Welcome back! Here's a quick overview of SFFL performance.</p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border-l-4 border-sffl-red hover:shadow-lg transition">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-red-50 dark:bg-red-900/30 text-sffl-red rounded-lg text-xl">💰</div>
                        <div className="text-gray-500 dark:text-gray-400 text-sm font-bold">Total Revenue</div>
                    </div>
                    <div className="text-4xl font-black text-sffl-navy dark:text-white">{formatNaira(total_revenue)}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">All time ticket sales</div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border-l-4 border-sffl-navy hover:shadow-lg transition">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-blue-50 dark:bg-blue-900/30 text-sffl-navy dark:text-blue-400 rounded-lg text-xl">🎟️</div>
                        <div className="text-gray-500 dark:text-gray-400 text-sm font-bold">Tickets Sold</div>
                    </div>
                    <div className="text-4xl font-black text-sffl-navy dark:text-white">{total_tickets_sold.toLocaleString()}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">Paid and checked-in tickets</div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border-l-4 border-green-500 hover:shadow-lg transition">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-green-50 dark:bg-green-900/30 text-green-600 rounded-lg text-xl">👥</div>
                        <div className="text-gray-500 dark:text-gray-400 text-sm font-bold">Registered Users</div>
                    </div>
                    <div className="text-4xl font-black text-sffl-navy dark:text-white">{total_users.toLocaleString()}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">Total platform signups</div>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
                <h2 className="text-2xl font-black text-sffl-navy dark:text-white mb-4">Quick Actions</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Link
                        to="/admin/matches"
                        className="flex items-center gap-3 p-4 min-h-[44px] border-2 border-gray-100 dark:border-gray-700 rounded-lg hover:border-sffl-red dark:hover:border-sffl-red hover:bg-red-50 dark:hover:bg-gray-700 transition-all duration-300 hover:scale-[1.02] active:scale-95"
                    >
                        <div className="text-3xl">🏈</div>
                        <div>
                            <div className="font-bold text-sffl-navy dark:text-white">Add Match</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">Schedule game</div>
                        </div>
                    </Link>

                    <Link
                        to="/admin/news"
                        className="flex items-center gap-3 p-4 min-h-[44px] border-2 border-gray-100 dark:border-gray-700 rounded-lg hover:border-sffl-navy dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-gray-700 transition-all duration-300 hover:scale-[1.02] active:scale-95"
                    >
                        <div className="text-3xl">📰</div>
                        <div>
                            <div className="font-bold text-sffl-navy dark:text-white">Publish News</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">Write article</div>
                        </div>
                    </Link>

                    <Link
                        to="/admin/event-days"
                        className="flex items-center gap-3 p-4 min-h-[44px] border-2 border-gray-100 dark:border-gray-700 rounded-lg hover:border-green-500 dark:hover:border-green-500 hover:bg-green-50 dark:hover:bg-gray-700 transition-all duration-300 hover:scale-[1.02] active:scale-95"
                    >
                        <div className="text-3xl">📅</div>
                        <div>
                            <div className="font-bold text-sffl-navy dark:text-white">Event Day</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">Create event</div>
                        </div>
                    </Link>

                    <Link
                        to="/admin/gallery"
                        className="flex items-center gap-3 p-4 min-h-[44px] border-2 border-gray-100 dark:border-gray-700 rounded-lg hover:border-purple-500 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-gray-700 transition-all duration-300 hover:scale-[1.02] active:scale-95"
                    >
                        <div className="text-3xl">📸</div>
                        <div>
                            <div className="font-bold text-sffl-navy dark:text-white">Upload Photos</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">Add to gallery</div>
                        </div>
                    </Link>
                </div>
            </div>
        </div>
    );
};
