import { Link, useNavigate } from 'react-router-dom';
import { useState, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';

export const Navbar = () => {
    const [aboutDropdownOpen, setAboutDropdownOpen] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const { isAuthenticated, user, logout } = useAuth();
    const { isDarkMode, toggleDarkMode } = useTheme();
    const navigate = useNavigate();
    const dropdownTimeoutRef = useRef<number | null>(null);

    const handleDropdownEnter = () => {
        if (dropdownTimeoutRef.current) {
            clearTimeout(dropdownTimeoutRef.current);
        }
        setAboutDropdownOpen(true);
    };

    const handleDropdownLeave = () => {
        dropdownTimeoutRef.current = setTimeout(() => {
            setAboutDropdownOpen(false);
        }, 200); // 200ms delay before closing
    };

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    return (
        <nav className="bg-sffl-navy sticky top-0 z-50 shadow-lg border-b-4 border-sffl-red">
            {/* ROW 1: Logo | Main Pages Navigation | Auth */}
            <div className="border-b border-gray-700">
                <div className="container mx-auto px-4 py-3">
                    <div className="flex items-center justify-between text-white">
                        {/* Logo - Left */}
                        <Link to="/" className="flex items-center gap-2 group">
                            <img
                                src="https://images.leaguerepublic.com/data/images/738010788/107.png"
                                alt="SFFL Logo"
                                className="w-10 h-10 object-contain bg-white rounded-full p-1 transition-all duration-300 group-hover:scale-125 group-hover:rotate-6 group-hover:shadow-xl"
                            />
                            <span className="text-xl md:text-2xl font-black italic tracking-tighter transition-all duration-300 group-hover:text-gray-200 group-hover:scale-110 group-hover:drop-shadow-[0_0_10px_rgba(220,38,38,0.8)]">
                                SHOWTIME<span className="text-sffl-red">WEB</span>
                            </span>
                        </Link>

                        {/* Main Navigation - Center */}
                        <div className="hidden lg:flex items-center gap-8 uppercase font-bold text-sm tracking-wide">
                            <Link to="/" className="hover:text-sffl-red transition-all duration-300 hover:scale-110">Home</Link>
                            <Link to="/tickets" className="hover:text-sffl-red transition-all duration-300 hover:scale-110">Tickets</Link>
                            <Link to="/store" className="hover:text-sffl-red transition-all duration-300 hover:scale-110">Store</Link>

                            {/* About Us Dropdown */}
                            <div
                                className="relative group"
                                onMouseEnter={handleDropdownEnter}
                                onMouseLeave={handleDropdownLeave}
                            >
                                <button className="hover:text-sffl-red transition-all duration-300 hover:scale-110 flex items-center gap-1">
                                    ABOUT US
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>

                                {aboutDropdownOpen && (
                                    <div className="absolute top-full left-0 w-64 z-50">
                                        <div className="bg-white dark:bg-gray-800 text-sffl-navy dark:text-white rounded-lg shadow-2xl py-2 normal-case font-semibold text-sm border border-gray-200 dark:border-gray-700">
                                            <Link to="/about/showtime-flag" className="block px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-sffl-red transition-colors">About Showtime</Link>
                                            <Link to="/about/media-guidelines" className="block px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-sffl-red transition-colors">Media Guidelines</Link>
                                            <Link to="/about/rules" className="block px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-sffl-red transition-colors">Gameplay Rules</Link>
                                            <Link to="/about/byelaws" className="block px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-sffl-red transition-colors">Showtime Byelaws</Link>
                                            <Link to="/about/arena" className="block px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-sffl-red transition-colors">Showtime Arena</Link>
                                            <Link to="/about/education" className="block px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-sffl-red transition-colors">Education</Link>
                                            <Link to="/about/whistleblower" className="block px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-sffl-red transition-colors">Whistleblower</Link>
                                            <Link to="/about/faq" className="block px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-sffl-red transition-colors">FAQ</Link>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Auth Buttons - Right */}
                        <div className="hidden lg:flex items-center gap-3">
                            {isAuthenticated ? (
                                <>
                                    <span className="text-sm">Hi, <span className="font-extrabold">{user?.name}</span></span>
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
                                        className="bg-white dark:bg-gray-700 text-sffl-navy dark:text-white hover:bg-gray-100 dark:hover:bg-gray-600 font-bold px-3 py-1.5 rounded transition text-xs"
                                    >
                                        Logout
                                    </button>
                                </>
                            ) : (
                                <>
                                    <Link
                                        to="/login?role=fan"
                                        className="bg-white dark:bg-gray-700 text-sffl-navy dark:text-white hover:bg-gray-100 dark:hover:bg-gray-600 font-bold px-3 py-1.5 rounded transition text-xs"
                                    >
                                        Login
                                    </Link>
                                    <Link
                                        to="/signup"
                                        className="bg-sffl-red hover:bg-red-700 dark:hover:bg-red-600 text-white font-bold px-3 py-1.5 rounded transition text-xs"
                                    >
                                        Sign Up
                                    </Link>
                                </>
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
                </div>
            </div>

            {/* ROW 2: Sport/League Pages | Dark Mode Toggle */}
            <div className="hidden lg:block">
                <div className="container mx-auto px-4">
                    <div className="relative flex items-center justify-center py-3 text-white">
                        {/* Sport/League Navigation - Centered */}
                        <div className="flex items-center gap-8 uppercase font-bold text-sm tracking-wide">
                            <Link to="/matches" className="hover:text-sffl-red transition-all duration-300 hover:scale-110">Matches</Link>
                            <Link to="/standings" className="hover:text-sffl-red transition-all duration-300 hover:scale-110">Standings</Link>
                            <Link to="/players" className="hover:text-sffl-red transition-all duration-300 hover:scale-110">Players</Link>
                            <Link to="/news" className="hover:text-sffl-red transition-all duration-300 hover:scale-110">News</Link>
                            <Link to="/gallery" className="hover:text-sffl-red transition-all duration-300 hover:scale-110">Gallery</Link>
                        </div>

                        {/* Dark Mode Toggle - Absolute Far Right */}
                        <button
                            onClick={toggleDarkMode}
                            className="absolute right-0 p-2 rounded-full hover:bg-gray-700 transition-all duration-300 hover:scale-110 focus:outline-none"
                            aria-label="Toggle dark mode"
                        >
                            {isDarkMode ? (
                                <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                                </svg>
                            ) : (
                                <svg className="w-5 h-5 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                                </svg>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile Menu */}
            {mobileMenuOpen && (
                <div className="lg:hidden border-t border-gray-700">
                    <div className="container mx-auto px-4 py-4">
                        <div className="flex flex-col space-y-3">
                            <Link to="/" onClick={() => setMobileMenuOpen(false)} className="text-white hover:text-sffl-red font-bold py-2">Home</Link>
                            <Link to="/matches" onClick={() => setMobileMenuOpen(false)} className="text-white hover:text-sffl-red font-bold py-2">Matches</Link>
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
                                    <div className="text-white text-base">Hi, <span className="font-extrabold">{user?.name}</span></div>
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
                </div>
            )}
        </nav>
    );
};
