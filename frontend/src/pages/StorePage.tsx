import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getStoreProducts, type StoreProduct } from '../services/api';
import { LazyImage } from '../components/common/LazyImage';
import { getAvailableStock } from '../utils/storeStock';

export const StorePage = () => {
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');

    const { data: products = [], isLoading } = useQuery<StoreProduct[]>({
        queryKey: ['storeProducts'],
        queryFn: getStoreProducts,
    });

    const filteredProducts = products.filter(product =>
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (product.description && product.description.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const getPrimaryImage = (product: StoreProduct) => {
        if (!product.images || product.images.length === 0) return null;
        const primary = product.images.find(img => img.is_primary);
        return primary ? primary.image_url : product.images[0].image_url;
    };

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fadeIn">
            {/* Immersive Glassmorphic Banner */}
            <div className="relative overflow-hidden rounded-3xl shadow-2xl border border-white/10 bg-sffl-navy min-h-[280px] md:min-h-[340px]">
                {/* Hero background photo */}
                <div
                    className="absolute inset-0 bg-cover bg-center"
                    style={{ backgroundImage: 'url(/images/branding/store-hero.jpg)' }}
                    aria-hidden="true"
                />
                {/* Dark gradient overlay — heavier on the left so the headline reads cleanly,
                    fading toward transparent on the right so the photo is visible. */}
                <div
                    className="absolute inset-0 bg-gradient-to-r from-sffl-navy/95 via-sffl-navy/80 to-sffl-navy/30 md:to-transparent"
                    aria-hidden="true"
                />
                {/* Red accent glow */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-sffl-red/20 rounded-full blur-3xl -mr-20 -mt-20" aria-hidden="true" />

                <div className="relative z-10 space-y-4 max-w-2xl p-8 md:p-12">
                    <div className="inline-flex items-center gap-1.5 bg-sffl-red/10 border border-sffl-red/30 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-black text-sffl-red uppercase tracking-wider">
                        <span>⚡</span> OFFICIAL SHOWTIME MERCHANDISE
                    </div>
                    <h1 className="text-4xl md:text-6xl font-black italic tracking-tighter text-white uppercase leading-none drop-shadow-lg">
                        Gear Up For <span className="text-sffl-red">Showtime</span>
                    </h1>
                    <p className="text-sm md:text-base text-gray-200 drop-shadow">
                        Official team jerseys, high-performance training wear, custom hoodies, caps, and exclusive league drops. 100% of proceeds support team expansion.
                    </p>
                </div>
            </div>

            {/* Filter and Navigation bar */}
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white/5 dark:bg-gray-800/40 backdrop-blur-md border border-white/5 p-4 rounded-2xl shadow-lg">
                <div className="relative w-full sm:w-80">
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
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                    {filteredProducts.length} {filteredProducts.length === 1 ? 'item' : 'items'} available
                </div>
            </div>

            {/* Catalog Grid */}
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
            ) : filteredProducts.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {filteredProducts.map((product) => {
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
                                        <span className="absolute top-3 left-3 bg-red-600 text-white font-black text-[9px] uppercase tracking-wider px-2 py-1 rounded-md shadow">
                                            Sold Out
                                        </span>
                                    ) : isLowStock ? (
                                        <span className="absolute top-3 left-3 bg-yellow-500 text-black font-black text-[9px] uppercase tracking-wider px-2 py-1 rounded-md shadow">
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
                                        <h3 className="font-bold text-gray-900 dark:text-white group-hover:text-sffl-red transition-colors line-clamp-1">
                                            {product.name}
                                        </h3>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 min-h-[2rem]">
                                            {product.description || 'Premium official Showtime Flag Football apparel.'}
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
                    })}
                </div>
            ) : (
                /* Elegant centered empty state */
                <div className="flex flex-col items-center justify-center py-20 text-center space-y-6 max-w-md mx-auto">
                    <div className="relative w-28 h-28 bg-gradient-to-br from-sffl-navy to-black rounded-3xl border border-white/10 flex items-center justify-center shadow-xl">
                        <div className="absolute inset-0 bg-sffl-red/20 rounded-3xl blur-xl animate-pulse"></div>
                        <span className="text-5xl relative z-10">📦</span>
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-2xl font-black text-sffl-navy dark:text-white uppercase italic tracking-tight">No Merchandise Yet</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Our team is currently preparing the next drop of team jerseys, custom snapback caps, and player apparel. Follow us for release drops!
                        </p>
                    </div>
                    <button
                        onClick={() => navigate('/')}
                        className="bg-sffl-navy hover:bg-sffl-red text-white text-xs font-bold uppercase tracking-wider px-6 py-3 rounded-full shadow-lg transition-all"
                    >
                        Back to Home
                    </button>
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
