import { CopyableEmail } from '../../components/common/CopyableEmail';

export const Sponsorships = () => {
    return (
        <div className="space-y-4 md:space-y-8 pb-12">
            <div className="bg-sffl-navy text-white p-10 rounded-3xl shadow-2xl relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-sffl-red/30 to-sffl-navy/40" />
                <h1 className="text-3xl md:text-5xl font-black italic tracking-tighter relative z-10">PARTNERSHIPS & SPONSORSHIPS</h1>
            </div>

            <section className="bg-white dark:bg-gray-800 p-10 rounded-3xl shadow-xl relative overflow-hidden">
                <h2 className="text-3xl font-black text-sffl-navy dark:text-white mb-6">SPONSORSHIPS</h2>

                <div className="prose prose-lg dark:prose-invert max-w-none text-gray-700 dark:text-gray-300">
                    <p className="font-medium text-xl text-sffl-navy dark:text-blue-400 mb-6">
                        Showtime offers premium partnership opportunities across live events, digital platforms, media integration, and community development initiatives.
                    </p>
                    <p className="mb-8">
                        As The Standard of Co-Ed Flag Football, we provide more than brand visibility. What we offer is cultural positioning within a fast-growing, youth-forward sports ecosystem.
                    </p>

                    <div className="bg-gray-50 dark:bg-gray-900/50 p-8 rounded-2xl border border-gray-100 dark:border-gray-700">
                        <h3 className="font-bold text-lg text-sffl-navy dark:text-white mb-4">Partnership opportunities include:</h3>
                        <ul className="grid md:grid-cols-2 gap-4 list-none p-0 m-0">
                            {[
                                'Title Sponsorship',
                                'Season Partnerships',
                                'Game-Day Activations',
                                'Digital & Media Integration',
                                'Product Placement & On-Site Experience',
                                'Community & Development Program Sponsorship'
                            ].map((item, i) => (
                                <li key={i} className="flex items-center gap-3 m-0 p-0 text-base font-semibold">
                                    <span className="text-sffl-red text-xl">✓</span> {item}
                                </li>
                            ))}
                        </ul>
                    </div>

                    <p className="font-black text-xl text-center text-sffl-navy dark:text-white mt-8 italic">
                        Showtime is where brands align with competition, culture, and credibility.
                    </p>
                    <div className="flex justify-center mt-6">
                        <CopyableEmail email="showtime@sffl.football" label="Request Deck at:" className="bg-gray-100 dark:bg-gray-800 text-sffl-navy dark:text-white px-6 py-3 rounded-full border border-gray-200 dark:border-gray-700 shadow-sm" />
                    </div>
                </div>
            </section>
        </div>
    );
};
