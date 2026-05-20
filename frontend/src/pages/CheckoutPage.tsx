import { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { 
    getStoreProduct, 
    getSavedAddresses, 
    initializeCheckout, 
    type StoreProduct, 
    type SavedAddress, 
    type CheckoutPayload 
} from '../services/api';
import { LazyImage } from '../components/common/LazyImage';

export const CheckoutPage = () => {
    const [searchParams] = useSearchParams();
    const { user, isAuthenticated } = useAuth();

    const productId = searchParams.get('product_id') || '';
    const variantId = searchParams.get('variant_id') || '';
    const quantity = parseInt(searchParams.get('quantity') || '1', 10);

    const [checkoutStep, setCheckoutStep] = useState<1 | 2>(1);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form State
    const [shippingForm, setShippingForm] = useState({
        recipient_name: user?.name || '',
        email: user?.email || '',
        phone: user?.phone || '',
        country: 'Nigeria',
        state: '',
        city: '',
        street_address: '',
        postal_code: '',
    });

    const { data: product, isLoading: loadingProduct } = useQuery<StoreProduct>({
        queryKey: ['storeProduct', productId],
        queryFn: () => getStoreProduct(productId),
        enabled: !!productId,
    });

    const { data: savedAddresses = [] } = useQuery<SavedAddress[]>({
        queryKey: ['savedAddresses'],
        queryFn: getSavedAddresses,
        enabled: isAuthenticated,
    });

    if (loadingProduct) {
        return (
            <div className="max-w-7xl mx-auto px-4 py-16 flex flex-col items-center justify-center space-y-4">
                <div className="w-12 h-12 border-4 border-sffl-red border-t-transparent rounded-full animate-spin"></div>
                <p className="text-sm font-bold text-gray-500">Preparing secure checkout gateway...</p>
            </div>
        );
    }

    if (!product) {
        return (
            <div className="max-w-md mx-auto px-4 py-16 text-center space-y-6">
                <span className="text-5xl">🛒</span>
                <div className="space-y-2">
                    <h2 className="text-xl font-bold dark:text-white">Your Cart is Empty</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Please select an item from our official merchandise store to proceed with checkout.
                    </p>
                </div>
                <Link to="/store" className="inline-block bg-sffl-navy hover:bg-sffl-red text-white text-xs font-bold uppercase tracking-wider px-6 py-3 rounded-full shadow transition-all">
                    Go to Store
                </Link>
            </div>
        );
    }

    // Match variant details
    const matchedVariant = product.variants?.find(v => v.id === variantId);
    const unitPrice = matchedVariant && matchedVariant.price > 0 ? matchedVariant.price : product.price;
    const subtotal = unitPrice * quantity;
    const shippingCost = 0; // Free promo
    const totalAmount = subtotal + shippingCost;

    const handleSelectAddress = (addr: SavedAddress) => {
        setShippingForm({
            recipient_name: addr.recipient_name,
            email: shippingForm.email || user?.email || '',
            phone: addr.phone,
            country: addr.country,
            state: addr.state,
            city: addr.city,
            street_address: addr.street_address,
            postal_code: addr.postal_code,
        });
    };

    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // Validation
        if (
            !shippingForm.recipient_name ||
            !shippingForm.email ||
            !shippingForm.phone ||
            !shippingForm.state ||
            !shippingForm.city ||
            !shippingForm.street_address
        ) {
            alert('Please fill out all required shipping fields.');
            return;
        }
        setCheckoutStep(2);
    };

    const handlePayNow = async () => {
        setIsSubmitting(true);
        try {
            const payload: CheckoutPayload = {
                customer_name: shippingForm.recipient_name,
                customer_email: shippingForm.email,
                customer_phone: shippingForm.phone,
                shipping_country: shippingForm.country,
                shipping_state: shippingForm.state,
                shipping_city: shippingForm.city,
                shipping_address: shippingForm.street_address,
                shipping_postal_code: shippingForm.postal_code || '100001',
                items: [
                    {
                        product_id: product.id,
                        variant_id: variantId || undefined,
                        quantity: quantity,
                    }
                ],
            };

            const response = await initializeCheckout(payload);
            if (response && response.paystack_url) {
                // Redirect user directly to secure Paystack transaction
                window.location.href = response.paystack_url;
            } else {
                throw new Error('No checkout URL received from merchant API.');
            }
        } catch (err: any) {
            alert(err.response?.data?.error || 'Failed to initialize Paystack checkout. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fadeIn">
            {/* Header Steps */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b dark:border-gray-800">
                <div>
                    <h1 className="text-3xl font-black italic tracking-tighter text-sffl-navy dark:text-white uppercase leading-none">
                        Secure Checkout
                    </h1>
                    <p className="text-xs text-gray-500 uppercase font-black tracking-widest mt-1.5">
                        Showtime Football In-App Checkout
                    </p>
                </div>

                {/* Progress Indicators */}
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
                    <span className={`px-3 py-1.5 rounded-lg ${checkoutStep === 1 ? 'bg-sffl-navy text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'}`}>
                        1. Shipping Address
                    </span>
                    <span className="text-gray-300">➔</span>
                    <span className={`px-3 py-1.5 rounded-lg ${checkoutStep === 2 ? 'bg-sffl-navy text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'}`}>
                        2. Invoice & Payment
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* Left: Interactive checkout panel */}
                <div className="lg:col-span-8 space-y-6">
                    {checkoutStep === 1 ? (
                        <div className="bg-white dark:bg-gray-800/30 backdrop-blur-md rounded-3xl p-6 border border-gray-100 dark:border-gray-700/50 shadow-lg space-y-6">
                            <h2 className="text-lg font-black text-sffl-navy dark:text-white uppercase tracking-tight">
                                🚚 Shipping & Contact Information
                            </h2>

                            {/* Saved Address Panel for Logged in Profiles */}
                            {isAuthenticated && savedAddresses.length > 0 && (
                                <div className="space-y-3">
                                    <label className="text-xs font-black uppercase text-gray-400 tracking-wider">
                                        📋 Select a Saved Shipping Address
                                    </label>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {savedAddresses.map((addr) => (
                                            <div
                                                key={addr.id}
                                                onClick={() => handleSelectAddress(addr)}
                                                className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 hover:border-sffl-red/40 p-4 rounded-2xl cursor-pointer transition-all duration-300 group hover:shadow-md"
                                            >
                                                <div className="flex justify-between items-start">
                                                    <span className="font-bold text-sm text-sffl-navy dark:text-white group-hover:text-sffl-red transition-colors">
                                                        {addr.recipient_name}
                                                    </span>
                                                    <span className="text-[10px] bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded text-gray-500 font-bold uppercase">Use</span>
                                                </div>
                                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 truncate">{addr.street_address}</p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{addr.city}, {addr.state}</p>
                                                <p className="text-[10px] text-gray-400 mt-1">{addr.phone}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {!isAuthenticated && (
                                <div className="bg-sffl-navy/5 border border-sffl-navy/20 p-4 rounded-2xl text-xs flex justify-between items-center text-gray-500">
                                    <span>💡 Checked out as Guest. Log in to use your saved addresses.</span>
                                    <Link to="/login" className="text-sffl-red font-black hover:underline uppercase ml-2">Login</Link>
                                </div>
                            )}

                            <form onSubmit={handleFormSubmit} className="space-y-4 pt-2">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-gray-500 uppercase">Recipient Name</label>
                                        <input
                                            required
                                            type="text"
                                            value={shippingForm.recipient_name}
                                            onChange={e => setShippingForm({ ...shippingForm, recipient_name: e.target.value })}
                                            className="w-full px-3 py-2 text-sm border rounded-xl dark:bg-gray-800 dark:border-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-sffl-red/40"
                                            placeholder="e.g. David Oh"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-gray-500 uppercase">Email Address</label>
                                        <input
                                            required
                                            type="email"
                                            value={shippingForm.email}
                                            onChange={e => setShippingForm({ ...shippingForm, email: e.target.value })}
                                            className="w-full px-3 py-2 text-sm border rounded-xl dark:bg-gray-800 dark:border-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-sffl-red/40"
                                            placeholder="e.g. david@gmail.com"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-gray-500 uppercase">Phone Number</label>
                                        <input
                                            required
                                            type="text"
                                            value={shippingForm.phone}
                                            onChange={e => setShippingForm({ ...shippingForm, phone: e.target.value })}
                                            className="w-full px-3 py-2 text-sm border rounded-xl dark:bg-gray-800 dark:border-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-sffl-red/40"
                                            placeholder="e.g. +234..."
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-gray-500 uppercase">Country</label>
                                        <input
                                            readOnly
                                            type="text"
                                            value={shippingForm.country}
                                            className="w-full px-3 py-2 text-sm border rounded-xl bg-gray-50 dark:bg-gray-700/30 dark:border-gray-700 dark:text-gray-400 outline-none cursor-not-allowed"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                    <div className="col-span-2 sm:col-span-1 space-y-1">
                                        <label className="text-xs font-bold text-gray-500 uppercase">State</label>
                                        <input
                                            required
                                            type="text"
                                            value={shippingForm.state}
                                            onChange={e => setShippingForm({ ...shippingForm, state: e.target.value })}
                                            className="w-full px-3 py-2 text-sm border rounded-xl dark:bg-gray-800 dark:border-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-sffl-red/40"
                                            placeholder="e.g. Lagos"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-gray-500 uppercase">City</label>
                                        <input
                                            required
                                            type="text"
                                            value={shippingForm.city}
                                            onChange={e => setShippingForm({ ...shippingForm, city: e.target.value })}
                                            className="w-full px-3 py-2 text-sm border rounded-xl dark:bg-gray-800 dark:border-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-sffl-red/40"
                                            placeholder="e.g. Lekki"
                                        />
                                    </div>
                                    <div className="col-span-2 sm:col-span-1 space-y-1">
                                        <label className="text-xs font-bold text-gray-500 uppercase">Postal Code</label>
                                        <input
                                            type="text"
                                            value={shippingForm.postal_code}
                                            onChange={e => setShippingForm({ ...shippingForm, postal_code: e.target.value })}
                                            className="w-full px-3 py-2 text-sm border rounded-xl dark:bg-gray-800 dark:border-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-sffl-red/40"
                                            placeholder="e.g. 100001"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-500 uppercase">Street Address</label>
                                    <textarea
                                        required
                                        rows={2}
                                        value={shippingForm.street_address}
                                        onChange={e => setShippingForm({ ...shippingForm, street_address: e.target.value })}
                                        className="w-full px-3 py-2 text-sm border rounded-xl dark:bg-gray-800 dark:border-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-sffl-red/40"
                                        placeholder="Detailed street name, apartment details, building number..."
                                    />
                                </div>

                                <button
                                    type="submit"
                                    className="w-full bg-sffl-navy hover:bg-sffl-red text-white py-3.5 rounded-2xl font-black text-xs uppercase tracking-wider transition-colors shadow-lg"
                                >
                                    Continue to Invoice & Payment →
                                </button>
                            </form>
                        </div>
                    ) : (
                        /* Stage 2: Invoice Place Order Panel */
                        <div className="bg-white dark:bg-gray-800/30 backdrop-blur-md rounded-3xl p-6 border border-gray-100 dark:border-gray-700/50 shadow-lg space-y-6">
                            <h2 className="text-lg font-black text-sffl-navy dark:text-white uppercase tracking-tight">
                                🔒 Secure Invoice Validation
                            </h2>

                            <div className="bg-gray-50 dark:bg-gray-800/50 border p-5 rounded-2xl space-y-4">
                                <div className="border-b pb-2">
                                    <h3 className="text-xs font-black uppercase text-gray-400 tracking-wider">Shipping Destination Details</h3>
                                    <div className="text-xs text-gray-700 dark:text-gray-300 mt-2 font-medium">
                                        <p className="font-bold text-sm text-sffl-navy dark:text-white">{shippingForm.recipient_name}</p>
                                        <p>{shippingForm.street_address}</p>
                                        <p>{shippingForm.city}, {shippingForm.state}, {shippingForm.country}</p>
                                        <p className="mt-1 text-gray-500">Contact: {shippingForm.phone} | {shippingForm.email}</p>
                                    </div>
                                </div>

                                <div>
                                    <h3 className="text-xs font-black uppercase text-gray-400 tracking-wider">Checkout Order Breakdown</h3>
                                    <div className="flex items-center gap-3 mt-3">
                                        <div className="w-12 h-12 rounded-lg bg-gray-200 dark:bg-gray-700 overflow-hidden flex-shrink-0">
                                            {product.images && product.images.length > 0 ? (
                                                <LazyImage src={product.images[0].image_url} alt="" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-gray-400">GEAR</div>
                                            )}
                                        </div>
                                        <div className="text-xs">
                                            <p className="font-bold text-sffl-navy dark:text-white">{product.name}</p>
                                            {matchedVariant && (
                                                <p className="text-[10px] text-gray-500 font-bold uppercase mt-0.5">
                                                    Option: {matchedVariant.variant_name} ({matchedVariant.variant_value})
                                                </p>
                                            )}
                                            <p className="text-gray-400 mt-0.5">Qty: {quantity} @ ₦{unitPrice.toLocaleString()}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {isSubmitting ? (
                                <div className="text-center py-6 space-y-4">
                                    <div className="w-10 h-10 border-4 border-sffl-red border-t-transparent rounded-full animate-spin mx-auto"></div>
                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider animate-pulse">
                                        Connecting safely to Paystack payment gateway...
                                    </p>
                                </div>
                            ) : (
                                <div className="flex gap-4">
                                    <button
                                        type="button"
                                        onClick={() => setCheckoutStep(1)}
                                        className="flex-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-300 py-3.5 rounded-2xl font-black text-xs uppercase tracking-wider transition-colors border"
                                    >
                                        Back
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handlePayNow}
                                        className="flex-[2] bg-sffl-red hover:bg-red-700 text-white py-3.5 rounded-2xl font-black text-xs uppercase tracking-wider transition-all transform active:scale-95 shadow-xl hover:shadow-sffl-red/20"
                                    >
                                        Pay With Paystack →
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Right: Cart Summary Column */}
                <div className="lg:col-span-4 bg-white dark:bg-gray-800/30 backdrop-blur-md rounded-3xl p-6 border border-gray-100 dark:border-gray-700/50 shadow-lg space-y-4">
                    <h2 className="text-xs uppercase font-black text-gray-400 tracking-wider">
                        🛒 Checkout Cart Summary
                    </h2>

                    <div className="flex items-center gap-3 pb-3 border-b dark:border-gray-800">
                        <div className="w-16 h-16 rounded-xl bg-gray-100 dark:bg-gray-800/60 overflow-hidden flex-shrink-0 flex items-center justify-center border">
                            {product.images && product.images.length > 0 ? (
                                <LazyImage src={product.images[0].image_url} alt="" />
                            ) : (
                                <div className="text-[10px] font-bold text-gray-400">MERCH</div>
                            )}
                        </div>
                        <div className="text-xs space-y-1">
                            <p className="font-bold text-gray-900 dark:text-white line-clamp-1">{product.name}</p>
                            {matchedVariant && (
                                <p className="text-[10px] font-semibold text-gray-400 uppercase">
                                    Option: {matchedVariant.variant_name} ({matchedVariant.variant_value})
                                </p>
                            )}
                            <p className="text-sffl-red font-bold">₦{unitPrice.toLocaleString()} × {quantity}</p>
                        </div>
                    </div>

                    <div className="space-y-2 text-xs pt-1">
                        <div className="flex justify-between text-gray-500">
                            <span>Subtotal</span>
                            <span className="font-semibold text-gray-900 dark:text-white">₦{subtotal.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-gray-500">
                            <span>Shipping Promo</span>
                            <span className="font-semibold text-emerald-500 uppercase text-[10px] bg-emerald-500/10 px-1.5 py-0.5 rounded">FREE</span>
                        </div>
                        <div className="flex justify-between text-base font-black text-sffl-navy dark:text-white pt-3 border-t dark:border-gray-800">
                            <span>Invoice Total</span>
                            <span>₦{totalAmount.toLocaleString()}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
