import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../contexts/CartContext';

export const CartPage = () => {
    const { items, subtotal, updateQuantity, removeItem, clear } = useCart();
    const navigate = useNavigate();

    // CheckoutPage reads cart-mode straight from CartContext when ?source=cart
    // is present — no URL or sessionStorage payload needed.
    const handleCheckout = () => {
        navigate('/store/checkout?source=cart');
    };

    if (items.length === 0) {
        return (
            <div className="max-w-2xl mx-auto px-4 py-20 text-center space-y-6 animate-fadeIn">
                <div className="text-6xl">🛒</div>
                <div className="space-y-2">
                    <h1 className="text-2xl font-black uppercase tracking-tight text-sffl-navy dark:text-white">Your cart is empty</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Browse the store and tap "Add to Cart" on any product to get started.
                    </p>
                </div>
                <Link
                    to="/store"
                    className="inline-block bg-sffl-navy hover:bg-sffl-red text-white text-xs font-bold uppercase tracking-wider px-6 py-3 rounded-full shadow-lg transition-all"
                >
                    Go to Store
                </Link>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fadeIn">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b dark:border-gray-800">
                <div>
                    <h1 className="text-3xl font-black italic tracking-tighter text-sffl-navy dark:text-white uppercase leading-none">
                        Your Cart
                    </h1>
                    <p className="text-xs text-gray-500 uppercase font-black tracking-widest mt-1.5">
                        {items.length} item{items.length === 1 ? '' : 's'}
                    </p>
                </div>
                <button
                    onClick={() => { if (confirm('Empty the entire cart?')) clear(); }}
                    className="text-xs font-black uppercase tracking-wider text-red-500 hover:underline self-start md:self-auto"
                >
                    Clear cart
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                {/* Items */}
                <div className="lg:col-span-2 space-y-3">
                    {items.map(line => {
                        const lineTotal = line.unit_price * line.quantity;
                        return (
                            <div
                                key={`${line.product_id}::${line.variant_id || ''}`}
                                className="flex gap-4 bg-white dark:bg-gray-800/40 border border-gray-100 dark:border-gray-700/60 rounded-2xl p-4 shadow-sm"
                            >
                                <Link
                                    to={`/store/products/${line.product_id}`}
                                    className="w-20 h-20 flex-shrink-0 rounded-xl bg-gray-50 dark:bg-gray-900/40 overflow-hidden flex items-center justify-center border border-gray-100 dark:border-gray-700"
                                >
                                    {line.image_url ? (
                                        <img src={line.image_url} alt="" className="w-full h-full object-contain p-1" />
                                    ) : (
                                        <span className="text-[10px] font-bold text-gray-400">MERCH</span>
                                    )}
                                </Link>

                                <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-3">
                                    <div className="flex-1 min-w-0 space-y-1">
                                        <Link
                                            to={`/store/products/${line.product_id}`}
                                            className="font-black text-sm text-sffl-navy dark:text-white hover:text-sffl-red transition-colors line-clamp-1"
                                        >
                                            {line.product_name}
                                        </Link>
                                        {line.variant_label && (
                                            <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                {line.variant_label}
                                            </p>
                                        )}
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            ₦{line.unit_price.toLocaleString()} each
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <div className="inline-flex items-center border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800/40">
                                            <button
                                                type="button"
                                                onClick={() => updateQuantity(line.product_id, line.variant_id, line.quantity - 1)}
                                                className="px-2.5 py-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm font-bold"
                                            >
                                                −
                                            </button>
                                            <span className="px-3 text-sm font-bold text-gray-900 dark:text-white">{line.quantity}</span>
                                            <button
                                                type="button"
                                                onClick={() => updateQuantity(line.product_id, line.variant_id, line.quantity + 1)}
                                                className="px-2.5 py-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm font-bold"
                                            >
                                                +
                                            </button>
                                        </div>

                                        <div className="text-right min-w-[80px]">
                                            <div className="font-black text-sm text-sffl-navy dark:text-white">₦{lineTotal.toLocaleString()}</div>
                                            <button
                                                type="button"
                                                onClick={() => removeItem(line.product_id, line.variant_id)}
                                                className="text-[10px] font-bold text-red-500 hover:underline uppercase tracking-wider"
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Summary */}
                <div className="lg:sticky lg:top-24 bg-white dark:bg-gray-800/40 border border-gray-100 dark:border-gray-700/60 rounded-2xl p-6 shadow-sm space-y-4">
                    <h2 className="text-[11px] uppercase font-black tracking-wider text-sffl-red">Order Summary</h2>

                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between text-gray-500">
                            <span>Subtotal</span>
                            <span className="font-bold text-sffl-navy dark:text-white">₦{subtotal.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-gray-500">
                            <span>Shipping</span>
                            <span className="font-bold text-emerald-600 uppercase text-[10px] bg-emerald-500/10 px-2 py-0.5 rounded">Calculated at checkout</span>
                        </div>
                        <div className="flex justify-between pt-3 border-t dark:border-gray-700/40 text-base font-black text-sffl-navy dark:text-white">
                            <span>Total</span>
                            <span className="text-sffl-red text-lg">₦{subtotal.toLocaleString()}</span>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={handleCheckout}
                        className="w-full bg-sffl-red hover:bg-red-700 text-white py-3 rounded-full font-bold text-xs uppercase tracking-wider transition-all transform active:scale-95 shadow-md"
                    >
                        Checkout →
                    </button>

                    <Link
                        to="/store"
                        className="block text-center text-xs font-bold text-sffl-navy dark:text-gray-300 hover:text-sffl-red uppercase tracking-wider"
                    >
                        ← Continue shopping
                    </Link>
                </div>
            </div>
        </div>
    );
};
