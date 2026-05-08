export const OurTeam = () => {
    return (
        <div className="max-w-6xl mx-auto space-y-4 md:space-y-8 pb-12">
            <div className="bg-sffl-navy text-white p-10 rounded-3xl shadow-2xl relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-sffl-red/20 to-blue-900/30" />
                <div className="relative z-10 text-center md:text-left">
                    <h1 className="text-3xl md:text-5xl font-black italic tracking-tighter">OUR TEAM</h1>
                    <p className="text-xl text-gray-300 mt-4 font-semibold uppercase tracking-widest">Showtime Leadership & Ownership</p>
                </div>
            </div>

            <section className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl text-center">
                <p className="text-lg text-gray-600 dark:text-gray-400">Team configurations are currently undergoing management reviews.</p>
            </section>
        </div>
    );
};
