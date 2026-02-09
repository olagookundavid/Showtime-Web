import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';

export const Navbar = () => {
    const [aboutDropdownOpen, setAboutDropdownOpen] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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
                <div className="hidden lg:flex items-center space-x-4 uppercase font-bold text-xs tracking-wide">
                    <Link to="/" className="hover:text-sffl-red transition-all duration-300 hover:scale-110 hover:font-black hover:drop-shadow-lg">Home</Link>
                    <Link to="/schedule" className="hover:text-sffl-red transition-all duration-300 hover:scale-110 hover:font-black hover:drop-shadow-lg">Matches</Link>
                    <Link to="/standings" className="hover:text-sffl-red transition-all duration-300 hover:scale-110 hover:font-black hover:drop-shadow-lg">Standings</Link>
                    <Link to="/players" className="hover:text-sffl-red transition-all duration-300 hover:scale-110 hover:font-black hover:drop-shadow-lg">Players</Link>
                    <Link to="/news" className="hover:text-sffl-red transition-all duration-300 hover:scale-110 hover:font-black hover:drop-shadow-lg">News</Link>
                    <Link to="/gallery" className="hover:text-sffl-red transition-all duration-300 hover:scale-110 hover:font-black hover:drop-shadow-lg">Gallery</Link>
                    <Link to="/tickets" className="hover:text-sffl-red transition-all duration-300 hover:scale-110 hover:font-black hover:drop-shadow-lg">Tickets</Link>
                    <Link to="/store" className="hover:text-sffl-red transition-all duration-300 hover:scale-110 hover:font-black hover:drop-shadow-lg">Store</Link>

                    {/* About Us Dropdown */}
                    <div
                        className="relative group"
                        onMouseEnter={() => setAboutDropdownOpen(true)}
                        onMouseLeave={() => setAboutDropdownOpen(false)}
                    >
                        <button className="hover:text-sffl-red transition-all duration-300 hover:scale-110 hover:font-black hover:drop-shadow-lg flex items-center gap-1">
                            ABOUT US
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>

                        {aboutDropdownOpen && (
                            <div className="absolute top-full left-0 pt-2 w-56">
                                <div className="bg-white text-sffl-navy rounded-lg shadow-2xl py-2 normal-case font-semibold text-sm">
                                    <Link to="/about/showtime-flag" className="block px-4 py-2 hover:bg-gray-100 hover:text-sffl-red transition-colors">About Showtime</Link>
                                    <Link to="/about/media-guidelines" className="block px-4 py-2 hover:bg-gray-100 hover:text-sffl-red transition-colors">Media Guidelines</Link>
                                    <Link to="/about/rules" className="block px-4 py-2 hover:bg-gray-100 hover:text-sffl-red transition-colors">Gameplay Rules</Link>
                                    <Link to="/about/byelaws" className="block px-4 py-2 hover:bg-gray-100 hover:text-sffl-red transition-colors">Showtime Byelaws</Link>
                                    <Link to="/about/arena" className="block px-4 py-2 hover:bg-gray-100 hover:text-sffl-red transition-colors">Showtime Arena</Link>
                                    <Link to="/about/education" className="block px-4 py-2 hover:bg-gray-100 hover:text-sffl-red transition-colors">Education</Link>
                                    <Link to="/about/whistleblower" className="block px-4 py-2 hover:bg-gray-100 hover:text-sffl-red transition-colors">Whistleblower</Link>
                                    <Link to="/about/faq" className="block px-4 py-2 hover:bg-gray-100 hover:text-sffl-red transition-colors">FAQ</Link>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Auth Buttons */}
                    {isAuthenticated ? (
                        <div className="flex items-center gap-2 ml-4 border-l border-gray-600 pl-4">
                            <span className="text-xs normal-case">Hi, <span className="font-bold">{user?.name}</span></span>
                            {user?.role === 'admin' && (
                                <Link
                                    to="/admin"
                                    className="bg-sffl-red hover:bg-red-700 text-white font-bold px-3 py-1.5 rounded transition text-xs"
                                >
                                    Admin
                                </Link>
                            )}
                            <button
                                onClick={handleLogout}
                                className="bg-white text-sffl-navy hover:bg-gray-100 font-bold px-3 py-1.5 rounded transition text-xs"
                            >
                                Logout
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 ml-4 border-l border-gray-600 pl-4">
                            <Link
                                to="/login?role=fan"
                                className="bg-white text-sffl-navy hover:bg-gray-100 font-bold px-3 py-1.5 rounded transition text-xs"
                            >
                                Login
                            </Link>
                            <Link
                                to="/signup"
                                className="bg-sffl-red hover:bg-red-700 text-white font-bold px-3 py-1.5 rounded transition text-xs"
                            >
                                Sign Up
                            </Link>
                        </div>
                    )}
                </div>

                {/* Mobile Menu Button */}
                <button
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    className="lg:hidden text-white focus:outline-none"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {mobileMenuOpen ? (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        ) : (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        )}
                    </svg>
                </button>
            </div>

            {/* Mobile Menu */}
            {mobileMenuOpen && (
                <div className="lg:hidden mt-4 pb-4 border-t border-gray-700 pt-4">
                    <div className="flex flex-col space-y-3">
                        <Link to="/" onClick={() => setMobileMenuOpen(false)} className="text-white hover:text-sffl-red font-bold py-2">Home</Link>
                        <Link to="/schedule" onClick={() => setMobileMenuOpen(false)} className="text-white hover:text-sffl-red font-bold py-2">Matches</Link>
                        <Link to="/standings" onClick={() => setMobileMenuOpen(false)} className="text-white hover:text-sffl-red font-bold py-2">Standings</Link>
                        <Link to="/players" onClick={() => setMobileMenuOpen(false)} className="text-white hover:text-sffl-red font-bold py-2">Players</Link>
                        <Link to="/news" onClick={() => setMobileMenuOpen(false)} className="text-white hover:text-sffl-red font-bold py-2">News</Link>
                        <Link to="/gallery" onClick={() => setMobileMenuOpen(false)} className="text-white hover:text-sffl-red font-bold py-2">Gallery</Link>
                        <Link to="/tickets" onClick={() => setMobileMenuOpen(false)} className="text-white hover:text-sffl-red font-bold py-2">Tickets</Link>
                        <Link to="/store" onClick={() => setMobileMenuOpen(false)} className="text-white hover:text-sffl-red font-bold py-2">Store</Link>

                        {/* About Section */}
                        <div className="border-t border-gray-700 pt-3 mt-2">
                            <div className="text-sffl-red font-bold mb-2 text-sm">ABOUT US</div>
                            <Link to="/about/showtime-flag" onClick={() => setMobileMenuOpen(false)} className="text-white hover:text-sffl-red py-2 pl-4 block text-sm">About Showtime</Link>
                            <Link to="/about/media-guidelines" onClick={() => setMobileMenuOpen(false)} className="text-white hover:text-sffl-red py-2 pl-4 block text-sm">Media Guidelines</Link>
                            <Link to="/about/rules" onClick={() => setMobileMenuOpen(false)} className="text-white hover:text-sffl-red py-2 pl-4 block text-sm">Gameplay Rules</Link>
                            <Link to="/about/byelaws" onClick={() => setMobileMenuOpen(false)} className="text-white hover:text-sffl-red py-2 pl-4 block text-sm">Showtime Byelaws</Link>
                            <Link to="/about/arena" onClick={() => setMobileMenuOpen(false)} className="text-white hover:text-sffl-red py-2 pl-4 block text-sm">Showtime Arena</Link>
                            <Link to="/about/education" onClick={() => setMobileMenuOpen(false)} className="text-white hover:text-sffl-red py-2 pl-4 block text-sm">Education</Link>
                            <Link to="/about/whistleblower" onClick={() => setMobileMenuOpen(false)} className="text-white hover:text-sffl-red py-2 pl-4 block text-sm">Whistleblower</Link>
                            <Link to="/about/faq" onClick={() => setMobileMenuOpen(false)} className="text-white hover:text-sffl-red py-2 pl-4 block text-sm">FAQ</Link>
                        </div>

                        {/* Mobile Auth */}
                        {isAuthenticated ? (
                            <div className="border-t border-gray-700 pt-3 mt-2 space-y-2">
                                <div className="text-white text-sm">Hi, <span className="font-bold">{user?.name}</span></div>
                                {user?.role === 'admin' && (
                                    <Link to="/admin" onClick={() => setMobileMenuOpen(false)} className="block bg-sffl-red hover:bg-red-700 text-white font-bold px-4 py-2 rounded text-center">
                                        Admin Panel
                                    </Link>
                                )}
                                <button
                                    onClick={() => { handleLogout(); setMobileMenuOpen(false); }}
                                    className="w-full bg-white text-sffl-navy hover:bg-gray-100 font-bold px-4 py-2 rounded"
                                >
                                    Logout
                                </button>
                            </div>
                        ) : (
                            <div className="border-t border-gray-700 pt-3 mt-2 space-y-2">
                                <Link to="/login?role=fan" onClick={() => setMobileMenuOpen(false)} className="block bg-white text-sffl-navy hover:bg-gray-100 font-bold px-4 py-2 rounded text-center">
                                    Login
                                </Link>
                                <Link to="/signup" onClick={() => setMobileMenuOpen(false)} className="block bg-sffl-red hover:bg-red-700 text-white font-bold px-4 py-2 rounded text-center">
                                    Sign Up
                                </Link>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </nav>
    );
};
