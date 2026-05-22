import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getStoreProduct, type StoreProduct, type ProductVariant } from '../services/api';
import { LazyImage } from '../components/common/LazyImage';
import { ProductDescription } from '../components/store/ProductDescription';
import { Modal } from '../components/ui/Modal';
import { ReturnPolicyContent, ShippingPolicyContent, PrivacyPolicyContent } from '../components/store/PolicyContent';
import { getAvailableStock, getVariantPrice, findVariantByValues } from '../utils/storeStock';

export const ProductDetailPage = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [quantity, setQuantity] = useState(1);
    // selectedValues is indexed by option position (0/1/2), matching how
    // variants store their tuple. undefined slot means that option is unset.
    const [selectedValues, setSelectedValues] = useState<(string | undefined)[]>([undefined, undefined, undefined]);
    const [activeImageIndex, setActiveImageIndex] = useState(0);
    const [openPolicy, setOpenPolicy] = useState<'return' | 'shipping' | 'privacy' | null>(null);
    const [shareToast, setShareToast] = useState('');

    const { data: product, isLoading, error } = useQuery<StoreProduct>({
        queryKey: ['storeProduct', id],
        queryFn: () => getStoreProduct(id || ''),
        enabled: !!id,
    });

    // For each option position, compute the per-value remaining stock summed
    // across all variants that carry that value. Used to dim sold-out pills.
    const stockByOptionValue = useMemo<Record<number, Record<string, number>>>(() => {
        const map: Record<number, Record<string, number>> = { 0: {}, 1: {}, 2: {} };
        product?.variants?.forEach((v: ProductVariant) => {
            const values = [v.option1_value, v.option2_value, v.option3_value];
            values.forEach((val, i) => {
                if (!val) return;
                map[i][val] = (map[i][val] ?? 0) + (v.quantity || 0);
            });
        });
        return map;
    }, [product]);

    // Auto-select the first in-stock value for any unset option position.
    useEffect(() => {
        if (!product?.options || product.options.length === 0) return;
        setSelectedValues(prev => {
            const next = [...prev];
            let changed = false;
            product.options.forEach((opt, i) => {
                if (next[i]) return;
                const firstInStock = opt.values.find(v => (stockByOptionValue[i]?.[v.value] ?? 0) > 0);
                if (firstInStock) {
                    next[i] = firstInStock.value;
                    changed = true;
                }
            });
            return changed ? next : prev;
        });
    }, [product, stockByOptionValue]);

    // When the user picks a variant that pins a specific gallery image, jump
    // the gallery to it. If no image is pinned, leave the gallery alone (per
    // spec: silent no-op).
    useEffect(() => {
        if (!product) return;
        const variant = findVariantByValues(product, selectedValues);
        if (!variant || !variant.image_url) return;
        const idx = product.images?.findIndex(img => img.image_url === variant.image_url);
        if (idx !== undefined && idx >= 0) {
            setActiveImageIndex(idx);
        }
    }, [product, selectedValues]);

    if (isLoading) {
        return (
            <div className="max-w-7xl mx-auto px-4 py-16 flex flex-col items-center justify-center space-y-4">
                <div className="w-12 h-12 border-4 border-sffl-red border-t-transparent rounded-full animate-spin"></div>
                <p className="text-sm font-bold text-gray-500 dark:text-gray-400">Loading catalog item details...</p>
            </div>
        );
    }

    if (error || !product) {
        return (
            <div className="max-w-md mx-auto px-4 py-16 text-center space-y-6">
                <span className="text-5xl">⚠️</span>
                <div className="space-y-2">
                    <h2 className="text-xl font-bold dark:text-white">Gear Item Not Found</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        The requested store item could not be retrieved. It may have been disabled or deleted from the catalog.
                    </p>
                </div>
                <Link to="/store" className="inline-block bg-sffl-navy hover:bg-sffl-red text-white text-xs font-bold uppercase tracking-wider px-6 py-3 rounded-full shadow transition-all">
                    Back to Store
                </Link>
            </div>
        );
    }

    const options = product.options || [];

    // Find the variant row whose tuple of option values matches the user's
    // current selection. Returns null until every active option has a value.
    const matchedVariant = findVariantByValues(product, selectedValues);

    // Calculate active price and stock (null-safe on variant override price).
    const activePrice = getVariantPrice(product, matchedVariant);
    const hasVariants = (product.variants?.length || 0) > 0;
    const activeStock = matchedVariant ? matchedVariant.quantity : (hasVariants ? 0 : product.quantity);
    const isVariantOutOfStock = activeStock === 0;
    const totalAvailable = getAvailableStock(product);

    const showShareFeedback = (msg: string) => {
        setShareToast(msg);
        window.setTimeout(() => setShareToast(''), 2500);
    };

    // Copy the product URL to clipboard, fall back through every available
    // strategy, and ALWAYS surface visible feedback to the user.
    const handleShare = async () => {
        const url = window.location.href;

        // 1. Modern async clipboard — works on https + localhost.
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(url);
                showShareFeedback('Link copied!');
                return;
            }
        } catch {
            // fall through to legacy path
        }

        // 2. Legacy textarea + execCommand — works on plain http and older browsers.
        try {
            const ta = document.createElement('textarea');
            ta.value = url;
            ta.setAttribute('readonly', '');
            ta.style.position = 'fixed';
            ta.style.top = '0';
            ta.style.left = '0';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            ta.setSelectionRange(0, url.length);
            const ok = document.execCommand('copy');
            document.body.removeChild(ta);
            if (ok) {
                showShareFeedback('Link copied!');
                return;
            }
        } catch {
            // fall through
        }

        showShareFeedback('Could not copy — please copy from the address bar');
    };

    const handleBuyNow = () => {
        if (isVariantOutOfStock) return;
        let checkoutUrl = `/store/checkout?product_id=${product.id}&quantity=${quantity}`;
        if (matchedVariant) {
            checkoutUrl += `&variant_id=${matchedVariant.id}`;
        }
        navigate(checkoutUrl);
    };

    const productImages = product.images && product.images.length > 0 ? product.images : [];

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fadeIn">
            {/* Breadcrumbs */}
            <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
                <Link to="/store" className="hover:text-sffl-red transition-colors">Store</Link>
                <span>/</span>
                <span className="text-gray-900 dark:text-white truncate">{product.name}</span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
                {/* Left: Dynamic HD Image Gallery Showcase */}
                <div className="lg:col-span-7 space-y-4">
                    {/* Big Showcase Box */}
                    <div className="relative aspect-square w-full rounded-3xl overflow-hidden bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700/50 flex items-center justify-center shadow-lg">
                        {productImages.length > 0 ? (
                            <LazyImage
                                src={productImages[activeImageIndex].image_url}
                                alt={product.name}
                                objectFit="contain"
                                className="select-none p-4"
                            />
                        ) : (
                            <div className="text-gray-400 font-black tracking-widest text-sm select-none">
                                NO IMAGES PROVIDED
                            </div>
                        )}

                        {activeStock <= product.threshold && activeStock > 0 && (
                            <span className="absolute top-4 left-4 bg-yellow-500 text-black font-black text-xs uppercase px-3 py-1 rounded-lg shadow-md tracking-wider">
                                Low Stock ({activeStock} left)
                            </span>
                        )}
                        {activeStock === 0 && (
                            <span className="absolute top-4 left-4 bg-red-600 text-white font-black text-xs uppercase px-3 py-1 rounded-lg shadow-md tracking-wider">
                                Out of Stock
                            </span>
                        )}
                    </div>

                    {/* Thumbnails list */}
                    {productImages.length > 1 && (
                        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                            {productImages.map((img, idx) => (
                                <button
                                    key={img.id}
                                    onClick={() => setActiveImageIndex(idx)}
                                    className={`relative w-20 h-20 rounded-xl overflow-hidden bg-gray-100 border-2 flex-shrink-0 transition-all ${activeImageIndex === idx ? 'border-sffl-red scale-95 shadow-md' : 'border-transparent hover:border-gray-300 dark:hover:border-gray-600'
                                        }`}
                                >
                                    <LazyImage src={img.image_url} alt="" objectFit="contain" className="p-1" />
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Right: Dynamic Product Options & Shopping Info */}
                <div className="lg:col-span-5 flex flex-col space-y-6">
                    {/* 1. Name + Price */}
                    <div className="space-y-2">
                        <h1 className="text-3xl md:text-4xl font-black italic tracking-tighter text-sffl-navy dark:text-white uppercase leading-none">
                            {product.name}
                        </h1>
                        <div className="flex items-baseline gap-4 pt-1">
                            <span className="text-3xl font-black text-sffl-navy dark:text-white">
                                ₦{activePrice.toLocaleString()}
                            </span>
                            {product.price !== activePrice && (
                                <span className="text-sm font-bold text-gray-500 line-through">
                                    ₦{product.price.toLocaleString()}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* 2. Variant Selectors (one row per option dimension) */}
                    {options.length > 0 && (
                        <div className="space-y-4 pt-2 border-t dark:border-gray-700/40">
                            {options.map((opt, optIdx) => (
                                <div key={`${opt.name}-${optIdx}`} className="space-y-2">
                                    <label className="text-xs uppercase font-black text-sffl-navy dark:text-gray-400 tracking-wider">
                                        Select {opt.name}
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                        {opt.values.map(val => {
                                            const isSelected = selectedValues[optIdx] === val.value;
                                            const stockForVal = stockByOptionValue[optIdx]?.[val.value] ?? 0;
                                            const isValueSoldOut = stockForVal === 0;
                                            return (
                                                <button
                                                    key={val.value}
                                                    disabled={isValueSoldOut}
                                                    onClick={() => {
                                                        if (isValueSoldOut) return;
                                                        setSelectedValues(prev => {
                                                            const next = [...prev];
                                                            next[optIdx] = val.value;
                                                            return next;
                                                        });
                                                    }}
                                                    title={isValueSoldOut ? 'Sold out' : undefined}
                                                    className={`px-4 py-2 text-xs font-bold rounded-xl border transition-all uppercase ${isValueSoldOut
                                                            ? 'bg-gray-100 dark:bg-gray-800/30 border-gray-200 dark:border-gray-700 text-gray-400 line-through cursor-not-allowed'
                                                            : isSelected
                                                                ? 'bg-sffl-navy border-sffl-navy text-white dark:bg-white dark:border-white dark:text-sffl-navy shadow-md'
                                                                : 'bg-white dark:bg-gray-800/40 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-400 dark:hover:border-gray-500'
                                                        }`}
                                                >
                                                    {val.value}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* 3. Quantity Selector */}
                    {!isVariantOutOfStock && (
                        <div className="space-y-2 pt-2 border-t dark:border-gray-700/40">
                            <label className="text-xs uppercase font-black text-sffl-navy dark:text-gray-400 tracking-wider block">Quantity</label>
                            <div className="inline-flex items-center border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-800/40">
                                <button
                                    type="button"
                                    onClick={() => setQuantity(prev => Math.max(1, prev - 1))}
                                    className="px-3 py-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm font-bold"
                                >
                                    -
                                </button>
                                <span className="px-4 text-sm font-bold text-gray-900 dark:text-white">{quantity}</span>
                                <button
                                    type="button"
                                    onClick={() => setQuantity(prev => Math.min(activeStock, prev + 1))}
                                    className="px-3 py-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm font-bold"
                                >
                                    +
                                </button>
                            </div>
                        </div>
                    )}

                    {/* 4. Buy Now */}
                    <div className="pt-4 border-t dark:border-gray-700/40 space-y-3">
                        {isVariantOutOfStock ? (
                            <button
                                disabled
                                className="w-full bg-gray-200 dark:bg-gray-700 text-gray-500 py-4 rounded-2xl font-black text-sm uppercase tracking-wider cursor-not-allowed shadow"
                            >
                                Out of Stock
                            </button>
                        ) : (
                            <button
                                onClick={handleBuyNow}
                                className="w-full bg-sffl-red hover:bg-red-700 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-wider transition-all transform active:scale-95 shadow-xl hover:shadow-sffl-red/20"
                            >
                                Buy Now →
                            </button>
                        )}
                        <p className="text-center text-[10px] text-sffl-navy dark:text-gray-400 font-bold uppercase tracking-wider flex items-center justify-center gap-1.5">
                            <span className="text-sffl-red">🔒</span> Secure payment options managed safely by Paystack.
                        </p>
                    </div>

                    {/* 5. Description */}
                    <div className="space-y-2 pt-4 border-t dark:border-gray-700/40">
                        <h3 className="text-xs uppercase font-black text-sffl-navy dark:text-gray-400 tracking-wider">Description</h3>
                        {product.description?.trim() ? (
                            <ProductDescription text={product.description} />
                        ) : (
                            <p className="text-base font-medium text-gray-800 dark:text-gray-300 leading-relaxed">
                                Exclusive official Showtime Flag Football premium gear. Durable threadwork engineered for dynamic durability and athletic performance.
                            </p>
                        )}
                    </div>

                    {/* 6. Stock / Share / Policies */}
                    <div className="space-y-4 pt-4 border-t dark:border-gray-700/40">
                        {totalAvailable > 0 && (
                            <div className="flex items-center gap-2 text-sm text-sffl-navy dark:text-gray-200">
                                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500/90 ring-2 ring-emerald-500/15"></span>
                                <span className="font-bold">{totalAvailable} in stock</span>
                            </div>
                        )}

                        <button
                            type="button"
                            onClick={handleShare}
                            aria-live="polite"
                            className={`inline-flex items-center gap-2 text-sm font-bold transition-colors ${
                                shareToast
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-sffl-navy dark:text-gray-200 hover:text-sffl-red'
                            }`}
                        >
                            {shareToast ? (
                                <>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                    </svg>
                                    {shareToast}
                                </>
                            ) : (
                                <>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M16 8l-4-4m0 0L8 8m4-4v12" />
                                    </svg>
                                    Share
                                </>
                            )}
                        </button>

                        <div className="space-y-3 text-sm text-gray-600 dark:text-gray-300 leading-relaxed pt-2">
                            <p>
                                Returns accepted within 15 days. See our{' '}
                                <button
                                    type="button"
                                    onClick={() => setOpenPolicy('return')}
                                    className="text-sffl-navy dark:text-white underline underline-offset-2 hover:text-sffl-red font-bold"
                                >
                                    Return Policy
                                </button>
                                .
                            </p>
                            <p>
                                Ships within 2–3 business days. View{' '}
                                <button
                                    type="button"
                                    onClick={() => setOpenPolicy('shipping')}
                                    className="text-sffl-navy dark:text-white underline underline-offset-2 hover:text-sffl-red font-bold"
                                >
                                    Shipping Policy
                                </button>
                                .
                            </p>
                            <p>
                                Your data is protected. Read our{' '}
                                <button
                                    type="button"
                                    onClick={() => setOpenPolicy('privacy')}
                                    className="text-sffl-navy dark:text-white underline underline-offset-2 hover:text-sffl-red font-bold"
                                >
                                    Privacy Policy
                                </button>
                                .
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Policy modals */}
            <Modal
                open={openPolicy === 'return'}
                onClose={() => setOpenPolicy(null)}
                title="Refund Policy"
                subtitle="Showtime Store"
                maxWidth="2xl"
            >
                <ReturnPolicyContent />
            </Modal>
            <Modal
                open={openPolicy === 'shipping'}
                onClose={() => setOpenPolicy(null)}
                title="Shipping Policy"
                subtitle="Showtime Store"
                maxWidth="2xl"
            >
                <ShippingPolicyContent />
            </Modal>
            <Modal
                open={openPolicy === 'privacy'}
                onClose={() => setOpenPolicy(null)}
                title="Privacy Policy"
                subtitle="Showtime Store"
                maxWidth="2xl"
            >
                <PrivacyPolicyContent />
            </Modal>
        </div>
    );
};
