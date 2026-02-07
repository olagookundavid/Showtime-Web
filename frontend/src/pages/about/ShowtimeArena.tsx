export const ShowtimeArena = () => {
    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div className="bg-sffl-navy text-white p-8 rounded-2xl shadow-xl">
                <h1 className="text-4xl font-black italic">SHOWTIME ARENA</h1>
                <p className="text-gray-300 mt-2">Our home field</p>
            </div>

            <section className="bg-white p-8 rounded-xl shadow-md space-y-6">
                <h2 className="text-2xl font-bold text-sffl-red">Venue Information</h2>
                <p className="text-gray-700 leading-relaxed">
                    Showtime Arena is the premier flag football facility in Lagos, featuring a
                    regulation-size field, professional lighting, and spectator seating. All SFFL
                    league matches are held at this state-of-the-art venue.
                </p>

                <div className="bg-gray-100 p-6 rounded-lg space-y-4">
                    <h3 className="font-bold text-xl text-sffl-navy">Facilities</h3>
                    <ul className="text-gray-700 space-y-2 list-disc list-inside">
                        <li>Regulation flag football field</li>
                        <li>Professional lighting for evening games</li>
                        <li>Covered spectator area</li>
                        <li>Player locker rooms</li>
                        <li>Refreshment stands</li>
                        <li>Ample parking</li>
                    </ul>
                </div>

                <div className="grid md:grid-cols-2 gap-6 mt-8">
                    <a
                        href="https://maps.app.goo.gl/9vP7Rgc18gVyTSdW6"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-sffl-red hover:bg-red-700 text-white font-bold py-4 px-6 rounded-xl text-center transition transform hover:scale-105 shadow-lg flex items-center justify-center gap-2"
                    >
                        <span>📍</span>
                        <span>View on Google Maps</span>
                    </a>

                    <a
                        href="https://docs.google.com/forms/d/e/1FAIpQLSfXTuLAF4_Nis1rlqBU7nlOH_7Mh_rRlj6yT0Hnu_kSc1N0-w/viewform"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-sffl-navy hover:bg-blue-900 text-white font-bold py-4 px-6 rounded-xl text-center transition transform hover:scale-105 shadow-lg flex items-center justify-center gap-2"
                    >
                        <span>📝</span>
                        <span>Book the Arena</span>
                    </a>
                </div>

                <div className="bg-sffl-navy text-white p-6 rounded-xl mt-8">
                    <h3 className="font-bold text-xl mb-3">Rental & Events</h3>
                    <p className="text-gray-300">
                        Showtime Arena is available for private events, training sessions, and
                        tournaments. Click the "Book the Arena" button above to submit a booking request.
                    </p>
                </div>
            </section>
        </div>
    );
};
