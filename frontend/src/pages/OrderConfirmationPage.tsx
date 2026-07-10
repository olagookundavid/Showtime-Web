import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams, Link } from 'react-router-dom';
import { getOrderByReference, verifyStorePayment } from '../services/api';
import { Loader } from '../components/ui/Loader';
import { OrderLifecycleStepper } from '../components/store/OrderLifecycleStepper';
import { useCart } from '../contexts/CartContext';

export const OrderConfirmationPage = () => {
    const [searchParams] = useSearchParams();
    const reference = searchParams.get('reference') || searchParams.get('trxref');
    const { removeItem } = useCart();
    const cartClearedRef = useRef(false);
    const verifyFiredRef = useRef(false);

    // Don't rely solely on the Paystack webhook to confirm payment. On landing,
    // proactively ask the backend to verify this reference with Paystack once.
    // /store/verify is idempotent (it only transitions based on Paystack's
    // authoritative response), so if the webhook is delayed or missed the
    // customer still gets a 'paid' order instead of "pending" forever.
    useEffect(() => {
        if (!reference || verifyFiredRef.current) return;
        verifyFiredRef.current = true;
        verifyStorePayment(reference).catch(() => {
            /* polling below still picks up the webhook-driven update */
        });
    }, [reference]);

    // Poll the order until payment_status moves off 'pending'. The Paystack
    // webhook lands milliseconds-to-seconds after the redirect — stop polling
    // once we see a terminal state ('paid' or 'failed'), or after ~30s.
    const { data: order, isLoading, isError, failureCount } = useQuery({
        queryKey: ['publicOrder', reference],
        queryFn: () => getOrderByReference(reference!),
        enabled: !!reference,
        refetchInterval: (query) => {
            const data = query.state.data;
            if (data && data.payment_status !== 'pending') return false;
            return 2000;
        },
        retry: 6, // ~6 retries while order row hasn't been written yet
        retryDelay: 1500,
    });

    // Clear purchased lines from the cart once payment is confirmed. We hold
    // off until 'paid' (not at checkout submit) so a customer who bails at
    // Paystack or whose payment fails still finds their cart intact and can
    // retry. Guarded by a ref so polling re-renders don't re-fire the clear.
    useEffect(() => {
        if (cartClearedRef.current) return;
        if (order?.payment_status !== 'paid') return;
        order.items?.forEach(item => removeItem(item.product_id, item.variant_id));
        cartClearedRef.current = true;
    }, [order, removeItem]);

    const loading = !reference ? false : (isLoading && failureCount < 6);
    const error = !reference
        ? 'No order reference found.'
        : (isError && failureCount >= 6)
            ? 'Could not find your order. Please check your email or contact support.'
            : '';

    if (loading) {
        return (
            <div className="px-4 py-16 flex flex-col items-center justify-center space-y-4">
                <Loader />
                <p className="text-sm font-bold text-gray-500 dark:text-gray-400">Verifying secure payment with merchant gateways...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="max-w-2xl mx-auto text-center py-24 px-4 space-y-6">
                <div className="text-6xl animate-bounce">❌</div>
                <h2 className="text-2xl font-black text-red-600 mb-2 uppercase tracking-tight">Something Went Wrong</h2>
                <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">{error}</p>
                <Link to="/store" className="inline-block bg-sffl-navy hover:bg-sffl-red text-white px-8 py-3 rounded-full font-bold transition shadow-md">
                    Back to Store
                </Link>
            </div>
        );
    }

    const isPaid = order?.payment_status === 'paid';
    const isPending = order?.payment_status === 'pending';

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="space-y-8 animate-fadeIn print:py-0 print:px-0">
            {/* Status Header - Hidden during print */}
            <div className={`text-center p-8 rounded-3xl shadow-xl print:hidden ${
                isPaid 
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white' 
                    : isPending 
                        ? 'bg-gradient-to-r from-yellow-500 to-amber-500 text-white' 
                        : 'bg-gradient-to-r from-red-500 to-rose-600 text-white'
            }`}>
                <div className="text-6xl mb-4">{isPaid ? '✅' : isPending ? '⏳' : '❌'}</div>
                <h1 className="text-3xl font-black uppercase tracking-tight mb-2">
                    {isPaid ? 'Order Confirmed!' : isPending ? 'Order Pending' : 'Order Failed'}
                </h1>
                <p className="text-sm opacity-90 font-bold uppercase tracking-wider">
                    {isPaid ? 'Thank you for your purchase!' : isPending ? 'Your payment is being processed' : 'Your payment could not be completed'}
                </p>
                {!isPaid && !isPending && (
                    <Link
                        to="/store/cart"
                        className="inline-block mt-5 bg-white text-sffl-red hover:bg-gray-100 px-6 py-2.5 rounded-full font-black uppercase tracking-wider text-xs shadow-md transition"
                    >
                        ← Try Again
                    </Link>
                )}
            </div>

            {/* Lifecycle stepper — Order Placed → Paid → Preparing → Shipped → Delivered.
                Terminal states (failed payment / cancelled order) render their own
                inline banner inside the component. Hidden during print so it doesn't
                clutter the physical receipt. */}
            {order && (
                <div className="print:hidden">
                    <OrderLifecycleStepper order={order} />
                </div>
            )}

            {/* Order Details Receipt Box */}
            {order && (
                <div className="bg-white dark:bg-gray-800/40 backdrop-blur-md rounded-3xl overflow-hidden border border-gray-100 dark:border-gray-700/60 shadow-xl print:shadow-none print:border-none print:rounded-none print:bg-white">
                    {/* Header Banner — logo + brand on the left, invoice meta on
                        the right. In print this becomes the document letterhead
                        and stays as the first thing on page 1. */}
                    <div className="invoice-header bg-sffl-navy text-white p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-700 print:bg-white print:text-sffl-navy print:border-b-2 print:border-sffl-navy print:p-0 print:pb-4">
                        <div className="flex items-center gap-4">
                            <img
                                src="/images/branding/showtime-logo.png"
                                alt="Showtime Flag Football"
                                className="w-14 h-14 object-contain bg-white rounded-full p-1 print:bg-transparent print:p-0 print:w-16 print:h-16"
                            />
                            <div>
                                <p className="text-xs uppercase tracking-widest text-gray-300 font-bold print:text-sffl-navy">
                                    Showtime Flag Football
                                </p>
                                <h2 className="text-xl font-black italic uppercase tracking-tight mt-1 print:text-2xl">
                                    Official Invoice
                                </h2>
                            </div>
                        </div>
                        <div className="text-left md:text-right">
                            <p className="text-xs text-gray-400 font-bold uppercase print:text-gray-600">Order Reference</p>
                            <p className="font-mono text-sm font-black tracking-widest text-sffl-red print:text-base">{order.order_reference}</p>
                            <p className="text-[10px] text-gray-400 font-bold uppercase mt-1 print:text-gray-600">
                                {new Date(order.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                            </p>
                        </div>
                    </div>

                    {/* Details Breakdown */}
                    <div className="p-6 space-y-6 print:p-0 print:pt-4">
                        {/* Customer & Shipping Summary */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6 border-b dark:border-gray-700/40">
                            <div className="space-y-1">
                                <span className="text-[10px] text-gray-400 uppercase font-black tracking-wider">Customer Contact</span>
                                <p className="font-bold text-sffl-navy dark:text-white">{order.customer_name}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">{order.customer_email}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">{order.customer_phone}</p>
                            </div>
                            <div className="space-y-1">
                                <span className="text-[10px] text-gray-400 uppercase font-black tracking-wider">Delivery Address</span>
                                <p className="font-bold text-sffl-navy dark:text-white leading-tight">{order.shipping_address}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {order.shipping_city}, {order.shipping_state}, {order.shipping_country}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">Postal Code: {order.shipping_postal_code || '—'}</p>
                            </div>
                        </div>

                        {/* Order Items Table */}
                        <div className="space-y-3">
                            <span className="text-[10px] text-gray-400 uppercase font-black tracking-wider block">Items Purchased</span>
                            <div className="divide-y divide-gray-100 dark:divide-gray-700/40">
                                {order.items?.map((item) => (
                                    <div key={item.id} className="invoice-item py-3 flex items-center justify-between text-sm">
                                        <div className="space-y-0.5">
                                            <p className="font-bold text-sffl-navy dark:text-white uppercase">{item.product_name}</p>
                                            {item.variant_label && (
                                                <p className="text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider px-2 py-0.5 rounded inline-block">
                                                    {item.variant_label}
                                                </p>
                                            )}
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold text-gray-900 dark:text-white">
                                                ₦{item.unit_price?.toLocaleString()} <span className="text-xs text-gray-400">x{item.quantity}</span>
                                            </p>
                                            <p className="text-xs font-black text-sffl-red">₦{(item.unit_price * item.quantity).toLocaleString()}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Invoice Summary Calculation */}
                        <div className="invoice-summary pt-6 border-t dark:border-gray-700/40 flex flex-col items-end space-y-2">
                            <div className="flex justify-between w-64 text-xs font-bold text-gray-500">
                                <span>Subtotal</span>
                                <span>₦{order.total_amount?.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between w-64 text-xs font-bold text-green-500">
                                <span>Shipping (Promo)</span>
                                <span>FREE</span>
                            </div>
                            <div className="flex justify-between w-64 pt-3 border-t dark:border-gray-700/40 text-base font-black text-sffl-navy dark:text-white">
                                <span>Total Paid</span>
                                <span className="text-sffl-red text-lg">₦{order.total_amount?.toLocaleString()}</span>
                            </div>
                        </div>

                        {/* Order Reference details footer */}
                        <div className="border-t dark:border-gray-700/40 pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-gray-400">
                            <span>Reference: {order.paystack_reference || '—'}</span>
                            <span className={`px-3 py-1 rounded-full font-black uppercase text-[10px] self-start sm:self-center ${
                                isPaid 
                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400' 
                                    : isPending 
                                        ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400' 
                                        : 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                            }`}>
                                {order.payment_status}
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* Print & Back actions */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4 print:hidden">
                <button
                    onClick={handlePrint}
                    className="w-full sm:w-auto bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 px-8 py-3 rounded-full font-bold transition flex items-center justify-center gap-2 shadow"
                >
                    <span>🖨️</span> Print Invoice
                </button>
                <Link 
                    to="/store" 
                    className="w-full sm:w-auto text-center bg-sffl-navy hover:bg-sffl-red text-white px-8 py-3 rounded-full font-bold transition shadow"
                >
                    ← Back to Store
                </Link>
            </div>
        </div>
    );
};
