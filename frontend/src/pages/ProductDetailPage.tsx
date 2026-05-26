import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getStoreProduct, getProductReviews, type StoreProduct, type ProductVariant } from '../services/api';
import { LazyImage } from '../components/common/LazyImage';
import { ProductDescription } from '../components/store/ProductDescription';
import { StarRating } from '../components/store/StarRating';
import { Modal } from '../components/ui/Modal';
import { ReturnPolicyContent, ShippingPolicyContent, PrivacyPolicyContent } from '../components/store/PolicyContent';
import { getVariantPrice, findVariantByValues } from '../utils/storeStock';
import { useCart } from '../contexts/CartContext';

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
    const [addedToast, setAddedToast] = useState('');
    // Hook must be called unconditionally at the top of the component to
    // satisfy the Rules of Hooks — early returns below would otherwise skip it
    // and produce a "rendered more hooks" mismatch on subsequent renders.
    const { addItem } = useCart();

    // Fetch the 2 most recent reviews for the inline preview block below the
    // description. The dedicated /reviews page paginates the full list.
    const { data: reviewsPreview } = useQuery({
        queryKey: ['productReviewsPreview', id],
        queryFn: () => getProductReviews(id!, 1, 2, 'newest'),
        enabled: !!id,
    });

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
            <div className="px-4 py-16 flex flex-col items-center justify-center space-y-4">
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

    // Builds the cart line from the currently selected variant + qty, then
    // hands it to the CartContext (which dedupes by product+variant).
    const handleAddToCart = () => {
        if (isVariantOutOfStock) return;
        const variantLabel = matchedVariant
            ? [matchedVariant.option1_value, matchedVariant.option2_value, matchedVariant.option3_value]
                .filter(Boolean)
                .map((v, i) => `${product.options?.[i]?.name || `Option ${i + 1}`}: ${v}`)
                .join(', ')
            : undefined;
        const primaryImage = matchedVariant?.image_url || product.images?.find(i => i.is_primary)?.image_url || product.images?.[0]?.image_url;

        addItem({
            product_id: product.id,
            variant_id: matchedVariant?.id,
            product_name: product.name,
            variant_label: variantLabel,
            unit_price: activePrice,
            quantity,
            image_url: primaryImage,
        });
        setAddedToast(quantity > 1 ? `${quantity} added to cart` : 'Added to cart');
        window.setTimeout(() => setAddedToast(''), 2000);
    };

    const productImages = product.images && product.images.length > 0 ? product.images : [];

    return (
        <div className="space-y-8 animate-fadeIn">
            {/* Breadcrumbs */}
            <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
                <Link to="/store" className="hover:text-sffl-red transition-colors">Store</Link>
                <span>/</span>
                <span className="text-gray-900 dark:text-white truncate">{product.name}</span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
                {/* Left (cols 1-3, spans 2 rows): Image gallery — kept small,
                    Amazon-style, so the middle column carries the title and
                    description. Sticky on desktop. `lg:self-start` is critical
                    — grid items default to `stretch`, which silently breaks
                    `position:sticky`. */}
                <div className="lg:col-span-3 lg:row-span-2 space-y-4 lg:sticky lg:top-24 lg:self-start">
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

                    {/* Provenance — who added the product and when. Labels
                        ("Added by:" / "Added on:") give the values context;
                        sits below the gallery so it doesn't compete with the
                        title or buy box but is still discoverable. */}
                    <div className="text-xs font-bold text-sffl-navy dark:text-gray-300 leading-relaxed pt-2 space-y-0.5">
                        {product.created_by_name && (
                            <div>
                                <span className="text-gray-500 dark:text-gray-400">Added by:</span>{' '}
                                <span className="font-black">{product.created_by_name}</span>
                            </div>
                        )}
                        <div>
                            <span className="text-gray-500 dark:text-gray-400">Added on:</span>{' '}
                            <span className="font-black">
                                {product.created_at
                                    ? new Date(product.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
                                    : '—'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Middle top (cols 4-9): Title only. On mobile this falls
                    directly after the image and before the buy box. */}
                <div className="lg:col-span-6 lg:col-start-4">
                    <h1 className="text-3xl md:text-4xl font-black italic tracking-tighter text-sffl-navy dark:text-white uppercase leading-tight">
                        {product.name}
                    </h1>
                </div>

                {/* Right (cols 10-12, spans 2 rows): The buy box. Variants,
                    price, stock, quantity, Buy Now. Sticky on desktop so the
                    shopper can change the variant and hit buy without scroll
                    no matter how long the description is. */}
                <div className="lg:col-span-3 lg:col-start-10 lg:row-span-2 lg:sticky lg:top-24 lg:self-start">
                    <div className="bg-white dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700/60 rounded-2xl p-5 shadow-lg space-y-5">
                        {/* Price */}
                        <div className="text-2xl font-black text-sffl-red leading-none">
                            ₦{(activePrice ?? 0).toLocaleString()}
                        </div>

                        {/* Rating summary — clickable, jumps to the dedicated
                            reviews page. Hidden when nobody's rated yet. */}
                        {product.rating_count > 0 ? (
                            <Link
                                to={`/store/products/${product.id}/reviews`}
                                className="flex items-center gap-2 text-xs font-bold text-sffl-navy dark:text-gray-300 hover:text-sffl-red transition-colors"
                            >
                                <StarRating value={product.rating_avg ?? 0} size="sm" />
                                <span>{(product.rating_avg ?? 0).toFixed(1)}</span>
                                <span className="text-gray-400">·</span>
                                <span className="underline underline-offset-2">{product.rating_count} review{product.rating_count === 1 ? '' : 's'}</span>
                            </Link>
                        ) : (
                            <Link
                                to={`/store/products/${product.id}/reviews`}
                                className="inline-flex items-center gap-2 text-xs font-bold text-gray-500 hover:text-sffl-red transition-colors"
                            >
                                <StarRating value={0} size="sm" />
                                <span>No reviews yet</span>
                            </Link>
                        )}

                        {/* Variant selectors */}
                        {options.length > 0 && (
                            <div className="space-y-4 pt-4 border-t dark:border-gray-700/40">
                                {options.map((opt, optIdx) => (
                                    <div key={`${opt.name}-${optIdx}`} className="space-y-2">
                                        <label className="text-[10px] uppercase font-black text-sffl-navy dark:text-gray-400 tracking-wider">
                                            {opt.name}
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
                                                        className={`px-3 py-1.5 text-xs font-bold rounded-md border transition-all uppercase ${isValueSoldOut
                                                                ? 'bg-gray-100 dark:bg-gray-800/30 border-gray-200 dark:border-gray-700 text-gray-400 line-through cursor-not-allowed'
                                                                : isSelected
                                                                    ? 'bg-sffl-navy border-sffl-navy text-white dark:bg-white dark:border-white dark:text-sffl-navy shadow-sm'
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

                        {/* In Stock / Sold Out */}
                        <div className="flex items-center gap-2 text-xs font-bold pt-4 border-t dark:border-gray-700/40">
                            {isVariantOutOfStock ? (
                                <>
                                    <span className="inline-block w-2 h-2 rounded-full bg-red-500"></span>
                                    <span className="text-red-600 dark:text-red-400">Sold Out</span>
                                </>
                            ) : (
                                <>
                                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-500/90 ring-2 ring-emerald-500/15"></span>
                                    <span className="text-emerald-700 dark:text-emerald-400">In Stock</span>
                                </>
                            )}
                        </div>

                        {/* Quantity */}
                        {!isVariantOutOfStock && (
                            <div className="space-y-2">
                                <label className="text-[10px] uppercase font-black text-sffl-navy dark:text-gray-400 tracking-wider block">Quantity</label>
                                <div className="inline-flex items-center border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800/40">
                                    <button
                                        type="button"
                                        onClick={() => setQuantity(prev => Math.max(1, prev - 1))}
                                        className="px-3 py-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm font-bold"
                                    >
                                        −
                                    </button>
                                    <span className="px-3 text-sm font-bold text-gray-900 dark:text-white">{quantity}</span>
                                    <button
                                        type="button"
                                        onClick={() => setQuantity(prev => Math.min(activeStock, prev + 1))}
                                        className="px-3 py-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm font-bold"
                                    >
                                        +
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* CTAs — Amazon-style two-button stack: yellow Add to
                            Cart on top, red Buy Now below for the impatient. */}
                        <div className="space-y-2">
                            {isVariantOutOfStock ? (
                                <button
                                    disabled
                                    className="w-full bg-gray-200 dark:bg-gray-700 text-gray-500 py-2.5 rounded-full font-bold text-xs uppercase tracking-wider cursor-not-allowed shadow-sm"
                                >
                                    Out of Stock
                                </button>
                            ) : (
                                <>
                                    <button
                                        type="button"
                                        onClick={handleAddToCart}
                                        aria-live="polite"
                                        className={`w-full py-2.5 rounded-full font-bold text-xs uppercase tracking-wider transition-all transform active:scale-95 shadow-md ${
                                            addedToast
                                                ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                                                : 'bg-amber-400 hover:bg-amber-500 text-sffl-navy'
                                        }`}
                                    >
                                        {addedToast ? `✓ ${addedToast}` : 'Add to Cart'}
                                    </button>
                                    <button
                                        onClick={handleBuyNow}
                                        className="w-full bg-sffl-red hover:bg-red-700 text-white py-2.5 rounded-full font-bold text-xs uppercase tracking-wider transition-all transform active:scale-95 shadow-md hover:shadow-sffl-red/20"
                                    >
                                        Buy Now →
                                    </button>
                                </>
                            )}
                            <p className="text-center text-[10px] text-sffl-navy dark:text-gray-400 font-bold uppercase tracking-wider flex items-center justify-center gap-1.5">
                                <span className="text-sffl-red">🔒</span> Secured by Paystack
                            </p>
                        </div>

                        {/* Share button — Amazon-style meta action below the CTA. */}
                        <div className="pt-4 border-t dark:border-gray-700/40">
                            <button
                                type="button"
                                onClick={handleShare}
                                aria-live="polite"
                                className={`inline-flex items-center gap-2 text-xs font-bold transition-colors ${
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
                        </div>

                        {/* Policy links — generous vertical rhythm, no horizontal
                            crowding. Each line is one sentence, the policy name
                            opens a modal. */}
                        <div className="pt-4 border-t dark:border-gray-700/40 space-y-3 text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                            <p>
                                Returns accepted within 15 days. See our{' '}
                                <button
                                    type="button"
                                    onClick={() => setOpenPolicy('return')}
                                    className="text-sffl-navy dark:text-white underline underline-offset-2 hover:text-sffl-red font-bold"
                                >
                                    Return Policy
                                </button>.
                            </p>
                            <p>
                                Ships within 2–3 business days. View{' '}
                                <button
                                    type="button"
                                    onClick={() => setOpenPolicy('shipping')}
                                    className="text-sffl-navy dark:text-white underline underline-offset-2 hover:text-sffl-red font-bold"
                                >
                                    Shipping Policy
                                </button>.
                            </p>
                            <p>
                                Your data is protected. Read our{' '}
                                <button
                                    type="button"
                                    onClick={() => setOpenPolicy('privacy')}
                                    className="text-sffl-navy dark:text-white underline underline-offset-2 hover:text-sffl-red font-bold"
                                >
                                    Privacy Policy
                                </button>.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Middle bottom (cols 4-9): Description + reviews preview.
                    Share + policy links live in the buy box on the right
                    (matches Amazon's right-rail meta info). */}
                <div className="lg:col-span-6 lg:col-start-4 space-y-8">
                    <div className="space-y-2">
                        <h3 className="text-xs uppercase font-black text-sffl-navy dark:text-gray-400 tracking-wider">Description</h3>
                        {product.description?.trim() ? (
                            <ProductDescription text={product.description} />
                        ) : (
                            <p className="text-base font-medium text-gray-800 dark:text-gray-300 leading-relaxed">
                                Exclusive official Showtime Flag Football premium gear. Durable threadwork engineered for dynamic durability and athletic performance.
                            </p>
                        )}
                    </div>

                    {/* Reviews preview: shows 2 latest reviews + a "see all" link
                        to the dedicated page. When there are no reviews yet, we
                        still surface the entry point so a verified customer can
                        write the first one. */}
                    <div className="space-y-4 pt-6 border-t dark:border-gray-700/40">
                        <div className="flex items-center justify-between gap-4">
                            <h3 className="text-xs uppercase font-black text-sffl-navy dark:text-gray-400 tracking-wider">
                                Customer Reviews
                            </h3>
                            <Link
                                to={`/store/products/${product.id}/reviews`}
                                className="text-xs font-black uppercase tracking-wider text-sffl-red hover:underline"
                            >
                                {product.rating_count > 0 ? `See all ${product.rating_count}` : 'Write a review'} →
                            </Link>
                        </div>

                        {product.rating_count > 0 && (
                            <div className="flex items-center gap-3">
                                <StarRating value={product.rating_avg} size="md" />
                                <span className="text-lg font-black text-sffl-navy dark:text-white">{(product.rating_avg ?? 0).toFixed(1)}</span>
                                <span className="text-sm text-gray-500">out of 5 · {product.rating_count} review{product.rating_count === 1 ? '' : 's'}</span>
                            </div>
                        )}

                        {!reviewsPreview?.data?.length ? (
                            <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                                No reviews yet. Be the first to share your experience after you receive this item.
                            </p>
                        ) : (
                            <div className="space-y-4">
                                {reviewsPreview.data.map(r => (
                                    <div key={r.id} className="bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-700/60 rounded-2xl p-4 space-y-2">
                                        <div className="flex items-center gap-3 flex-wrap">
                                            <StarRating value={r.rating} size="sm" />
                                            {r.title && <span className="font-black text-sm text-sffl-navy dark:text-white">{r.title}</span>}
                                        </div>
                                        <div className="flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400 font-bold">
                                            <span>{r.user_name}</span>
                                            {r.verified_purchase && (
                                                <span className="text-emerald-600 dark:text-emerald-400">· ✓ Verified Purchase</span>
                                            )}
                                            <span className="text-gray-400">· {new Date(r.created_at).toLocaleDateString()}</span>
                                        </div>
                                        {r.body && (
                                            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line">{r.body}</p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
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
