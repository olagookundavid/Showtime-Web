export const ShowtimeByelaws = () => {
    return (
        <div className="max-w-6xl mx-auto space-y-8">
            <div className="bg-sffl-navy text-white p-4 md:p-8 rounded-xl md:rounded-2xl shadow-xl">
                <h1 className="text-3xl md:text-5xl font-black italic tracking-tighter">SHOWTIME BYELAWS & CONSTITUTION</h1>
                <p className="text-gray-300 mt-2">League governance and regulations</p>
            </div>

            <section className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-md space-y-6">
                <div className="bg-gradient-to-r from-sffl-navy to-sffl-red text-white p-6 rounded-xl">
                    <h2 className="text-2xl font-bold mb-2">Official Document</h2>
                    <p className="text-gray-100 mb-4">
                        Download the complete Showtime Byelaws and Constitution for full details on
                        league governance, membership, and regulations.
                    </p>
                    <a
                        href="http://images.leaguerepublic.com/data/editor-docs/350033916/1751668190326-showtime_bye_laws_and_constitution.pdf"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 bg-white text-sffl-navy font-bold py-3 px-6 rounded-lg hover:bg-gray-100 transition"
                    >
                        <span>📥</span>
                        <span>Download Byelaws (PDF)</span>
                    </a>
                </div>

                <h2 className="text-2xl font-bold text-sffl-navy dark:text-white">Key Provisions</h2>

                <div className="space-y-6">
                    <div>
                        <h3 className="font-bold text-lg text-sffl-red mb-2">League Structure</h3>
                        <p className="text-gray-700 dark:text-gray-300">
                            The Showtime Flag Football League is organized as a member-based organization
                            governed by the Commissioner, Executive Board, and Team Representatives.
                        </p>
                    </div>

                    <div>
                        <h3 className="font-bold text-lg text-sffl-red mb-2">Membership</h3>
                        <p className="text-gray-700 dark:text-gray-300">
                            All teams and players must comply with league membership requirements,
                            including registration, fees, and conduct standards.
                        </p>
                    </div>

                    <div>
                        <h3 className="font-bold text-lg text-sffl-red mb-2">Code of Conduct</h3>
                        <p className="text-gray-700 dark:text-gray-300">
                            All participants are expected to uphold the highest standards of
                            sportsmanship, respect, and fair play. Violations may result in
                            suspension or expulsion from the league.
                        </p>
                    </div>

                    <div>
                        <h3 className="font-bold text-lg text-sffl-red mb-2">Dispute Resolution</h3>
                        <p className="text-gray-700 dark:text-gray-300">
                            The league has established procedures for handling disputes, protests,
                            and appeals. All decisions by the Commissioner and Executive Board are final.
                        </p>
                    </div>

                    <div>
                        <h3 className="font-bold text-lg text-sffl-red mb-2">Amendments</h3>
                        <p className="text-gray-700 dark:text-gray-300">
                            Byelaws may be amended by a majority vote of the Executive Board with
                            input from team representatives. All members will be notified of changes.
                        </p>
                    </div>
                </div>

                <div className="bg-yellow-50 dark:bg-yellow-900/30 border-l-4 border-yellow-400 p-6 mt-8">
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                        <strong>Important:</strong> All team captains and registered players are
                        responsible for reading and understanding the complete byelaws. Ignorance
                        of the rules does not constitute grounds for appeal.
                    </p>
                </div>
            </section>
        </div>
    );
};
