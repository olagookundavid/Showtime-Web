export const Education = () => {
    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div className="bg-sffl-navy text-white p-8 rounded-2xl shadow-xl">
                <h1 className="text-4xl font-black italic">FLAG FOOTBALL EDUCATION</h1>
                <p className="text-gray-300 mt-2">Learn, train, and improve your game</p>
            </div>

            <section className="bg-white p-8 rounded-xl shadow-md space-y-6">
                <h2 className="text-2xl font-bold text-sffl-red">Player Development Programs</h2>
                <p className="text-gray-700">
                    SFFL is committed to developing flag football talent at all levels. We offer
                    training programs, clinics, and educational resources for players, coaches,
                    and officials.
                </p>

                <div className="grid md:grid-cols-2 gap-6 mt-6">
                    <div className="bg-gray-100 p-6 rounded-xl">
                        <h3 className="font-bold text-lg text-sffl-navy mb-3">🏈 Skills Clinics</h3>
                        <p className="text-gray-700 text-sm">
                            Regular training sessions covering throwing mechanics, route running,
                            defensive techniques, and game strategy.
                        </p>
                    </div>

                    <div className="bg-gray-100 p-6 rounded-xl">
                        <h3 className="font-bold text-lg text-sffl-navy mb-3">👨‍🏫 Coaching Courses</h3>
                        <p className="text-gray-700 text-sm">
                            Certification programs for aspiring coaches covering game planning,
                            player development, and leadership.
                        </p>
                    </div>

                    <div className="bg-gray-100 p-6 rounded-xl">
                        <h3 className="font-bold text-lg text-sffl-navy mb-3">⚖️ Officiating Training</h3>
                        <p className="text-gray-700 text-sm">
                            Learn the rules and mechanics of flag football officiating.
                            Certified referees are always in demand.
                        </p>
                    </div>

                    <div className="bg-gray-100 p-6 rounded-xl">
                        <h3 className="font-bold text-lg text-sffl-navy mb-3">📚 Resources</h3>
                        <p className="text-gray-700 text-sm">
                            Access to playbooks, training videos, and educational materials
                            for continuous improvement.
                        </p>
                    </div>
                </div>

                <div className="bg-sffl-navy text-white p-6 rounded-xl mt-8">
                    <h3 className="font-bold text-xl mb-3">Youth Development</h3>
                    <p className="text-gray-300">
                        We believe in building the future of flag football. Our youth programs
                        introduce younger players to the fundamentals of the game in a fun,
                        safe environment.
                    </p>
                </div>

                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-6">
                    <h3 className="font-bold text-sffl-navy mb-2">Coming Soon</h3>
                    <p className="text-gray-700">
                        We're developing an online learning platform with video tutorials,
                        drills, and training programs. Stay tuned for updates!
                    </p>
                </div>

                <div className="text-center mt-8">
                    <p className="text-gray-600 mb-4">Interested in our educational programs?</p>
                    <button className="bg-sffl-red hover:bg-red-700 text-white font-bold py-3 px-8 rounded-full transition">
                        Contact Us
                    </button>
                </div>
            </section>
        </div>
    );
};
