export const MediaGuidelines = () => {
    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div className="bg-sffl-navy text-white p-8 rounded-2xl shadow-xl">
                <h1 className="text-4xl font-black italic">MEDIA & CONTENT CREATOR GUIDELINES</h1>
                <p className="text-gray-300 mt-2">Accreditation Framework</p>
            </div>

            <section className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-md space-y-6 text-gray-700 dark:text-gray-300 leading-relaxed">
                <div className="bg-gray-100 dark:bg-gray-700 p-6 rounded-lg border-l-4 border-sffl-red">
                    <h2 className="text-xl font-bold text-sffl-navy dark:text-white mb-2">Purpose</h2>
                    <p>
                        The SFFL Media Accreditation Framework ensures a professional and organized environment for
                        journalists, photographers, and content creators coverage of league events.
                    </p>
                </div>

                <h2 className="text-2xl font-bold text-sffl-navy dark:text-white mt-6">Accreditation Requirement</h2>
                <p>
                    All media personnel and content creators wishing to cover SFFL games for commercial or
                    public distribution must be accredited by the league. Accreditation provides access to
                    designated media zones and post-game interview areas.
                </p>

                <h3 className="text-xl font-bold text-sffl-navy dark:text-white mt-6">Usage Rules</h3>
                <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>
                        <strong>Identification:</strong> Accredited media must wear provided bibs or media passes
                        at all times while on the field level.
                    </li>
                    <li>
                        <strong>Zones:</strong> Photography and videography are restricted to designated media zones.
                        Do not enter the team bench areas or the playing field during live action.
                    </li>
                    <li>
                        <strong>Privacy:</strong> Respect the privacy of players and officials during injury timeouts
                        or private team discussions.
                    </li>
                </ul>

                <h3 className="text-xl font-bold text-sffl-navy dark:text-white mt-6">Content Restrictions</h3>
                <div className="grid md:grid-cols-2 gap-4">
                    <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                        <strong className="block text-sffl-red mb-1">Game Footage</strong>
                        <p className="text-sm">
                            External media are permitted to record game highlights but cannot broadcast full matches live.
                            Individual clips should not exceed 10 minutes without prior written consent.
                        </p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                        <strong className="block text-sffl-red mb-1">Commercial Use</strong>
                        <p className="text-sm">
                            Images and video captured at SFFL events cannot be sold or used for commercial
                            advertising without a licensing agreement from the league.
                        </p>
                    </div>
                </div>

                <div className="bg-sffl-navy text-white p-6 rounded-xl mt-8">
                    <h3 className="font-bold text-xl mb-2">Apply for Accreditation</h3>
                    <p className="text-gray-300 mb-4">
                        To request media credentials for upcoming games, please contact our media department
                        at least 48 hours before kickoff.
                    </p>
                    <a href="mailto:media@sffl.football" className="inline-flex items-center gap-2 text-sffl-red font-bold hover:underline bg-white px-4 py-2 rounded-lg">
                        ✉️ media@sffl.football
                    </a>
                </div>
            </section>
        </div>
    );
};
