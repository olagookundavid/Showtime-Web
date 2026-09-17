import { Link, useNavigate } from 'react-router-dom';
import { useState, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';

interface NavbarProps {
    onMoreClick?: () => void;
}

export const Navbar = ({ onMoreClick }: NavbarProps) => {
    const [leagueDropdownOpen, setLeagueDropdownOpen] = useState(false);
    const [storeDropdownOpen, setStoreDropdownOpen] = useState(false);
    const [statsDropdownOpen, setStatsDropdownOpen] = useState(false);
    const { isAuthenticated, user, logout } = useAuth();
    const { count: cartCount } = useCart();
    const navigate = useNavigate();
    const leagueTimeoutRef = useRef<number | null>(null);
    const storeTimeoutRef = useRef<number | null>(null);
    const statsTimeoutRef = useRef<number | null>(null);

    const handleLeagueEnter = () => {
        if (leagueTimeoutRef.current) {
            clearTimeout(leagueTimeoutRef.current);
        }
        setLeagueDropdownOpen(true);
    };

    const handleLeagueLeave = () => {
        leagueTimeoutRef.current = setTimeout(() => {
            setLeagueDropdownOpen(false);
        }, 200);
    };

    const handleStoreEnter = () => {
        if (storeTimeoutRef.current) {
            clearTimeout(storeTimeoutRef.current);
        }
        setStoreDropdownOpen(true);
    };

    const handleStoreLeave = () => {
        storeTimeoutRef.current = setTimeout(() => {
            setStoreDropdownOpen(false);
        }, 200);
    };

    const handleStatsEnter = () => {
        if (statsTimeoutRef.current) {
            clearTimeout(statsTimeoutRef.current);
        }
        setStatsDropdownOpen(true);
    };

    const handleStatsLeave = () => {
        statsTimeoutRef.current = setTimeout(() => {
            setStatsDropdownOpen(false);
        }, 200);
    };

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    return (
        <nav className="bg-sffl-navy sticky top-0 z-50 shadow-lg border-b-4 border-sffl-red">
            <div className="max-w-shell mx-auto px-4 py-2.5 md:py-3">
                <div className="relative flex items-center justify-between text-white">
                    {/* Logo - Left */}
                    <Link to="/" className="flex items-center flex-shrink-0" aria-label="Showtime Home">
                        <img
                            src="/images/branding/showtime-logo.png"
                            alt="Showtime Flag Football"
                            className="w-12 h-12 sm:w-14 sm:h-14 object-contain transition-all duration-300 hover:scale-110"
                        />
                    </Link>

                    {/* Main Navigation - Center. Wider spacing now that the
                        About Us dropdown is gone — the remaining items get
                        room to breathe. */}
                    <div className="hidden lg:flex items-center gap-9 xl:gap-12 uppercase font-bold text-xs xl:text-sm tracking-wide">
                        <Link to="/" className="hover:text-sffl-red font-bold transition-all duration-300 hover:scale-105">Home</Link>
                        {/* League Dropdown — groups Matches, Standings, Teams */}
                        <div
                            className="relative group"
                            onMouseEnter={handleLeagueEnter}
                            onMouseLeave={handleLeagueLeave}
                        >
                            <button className="hover:text-sffl-red font-bold transition-all duration-300 hover:scale-105 flex items-center gap-1 uppercase">
                                League
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>

                            {leagueDropdownOpen && (
                                <div className="absolute top-full left-0 w-48 z-50 pt-2">
                                    <div className="bg-white dark:bg-gray-800 text-sffl-navy dark:text-white rounded-lg shadow-2xl py-2 normal-case font-bold text-sm border border-gray-200 dark:border-gray-700">
                                        <Link to="/matches" className="block px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-sffl-red transition-colors font-bold">Matches</Link>
                                        <Link to="/standings" className="block px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-sffl-red transition-colors font-bold">Standings</Link>
                                        <Link to="/teams" className="block px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-sffl-red transition-colors font-bold">Teams</Link>
                                    </div>
                                </div>
                            )}
                        </div>
                        {/* Stats Dropdown */}
                        <div 
                            className="relative group"
                            onMouseEnter={handleStatsEnter}
                            onMouseLeave={handleStatsLeave}
                        >
                            <Link to="/stats" className="hover:text-sffl-red font-bold transition-all duration-300 hover:scale-105 flex items-center gap-1 uppercase">
                                Stats
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </Link>

                            {statsDropdownOpen && (
                                <div className="absolute top-full left-0 w-48 z-50 pt-2">
                                    <div className="bg-white dark:bg-gray-800 text-sffl-navy dark:text-white rounded-lg shadow-2xl py-2 normal-case font-bold text-sm border border-gray-200 dark:border-gray-700">
                                        <Link to="/stats?tab=players" className="block px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-sffl-red transition-colors font-bold">Player Stats</Link>
                                        <Link to="/stats?tab=teams" className="block px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-sffl-red transition-colors font-bold">Team Stats</Link>
                                    </div>
                                </div>
                            )}
                        </div>
                        <Link to="/news" className="hover:text-sffl-red font-bold transition-all duration-300 hover:scale-105">News</Link>
                        <Link to="/fantasy" className="hover:text-sffl-red font-bold transition-all duration-300 hover:scale-105 uppercase text-yellow-400">Fantasy</Link>
                        
                        {/* Store Dropdown */}
                        <div 
                            className="relative group"
                            onMouseEnter={handleStoreEnter}
                            onMouseLeave={handleStoreLeave}
                        >
                            <button className="hover:text-sffl-red font-bold transition-all duration-300 hover:scale-105 flex items-center gap-1 uppercase">
                                STORE
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>

                            {storeDropdownOpen && (
                                <div className="absolute top-full left-0 w-48 z-50 pt-2">
                                    <div className="bg-white dark:bg-gray-800 text-sffl-navy dark:text-white rounded-lg shadow-2xl py-2 normal-case font-bold text-sm border border-gray-200 dark:border-gray-700">
                                        <Link to="/tickets" className="block px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-sffl-red transition-colors font-bold">Gameday Tickets</Link>
                                        <Link to="/store" className="block px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-sffl-red transition-colors font-bold">Merch Store</Link>
                                        {isAuthenticated && (
                                            <Link to="/store/orders" className="block px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-sffl-red transition-colors font-bold">My Orders</Link>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                    </div>

                    {/* Actions / Auth - Right. Gap is intentionally tight here
                        because the right rail already carries 3 chunks
                        (cart icon, auth block) and used to overflow. */}
                    <div className="hidden lg:flex items-center gap-3">
                        {/* Cart icon with item-count badge */}
                        <Link
                            to="/store/cart"
                            aria-label={`Cart, ${cartCount} item${cartCount === 1 ? '' : 's'}`}
                            className="relative text-white hover:text-sffl-red transition-colors ml-1"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                            {cartCount > 0 && (
                                <span className="absolute -top-1.5 -right-2 bg-sffl-red text-white text-[10px] font-black rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                                    {cartCount > 99 ? '99+' : cartCount}
                                </span>
                            )}
                        </Link>

                        <div className="flex items-center gap-3">
                            {isAuthenticated ? (
                                <>
                                    <span className="text-sm">Hi, <span className="font-extrabold">{user?.name}</span></span>
                                    {user?.role === 'admin' && (
                                        <Link
                                            to="/admin"
                                            className="bg-sffl-red hover:bg-[#A52323] text-white font-bold px-3 py-1.5 rounded transition text-xs"
                                        >
                                            Admin
                                        </Link>
                                    )}
                                    {user?.role === 'app_admin' && (
                                        <Link
                                            to="/admin"
                                            className="bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-white font-bold px-3 py-1.5 rounded transition text-xs shadow-sm"
                                        >
                                            App Admin
                                        </Link>
                                    )}
                                    {user?.role === 'referee' && (
                                        <Link
                                            to="/admin/matches"
                                            className="bg-sffl-navy border border-sffl-red hover:bg-sffl-red text-white font-bold px-3 py-1.5 rounded transition text-xs"
                                        >
                                            Referee Portal
                                        </Link>
                                    )}
                                    {user?.role === 'stats' && (
                                        <Link
                                            to="/admin/matches"
                                            className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-3 py-1.5 rounded transition text-xs"
                                        >
                                            Stats Portal
                                        </Link>
                                    )}
                                    {user?.role === 'team_head' && (
                                        <Link
                                            to="/team-head"
                                            className="bg-green-600 hover:bg-green-700 text-white font-bold px-3 py-1.5 rounded transition text-xs"
                                        >
                                            My Team
                                        </Link>
                                    )}
                                    {user?.role === 'player' && (
                                        <Link
                                            to="/player-portal"
                                            className="bg-sffl-red hover:bg-sffl-red/90 text-white font-bold px-3 py-1.5 rounded transition text-xs"
                                        >
                                            Player Portal
                                        </Link>
                                    )}
                                    {user?.role === 'ticketer' && (
                                        <Link
                                            to="/admin/tickets"
                                            className="bg-sffl-navy border border-sffl-red hover:bg-sffl-red text-white font-bold px-3 py-1.5 rounded transition text-xs"
                                        >
                                            Ticketing Portal
                                        </Link>
                                    )}
                                    {user?.role === 'seller' && (
                                        <Link
                                            to="/seller"
                                            className="bg-green-600 border border-green-500 hover:bg-green-700 text-white font-bold px-3 py-1.5 rounded transition text-xs"
                                        >
                                            Store Portal
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
                                        className="bg-sffl-red hover:bg-[#A52323] dark:hover:bg-[#A52323] text-white font-bold px-3 py-1.5 rounded transition text-xs"
                                    >
                                        Sign Up
                                    </Link>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Mobile Center Greeting */}
                    {isAuthenticated && user?.name && (
                        <div className="lg:hidden absolute left-1/2 -translate-x-1/2 flex items-center justify-center pointer-events-none max-w-[45%] sm:max-w-[55%] text-center">
                            <span className="text-white/90 text-xs sm:text-sm font-bold truncate">
                                Hi <span className="font-extrabold text-white">{user.name.split(' ')[0]}</span>
                            </span>
                        </div>
                    )}

                    {/* Mobile Right Controls: Cart & Menu Button */}
                    <div className="flex lg:hidden items-center gap-1 sm:gap-1.5">
                        {/* Mobile Cart Icon */}
                        <Link
                            to="/store/cart"
                            aria-label={`Cart, ${cartCount} items`}
                            className="relative text-white hover:text-sffl-red transition-colors p-1.5"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                            {cartCount > 0 && (
                                <span className="absolute -top-1 -right-1 bg-sffl-red text-white text-[9px] font-black rounded-full min-w-[16px] h-[16px] flex items-center justify-center px-1 shadow-md">
                                    {cartCount > 99 ? '99+' : cartCount}
                                </span>
                            )}
                        </Link>

                        {/* Mobile Menu Button - More icon */}
                        <button
                            onClick={onMoreClick}
                            className="text-white hover:text-sffl-red transition-colors focus:outline-none p-1.5"
                            aria-label="Open navigation menu"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        </nav>
    );
};
