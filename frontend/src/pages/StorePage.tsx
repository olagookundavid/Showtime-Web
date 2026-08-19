import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getStoreProducts, type StoreProduct } from '../services/api';
import { LazyImage } from '../components/common/LazyImage';
import { getAvailableStock } from '../utils/storeStock';
import { StarRating } from '../components/store/StarRating';

type GroupByOption = 'ALL' | 'TAGS' | 'DATE';

const STANDARD_TAGS = ['Jerseys', 'Merch', 'Books', 'Others'];

export const StorePage = () => {
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedTag, setSelectedTag] = useState('All');
    const [groupBy, setGroupBy] = useState<GroupByOption>('ALL');

    const { data: products = [], isLoading } = useQuery<StoreProduct[]>({
        queryKey: ['storeProducts'],
        queryFn: getStoreProducts,
    });

    // Extract all unique tags present across available products
    const allAvailableTags = useMemo(() => {
        const set = new Set<string>(STANDARD_TAGS);
        products.forEach(p => {
            if (p.tags && Array.isArray(p.tags)) {
                p.tags.forEach(t => {
                    if (t.trim()) set.add(t.trim());
                });
            }
        });
        return ['All', ...Array.from(set)];
    }, [products]);

    // Filter products by search query and selected tag
    const filteredProducts = useMemo(() => {
        return products.filter(product => {
            // Search filter
            const matchesSearch =
                product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (product.description && product.description.toLowerCase().includes(searchQuery.toLowerCase()));

            if (!matchesSearch) return false;

            // Tag filter
            if (selectedTag === 'All') return true;
            
            const productTags = product.tags || [];
            if (selectedTag === 'Others') {
                return productTags.includes('Others') || productTags.length === 0;
            }
            return productTags.includes(selectedTag);
        });
    }, [products, searchQuery, selectedTag]);

    // Grouping by Tag logic
    const groupedByTags = useMemo(() => {
        if (groupBy !== 'TAGS') return [];

        const tagMap = new Map<string, StoreProduct[]>();

        // Initialize entries for active tags
        const relevantTags = selectedTag === 'All'
            ? allAvailableTags.filter(t => t !== 'All')
            : [selectedTag];

        relevantTags.forEach(t => tagMap.set(t, []));

        filteredProducts.forEach(product => {
            const tags = product.tags && product.tags.length > 0 ? product.tags : ['Others'];
            tags.forEach(tag => {
                if (tagMap.has(tag)) {
                    tagMap.get(tag)!.push(product);
                } else if (selectedTag === 'All') {
                    tagMap.set(tag, [product]);
                }
            });
        });

        // Convert map to array, filtering out empty groups
        return Array.from(tagMap.entries())
            .map(([tag, itemGroup]) => ({ tag, items: itemGroup }))
            .filter(group => group.items.length > 0);
    }, [filteredProducts, groupBy, selectedTag, allAvailableTags]);

    // Grouping by Date logic
    const groupedByDate = useMemo(() => {
        if (groupBy !== 'DATE') return [];

        const now = new Date().getTime();
        const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
        const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

        const newArrivals: StoreProduct[] = [];
        const recentReleases: StoreProduct[] = [];
        const classicDrops: StoreProduct[] = [];

        filteredProducts.forEach(p => {
            const createdAt = new Date(p.created_at).getTime();
            const diff = now - createdAt;
            if (diff <= SEVEN_DAYS) {
                newArrivals.push(p);
            } else if (diff <= THIRTY_DAYS) {
                recentReleases.push(p);
            } else {
                classicDrops.push(p);
            }
        });

        const groups = [];
        if (newArrivals.length > 0) {
            groups.push({ title: '🔥 New Arrivals (Last 7 Days)', items: newArrivals });
        }
        if (recentReleases.length > 0) {
            groups.push({ title: '✨ Recent Drops (Last 30 Days)', items: recentReleases });
        }
        if (classicDrops.length > 0) {
            groups.push({ title: '📦 Classic Drops', items: classicDrops });
        }
        return groups;
    }, [filteredProducts, groupBy]);

    const getPrimaryImage = (product: StoreProduct) => {
        if (!product.images || product.images.length === 0) return null;
        const primary = product.images.find(img => img.is_primary);
        return primary ? primary.image_url : product.images[0].image_url;
    };

    const renderProductCard = (product: StoreProduct) => {
        const imgUrl = getPrimaryImage(product);
        const available = getAvailableStock(product);
        const isOutOfStock = available === 0;
        const isLowStock = !isOutOfStock && available <= product.threshold;

        return (
            <div
                key={product.id}
                onClick={() => !isOutOfStock && navigate(`/store/products/${product.id}`)}
                className={`group relative flex flex-col bg-white dark:bg-gray-800/30 rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-700/50 shadow-md hover:shadow-xl dark:hover:border-sffl-red/30 transition-all duration-300 transform hover:-translate-y-1 ${
                    isOutOfStock ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
                }`}
            >
                {/* Image and Badges */}
                <div className="relative aspect-square w-full overflow-hidden bg-gray-50 dark:bg-gray-900/50 flex items-center justify-center border-b dark:border-gray-700/30">
                    {imgUrl ? (
                        <LazyImage
                            src={imgUrl}
                            alt={product.name}
                            objectFit="contain"
                            className="group-hover:scale-105 p-3"
                        />
                    ) : (
                        <div className="text-gray-400 font-bold tracking-widest text-xs select-none">
                            SHOWTIME GEAR
                        </div>
                    )}

                    {/* Stock Badge */}
                    {isOutOfStock ? (
                        <span className="absolute top-3 left-3 bg-red-600 text-white font-black text-[9px] uppercase tracking-wider px-2 py-1 rounded-md shadow z-10">
                            Sold Out
                        </span>
                    ) : isLowStock ? (
                        <span className="absolute top-3 left-3 bg-yellow-500 text-black font-black text-[9px] uppercase tracking-wider px-2 py-1 rounded-md shadow z-10">
                            Low Stock
                        </span>
                    ) : null}

                    {/* Glass Overlay Hover Effect */}
                    {!isOutOfStock && (
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center backdrop-blur-[2px]">
                            <span className="bg-white text-sffl-navy font-bold text-xs uppercase px-4 py-2 rounded-xl shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                                View Product
                            </span>
                        </div>
                    )}
                </div>

                {/* Details Container */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-2">
                    <div className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                            <h3 className="font-bold text-gray-900 dark:text-white group-hover:text-sffl-red transition-colors line-clamp-1">
                                {product.name}
                            </h3>
                        </div>

                        {/* Product Tags */}
                        {product.tags && product.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 py-0.5">
                                {product.tags.map(t => (
                                    <span key={t} className="bg-sffl-red/10 text-sffl-red text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                                        {t}
                                    </span>
                                ))}
                            </div>
                        )}

                        {product.rating_count > 0 && (
                            <div className="flex items-center gap-1.5 pt-0.5">
                                <StarRating value={product.rating_avg ?? 0} size="sm" />
                                <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400">({product.rating_count})</span>
                            </div>
                        )}
                        <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 min-h-[2rem]">
                            {product.description || 'Official Showtime Flag Football merchandise.'}
                        </p>
                    </div>
                    <div className="flex items-center justify-between pt-1">
                        <span className="text-base font-black text-sffl-navy dark:text-white">
                            ₦{product.price.toLocaleString()}
                        </span>
                        {isOutOfStock ? (
                            <span className="text-xs font-bold text-red-500">Unavailable</span>
                        ) : (
                            <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wide bg-emerald-500/10 dark:bg-emerald-500/5 px-2 py-0.5 rounded-md">
                                In Stock
                            </span>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-8 animate-fadeIn">
            {/* Immersive Glassmorphic Banner */}
            <div className="relative overflow-hidden rounded-3xl shadow-2xl border border-white/10 bg-sffl-navy min-h-[280px] md:min-h-[340px]">
                {/* Hero background photo */}
                <div
                    className="absolute inset-0 bg-cover bg-center"
                    style={{ backgroundImage: 'url(/images/branding/store-hero.jpg)' }}
                    aria-hidden="true"
                />
                <div
                    className="absolute inset-0 bg-gradient-to-r from-sffl-navy/95 via-sffl-navy/80 to-sffl-navy/30 md:to-transparent"
                    aria-hidden="true"
                />
                <div className="absolute top-0 right-0 w-64 h-64 bg-sffl-red/20 rounded-full blur-3xl -mr-20 -mt-20" aria-hidden="true" />

                <div className="relative z-10 space-y-4 max-w-2xl p-8 md:p-12">
                    <div className="inline-flex items-center gap-1.5 bg-sffl-red/10 border border-sffl-red/30 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-black text-sffl-red uppercase tracking-wider">
                        <span>⚡</span> OFFICIAL SHOWTIME MERCHANDISE
                    </div>
                    <h1 className="text-4xl md:text-6xl font-black italic tracking-tighter text-white uppercase leading-none drop-shadow-lg">
                        Gear Up For <span className="text-sffl-red">Showtime</span>
                    </h1>
                    <p className="text-sm md:text-base text-gray-200 drop-shadow">
                        Official team jerseys, high-performance training wear, books, custom hoodies, caps, and exclusive league drops.
                    </p>
                </div>
            </div>

            {/* Filter, Search, and Grouping Control Bar */}
            <div className="space-y-4 bg-white/5 dark:bg-gray-800/40 backdrop-blur-md border border-white/5 p-4 md:p-6 rounded-3xl shadow-lg">
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                    {/* Search Field */}
                    <div className="relative w-full md:w-80">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                            🔍
                        </span>
                        <input
                            type="text"
                            placeholder="Search gear..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 dark:border-gray-700/60 rounded-xl bg-white dark:bg-gray-800/50 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sffl-red/50 transition-all"
                        />
                    </div>

                    {/* Group By Selector */}
                    <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                            Group By:
                        </span>
                        <div className="inline-flex p-1 bg-gray-100 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                            <button
                                onClick={() => setGroupBy('ALL')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                    groupBy === 'ALL'
                                        ? 'bg-sffl-navy dark:bg-sffl-red text-white shadow'
                                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                }`}
                            >
                                All Products
                            </button>
                            <button
                                onClick={() => setGroupBy('TAGS')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                    groupBy === 'TAGS'
                                        ? 'bg-sffl-navy dark:bg-sffl-red text-white shadow'
                                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                }`}
                            >
                                🏷️ Tags
                            </button>
                            <button
                                onClick={() => setGroupBy('DATE')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                    groupBy === 'DATE'
                                        ? 'bg-sffl-navy dark:bg-sffl-red text-white shadow'
                                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                }`}
                            >
                                📅 Creation Date
                            </button>
                        </div>
                    </div>
                </div>

                {/* Tag Filter Pills */}
                <div className="pt-2 border-t border-gray-100 dark:border-gray-700/40 flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mr-1">
                        Filter:
                    </span>
                    {allAvailableTags.map(tag => {
                        const isSelected = selectedTag === tag;
                        return (
                            <button
                                key={tag}
                                onClick={() => setSelectedTag(tag)}
                                className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                                    isSelected
                                        ? 'bg-sffl-red text-white shadow-md scale-105'
                                        : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-sffl-red/40 hover:text-sffl-red'
                                }`}
                            >
                                {tag === 'All' ? '🌐 All Tags' : `🏷️ ${tag}`}
                            </button>
                        );
                    })}
                </div>

                <div className="text-xs font-bold text-gray-500 uppercase tracking-wider pt-1">
                    {filteredProducts.length} {filteredProducts.length === 1 ? 'item' : 'items'} found
                    {selectedTag !== 'All' && ` in "${selectedTag}"`}
                </div>
            </div>

            {/* Catalog Display */}
            {isLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {[1, 2, 3, 4].map(idx => (
                        <div key={idx} className="bg-white/5 dark:bg-gray-800/20 border border-white/5 rounded-2xl h-80 animate-pulse flex flex-col justify-end p-4 space-y-3">
                            <div className="h-44 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
                            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
                            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
                        </div>
                    ))}
                </div>
            ) : filteredProducts.length === 0 ? (
                /* Empty State */
                <div className="flex flex-col items-center justify-center py-20 text-center space-y-6 max-w-md mx-auto">
                    <div className="relative w-28 h-28 bg-gradient-to-br from-sffl-navy to-black rounded-3xl border border-white/10 flex items-center justify-center shadow-xl">
                        <div className="absolute inset-0 bg-sffl-red/20 rounded-3xl blur-xl animate-pulse"></div>
                        <span className="text-5xl relative z-10">📦</span>
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-2xl font-black text-sffl-navy dark:text-white uppercase italic tracking-tight">No Products Found</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            No merchandise matches your selected tag filter or search query. Try switching tag filters!
                        </p>
                    </div>
                    <button
                        onClick={() => { setSelectedTag('All'); setSearchQuery(''); }}
                        className="bg-sffl-navy hover:bg-sffl-red text-white text-xs font-bold uppercase tracking-wider px-6 py-3 rounded-full shadow-lg transition-all"
                    >
                        Reset Filters
                    </button>
                </div>
            ) : groupBy === 'TAGS' ? (
                /* Grouped By Tags View */
                <div className="space-y-10">
                    {groupedByTags.map(({ tag, items }) => (
                        <section key={tag} className="space-y-4">
                            <div className="flex items-center gap-3 border-b-2 border-sffl-red/20 pb-3">
                                <span className="text-2xl">🏷️</span>
                                <h2 className="text-2xl font-black italic tracking-tight text-sffl-navy dark:text-white uppercase">
                                    {tag}
                                </h2>
                                <span className="bg-sffl-red text-white text-xs font-black px-2.5 py-0.5 rounded-full shadow-sm">
                                    {items.length} {items.length === 1 ? 'item' : 'items'}
                                </span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                                {items.map(renderProductCard)}
                            </div>
                        </section>
                    ))}
                </div>
            ) : groupBy === 'DATE' ? (
                /* Grouped By Date View */
                <div className="space-y-10">
                    {groupedByDate.map(({ title, items }) => (
                        <section key={title} className="space-y-4">
                            <div className="flex items-center gap-3 border-b-2 border-sffl-red/20 pb-3">
                                <h2 className="text-2xl font-black italic tracking-tight text-sffl-navy dark:text-white uppercase">
                                    {title}
                                </h2>
                                <span className="bg-sffl-navy dark:bg-sffl-red text-white text-xs font-black px-2.5 py-0.5 rounded-full shadow-sm">
                                    {items.length} {items.length === 1 ? 'item' : 'items'}
                                </span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                                {items.map(renderProductCard)}
                            </div>
                        </section>
                    ))}
                </div>
            ) : (
                /* Default Flat Grid View */
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {filteredProducts.map(renderProductCard)}
                </div>
            )}

            {/* Informational grid footer */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-8 border-t border-gray-100 dark:border-gray-700/40">
                <div className="bg-white/5 dark:bg-gray-800/20 border border-white/5 p-6 rounded-2xl space-y-2">
                    <h3 className="font-bold text-sm text-sffl-navy dark:text-white">🚚 Swift Delivery</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        Reliable shipping across Lagos and regional locations. Orders typically ship within 3-5 business days with live tracking details.
                    </p>
                </div>
                <div className="bg-white/5 dark:bg-gray-800/20 border border-white/5 p-6 rounded-2xl space-y-2">
                    <h3 className="font-bold text-sm text-sffl-navy dark:text-white">💳 Paystack Secured</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        Integrated native checking powered securely by Paystack. We process Visa, Mastercard, Verve, and direct electronic transfers safely.
                    </p>
                </div>
                <div className="bg-white/5 dark:bg-gray-800/20 border border-white/5 p-6 rounded-2xl space-y-2">
                    <h3 className="font-bold text-sm text-sffl-navy dark:text-white">🛡️ Genuine Merchandise</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        All clothing products are official Showtime Flag Football items. Fully certified athletic wear ensuring premium thread comfort.
                    </p>
                </div>
            </div>
        </div>
    );
};
