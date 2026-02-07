export const MediaGuidelines = () => {
    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div className="bg-sffl-navy text-white p-8 rounded-2xl shadow-xl">
                <h1 className="text-4xl font-black italic">MEDIA & CONTENT GUIDELINES</h1>
                <p className="text-gray-300 mt-2">For creators, photographers, and media partners</p>
            </div>

            <section className="bg-white p-8 rounded-xl shadow-md prose prose-lg max-w-none">
                <h2 className="text-2xl font-bold text-sffl-red">Photography & Videography</h2>
                <p className="text-gray-700">
                    We welcome media coverage and content creation at SFFL events. All photographers
                    and videographers must register with league officials before the event begins.
                </p>

                <h3 className="text-xl font-bold text-sffl-navy mt-6">Guidelines:</h3>
                <ul className="text-gray-700 space-y-2">
                    <li>All media personnel must check in at the registration desk</li>
                    <li>Media badges will be provided and must be worn at all times</li>
                    <li>Respect player and official privacy during breaks</li>
                    <li>Do not interfere with gameplay or officials</li>
                    <li>Designated media zones will be marked on the field</li>
                </ul>

                <h2 className="text-2xl font-bold text-sffl-red mt-8">Social Media Policy</h2>
                <p className="text-gray-700">
                    When posting content from SFFL games, please tag @showtimeflag and use the
                    official hashtag #ShowtimeFlag. We encourage sharing and celebrating our players
                    and the excitement of the game.
                </p>

                <h3 className="text-xl font-bold text-sffl-navy mt-6">Content Usage:</h3>
                <ul className="text-gray-700 space-y-2">
                    <li>Tag SFFL official accounts in all posts</li>
                    <li>Use hashtag #ShowtimeFlag</li>
                    <li>Respect player image rights</li>
                    <li>No unauthorized commercial use of league content</li>
                </ul>

                <h2 className="text-2xl font-bold text-sffl-red mt-8">Press & Interviews</h2>
                <p className="text-gray-700">
                    Media requests for player and coach interviews should be coordinated through
                    the league office. Contact us at media@sffl.football to arrange interviews.
                </p>

                <div className="bg-sffl-navy text-white p-6 rounded-xl mt-8">
                    <h3 className="font-bold text-xl mb-2">Contact</h3>
                    <p className="text-gray-300">
                        For media inquiries and partnerships: <br />
                        <a href="mailto:media@sffl.football" className="text-sffl-red hover:underline">
                            media@sffl.football
                        </a>
                    </p>
                </div>
            </section>
        </div>
    );
};
