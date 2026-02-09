import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';

export const Navbar = () => {
    const [aboutDropdownOpen, setAboutDropdownOpen] = useState(false);
    const { isAuthenticated, user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    return (
        <nav className="bg-sffl-navy p-4 sticky top-0 z-50 shadow-lg border-b-4 border-sffl-red">
            <div className="container mx-auto flex justify-between items-center text-white">
                {/* Logo Area */}
                <Link to="/" className="flex items-center gap-2 group">
                    <img
                        src="https://images.leaguerepublic.com/data/images/738010788/107.png"
                        alt="SFFL Logo"
                        className="w-12 h-12 object-contain bg-white rounded-full p-1 transition-all duration-300 group-hover:scale-125 group-hover:rotate-6 group-hover:shadow-xl"
                    />
                    <span className="text-2xl font-black italic tracking-tighter transition-all duration-300 group-hover:text-gray-200 group-hover:scale-110 group-hover:drop-shadow-[0_0_10px_rgba(220,38,38,0.8)]">
                        SHOWTIME<span className="text-sffl-red">WEB</span>
                    </span>
                </Link>

                {/* Desktop Menu */}
                <div className="hidden lg:flex items-center space-x-6 uppercase font-bold text-sm tracking-wide">
                    <Link to="/" className="hover:text-sffl-red transition-all duration-300 hover:scale-110 hover:font-black hover:drop-shadow-lg">Home</Link>
                    <Link to="/schedule" className="hover:text-sffl-red transition-all duration-300 hover:scale-110 hover:font-black hover:drop-shadow-lg">Match Hub</Link>
                    <Link to="/standings" className="hover:text-sffl-red transition-all duration-300 hover:scale-110 hover:font-black hover:drop-shadow-lg">Standings</Link>
                    <Link to="/news" className="hover:text-sffl-red transition-all duration-300 hover:scale-110 hover:font-black hover:drop-shadow-lg">News</Link>
                    <Link to="/gallery" className="hover:text-sffl-red transition-all duration-300 hover:scale-110 hover:font-black hover:drop-shadow-lg">Gallery</Link>
                    <Link to="/tickets" className="hover:text-sffl-red transition-all duration-300 hover:scale-110 hover:font-black hover:drop-shadow-lg">Tickets</Link>

                    {/* About Us Dropdown */}
                    <div
                        className="relative group"
                        onMouseEnter={() => setAboutDropdownOpen(true)}
                        onMouseLeave={() => setAboutDropdownOpen(false)}
                    >
                        <button className="hover:text-sffl-red transition-all duration-300 hover:scale-110 hover:font-black hover:drop-shadow-lg flex items-center gap-1">
                            About Us
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>

                        {aboutDropdownOpen && (
                            <div className="absolute top-full left-0 pt-2 w-64">
                                <div className="bg-white text-sffl-navy rounded-lg shadow-2xl py-2 normal-case font-semibold text-sm">
                                    <Link to="/about/showtime-flag" className="block px-4 py-2 hover:bg-gray-100 hover:text-sffl-red transition-colors">About Showtime Flag</Link>
                                    <Link to="/about/media-guidelines" className="block px-4 py-2 hover:bg-gray-100 hover:text-sffl-red transition-colors">Media Guidelines</Link>
                                    <Link to="/about/rules" className="block px-4 py-2 hover:bg-gray-100 hover:text-sffl-red transition-colors">Gameplay Rules</Link>
                                    <Link to="/about/byelaws" className="block px-4 py-2 hover:bg-gray-100 hover:text-sffl-red transition-colors">Showtime Byelaws</Link>
                                    <Link to="/about/arena" className="block px-4 py-2 hover:bg-gray-100 hover:text-sffl-red transition-colors">Showtime Arena</Link>
                                    <Link to="/about/education" className="block px-4 py-2 hover:bg-gray-100 hover:text-sffl-red transition-colors">Education</Link>
                                    <Link to="/about/faq" className="block px-4 py-2 hover:bg-gray-100 hover:text-sffl-red transition-colors">FAQ</Link>
                                    <Link to="/about/whistleblower" className="block px-4 py-2 hover:bg-gray-100 hover:text-sffl-red transition-colors">Whistleblower</Link>
                                </div>
                            </div>
                        )}
                    </div>

                    <Link to="/commissioners-note" className="hover:text-sffl-red transition-colors duration-300">Commissioner's Note</Link>
                    <Link to="/store" className="hover:text-sffl-red transition-colors duration-300">Store</Link>

                    {/* Auth Buttons */}
                    {isAuthenticated ? (
                        <div className="flex items-center gap-4 ml-6 border-l border-gray-600 pl-6">
                            <span className="text-sm">Hi, <span className="font-bold">{user?.name}</span></span>
                            {user?.role === 'admin' && (
                                <Link
                                    to="/admin"
                                    className="bg-sffl-red hover:bg-red-700 text-white font-bold px-4 py-2 rounded-lg transition text-xs"
                                >
                                    Admin Panel
                                </Link>
                            )}
                            <button
                                onClick={handleLogout}
                                className="bg-white text-sffl-navy hover:bg-gray-100 font-bold px-4 py-2 rounded-lg transition text-xs"
                            >
                                Logout
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-3 ml-6 border-l border-gray-600 pl-6">
                            <Link
                                to="/login?role=fan"
                                className="bg-white text-sffl-navy hover:bg-gray-100 font-bold px-4 py-2 rounded-lg transition text-xs"
                            >
                                Login
                            </Link>
                            <Link
                                to="/signup"
                                className="bg-sffl-red hover:bg-red-700 text-white font-bold px-4 py-2 rounded-lg transition text-xs"
                            >
                                Sign Up
                            </Link>
                        </div>
                    )}
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
