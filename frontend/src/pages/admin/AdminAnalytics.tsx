import { useQuery } from '@tanstack/react-query';
import { Loader } from '../../components/ui/Loader';
import { getAdminAnalytics, type TicketResponse } from '../../services/api';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useTheme } from '../../contexts/ThemeContext';

const PIE_COLORS = ['#001F3F', '#C62828', '#22c55e', '#f59e0b', '#a855f7'];

// Simple Nigerian Naira formatter
const formatNaira = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
        style: 'currency',
        currency: 'NGN',
        minimumFractionDigits: 0,
    }).format(amount);
};

export const AdminAnalytics = () => {
    const { isDarkMode } = useTheme();
    const {
        data: analytics,
        isLoading: loading,
        error: queryError,
    } = useQuery({
        queryKey: ['adminAnalytics'],
        queryFn: async () => {
            const res = await getAdminAnalytics();
            return res.data;
        }
    });

    const error = queryError ? (queryError as any).response?.data?.error || 'Failed to load analytics data' : '';

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
        users_by_role = {},
        sales_by_tier = [],
        recent_sales = []
    } = analytics || {};

    const usersPieData = Object.entries(users_by_role).map(([role, count]) => ({
        name: role.toUpperCase(),
        value: count
    }));

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Header */}
            <div>
                <h1 className="text-4xl font-black text-sffl-navy dark:text-white mb-2">Analytics</h1>
                <p className="text-gray-600 dark:text-gray-400">Deep dive into platform data and user metrics.</p>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Users By Role Pie Chart */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border-gray-200 dark:border-gray-700 border">
                    <h2 className="text-xl font-black text-sffl-navy dark:text-white mb-4">Users Breakdown</h2>
                    {usersPieData.length === 0 ? (
                        <div className="h-64 flex items-center justify-center text-gray-400 dark:text-gray-500 italic bg-gray-50 dark:bg-gray-700/50 rounded-lg border-2 border-dashed border-gray-200 dark:border-gray-600">
                            No user data available to chart
                        </div>
                    ) : (
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={usersPieData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {usersPieData.map((_entry, index) => (
                                            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(value) => [value, 'Users']} />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>

                {/* Sales By Tier Bar Chart */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border-gray-200 dark:border-gray-700 border">
                    <h2 className="text-xl font-black text-sffl-navy dark:text-white mb-4">Ticket Sales by Tier</h2>
                    {sales_by_tier.length === 0 ? (
                        <div className="h-64 flex items-center justify-center text-gray-400 dark:text-gray-500 italic bg-gray-50 dark:bg-gray-700/50 rounded-lg border-2 border-dashed border-gray-200 dark:border-gray-600">
                            No sales data available to chart
                        </div>
                    ) : (
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={sales_by_tier} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                    <XAxis dataKey="tier_name" tick={{ fill: isDarkMode ? '#9ca3af' : '#6b7280', fontSize: 12 }} />
                                    <YAxis yAxisId="left" orientation="left" stroke={isDarkMode ? '#e2e8f0' : '#0f172a'} />
                                    <YAxis yAxisId="right" orientation="right" stroke={isDarkMode ? '#EF5350' : '#C62828'} />
                                    <Tooltip
                                        formatter={(value, name) => {
                                            if (name === 'Revenue') return [formatNaira(value as number), 'Revenue'];
                                            return [value, 'Tickets Sold'];
                                        }}
                                        labelStyle={{ color: '#0f172a', fontWeight: 'bold' }}
                                        contentStyle={isDarkMode ? { backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' } : undefined}
                                    />
                                    <Legend />
                                    <Bar yAxisId="left" dataKey="quantity" name="Tickets Sold" fill={isDarkMode ? '#94a3b8' : '#0f172a'} radius={[4, 4, 0, 0]} />
                                    <Bar yAxisId="right" dataKey="total_amount" name="Revenue" fill={isDarkMode ? '#EF5350' : '#C62828'} radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>
            </div>

            {/* Recent Sales Table */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 border-gray-200 dark:border-gray-700 border">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-black text-sffl-navy dark:text-white">Recent Ticket Sales</h2>
                </div>

                {recent_sales.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
                        No recent ticket sales found.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                                    <th className="p-3 font-semibold text-gray-600 dark:text-gray-300">Event</th>
                                    <th className="p-3 font-semibold text-gray-600 dark:text-gray-300">Tier / Qty</th>
                                    <th className="p-3 font-semibold text-gray-600 dark:text-gray-300">Amount</th>
                                    <th className="p-3 font-semibold text-gray-600 dark:text-gray-300">Purchaser</th>
                                    <th className="p-3 font-semibold text-gray-600 dark:text-gray-300">Time</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recent_sales.map((sale: TicketResponse) => (
                                    <tr key={sale.id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition">
                                        <td className="p-3">
                                            <div className="font-bold text-sffl-navy dark:text-white">{sale.event_title}</div>
                                        </td>
                                        <td className="p-3">
                                            <div className="text-sm dark:text-gray-300">
                                                <span className="font-bold bg-gray-100 dark:bg-gray-600 px-2 py-1 rounded">{sale.tier_name}</span> x {sale.quantity}
                                            </div>
                                        </td>
                                        <td className="p-3 font-bold text-green-600">
                                            {formatNaira(sale.total_amount)}
                                        </td>
                                        <td className="p-3 text-sm text-gray-600 dark:text-gray-400">
                                            {sale.email}
                                        </td>
                                        <td className="p-3 text-xs text-gray-400 dark:text-gray-500">
                                            {new Date(sale.created_at).toLocaleString()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border-t-4 border-sffl-navy dark:border-blue-500">
                <h3 className="text-lg font-bold text-gray-700 dark:text-gray-200 mb-2">More Analytics Coming Soon...</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    This dedicated page will host all future Analytics and Insights for the app.
                </p>
            </div>
        </div>
    );
};
