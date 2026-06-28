import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { getCustomerOrders } from '../services/api';

const statusBadge = (kind: 'payment' | 'fulfillment', value: string) => {
    const base = 'text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider';
    if (kind === 'payment') {
        if (value === 'paid') return `${base} bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400`;
        if (value === 'failed') return `${base} bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400`;
        return `${base} bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400`;
    }
    if (value === 'delivered') return `${base} bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400`;
    if (value === 'shipped') return `${base} bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400`;
    if (value === 'cancelled') return `${base} bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400`;
    return `${base} bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300`;
};

export const MyOrdersPage = () => {
    const { isAuthenticated } = useAuth();
    const [page, setPage] = useState(1);

    const { data, isLoading, isError } = useQuery({
        queryKey: ['customerOrders', page],
        queryFn: () => getCustomerOrders(page, 20),
        enabled: isAuthenticated,
    });

    if (!isAuthenticated) {
        return <Navigate to="/" replace />;
    }

    const orders = data?.data || [];
    const totalPages = data?.total_pages || 1;

    return (
        <div className="space-y-6 animate-fadeIn">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b dark:border-gray-800">
                <div>
                    <h1 className="text-3xl font-black italic tracking-tighter text-sffl-navy dark:text-white uppercase leading-none">
                        My Orders
                    </h1>
                    <p className="text-xs text-gray-500 uppercase font-black tracking-widest mt-1.5">
                        Your Showtime Store purchase history
                    </p>
                </div>
                <Link to="/store" className="text-xs font-black uppercase tracking-wider text-sffl-red hover:underline">
                    ← Back to Store
                </Link>
            </div>

            {isLoading ? (
                <div className="grid grid-cols-1 gap-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-24 bg-white/5 dark:bg-gray-800/40 border border-white/5 rounded-2xl animate-pulse" />
                    ))}
                </div>
            ) : isError ? (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm font-bold px-6 py-4 rounded-2xl">
                    Couldn't load your orders. Please try again in a moment.
                </div>
            ) : orders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center space-y-4 max-w-md mx-auto">
                    <div className="text-5xl">🧾</div>
                    <h2 className="text-xl font-black text-sffl-navy dark:text-white uppercase">No Orders Yet</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        When you buy something from the Showtime Store, it'll show up here.
                    </p>
                    <Link to="/store" className="inline-block bg-sffl-navy hover:bg-sffl-red text-white text-xs font-bold uppercase tracking-wider px-6 py-3 rounded-full shadow-lg transition-all">
                        Browse the store
                    </Link>
                </div>
            ) : (
                <>
                    <div className="space-y-3">
                        {orders.map(order => (
                            <Link
                                key={order.id}
                                to={`/store/confirm?reference=${encodeURIComponent(order.order_reference)}`}
                                className="block p-5 bg-white dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700/50 hover:border-sffl-red/40 rounded-2xl shadow-sm hover:shadow-md transition-all"
                            >
                                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-black text-sm text-sffl-red font-mono">{order.order_reference}</span>
                                            <span className={statusBadge('payment', order.payment_status)}>{order.payment_status}</span>
                                            <span className={statusBadge('fulfillment', order.fulfillment_status)}>{order.fulfillment_status}</span>
                                        </div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400">
                                            {order.items?.length || 0} item{(order.items?.length || 0) === 1 ? '' : 's'} • {new Date(order.created_at).toLocaleDateString()}
                                        </div>
                                        {order.items && order.items.length > 0 && (
                                            <div className="text-xs text-gray-600 dark:text-gray-300 line-clamp-1">
                                                {order.items.map(it => it.product_name + (it.variant_label ? ` (${it.variant_label})` : '')).join(', ')}
                                            </div>
                                        )}
                                    </div>
                                    <div className="text-right">
                                        <div className="font-black text-lg text-sffl-navy dark:text-white">₦{order.total_amount.toLocaleString()}</div>
                                        <div className="text-[10px] text-gray-400 mt-0.5 uppercase tracking-wider">View details →</div>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>

                    {totalPages > 1 && (
                        <div className="flex justify-between items-center pt-4 border-t dark:border-gray-700">
                            <button
                                disabled={page === 1}
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-xs font-bold rounded-xl disabled:opacity-50 dark:text-white"
                            >
                                Previous
                            </button>
                            <span className="text-xs text-gray-500 font-bold">Page {page} of {totalPages}</span>
                            <button
                                disabled={page >= totalPages}
                                onClick={() => setPage(p => p + 1)}
                                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-xs font-bold rounded-xl disabled:opacity-50 dark:text-white"
                            >
                                Next
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};
