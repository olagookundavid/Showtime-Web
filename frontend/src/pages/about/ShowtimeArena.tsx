export const ShowtimeArena = () => {
    return (
        <div className="max-w-6xl mx-auto space-y-8">
            <div className="bg-sffl-navy text-white p-4 md:p-8 rounded-xl md:rounded-2xl shadow-xl">
                <h1 className="text-3xl md:text-5xl font-black italic tracking-tighter">SHOWTIME ARENA</h1>
                <p className="text-gray-300 mt-2">Home of the SFFL</p>
            </div>

            <section className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-md space-y-6">
                <h2 className="text-2xl font-bold text-sffl-red">Experience the Game Night</h2>
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed text-lg">
                    Located at <strong>Meadow Hall Way, Alma Beach Estate, Lekki</strong>, the Showtime Arena
                    is the premier destination for flag football in Lagos.
                </p>

                <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                    Designed for both high-performance sports and entertainment, the arena offers a unique
                    atmosphere where fans can enjoy evening games under the stars.
                </p>

                <div className="grid md:grid-cols-2 gap-6 mt-6">
                    <div className="bg-gray-100 dark:bg-gray-700 p-6 rounded-xl">
                        <h3 className="font-bold text-xl text-sffl-navy mb-3">🏟️ World-Class Pitch</h3>
                        <p className="text-gray-700 dark:text-gray-300">
                            A professional-grade turf field with floodlights, allowing for exciting
                            night games and excellent visibility for players and spectators.
                        </p>
                    </div>

                    <div className="bg-gray-100 dark:bg-gray-700 p-6 rounded-xl">
                        <h3 className="font-bold text-xl text-sffl-navy mb-3">🍻 Showtime Bar & Food</h3>
                        <p className="text-gray-700 dark:text-gray-300">
                            Enjoy food and drinks at our dedicated vendor area. The Showtime Bar
                            ensures you stay refreshed while cheering for your team.
                        </p>
                    </div>

                    <div className="bg-gray-100 dark:bg-gray-700 p-6 rounded-xl">
                        <h3 className="font-bold text-xl text-sffl-navy mb-3">🚗 Ample Parking</h3>
                        <p className="text-gray-700 dark:text-gray-300">
                            Spacious and secure parking facilities are available for all attendees,
                            making your game day experience stress-free.
                        </p>
                    </div>

                    <div className="bg-gray-100 dark:bg-gray-700 p-6 rounded-xl">
                        <h3 className="font-bold text-xl text-sffl-navy mb-3">🎥 Media Ready</h3>
                        <p className="text-gray-700 dark:text-gray-300">
                            Dedicated zones for media coverage, photographers, and content creators
                            to capture every highlight.
                        </p>
                    </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6 mt-8">
                    <a
                        href="https://maps.app.goo.gl/9vP7Rgc18gVyTSdW6"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-sffl-red hover:bg-red-700 text-white font-bold py-4 px-6 rounded-xl text-center transition transform hover:scale-105 shadow-lg flex items-center justify-center gap-2"
                    >
                        <span>📍</span>
                        <span>Navigate to Arena</span>
                    </a>

                    <a
                        href="https://docs.google.com/forms/d/e/1FAIpQLSfXTuLAF4_Nis1rlqBU7nlOH_7Mh_rRlj6yT0Hnu_kSc1N0-w/viewform?usp=dialog"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-sffl-navy hover:bg-blue-900 text-white font-bold py-4 px-6 rounded-xl text-center transition transform hover:scale-105 shadow-lg flex items-center justify-center gap-2"
                    >
                        <span>📝</span>
                        <span>Book the Arena</span>
                    </a>
                </div>
            </section>
        </div>
    );
};
