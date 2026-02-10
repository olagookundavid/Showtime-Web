

export const FAQ = () => {
    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div className="bg-sffl-navy text-white p-8 rounded-2xl shadow-xl">
                <h1 className="text-4xl font-black italic">FREQUENTLY ASKED QUESTIONS</h1>
                <p className="text-gray-300 mt-2">Everything you need to know</p>
            </div>

            <section className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-md space-y-8 text-center">
                <div className="max-w-2xl mx-auto">
                    <h2 className="text-2xl font-bold text-sffl-navy dark:text-white mb-4">2025 Season Guide</h2>
                    <p className="text-gray-700 dark:text-gray-300 mb-8">
                        We have compiled a comprehensive FAQ document "We Are Back" that covers all details
                        regarding the new season, team registration, rules, and what to expect.
                    </p>

                    <a
                        href="https://images.leaguerepublic.com/data/editor-docs/350033916/1737454491811-we_are_back_3.pdf"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block bg-sffl-red hover:bg-red-700 text-white font-black text-xl py-4 px-10 rounded-full transition transform hover:scale-105 shadow-xl"
                    >
                        Download FAQ Guide (PDF)
                    </a>
                </div>

                <div className="border-t pt-8 mt-8">
                    <h3 className="font-bold text-xl text-sffl-navy dark:text-white mb-4">Common Questions</h3>
                    <div className="text-left space-y-4 max-w-3xl mx-auto">
                        <details className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg group">
                            <summary className="font-bold cursor-pointer text-sffl-navy dark:text-white list-none flex justify-between items-center">
                                How can I join a team?
                                <span className="text-sffl-red text-xl group-open:rotate-45 transition-transform">+</span>
                            </summary>
                            <p className="mt-2 text-gray-700 dark:text-gray-100">
                                You can contact existing teams via their social media pages or attend our open
                                tryout events. Follow our social media for announcements.
                            </p>
                        </details>

                        <details className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg group">
                            <summary className="font-bold cursor-pointer text-sffl-navy dark:text-white list-none flex justify-between items-center">
                                Where are the games played?
                                <span className="text-sffl-red text-xl group-open:rotate-45 transition-transform">+</span>
                            </summary>
                            <p className="mt-2 text-gray-700 dark:text-gray-100">
                                All games are played at the <a href="/about/arena" className="text-sffl-red hover:underline">Showtime Arena</a>
                                in Lekki, Lagos.
                            </p>
                        </details>

                        <details className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg group">
                            <summary className="font-bold cursor-pointer text-sffl-navy dark:text-white list-none flex justify-between items-center">
                                Is there an entry fee for spectators?
                                <span className="text-sffl-red text-xl group-open:rotate-45 transition-transform">+</span>
                            </summary>
                            <p className="mt-2 text-gray-700 dark:text-gray-100">
                                General entry is usually free, but certain special events or VIP sections may require tickets.
                                Check the specific game day details.
                            </p>
                        </details>
                    </div>
                </div>
            </section>
        </div>
    );
};
