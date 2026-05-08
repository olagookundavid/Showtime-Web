export const StorePage = () => {
    return (
        <div className="max-w-6xl mx-auto space-y-4 md:space-y-8">
            {/* Header - Condensed */}
            <div className="bg-sffl-navy text-white p-4 md:p-8 rounded-xl md:rounded-2xl shadow-xl flex flex-col md:flex-row justify-between items-center">
                <div>
                    <h1 className="text-3xl md:text-5xl font-black italic tracking-tighter">STORE</h1>
                    <p className="text-sm md:text-lg text-gray-300 mt-1">Official merchandise and gear</p>
                </div>
            </div>

            {/* Store Preview - High Density */}
            <section className="bg-white dark:bg-gray-800 p-4 md:p-10 rounded-xl md:rounded-2xl shadow-lg text-center space-y-4 md:space-y-6">
                <div className="inline-block bg-sffl-navy text-white px-4 py-1.5 md:px-6 md:py-2 rounded-full text-[10px] md:text-sm font-bold uppercase tracking-wide">
                    Official Merch
                </div>

                <h2 className="text-xl md:text-3xl font-bold text-sffl-navy dark:text-white">
                    Get Your Gear
                </h2>

                <p className="text-gray-600 dark:text-gray-300 max-w-2xl mx-auto text-sm md:text-lg leading-relaxed">
                    Official jerseys, hoodies, caps, and more. All proceeds support the league.
                </p>

                {/* Featured Items Preview - Grid cols 2 for mobile */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-6 mt-4 md:mt-8">
                    <div className="bg-gray-100 dark:bg-gray-700 p-3 md:p-6 rounded-xl">
                        <div className="h-24 md:h-48 bg-gray-300 dark:bg-gray-600 rounded-lg mb-2 md:mb-4 flex items-center justify-center text-[10px] md:text-gray-400 font-bold">
                            JERSEY
                        </div>
                        <p className="font-bold text-[10px] md:text-base text-sffl-navy dark:text-white">Team Jersey</p>
                        <p className="text-sffl-red font-bold text-xs md:text-xl mt-1 md:mt-2">₦15,000</p>
                    </div>
                    <div className="bg-gray-100 dark:bg-gray-700 p-3 md:p-6 rounded-xl">
                        <div className="h-24 md:h-48 bg-gray-300 dark:bg-gray-600 rounded-lg mb-2 md:mb-4 flex items-center justify-center text-[10px] md:text-gray-400 font-bold">
                            HOODIE
                        </div>
                        <p className="font-bold text-[10px] md:text-base text-sffl-navy dark:text-white">Showtime Hoodie</p>
                        <p className="text-sffl-red font-bold text-xs md:text-xl mt-1 md:mt-2">₦12,000</p>
                    </div>
                    <div className="bg-gray-100 dark:bg-gray-700 p-3 md:p-6 rounded-xl">
                        <div className="h-24 md:h-48 bg-gray-300 dark:bg-gray-600 rounded-lg mb-2 md:mb-4 flex items-center justify-center text-[10px] md:text-gray-400 font-bold">
                            CAP
                        </div>
                        <p className="font-bold text-[10px] md:text-base text-sffl-navy dark:text-white">Snapback Cap</p>
                        <p className="text-sffl-red font-bold text-xs md:text-xl mt-1 md:mt-2">₦5,000</p>
                    </div>
                </div>

                {/* CTA Button */}
                <a
                    href="http://pke0b3-ew.myshopify.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-8 bg-sffl-red hover:bg-red-700 text-white font-black py-4 px-12 rounded-full text-lg uppercase tracking-wide transition transform hover:scale-105 shadow-xl"
                >
                    Shop Now →
                </a>

                <p className="text-sm text-gray-500 mt-4">
                    You will be redirected to our official Shopify store
                </p>
            </section>

            {/* Info Section */}
            <section className="grid md:grid-cols-2 gap-6">
                <div className="bg-sffl-navy text-white p-6 rounded-xl">
                    <h3 className="font-bold text-xl mb-3">🚚 Delivery</h3>
                    <p className="text-gray-300">
                        Fast shipping across Lagos. Orders typically arrive within 3-5 business days.
                    </p>
                </div>
                <div className="bg-sffl-navy text-white p-6 rounded-xl">
                    <h3 className="font-bold text-xl mb-3">💳 Payment</h3>
                    <p className="text-gray-300">
                        Secure checkout via Shopify. We accept cards, transfers, and cash on delivery.
                    </p>
                </div>
            </section>
        </div>
    );
};
