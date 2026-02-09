export const Footer = () => {
    return (
        <footer className="bg-sffl-navy text-white p-8 mt-auto">
            <div className="container mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 text-center md:text-left">
                {/* Branding */}
                <div className="flex flex-col items-center md:items-start text-center md:text-left group cursor-pointer">
                    <div className="flex items-center gap-3 mb-4">
                        <img
                            src="https://images.leaguerepublic.com/data/images/738010788/107.png"
                            alt="SFFL Logo"
                            className="w-16 h-16 object-contain bg-white rounded-full p-1 transition-all duration-300 group-hover:scale-125 group-hover:rotate-6 group-hover:shadow-xl"
                        />
                        <span className="text-3xl font-black italic tracking-tighter transition-all duration-300 group-hover:scale-110 group-hover:drop-shadow-[0_0_10px_rgba(220,38,38,0.8)]">
                            SHOWTIME<span className="text-sffl-red">WEB</span>
                        </span>
                    </div>
                    <p className="text-gray-400 text-sm leading-relaxed max-w-xs">
                        The premier flag football league in Lagos. Building community through sport.
                    </p>
                </div>

                {/* Links */}
                <div className="flex flex-col space-y-2">
                    <h4 className="font-bold uppercase text-sffl-red mb-2">League</h4>
                    <a href="/about/rules" className="text-gray-300 hover:text-white text-sm">Official Rules</a>
                    <a href="/about/arena" className="text-gray-300 hover:text-white text-sm">Showtime Arena</a>
                    <a href="/about/faq" className="text-gray-300 hover:text-white text-sm">FAQs</a>
                </div>

                {/* Socials / Contact */}
                <div>
                    <h4 className="font-bold uppercase text-sffl-red mb-2">Connect</h4>
                    <p className="text-gray-400 text-sm">Follow us on social media for live updates.</p>
                    <div className="mt-4 flex justify-center md:justify-start space-x-4">
                        <a
                            href="https://web.facebook.com/Showtimeffl"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-10 h-10 bg-gray-700 hover:bg-[#1877F2] rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110 hover:shadow-lg"
                            aria-label="Facebook"
                        >
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                            </svg>
                        </a>
                        <a
                            href="https://twitter.com/showtimeffl"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-10 h-10 bg-gray-700 hover:bg-black rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110 hover:shadow-lg"
                            aria-label="X (Twitter)"
                        >
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                            </svg>
                        </a>
                        <a
                            href="https://www.instagram.com/showtimeffl/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-10 h-10 bg-gray-700 hover:bg-gradient-to-br hover:from-[#833AB4] hover:via-[#FD1D1D] hover:to-[#F77737] rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110 hover:shadow-lg"
                            aria-label="Instagram"
                        >
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
                            </svg>
                        </a>
                    </div>
                </div>
            </div>
            <div className="text-center text-gray-600 text-xs mt-8 border-t border-gray-800 pt-4">
                &copy; 2026 Showtime Flag Football League. All rights reserved.
            </div>
        </footer>
    );
};
