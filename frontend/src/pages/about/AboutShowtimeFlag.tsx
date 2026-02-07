export const AboutShowtimeFlag = () => {
    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div className="bg-sffl-navy text-white p-8 rounded-2xl shadow-xl">
                <h1 className="text-4xl font-black italic">ABOUT SHOWTIME FLAG</h1>
                <p className="text-gray-300 mt-2">The premier flag football league</p>
            </div>

            <section className="bg-white p-8 rounded-xl shadow-md prose prose-lg max-w-none">
                <h2 className="text-2xl font-bold text-sffl-red">Our Mission</h2>
                <p className="text-gray-700">
                    Lorem ipsum dolor sit amet, consectetur adipiscing elit. Showtime Flag Football
                    League (SFFL) is dedicated to promoting competitive, safe, and exciting flag football
                    across Lagos and beyond. We provide a platform for athletes to showcase their skills,
                    build camaraderie, and experience the thrill of the game.
                </p>

                <h2 className="text-2xl font-bold text-sffl-red mt-8">League History</h2>
                <p className="text-gray-700">
                    Founded in [YEAR], SFFL has grown from a small community league to one of the
                    most recognized flag football organizations in Nigeria. Our commitment to excellence,
                    fair play, and community engagement has made us the league of choice for players
                    and fans alike.
                </p>

                <h2 className="text-2xl font-bold text-sffl-red mt-8">What We Offer</h2>
                <ul className="text-gray-700 space-y-2">
                    <li>Competitive league play with multiple divisions</li>
                    <li>Professional officiating and rule enforcement</li>
                    <li>State-of-the-art facilities at Showtime Arena</li>
                    <li>Player development programs and clinics</li>
                    <li>Community events and fan engagement</li>
                </ul>

                <h2 className="text-2xl font-bold text-sffl-red mt-8">Join Us</h2>
                <p className="text-gray-700">
                    Whether you're a seasoned athlete or new to flag football, SFFL welcomes you.
                    Contact us to learn about team registration, player recruitment, or sponsorship
                    opportunities.
                </p>
            </section>
        </div>
    );
};
