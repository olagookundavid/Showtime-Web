export const AboutShowtimeFlag = () => {
    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div className="bg-sffl-navy text-white p-8 rounded-2xl shadow-xl flex flex-col md:flex-row items-center gap-6">
                <img
                    src="https://images.leaguerepublic.com/data/images/738010788/107.png"
                    alt="SFFL Logo"
                    className="w-32 h-32 object-contain bg-white rounded-full p-2"
                />
                <div>
                    <h1 className="text-4xl font-black italic">ABOUT SHOWTIME FLAG</h1>
                    <p className="text-gray-300 mt-2">The Community League</p>
                </div>
            </div>

            <section className="bg-white p-8 rounded-xl shadow-md prose prose-lg max-w-none text-gray-700 leading-relaxed">
                <p>
                    Showtime Flag is more than just a flag football league; it is a vibrant community-building
                    initiative based in Lagos, Nigeria.
                </p>
                <p>
                    Founded in mid-2023 as "The Lagos Flag Football League" by Azeez Amida, the league was
                    rebranded in 2024 to better reflect its growing ambition and cultural impact.
                </p>

                <h2 className="text-2xl font-bold text-sffl-red mt-8">Our Mission</h2>
                <p>
                    Our mission is to create a platform that fosters athleticism, teamwork, and community
                    engagement through the sport of flag football. We aim to bring people together,
                    providing an exciting and safe environment for players and fans alike.
                </p>

                <h2 className="text-2xl font-bold text-sffl-red mt-8">The Showtime Bowl Series</h2>
                <p>
                    The league operates the <strong>Showtime Bowl Series</strong>, a competitive season featuring
                    12 teams battling for supremacy.
                </p>
                <ul className="list-disc pl-5 space-y-2 mt-4">
                    <li>
                        <strong>Regular Season:</strong> All 12 teams compete for seeding.
                    </li>
                    <li>
                        <strong>The Playoffs:</strong> The top 8 teams advance to the knockout stages to fight for the championship.
                    </li>
                    <li>
                        <strong>The Community Cup:</strong> The remaining 4 teams compete in a separate bracket, ensuring competitive games for everyone throughout the season.
                    </li>
                </ul>

                <h2 className="text-2xl font-bold text-sffl-red mt-8">Join the Community</h2>
                <p>
                    Whether you are a player, fan, or partner, Showtime Flag welcomes you. Join us at the
                    Showtime Arena for our next game day and experience the energy of Lagos flag football!
                </p>
            </section>
        </div>
    );
};
