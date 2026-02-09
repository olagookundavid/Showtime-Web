import { HeroCarousel } from '../components/HeroCarousel';
import { Link } from 'react-router-dom';

export const LandingPage = () => {
    return (
        <div className="space-y-12">
            {/* Main Hero Section */}
            <section className="relative bg-gradient-to-r from-sffl-navy to-sffl-red text-white p-12 md:p-20 rounded-3xl shadow-2xl overflow-hidden">
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-10 left-10 w-32 h-32 bg-white rounded-full blur-3xl"></div>
                    <div className="absolute bottom-10 right-10 w-48 h-48 bg-white rounded-full blur-3xl"></div>
                </div>
                <div className="relative z-10 max-w-3xl">
                    <h1 className="text-5xl md:text-7xl font-black italic mb-6 tracking-tight leading-tight">
                        WELCOME TO SHOWTIME FLAG FOOTBALL
                    </h1>
                    <p className="text-xl md:text-2xl text-gray-100 mb-8 leading-relaxed">
                        Experience the thrill of flag football in Lagos. Fast-paced action, fierce competition, and unforgettable moments.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4">
                        <Link
                            to="/schedule"
                            className="bg-sffl-red hover:bg-red-700 text-white font-bold py-3 px-8 rounded-full transition transform hover:scale-105 shadow-lg uppercase tracking-wide text-center"
                        >
                            View Schedule
                        </Link>
                        <Link
                            to="/standings"
                            className="bg-white hover:bg-gray-100 text-sffl-navy font-bold py-3 px-8 rounded-full transition transform hover:scale-105 shadow-lg uppercase tracking-wide text-center"
                        >
                            Latest Standings
                        </Link>
                    </div>
                </div>
            </section>

            {/* Promotional Carousel */}
            <HeroCarousel />

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
                    <Link to="/commissioners-note" className="text-sffl-red font-bold hover:text-white transition">Read Full Update</Link>
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
