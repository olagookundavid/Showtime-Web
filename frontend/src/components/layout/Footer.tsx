export const Footer = () => {
    return (
        <footer className="bg-sffl-navy text-white p-8 mt-auto">
            <div className="container mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 text-center md:text-left">
                {/* Branding */}
                <div>
                    <h3 className="text-xl font-bold italic mb-4">SHOWTIME WEB</h3>
                    <p className="text-gray-400 text-sm">
                        The premier flag football league.
                        Experience the intensity, the passion, and the glory.
                    </p>
                </div>

                {/* Links */}
                <div className="flex flex-col space-y-2">
                    <h4 className="font-bold uppercase text-sffl-red mb-2">League</h4>
                    <a href="/rules" className="text-gray-300 hover:text-white text-sm">Official Rules</a>
                    <a href="/register" className="text-gray-300 hover:text-white text-sm">Register Team</a>
                    <a href="/referees" className="text-gray-300 hover:text-white text-sm">Referees</a>
                </div>

                {/* Socials / Contact */}
                <div>
                    <h4 className="font-bold uppercase text-sffl-red mb-2">Connect</h4>
                    <p className="text-gray-400 text-sm">Follow us on social media for live updates.</p>
                    <div className="mt-4 flex justify-center md:justify-start space-x-4">
                        {/* Icons placeholders */}
                        <div className="w-8 h-8 bg-gray-700 rounded-full"></div>
                        <div className="w-8 h-8 bg-gray-700 rounded-full"></div>
                        <div className="w-8 h-8 bg-gray-700 rounded-full"></div>
                    </div>
                </div>
            </div>
            <div className="text-center text-gray-600 text-xs mt-8 border-t border-gray-800 pt-4">
                &copy; 2026 Showtime Flag Football League. All rights reserved.
            </div>
        </footer>
    );
};
