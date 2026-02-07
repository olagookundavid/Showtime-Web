export const LandingPage = () => {
    return (
        <div className="space-y-12">
            {/* Hero Section */}
            <section className="relative bg-sffl-navy text-white py-20 px-6 rounded-3xl overflow-hidden shadow-2xl">
                <div className="absolute inset-0 bg-gradient-to-r from-sffl-navy to-transparent opacity-90 z-10"></div>
                {/* Placeholder for background image */}
                <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?q=80&w=2069&auto=format&fit=crop')] bg-cover bg-center opacity-40"></div>

                <div className="relative z-20 max-w-2xl">
                    <h1 className="text-5xl md:text-7xl font-black italic tracking-tighter mb-6">
                        THIS IS <br />
                        <span className="text-sffl-red">SHOWTIME</span>
                    </h1>
                    <p className="text-xl md:text-2xl text-gray-200 mb-8 font-light">
                        The elite flag football league. <br />
                        Witness the speed, strategy, and spectacle.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4">
                        <button className="bg-sffl-red hover:bg-red-700 text-white font-bold py-3 px-8 rounded-full transition transform hover:scale-105 shadow-lg uppercase tracking-wide">
                            View Schedule
                        </button>
                        <button className="bg-white hover:bg-gray-100 text-sffl-navy font-bold py-3 px-8 rounded-full transition transform hover:scale-105 shadow-lg uppercase tracking-wide">
                            Latest Standings
                        </button>
                    </div>
                </div>
            </section>

            {/* Latest Scores Mockup */}
            <section>
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-3xl font-bold italic text-sffl-navy">LATEST RESULTS</h2>
                    <a href="/schedule" className="text-sffl-red font-semibold hover:underline">View All &rarr;</a>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Mock Score Card 1 */}
                    <div className="bg-white p-6 rounded-xl shadow-md border-l-4 border-sffl-red hover:shadow-xl transition">
                        <div className="text-gray-500 text-xs font-bold uppercase mb-2">Week 5 - Finished</div>
                        <div className="flex justify-between items-center mb-2">
                            <span className="font-bold text-xl">Outlaws</span>
                            <span className="font-black text-2xl text-sffl-navy">24</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="font-bold text-xl text-gray-600">Dragons</span>
                            <span className="font-black text-2xl text-gray-600">18</span>
                        </div>
                    </div>

                    {/* Mock Score Card 2 */}
                    <div className="bg-white p-6 rounded-xl shadow-md border-l-4 border-sffl-navy hover:shadow-xl transition">
                        <div className="text-gray-500 text-xs font-bold uppercase mb-2">Week 5 - Finished</div>
                        <div className="flex justify-between items-center mb-2">
                            <span className="font-bold text-xl">Spartans</span>
                            <span className="font-black text-2xl text-sffl-navy">30</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="font-bold text-xl text-gray-600">Titans</span>
                            <span className="font-black text-2xl text-gray-600">30</span>
                        </div>
                        <div className="mt-2 text-xs text-sffl-red font-bold uppercase text-right">Overtime</div>
                    </div>

                    {/* Mock Score Card 3 */}
                    <div className="bg-white p-6 rounded-xl shadow-md border-l-4 border-sffl-red hover:shadow-xl transition">
                        <div className="text-gray-500 text-xs font-bold uppercase mb-2">Week 5 - Finished</div>
                        <div className="flex justify-between items-center mb-2">
                            <span className="font-bold text-xl">Vipers</span>
                            <span className="font-black text-2xl text-sffl-navy">12</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="font-bold text-xl text-gray-600">Rebels</span>
                            <span className="font-black text-2xl text-gray-600">6</span>
                        </div>
                    </div>
                </div>
            </section>

            {/* News/Engagement Placeholder */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-sffl-navy text-white p-8 rounded-2xl shadow-xl">
                    <h3 className="text-2xl font-bold italic mb-4">COMMISSIONER'S NOTE</h3>
                    <p className="text-gray-300 mb-4">
                        "Week 5 showed us that the competition is fiercer than ever. New regulations regarding defensive setups will be enforced starting Week 6 to ensure fair play..."
                    </p>
                    <button className="text-sffl-red font-bold hover:text-white transition">Read Full Update</button>
                </div>
                <div className="bg-white p-8 rounded-2xl shadow-xl">
                    <h3 className="text-2xl font-bold italic text-sffl-navy mb-4">PLAYER OF THE WEEK</h3>
                    <div className="flex items-center gap-6">
                        <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center font-bold text-gray-400">IMG</div>
                        <div>
                            <div className="text-3xl font-black text-sffl-red">J. SMITH</div>
                            <div className="text-gray-600 font-bold uppercase">QB - Outlaws</div>
                            <div className="mt-2 text-sm text-gray-500">4 TDs, 0 INT, 250 Yds</div>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
};
