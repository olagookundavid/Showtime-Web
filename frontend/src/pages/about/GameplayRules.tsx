export const GameplayRules = () => {
    return (
        <div className="max-w-6xl mx-auto space-y-8">
            <div className="bg-sffl-navy text-white p-4 md:p-8 rounded-xl md:rounded-2xl shadow-xl">
                <h1 className="text-3xl md:text-5xl font-black italic tracking-tighter">GAMEPLAY RULES</h1>
                <p className="text-gray-300 mt-2">Official Showtime Flag Football League rules</p>
            </div>

            <section className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-md space-y-6">
                <div className="bg-sffl-red text-white p-6 rounded-xl">
                    <h2 className="text-2xl font-bold mb-2">Official Rule Book</h2>
                    <p className="text-gray-100 mb-4">
                        For the complete and official rules, please download the full rule book below.
                    </p>
                    <a
                        href="https://images.leaguerepublic.com/data/editor-docs/350033916/1758027708066-showtime_flag_rule_book2025_1.pdf"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 bg-white text-sffl-red font-bold py-3 px-6 rounded-lg hover:bg-gray-100 transition"
                    >
                        <span>📥</span>
                        <span>Download Rule Book (PDF)</span>
                    </a>
                </div>

                <h2 className="text-2xl font-bold text-sffl-navy dark:text-white">Quick Reference</h2>

                <div className="space-y-4">
                    <div className="border-l-4 border-sffl-red pl-4">
                        <h3 className="font-bold text-lg text-sffl-navy dark:text-white">Team Composition</h3>
                        <p className="text-gray-700 dark:text-gray-300">
                            Teams consist of 7 players on the field at a time. A minimum of 5 players
                            is required to start a game.
                        </p>
                    </div>

                    <div className="border-l-4 border-sffl-red pl-4">
                        <h3 className="font-bold text-lg text-sffl-navy dark:text-white">Game Duration</h3>
                        <p className="text-gray-700 dark:text-gray-300">
                            Games are played in two 20-minute halves with a running clock, except for
                            the final 2 minutes of each half.
                        </p>
                    </div>

                    <div className="border-l-4 border-sffl-red pl-4">
                        <h3 className="font-bold text-lg text-sffl-navy dark:text-white">Scoring</h3>
                        <ul className="text-gray-700 dark:text-gray-300 list-disc list-inside space-y-1">
                            <li>Touchdown: 6 points</li>
                            <li>Extra point (from 5 yards): 1 point</li>
                            <li>Extra point (from 10 yards): 2 points</li>
                            <li>Safety: 2 points</li>
                        </ul>
                    </div>

                    <div className="border-l-4 border-sffl-red pl-4">
                        <h3 className="font-bold text-lg text-sffl-navy dark:text-white">Flag Pulling</h3>
                        <p className="text-gray-700 dark:text-gray-300">
                            A legal flag pull occurs when a defensive player removes one flag from the
                            ball carrier. The play ends immediately at the spot of the flag pull.
                        </p>
                    </div>

                    <div className="border-l-4 border-sffl-red pl-4">
                        <h3 className="font-bold text-lg text-sffl-navy dark:text-white">No Contact Rule</h3>
                        <p className="text-gray-700 dark:text-gray-300">
                            Flag football is a non-contact sport. Blocking, tackling, and unnecessary
                            contact will result in penalties.
                        </p>
                    </div>
                </div>

                <div className="bg-gray-100 dark:bg-gray-700 p-6 rounded-xl mt-8">
                    <p className="text-sm text-gray-600 dark:text-gray-400 italic">
                        Note: This is a quick reference only. All official rulings are based on the
                        complete rule book. Teams and players are expected to be familiar with all rules.
                    </p>
                </div>
            </section>
        </div>
    );
};
