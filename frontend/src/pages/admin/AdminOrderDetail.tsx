import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
    getAdminOrder,
    updateOrderFulfillment,
    verifyAdminStoreOrder,
    cancelAdminStoreOrder,
    type Order,
} from '../../services/api';
import { Loader } from '../../components/ui/Loader';

export const AdminOrderDetail = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const [verifying, setVerifying] = useState(false);
    const [updatingFulfillment, setUpdatingFulfillment] = useState(false);
    const [cancelling, setCancelling] = useState(false);
    const [actionError, setActionError] = useState('');

    const { data: order, isLoading, isError, refetch } = useQuery<Order>({
        queryKey: ['adminOrder', id],
        queryFn: () => getAdminOrder(id!),
        enabled: !!id,
    });

    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: ['adminOrder', id] });
        queryClient.invalidateQueries({ queryKey: ['adminOrders'] });
    };

    const handleVerify = async () => {
        if (!order) return;
        setVerifying(true);
        setActionError('');
        try {
            await verifyAdminStoreOrder(order.id);
            await refetch();
            invalidate();
        } catch (err: any) {
            setActionError(err.response?.data?.error || err.message || 'Failed to verify payment');
        } finally {
            setVerifying(false);
        }
    };

    const handleFulfill = async (next: 'shipped' | 'delivered') => {
        if (!order) return;
        setUpdatingFulfillment(true);
        setActionError('');
        try {
            await updateOrderFulfillment(order.id, next);
            await refetch();
            invalidate();
        } catch (err: any) {
            setActionError(err.response?.data?.error || err.message || 'Failed to update fulfillment');
        } finally {
            setUpdatingFulfillment(false);
        }
    };

    const handleCancel = async () => {
        if (!order) return;
        if (!confirm('Cancel this order and restore its stock? This cannot be undone. If the customer was already charged, you must process a refund manually via Paystack.')) return;
        setCancelling(true);
        setActionError('');
        try {
            await cancelAdminStoreOrder(order.id);
            await refetch();
            invalidate();
        } catch (err: any) {
            setActionError(err.response?.data?.error || err.message || 'Failed to cancel order');
        } finally {
            setCancelling(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex justify-center py-16"><Loader /></div>
        );
    }

    if (isError || !order) {
        return (
            <div className="max-w-md mx-auto px-4 py-16 text-center space-y-6">
                <span className="text-5xl">⚠️</span>
                <div className="space-y-2">
                    <h2 className="text-xl font-bold dark:text-white">Order Not Found</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        We couldn't load this order. It may have been deleted, or the reference is invalid.
                    </p>
                </div>
                <Link to="/admin/store" className="inline-block bg-sffl-navy hover:bg-sffl-red text-white text-xs font-bold uppercase tracking-wider px-6 py-3 rounded-full shadow transition-all">
                    ← Back to Orders
                </Link>
            </div>
        );
    }

    const paymentClass =
        order.payment_status === 'paid' ? 'text-green-600' :
        order.payment_status === 'failed' ? 'text-red-600' :
        'text-amber-600';

    return (
        <div className="space-y-6 pb-12">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                    <button
                        onClick={() => navigate('/admin/store')}
                        className="text-xs font-black uppercase tracking-wider text-sffl-red hover:underline"
                    >
                        ← Back to Orders
                    </button>
                    <h1 className="text-3xl font-black text-sffl-navy dark:text-white">
                        Order <span className="font-mono text-sffl-red">{order.order_reference}</span>
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Placed {new Date(order.created_at).toLocaleString()}
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <span className={`text-[11px] font-black px-3 py-1.5 rounded-full uppercase tracking-wider ${
                        order.payment_status === 'paid'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : order.payment_status === 'failed'
                                ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                    }`}>
                        Payment: {order.payment_status}
                    </span>
                    <span className={`text-[11px] font-black px-3 py-1.5 rounded-full uppercase tracking-wider ${
                        order.fulfillment_status === 'cancelled'
                            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                    }`}>
                        Fulfillment: {order.fulfillment_status}
                    </span>
                </div>
            </div>

            {actionError && (
                <div role="alert" className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm font-bold px-4 py-3 rounded-xl">
                    {actionError}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Customer + Shipping */}
                <div className="lg:col-span-2 space-y-6">
                    <section className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-lg">
                        <h2 className="text-[11px] font-black uppercase tracking-wider text-sffl-red mb-4">Customer</h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm dark:text-gray-300">
                            <div>
                                <div className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Name</div>
                                <div className="font-bold text-sffl-navy dark:text-white">{order.customer_name}</div>
                            </div>
                            <div>
                                <div className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Email</div>
                                <a href={`mailto:${order.customer_email}`} className="text-sffl-red font-bold underline truncate inline-block max-w-full">
                                    {order.customer_email}
                                </a>
                            </div>
                            <div>
                                <div className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Phone</div>
                                <a href={`tel:${order.customer_phone}`} className="font-bold dark:text-white">{order.customer_phone}</a>
                            </div>
                        </div>
                    </section>

                    <section className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-lg">
                        <h2 className="text-[11px] font-black uppercase tracking-wider text-sffl-red mb-4">Shipping Address</h2>
                        <div className="bg-gray-50 dark:bg-gray-900/40 p-4 rounded-xl border border-gray-100 dark:border-gray-700 text-sm dark:text-gray-300 space-y-1">
                            <div className="font-bold text-sffl-navy dark:text-white">{order.customer_name}</div>
                            <div>{order.shipping_address}</div>
                            <div>{order.shipping_city}, {order.shipping_state}</div>
                            <div>{order.shipping_country} {order.shipping_postal_code && `· ${order.shipping_postal_code}`}</div>
                        </div>
                    </section>

                    <section className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-lg space-y-4">
                        <h2 className="text-[11px] font-black uppercase tracking-wider text-sffl-red">Items ({order.items?.length || 0})</h2>
                        <div className="space-y-2">
                            {order.items?.map(item => (
                                <div key={item.id} className="flex justify-between items-start bg-gray-50 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-700 p-4 rounded-xl">
                                    <div className="space-y-1">
                                        <div className="font-bold text-sm text-sffl-navy dark:text-white">{item.product_name}</div>
                                        {item.variant_label && (
                                            <div className="text-[11px] text-gray-500 dark:text-gray-400 uppercase tracking-wider font-bold">{item.variant_label}</div>
                                        )}
                                        <div className="text-xs text-gray-500">Qty: <strong>{item.quantity}</strong> @ ₦{item.unit_price.toLocaleString()}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-black text-base dark:text-white">₦{item.total_price.toLocaleString()}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="flex justify-between items-center pt-4 border-t border-gray-100 dark:border-gray-700">
                            <span className="font-black uppercase text-xs text-gray-500">Order Total</span>
                            <span className="font-black text-2xl text-sffl-red">₦{order.total_amount.toLocaleString()}</span>
                        </div>
                    </section>
                </div>

                {/* Right rail: payment + actions */}
                <div className="space-y-6">
                    <section className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-lg space-y-4">
                        <h2 className="text-[11px] font-black uppercase tracking-wider text-sffl-red">Payment</h2>
                        <div className="space-y-2 text-sm dark:text-gray-300">
                            <div className="flex justify-between">
                                <span className="text-gray-500 font-bold">Status</span>
                                <span className={`font-black uppercase ${paymentClass}`}>{order.payment_status}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500 font-bold">Amount</span>
                                <span className="font-bold text-sffl-navy dark:text-white">₦{order.total_amount.toLocaleString()}</span>
                            </div>
                            {order.paystack_reference && (
                                <div className="flex justify-between gap-2">
                                    <span className="text-gray-500 font-bold flex-shrink-0">Paystack Ref</span>
                                    <span className="font-mono text-[11px] truncate">{order.paystack_reference}</span>
                                </div>
                            )}
                        </div>
                    </section>

                    <section className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-lg space-y-3">
                        <h2 className="text-[11px] font-black uppercase tracking-wider text-sffl-red">Actions</h2>

                        {order.payment_status !== 'paid' && (
                            <button
                                disabled={verifying}
                                onClick={handleVerify}
                                className="w-full bg-sffl-navy hover:bg-slate-900 text-white py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider disabled:opacity-50"
                            >
                                {verifying ? 'Verifying…' : '🔄 Re-verify Payment'}
                            </button>
                        )}

                        {order.payment_status === 'paid' && order.fulfillment_status === 'pending' && (
                            <button
                                disabled={updatingFulfillment}
                                onClick={() => handleFulfill('shipped')}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider disabled:opacity-50"
                            >
                                {updatingFulfillment ? 'Updating…' : '🚢 Mark as Shipped'}
                            </button>
                        )}

                        {order.payment_status === 'paid' && order.fulfillment_status === 'shipped' && (
                            <button
                                disabled={updatingFulfillment}
                                onClick={() => handleFulfill('delivered')}
                                className="w-full bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider disabled:opacity-50"
                            >
                                {updatingFulfillment ? 'Updating…' : '✅ Mark as Delivered'}
                            </button>
                        )}

                        {order.fulfillment_status !== 'cancelled' && order.fulfillment_status !== 'delivered' && (
                            <button
                                disabled={cancelling}
                                onClick={handleCancel}
                                className="w-full bg-red-50 hover:bg-red-600 text-red-600 hover:text-white dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-600 dark:hover:text-white py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider disabled:opacity-50 border border-red-200 dark:border-red-900"
                            >
                                {cancelling ? 'Cancelling…' : '🚫 Cancel & Restore Stock'}
                            </button>
                        )}

                        {(order.fulfillment_status === 'delivered' || order.fulfillment_status === 'cancelled') && order.payment_status === 'paid' && (
                            <p className="text-xs text-gray-500 italic text-center py-2">
                                This order is closed. No further actions available.
                            </p>
                        )}
                    </section>
                </div>
            </div>
        </div>
    );
};
