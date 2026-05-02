import { FAQSection } from './FAQSection';

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
                    <h1 className="text-3xl md:text-5xl font-black italic tracking-tighter">ABOUT SHOWTIME</h1>
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
                            To build a structured, professional, and commercially viable flag football ecosystem that develops athletes, delivers high-quality sporting experiences, and creates meaningful opportunities for partners, communities, and the next generation of talent.
                        </p>
                    </section>

                    <section className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl border-l-8 border-blue-600 hover:-translate-y-1 transition duration-300">
                        <h2 className="text-2xl font-black text-sffl-navy dark:text-white mb-4 flex items-center gap-3">
                            <span className="text-3xl">👁️</span> VISION
                        </h2>
                        <p className="text-lg text-gray-700 dark:text-gray-300 leading-relaxed font-medium">
                            To become the leading flag football platform in the World and a globally recognized standard for how emerging sports are organized, experienced, and scaled.
                        </p>
                    </section>
                </div>

                {/* About Us */}
                <section className="bg-gradient-to-br from-sffl-navy to-blue-900 text-white p-8 rounded-2xl shadow-xl">
                    <h2 className="text-2xl font-black italic mb-6">ABOUT US</h2>
                    <div className="space-y-4 text-gray-200 leading-relaxed">
                        <p>
                            Showtime Flag is a premier flag football platform built to grow the sport, develop athletes, and create a new culture of competitive sport entertainment in Nigeria.
                        </p>
                        <p>
                            Founded with a clear belief that sport can be both a business and a movement, Showtime Flag brings together athletes, fans, brands, schools, communities, and media through organized leagues, tournaments, training programs, and high-quality sporting experiences.
                        </p>
                        <p>
                            At the heart of Showtime Flag is a simple mission: to make flag football accessible, aspirational, and commercially viable.
                        </p>
                        <p className="font-bold text-white text-lg mt-6 pt-6 border-t border-white/20">
                            We are building more than a league. We are building an ecosystem where athletes can compete, brands can connect with youth culture, and communities can experience sport in a fresh, energetic, and inclusive way.
                        </p>
                    </div>
                </section>
            </div>



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
