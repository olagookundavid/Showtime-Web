import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
    ArrowLeftIcon,
    ArrowPathIcon,
    CheckCircleIcon,
    ExclamationTriangleIcon,
    TruckIcon,
    XCircleIcon,
} from '@heroicons/react/24/outline';
import {
    getAdminOrder,
    updateOrderFulfillment,
    verifyAdminStoreOrder,
    cancelAdminStoreOrder,
    type Order,
} from '../../services/api';
import { Loader } from '../../components/ui/Loader';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { ConfirmSummary } from '../../components/ui/ConfirmSummary';
import { getApiErrorMessage } from '../../utils/apiError';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';

type PendingAction = 'verify' | 'shipped' | 'delivered' | 'cancel';

const FAILURE: Record<PendingAction, string> = {
    verify: 'Failed to verify payment',
    shipped: 'Failed to update fulfillment',
    delivered: 'Failed to update fulfillment',
    cancel: 'Failed to cancel order',
};

const SUCCESS: Record<PendingAction, string> = {
    verify: 'Payment re-checked with Paystack.',
    shipped: 'Order marked as shipped.',
    delivered: 'Order marked as delivered.',
    cancel: 'Order cancelled and stock restored.',
};

const actionButton = 'w-full inline-flex items-center justify-center gap-2 min-h-11 rounded-xl font-bold text-xs uppercase tracking-wider disabled:opacity-50 transition-colors';

