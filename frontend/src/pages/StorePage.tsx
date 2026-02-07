export const StorePage = () => {
    return (
        <div className="max-w-5xl mx-auto space-y-8">
            {/* Header */}
            <div className="bg-gradient-to-r from-sffl-red to-sffl-navy text-white p-12 rounded-3xl shadow-2xl text-center">
                <h1 className="text-5xl font-black italic tracking-tight mb-4">SHOWTIME STORE</h1>
                <p className="text-xl text-gray-200">Official merchandise and gear</p>
            </div>

            {/* Store Preview */}
            <section className="bg-white p-10 rounded-2xl shadow-lg text-center space-y-6">
                <div className="inline-block bg-sffl-navy text-white px-6 py-2 rounded-full text-sm font-bold uppercase tracking-wide">
                    Official Merch
                </div>

                <h2 className="text-3xl font-bold text-sffl-navy">
                    Get Your Showtime Gear
                </h2>

                <p className="text-gray-600 max-w-2xl mx-auto text-lg leading-relaxed">
                    Support your favorite team and represent the Showtime Flag Football League
                    with official jerseys, hoodies, caps, and more. All proceeds support the league.
                </p>

                {/* Featured Items Preview (Mock) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
                    <div className="bg-gray-100 p-6 rounded-xl">
                        <div className="h-48 bg-gray-300 rounded-lg mb-4 flex items-center justify-center text-gray-500 font-bold">
                            JERSEY
                        </div>
                        <p className="font-bold text-sffl-navy">Official Team Jersey</p>
                        <p className="text-sffl-red font-bold text-xl mt-2">₦15,000</p>
                    </div>
                    <div className="bg-gray-100 p-6 rounded-xl">
                        <div className="h-48 bg-gray-300 rounded-lg mb-4 flex items-center justify-center text-gray-500 font-bold">
                            HOODIE
                        </div>
                        <p className="font-bold text-sffl-navy">Showtime Hoodie</p>
                        <p className="text-sffl-red font-bold text-xl mt-2">₦12,000</p>
                    </div>
                    <div className="bg-gray-100 p-6 rounded-xl">
                        <div className="h-48 bg-gray-300 rounded-lg mb-4 flex items-center justify-center text-gray-500 font-bold">
                            CAP
                        </div>
                        <p className="font-bold text-sffl-navy">Snapback Cap</p>
                        <p className="text-sffl-red font-bold text-xl mt-2">₦5,000</p>
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
