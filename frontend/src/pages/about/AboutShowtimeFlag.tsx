import { FAQSection } from './FAQSection';
import { CopyableEmail } from '../../components/common/CopyableEmail';

export const AboutShowtimeFlag = () => {
    return (
        <div className="max-w-6xl mx-auto space-y-12 pb-12">
            {/* Header Area */}
            <div className="bg-sffl-navy text-white p-10 rounded-3xl shadow-2xl flex flex-col md:flex-row items-center gap-8 relative overflow-hidden">
                <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?q=80&w=2069&auto=format&fit=crop')] bg-cover bg-center opacity-10" />

                <img
                    src="https://images.leaguerepublic.com/data/images/738010788/107.png"
                    alt="SFFL Logo"
                    className="w-40 h-40 object-contain bg-white rounded-full p-4 shadow-xl z-10"
                />
                <div className="z-10 text-center md:text-left">
                    <h1 className="text-5xl md:text-6xl font-black italic tracking-tight">ABOUT SHOWTIME</h1>
                    <p className="text-xl text-gray-300 mt-4 font-semibold uppercase tracking-widest">The Standard of Co-Ed Flag Football</p>
                </div>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
                {/* Mission & Vision */}
                <div className="space-y-8">
                    <section className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl border-l-8 border-sffl-red hover:-translate-y-1 transition duration-300">
                        <h2 className="text-2xl font-black text-sffl-navy dark:text-white mb-4 flex items-center gap-3">
                            <span className="text-3xl">🎯</span> MISSION
                        </h2>
                        <p className="text-lg text-gray-700 dark:text-gray-300 leading-relaxed font-medium">
                            To define the highest standard of competition and spectacle in co-ed flag football.
                        </p>
                    </section>

                    <section className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl border-l-8 border-blue-600 hover:-translate-y-1 transition duration-300">
                        <h2 className="text-2xl font-black text-sffl-navy dark:text-white mb-4 flex items-center gap-3">
                            <span className="text-3xl">👁️</span> VISION
                        </h2>
                        <p className="text-lg text-gray-700 dark:text-gray-300 leading-relaxed font-medium">
                            To build a lasting sports institution where elite co-ed competition, cultural energy, and professional excellence unite to shape the future of flag football.
                        </p>
                    </section>
                </div>

                {/* About Us */}
                <section className="bg-gradient-to-br from-sffl-navy to-blue-900 text-white p-8 rounded-2xl shadow-xl">
                    <h2 className="text-2xl font-black italic mb-6">ABOUT US</h2>
                    <div className="space-y-4 text-gray-200 leading-relaxed">
                        <p>
                            Showtime Flag is a performance-driven sports institution and cultural platform rooted in Lagos, Nigeria.
                        </p>
                        <p>
                            Founded in mid-2023 as The Lagos Flag Football League by Azeez Amida, the league was rebranded in 2024 to reflect its growing ambition, not only to host games, but to define the highest standard of co-ed flag football.
                        </p>
                        <p>
                            Today, Showtime operates as a structured competitive ecosystem. Through initiatives like Showtime Streetz — our scouting program — and Showtime Pro — our intensive athlete development platform — we identify, train, and elevate talent into the Showtime player pipeline.
                        </p>
                        <p className="font-bold text-white text-lg mt-6 pt-6 border-t border-white/20">
                            Every season, Showtime transforms Sundays into a destination experience where elite co-ed competition meets curated spectacle. What began as a league has evolved into an institution built on excellence, structure, and the belief that sport, culture, and opportunity can rise together.
                        </p>
                    </div>
                </section>
            </div>

            {/* Sponsorships */}
            <section className="bg-white dark:bg-gray-800 p-10 rounded-3xl shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-sffl-red/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                <h2 className="text-3xl font-black text-sffl-navy dark:text-white mb-6 relative z-10">SPONSORSHIPS</h2>

                <div className="prose prose-lg dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 relative z-10">
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

            {/* Incubator Program */}
            <section className="bg-gradient-to-r from-gray-900 to-sffl-navy text-white p-10 rounded-3xl shadow-xl overflow-hidden relative">
                <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?q=80&w=2069&auto=format&fit=crop')] bg-cover bg-center opacity-20 mix-blend-overlay" />
                <div className="relative z-10">
                    <div className="inline-block bg-sffl-red text-white text-xs font-black px-3 py-1 rounded-full uppercase tracking-widest mb-4">Development</div>
                    <h2 className="text-4xl font-black italic mb-6">THE SHOWTIME INCUBATOR PROGRAM</h2>

                    <div className="space-y-6 text-lg text-gray-200 lg:w-3/4">
                        <p className="font-semibold text-xl text-white">
                            The Showtime Incubator is our talent and ecosystem development platform.
                        </p>
                        <p>
                            Designed to identify, train, and elevate athletes and future leaders within the sport, the Incubator creates a structured pathway for growth and exposure.
                        </p>
                        <p>
                            Through performance camps, strategic training programs, mentorship, and media visibility initiatives, the Incubator ensures a consistent pipeline of high-level talent operating under professional standards.
                        </p>
                        <p className="border-l-4 border-sffl-red pl-4 py-2 mt-8 font-medium">
                            It reflects our long-term commitment to sustaining excellence, institutional integrity, and the continued growth of co-ed flag football.
                        </p>
                    </div>
                </div>
            </section>

            {/* FAQs */}
            <FAQSection />
        </div>
    );
};