export const AdminOrderDetail = () => {
    const { id } = useParams<{ id: string }>();
    const queryClient = useQueryClient();

    const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
    const [busy, setBusy] = useState(false);

    const { data: order, isLoading, isError, refetch } = useQuery<Order>({
        queryKey: ['adminOrder', id],
        queryFn: () => getAdminOrder(id!),
        enabled: !!id,
    });

    const confirmPendingAction = async () => {
        const action = pendingAction;
        if (!order || !action) return;
        setBusy(true);
        try {
            if (action === 'verify') await verifyAdminStoreOrder(order.id);
            else if (action === 'cancel') await cancelAdminStoreOrder(order.id);
            else await updateOrderFulfillment(order.id, action);
            await refetch();
            queryClient.invalidateQueries({ queryKey: ['adminOrder', id] });
            queryClient.invalidateQueries({ queryKey: ['adminOrders'] });
            toast.success(SUCCESS[action]);
        } catch (err) {
            toast.error(getApiErrorMessage(err, err instanceof Error && err.message ? err.message : FAILURE[action]));
        } finally {
            setBusy(false);
            setPendingAction(null);
        }
    };

    if (isLoading) {
        return (
            <div className="flex justify-center py-16"><Loader /></div>
        );
    }

    if (isError || !order) {
        return (
            <div className="px-4 py-16 text-center space-y-6">
                <ExclamationTriangleIcon className="w-14 h-14 mx-auto text-amber-500" aria-hidden="true" />
                <div className="space-y-2">
                    <h2 className="text-xl font-bold dark:text-white">Order Not Found</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        We couldn't load this order. It may have been deleted, or the reference is invalid.
                    </p>
                </div>
                <Link to="/admin/store" className="inline-flex items-center gap-1.5 min-h-11 bg-sffl-navy hover:bg-sffl-red text-white text-xs font-bold uppercase tracking-wider px-6 rounded-full shadow transition-all">
                    <ArrowLeftIcon className="w-4 h-4" aria-hidden="true" />
                    Back to Orders
                </Link>
            </div>
        );
    }

    const paymentClass =
        order.payment_status === 'paid' ? 'text-green-600' :
        order.payment_status === 'failed' ? 'text-red-600' :
        'text-amber-600';

    const summary = (
        <ConfirmSummary rows={[
            ['Order', order.order_reference],
            ['Customer', order.customer_name],
            ['Total', `₦${order.total_amount.toLocaleString()}`],
            ['Payment', order.payment_status],
            ['Fulfillment', order.fulfillment_status],
        ]} />
    );

    const dialog = (() => {
        switch (pendingAction) {
            case 'shipped':
                return {
                    title: 'Mark this order as shipped?',
                    description: undefined,
                    confirmLabel: 'Mark as Shipped',
                    tone: 'success' as const,
                    icon: TruckIcon,
                };
            case 'delivered':
                return {
                    title: 'Mark this order as delivered?',
                    description: 'This closes the order.',
                    confirmLabel: 'Mark as Delivered',
                    tone: 'success' as const,
                    icon: CheckCircleIcon,
                };
            case 'cancel':
                return {
                    title: 'Cancel this order and restore its stock?',
                    description: 'This cannot be undone. If the customer was already charged, you must process a refund manually via Paystack.',
                    confirmLabel: 'Cancel Order',
                    tone: 'warning' as const,
                    icon: XCircleIcon,
                };
            default:
                return {
                    title: 'Re-verify this payment?',
                    description: 'Checks the payment with Paystack and updates the order if it has now gone through.',
                    confirmLabel: 'Re-verify Payment',
                    tone: 'info' as const,
                    icon: ArrowPathIcon,
                };
        }
    })();

    return (
        <div className="space-y-6 pb-36 md:pb-12">
            <AdminPageHeader
                back={{ to: '/admin/store', label: 'Back to Orders' }}
                title={<>Order <span className="font-mono text-sffl-red">{order.order_reference}</span></>}
                subtitle={`Placed ${new Date(order.created_at).toLocaleString()}`}
                actions={
                    <>
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
                    </>
                }
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Customer + Shipping */}
                <div className="lg:col-span-2 space-y-6 min-w-0">
                    <section className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 sm:p-6 shadow-lg">
                        <h2 className="text-[11px] font-black uppercase tracking-wider text-sffl-red mb-4">Customer</h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm dark:text-gray-300">
                            <div className="min-w-0">
                                <div className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Name</div>
                                <div className="font-bold text-sffl-navy dark:text-white wrap-break-word">{order.customer_name}</div>
                            </div>
                            <div className="min-w-0">
                                <div className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Email</div>
                                <a href={`mailto:${order.customer_email}`} className="text-sffl-red font-bold underline break-all">
                                    {order.customer_email}
                                </a>
                            </div>
                            <div className="min-w-0">
                                <div className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Phone</div>
                                <a href={`tel:${order.customer_phone}`} className="font-bold dark:text-white">{order.customer_phone}</a>
                            </div>
                        </div>
                    </section>

                    <section className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 sm:p-6 shadow-lg">
                        <h2 className="text-[11px] font-black uppercase tracking-wider text-sffl-red mb-4">Shipping Address</h2>
                        <div className="bg-gray-50 dark:bg-gray-900/40 p-4 rounded-xl border border-gray-100 dark:border-gray-700 text-sm dark:text-gray-300 space-y-1 wrap-break-word">
                            <div className="font-bold text-sffl-navy dark:text-white">{order.customer_name}</div>
                            <div>{order.shipping_address}</div>
                            <div>{order.shipping_city}, {order.shipping_state}</div>
                            <div>{order.shipping_country} {order.shipping_postal_code && `· ${order.shipping_postal_code}`}</div>
                        </div>
                    </section>

                    <section className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 sm:p-6 shadow-lg space-y-4">
                        <h2 className="text-[11px] font-black uppercase tracking-wider text-sffl-red">Items ({order.items?.length || 0})</h2>
                        <div className="space-y-2">
                            {order.items?.map(item => (
                                <div key={item.id} className="flex justify-between items-start gap-3 bg-gray-50 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-700 p-4 rounded-xl">
                                    <div className="space-y-1 min-w-0">
                                        <div className="font-bold text-sm text-sffl-navy dark:text-white wrap-break-word">{item.product_name}</div>
                                        {item.variant_label && (
                                            <div className="text-[11px] text-gray-500 dark:text-gray-400 uppercase tracking-wider font-bold">{item.variant_label}</div>
                                        )}
                                        <div className="text-xs text-gray-500">Qty: <strong>{item.quantity}</strong> @ ₦{item.unit_price.toLocaleString()}</div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <div className="font-black text-base dark:text-white">₦{item.total_price.toLocaleString()}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="flex justify-between items-center gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                            <span className="font-black uppercase text-xs text-gray-500">Order Total</span>
                            <span className="font-black text-2xl text-sffl-red">₦{order.total_amount.toLocaleString()}</span>
                        </div>
                    </section>
                </div>

                {/* Right rail: payment + actions */}
                <div className="space-y-6 min-w-0">
                    <section className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 sm:p-6 shadow-lg space-y-4">
                        <h2 className="text-[11px] font-black uppercase tracking-wider text-sffl-red">Payment</h2>
                        <div className="space-y-2 text-sm dark:text-gray-300">
                            <div className="flex justify-between gap-3">
                                <span className="text-gray-500 font-bold">Status</span>
                                <span className={`font-black uppercase ${paymentClass}`}>{order.payment_status}</span>
                            </div>
                            <div className="flex justify-between gap-3">
                                <span className="text-gray-500 font-bold">Amount</span>
                                <span className="font-bold text-sffl-navy dark:text-white">₦{order.total_amount.toLocaleString()}</span>
                            </div>
                            {order.paystack_reference && (
                                <div className="flex justify-between gap-2">
                                    <span className="text-gray-500 font-bold shrink-0">Paystack Ref</span>
                                    <span className="font-mono text-[11px] truncate">{order.paystack_reference}</span>
                                </div>
                            )}
                        </div>
                    </section>

                    <section className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 sm:p-6 shadow-lg space-y-3">
                        <h2 className="text-[11px] font-black uppercase tracking-wider text-sffl-red">Actions</h2>

                        {order.payment_status !== 'paid' && (
                            <button
                                type="button"
                                disabled={busy}
                                onClick={() => setPendingAction('verify')}
                                className={`${actionButton} bg-sffl-navy hover:bg-slate-900 text-white`}
                            >
                                <ArrowPathIcon className="w-4 h-4" aria-hidden="true" />
                                Re-verify Payment
                            </button>
                        )}

                        {order.payment_status === 'paid' && order.fulfillment_status === 'pending' && (
                            <button
                                type="button"
                                disabled={busy}
                                onClick={() => setPendingAction('shipped')}
                                className={`${actionButton} bg-blue-600 hover:bg-blue-700 text-white`}
                            >
                                <TruckIcon className="w-4 h-4" aria-hidden="true" />
                                Mark as Shipped
                            </button>
                        )}

                        {order.payment_status === 'paid' && order.fulfillment_status === 'shipped' && (
                            <button
                                type="button"
                                disabled={busy}
                                onClick={() => setPendingAction('delivered')}
                                className={`${actionButton} bg-green-600 hover:bg-green-700 text-white`}
                            >
                                <CheckCircleIcon className="w-4 h-4" aria-hidden="true" />
                                Mark as Delivered
                            </button>
                        )}

                        {order.fulfillment_status !== 'cancelled' && order.fulfillment_status !== 'delivered' && (
                            <button
                                type="button"
                                disabled={busy}
                                onClick={() => setPendingAction('cancel')}
                                className={`${actionButton} bg-red-50 hover:bg-red-600 text-red-600 hover:text-white dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-600 dark:hover:text-white border border-red-200 dark:border-red-900`}
                            >
                                <XCircleIcon className="w-4 h-4" aria-hidden="true" />
                                Cancel & Restore Stock
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

            <ConfirmDialog
                open={pendingAction !== null}
                title={dialog.title}
                description={dialog.description}
                body={summary}
                confirmLabel={dialog.confirmLabel}
                tone={dialog.tone}
                icon={dialog.icon}
                pending={busy}
                onConfirm={confirmPendingAction}
                onCancel={() => setPendingAction(null)}
            />
        </div>
    );
};
