import { Link } from 'react-router-dom';
import { useState } from 'react';

export const Navbar = () => {
    const [aboutDropdownOpen, setAboutDropdownOpen] = useState(false);

    return (
        <nav className="bg-sffl-navy p-4 sticky top-0 z-50 shadow-lg border-b-4 border-sffl-red">
            <div className="container mx-auto flex justify-between items-center text-white">
                {/* Logo Area */}
                <Link to="/" className="text-2xl font-black italic tracking-tighter hover:text-gray-200 transition">
                    SHOWTIME<span className="text-sffl-red">WEB</span>
                </Link>

                {/* Desktop Menu */}
                <div className="hidden lg:flex items-center space-x-6 uppercase font-bold text-sm tracking-wide">
                    <Link to="/" className="hover:text-sffl-red transition-colors duration-300">Home</Link>
                    <Link to="/schedule" className="hover:text-sffl-red transition-colors duration-300">Match Hub</Link>
                    <Link to="/standings" className="hover:text-sffl-red transition-colors duration-300">Standings</Link>
                    <Link to="/news" className="hover:text-sffl-red transition-colors duration-300">News</Link>
                    <Link to="/gallery" className="hover:text-sffl-red transition-colors duration-300">Gallery</Link>

                    {/* About Us Dropdown */}
                    <div
                        className="relative"
                        onMouseEnter={() => setAboutDropdownOpen(true)}
                        onMouseLeave={() => setAboutDropdownOpen(false)}
                    >
                        <button className="hover:text-sffl-red transition-colors duration-300 flex items-center gap-1">
                            About Us
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>

                        {aboutDropdownOpen && (
                            <div className="absolute top-full left-0 mt-2 w-64 bg-white text-sffl-navy rounded-lg shadow-2xl py-2 normal-case font-semibold text-sm">
                                <Link to="/about/showtime-flag" className="block px-4 py-2 hover:bg-gray-100 hover:text-sffl-red">About Showtime Flag</Link>
                                <Link to="/about/media-guidelines" className="block px-4 py-2 hover:bg-gray-100 hover:text-sffl-red">Media Guidelines</Link>
                                <Link to="/about/rules" className="block px-4 py-2 hover:bg-gray-100 hover:text-sffl-red">Gameplay Rules</Link>
                                <Link to="/about/byelaws" className="block px-4 py-2 hover:bg-gray-100 hover:text-sffl-red">Showtime Byelaws</Link>
                                <Link to="/about/arena" className="block px-4 py-2 hover:bg-gray-100 hover:text-sffl-red">Showtime Arena</Link>
                                <Link to="/about/education" className="block px-4 py-2 hover:bg-gray-100 hover:text-sffl-red">Education</Link>
                                <Link to="/about/faq" className="block px-4 py-2 hover:bg-gray-100 hover:text-sffl-red">FAQ</Link>
                                <Link to="/about/whistleblower" className="block px-4 py-2 hover:bg-gray-100 hover:text-sffl-red">Whistleblower</Link>
                            </div>
                        )}
                    </div>

                    <Link to="/commissioners-note" className="hover:text-sffl-red transition-colors duration-300">Commissioner's Note</Link>
                    <Link to="/store" className="hover:text-sffl-red transition-colors duration-300">Store</Link>
                </div>

                {/* Mobile Menu Button */}
                <button className="lg:hidden text-white focus:outline-none">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                </button>
            </div>
        </nav>
    );
};
