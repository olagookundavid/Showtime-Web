import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminListReferrals, type ReferralStatsResponse } from '../../services/api';

export const AdminReferrals: React.FC = () => {
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const limit = 10;

    const { data, isLoading, error } = useQuery({
        queryKey: ['adminReferrals', page, search],
        queryFn: () => adminListReferrals(page, limit, search.trim() || undefined),
        staleTime: 15_000,
    });

    const statsList: ReferralStatsResponse[] = data?.data || [];
    const totalItems = data?.total || 0;
    const totalPages = data?.total_pages || 1;

    // Simple client side summary for the current view
    const totalReferredTickets = statsList.reduce((sum, item) => sum + item.tickets_sold, 0);
    const totalReferredRevenue = statsList.reduce((sum, item) => sum + item.total_revenue, 0);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl md:text-3xl font-black italic tracking-tighter text-sffl-navy dark:text-white">
                    TICKET REFERRERS
                </h1>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Monitor, search, and manage user referral codes, tickets sold, and total revenue.
                </p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col justify-between">
                    <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider block mb-1">
                        Tickets Sold (Current Page)
                    </span>
                    <span className="text-3xl font-black text-sffl-navy dark:text-white">
                        {totalReferredTickets}
                    </span>
                </div>
                <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col justify-between">
                    <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider block mb-1">
                        Revenue Generated (Current Page)
                    </span>
                    <span className="text-3xl font-black text-sffl-red">
                        ₦{totalReferredRevenue.toLocaleString()}
                    </span>
                </div>
            </div>

            {/* Search and Table */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-150 dark:border-gray-700 shadow-sm overflow-hidden">
                {/* Search Bar */}
                <div className="p-4 border-b border-gray-150 dark:border-gray-700 flex justify-between items-center">
                    <div className="relative w-full max-w-sm">
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => {
                                setSearch(e.target.value);
                                setPage(1);
                            }}
                            placeholder="Search by code or referrer name..."
                            className="w-full pl-9 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-sffl-red outline-none transition"
                        />
                        <span className="absolute left-3 top-2.5 text-gray-400">🔍</span>
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    {isLoading ? (
                        <div className="flex justify-center py-12">
                            <div className="w-10 h-10 border-4 border-sffl-red border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    ) : error ? (
                        <div className="text-center py-8 text-red-500 font-medium">
                            Failed to load referral statistics. Please try again.
                        </div>
                    ) : statsList.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            No referrers found.
                        </div>
                    ) : (
                        <table className="w-full text-left border-collapse text-xs md:text-sm">
                            <thead>
                                <tr className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 font-bold border-b border-gray-150 dark:border-gray-700">
                                    <th className="p-4">Name</th>
                                    <th className="p-4">Referral Code</th>
                                    <th className="p-4">Email</th>
                                    <th className="p-4 text-center">Tickets Sold</th>
                                    <th className="p-4 text-right">Revenue</th>
                                    <th className="p-4">Created At</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                {statsList.map((item) => (
                                    <tr key={item.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/40 text-gray-900 dark:text-gray-100 transition-colors">
                                        <td className="p-4 font-bold">{item.name}</td>
                                        <td className="p-4 font-mono font-bold text-sffl-navy dark:text-white uppercase tracking-wider">
                                            {item.code}
                                        </td>
                                        <td className="p-4 text-gray-500 dark:text-gray-400">
                                            {item.email || <span className="text-gray-300 dark:text-gray-650 italic">None</span>}
                                        </td>
                                        <td className="p-4 text-center font-bold">{item.tickets_sold}</td>
                                        <td className="p-4 text-right font-black text-sffl-red">
                                            ₦{item.total_revenue.toLocaleString()}
                                        </td>
                                        <td className="p-4 text-gray-500 dark:text-gray-400">
                                            {new Date(item.created_at).toLocaleDateString()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="p-4 border-t border-gray-150 dark:border-gray-700 flex justify-between items-center">
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                            Showing page {page} of {totalPages} ({totalItems} referrers)
                        </span>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setPage(Math.max(1, page - 1))}
                                disabled={page === 1}
                                className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-xs font-bold bg-white dark:bg-gray-700 text-gray-700 dark:text-white disabled:opacity-40 transition hover:bg-gray-50 dark:hover:bg-gray-600"
                            >
                                Previous
                            </button>
                            <button
                                onClick={() => setPage(Math.min(totalPages, page + 1))}
                                disabled={page === totalPages}
                                className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-xs font-bold bg-white dark:bg-gray-700 text-gray-700 dark:text-white disabled:opacity-40 transition hover:bg-gray-50 dark:hover:bg-gray-600"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
