import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getStoreProduct, type StoreProduct, type ProductVariant } from '../services/api';
import { LazyImage } from '../components/common/LazyImage';

export const ProductDetailPage = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [quantity, setQuantity] = useState(1);
    const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
    const [activeImageIndex, setActiveImageIndex] = useState(0);

    const { data: product, isLoading, error } = useQuery<StoreProduct>({
        queryKey: ['storeProduct', id],
        queryFn: () => getStoreProduct(id || ''),
        enabled: !!id,
    });

    // Group variant values by option name (e.g. Size: ['M', 'L']).
    // Memoized so the dependency array of the auto-select effect is stable.
    const optionCategories = useMemo<Record<string, string[]>>(() => {
        const map: Record<string, string[]> = {};
        product?.variants?.forEach((v: ProductVariant) => {
            if (!map[v.variant_name]) map[v.variant_name] = [];
            if (!map[v.variant_name].includes(v.variant_value)) {
                map[v.variant_name].push(v.variant_value);
            }
        });
        return map;
    }, [product]);

    // Auto-select the first value for any unset option category once the product loads.
    useEffect(() => {
        const categories = Object.keys(optionCategories);
        if (categories.length === 0) return;
        setSelectedOptions(prev => {
            const next = { ...prev };
            let changed = false;
            for (const cat of categories) {
                if (!next[cat] && optionCategories[cat].length > 0) {
                    next[cat] = optionCategories[cat][0];
                    changed = true;
                }
            }
            return changed ? next : prev;
        });
    }, [optionCategories]);

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

    const categoriesList = Object.keys(optionCategories);

    // Each variant is a single (name, value) pair in the schema, so find the
    // variant matching the user's selection for that variant's category.
    const matchedVariant = product.variants?.find((v: ProductVariant) =>
        selectedOptions[v.variant_name] === v.variant_value
    );

    // Calculate active price and stock
    const activePrice = matchedVariant && matchedVariant.price > 0 ? matchedVariant.price : product.price;
    const activeStock = matchedVariant ? matchedVariant.quantity : product.quantity;
    const isVariantOutOfStock = activeStock === 0;

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
                                className="select-none"
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
                                    className={`relative w-20 h-20 rounded-xl overflow-hidden bg-gray-100 border-2 flex-shrink-0 transition-all ${
                                        activeImageIndex === idx ? 'border-sffl-red scale-95 shadow-md' : 'border-transparent hover:border-gray-300 dark:hover:border-gray-600'
                                    }`}
                                >
                                    <LazyImage src={img.image_url} alt="" />
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Right: Dynamic Product Options & Shopping Info */}
                <div className="lg:col-span-5 flex flex-col justify-between space-y-6">
                    <div className="space-y-6">
                        {/* Name and Price */}
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

                        {/* Description */}
                        <div className="space-y-2">
                            <h3 className="text-xs uppercase font-bold text-gray-400 tracking-wider">Description</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                                {product.description || 'Exclusive official Showtime Flag Football premium gear. Durable threadwork engineered for dynamic durability and athletic performance.'}
                            </p>
                        </div>

                        {/* Options Selectors */}
                        {categoriesList.length > 0 && (
                            <div className="space-y-4 pt-2 border-t dark:border-gray-700/40">
                                {categoriesList.map(categoryName => (
                                    <div key={categoryName} className="space-y-2">
                                        <label className="text-xs uppercase font-black text-sffl-navy dark:text-gray-400 tracking-wider">
                                            Select {categoryName}
                                        </label>
                                        <div className="flex flex-wrap gap-2">
                                            {optionCategories[categoryName].map(categoryVal => {
                                                const isSelected = selectedOptions[categoryName] === categoryVal;
                                                return (
                                                    <button
                                                        key={categoryVal}
                                                        onClick={() => setSelectedOptions({
                                                            ...selectedOptions,
                                                            [categoryName]: categoryVal
                                                        })}
                                                        className={`px-4 py-2 text-xs font-bold rounded-xl border transition-all uppercase ${
                                                            isSelected
                                                                ? 'bg-sffl-navy border-sffl-navy text-white dark:bg-white dark:border-white dark:text-sffl-navy shadow-md'
                                                                : 'bg-white dark:bg-gray-800/40 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-400 dark:hover:border-gray-500'
                                                        }`}
                                                    >
                                                        {categoryVal}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Quantity Selector */}
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
                    </div>

                    {/* Action Panel */}
                    <div className="pt-6 border-t dark:border-gray-700/40 space-y-4">
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
                        <p className="text-center text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider flex items-center justify-center gap-1.5">
                            <span className="text-sffl-red">🔒</span> Secure payment options managed safely by Paystack.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
