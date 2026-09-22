import { Outlet, Link, useLocation } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { BottomNav } from './BottomNav';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';
import { LatestMatchesCarousel, LatestMatchesInfoStrip } from './LatestMatchesCarousel';
import { useHideOnScrollDown } from '../../hooks/useHideOnScrollDown';
import { NewsletterPopup } from '../newsletter/NewsletterPopup';
import {
    XMarkIcon,
    InformationCircleIcon,
    ShoppingBagIcon,
    NewspaperIcon,
    QuestionMarkCircleIcon,
    ChevronRightIcon,
    ChevronLeftIcon,
    ShieldCheckIcon,
    WrenchIcon,
    AcademicCapIcon,
    BookOpenIcon,
    ScaleIcon,
    MapPinIcon,
    VideoCameraIcon,
    TicketIcon,
    CalendarIcon,
    UserGroupIcon,
    TableCellsIcon,
    ChartBarIcon,
    ChartPieIcon,
    TrophyIcon,
    ShoppingCartIcon,
    UserCircleIcon,
    ClipboardDocumentListIcon,
    ArrowRightOnRectangleIcon,
    SparklesIcon,
} from '@heroicons/react/24/outline';

export const Layout = () => {
    const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
    const [activeSubMenu, setActiveSubMenu] = useState<'main' | 'about'>('main');
    const { isAuthenticated, user, logout } = useAuth();
    const { count: cartCount } = useCart();
    const location = useLocation();
    // Folds away while reading down the page. It also folds while a dialog is
    // open, but that half is done in CSS — see .chrome-carousel in index.css.
    const hideMatchStrip = useHideOnScrollDown();

    // The sticky chrome's height, published as a CSS variable so dialogs can
    // open below it instead of being cut off by it. It is measured rather than
    // hard-coded because the strip collapses on scroll and the navbar changes
    // height across breakpoints.
    const chromeRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const el = chromeRef.current;
        if (!el) return;
        const publish = () =>
            document.documentElement.style.setProperty('--chrome-h', `${el.offsetHeight}px`);
        publish();
        const observer = new ResizeObserver(publish);
        observer.observe(el);
        return () => {
            observer.disconnect();
            document.documentElement.style.removeProperty('--chrome-h');
        };
    }, []);

    // Close menu on route change
    useEffect(() => {
        setIsMoreMenuOpen(false);
        setActiveSubMenu('main');
    }, [location.pathname]);

    // Prevent background scrolling when more drawer is open on mobile
    useEffect(() => {
        if (isMoreMenuOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isMoreMenuOpen]);


    return (
        <div className={`flex flex-col min-h-screen w-full max-w-[100vw] transition-colors duration-500 bg-transparent overscroll-y-none`}>
            {/* Global Background - High-contrast atmospheric version */}
            <div className="fixed inset-0 -z-50 bg-slate-200 dark:bg-black">
                <div 
                    className="absolute inset-0 bg-[url('/images/branding/home-bg.jpeg')] bg-cover bg-center opacity-40 dark:opacity-20 transition-opacity duration-700" 
                    style={{ backgroundAttachment: 'fixed' }}
                />
                
                {/* Dynamic Tints - Way different for light/dark */}
                <div className="absolute inset-0 bg-gradient-to-br from-sffl-red/10 via-white/50 dark:via-transparent to-sffl-navy/20 dark:from-sffl-red/5 dark:to-sffl-navy/60" />
                
                {/* Vignette for depth */}
                <div className="absolute inset-0 [background:radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.05)_100%)] dark:[background:radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.4)_100%)]" />
            </div>

            {/* Sticky chrome: navbar + scores carousel travel together at the
                top of every page. The Navbar already declares its own `sticky
                top-0` (kept for any layouts that mount it standalone); inside
                this wrapper the outer sticky is what actually pins. */}
            <div ref={chromeRef} className="sticky top-0 z-50">
                <Navbar onMoreClick={() => setIsMoreMenuOpen(true)} />
                {/* Reading down the page, the scores roll up out of the way and
                    give the content back its room; the first flick upward brings
                    them straight back. The 0fr/1fr grid animates to the row's
                    own height, so nothing here has to know how tall it is. */}
                <div
                    className={`chrome-carousel grid overflow-hidden transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none ${
                        hideMatchStrip ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100'
                    }`}
                    // Collapsed, the tiles are still in the DOM: `inert` keeps
                    // them out of the tab order and off screen readers, so
                    // nobody tabs into a row they cannot see.
                    inert={hideMatchStrip ? true : undefined}
                >
                    <div className="min-h-0">
                        <LatestMatchesCarousel />
                    </div>
                </div>
            </div>
            {/* Home-only info strip sits below the sticky chrome and scrolls
                away with the rest of the page. */}
            {location.pathname === '/' && <LatestMatchesInfoStrip />}
            <main className="flex-grow w-full max-w-page mx-auto px-2 sm:px-6 lg:px-8 py-3 md:py-8 pb-[calc(9rem+2*env(safe-area-inset-bottom,0px))] lg:pb-8 relative z-10 overscroll-y-none">
                <Outlet />
            </main>

            <Footer />

            <BottomNav onMoreClick={() => setIsMoreMenuOpen(prev => !prev)} isMoreOpen={isMoreMenuOpen} />

            <NewsletterPopup />

            {/* "More" Mobile Drawer */}
            <div
                className={`fixed inset-0 z-[60] lg:hidden transition-all duration-300 ${
                    isMoreMenuOpen ? 'opacity-100 visible' : 'opacity-0 invisible pointer-events-none'
                }`}
            >
                {/* Backdrop */}
                <div
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    onClick={() => setIsMoreMenuOpen(false)}
                />

                {/* Drawer Content */}
                <div
                    className={`absolute bottom-0 left-0 right-0 max-h-[88dvh] bg-white dark:bg-gray-900 rounded-t-3xl transition-transform duration-300 transform ${
                        isMoreMenuOpen ? 'translate-y-0' : 'translate-y-full'
                    } overflow-hidden shadow-2xl border-t border-gray-200 dark:border-gray-800 flex flex-col`}
                >
                    {/* Grab Handle */}
                    <div className="w-12 h-1 bg-gray-300 dark:bg-gray-700 rounded-full mx-auto my-2.5 shrink-0" />

                    <div
                        className={`transition-transform duration-300 flex w-[200%] flex-1 min-h-0 ${
                            activeSubMenu === 'about' ? '-translate-x-1/2' : 'translate-x-0'
                        }`}
                    >
                        {/* Main Menu Slide */}
                        <div className="w-1/2 p-5 sm:p-6 overflow-y-auto overscroll-contain pb-[calc(9rem+2*env(safe-area-inset-bottom,0px))]">
                            {/* Header */}
                            <div className="flex justify-between items-center mb-4 shrink-0">
                                <div className="flex items-center gap-2">
                                    <div className="w-2.5 h-6 bg-sffl-red rounded-full" />
                                    <h2 className="text-xl font-black italic text-sffl-navy dark:text-white uppercase tracking-tighter">
                                        Explore Showtime
                                    </h2>
                                </div>
                                <button
                                    onClick={() => setIsMoreMenuOpen(false)}
                                    className="p-2 -mr-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full transition-colors"
                                    aria-label="Close menu"
                                >
                                    <XMarkIcon className="w-6 h-6" />
                                </button>
                            </div>

                            {/* User / Auth Bar */}
                            <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-3.5 mb-5 shadow-sm">
                                {isAuthenticated ? (
                                    <>
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="w-10 h-10 rounded-full bg-sffl-navy dark:bg-gray-700 text-white flex items-center justify-center font-black text-sm uppercase shrink-0 border border-gray-200 dark:border-gray-600">
                                                    {user?.name ? user.name.charAt(0) : 'U'}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider">
                                                        Signed in as
                                                    </p>
                                                    <p className="text-sm font-extrabold text-sffl-navy dark:text-white truncate">
                                                        {user?.name || user?.email}
                                                    </p>
                                                </div>
                                            </div>

                                            <Link
                                                to="/store/cart"
                                                onClick={() => setIsMoreMenuOpen(false)}
                                                className="relative p-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sffl-navy dark:text-white hover:text-sffl-red transition-colors shrink-0"
                                                aria-label={`Cart, ${cartCount} items`}
                                            >
                                                <ShoppingCartIcon className="w-5 h-5" />
                                                {cartCount > 0 && (
                                                    <span className="absolute -top-1.5 -right-1.5 bg-sffl-red text-white text-[10px] font-black rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                                                        {cartCount > 99 ? '99+' : cartCount}
                                                    </span>
                                                )}
                                            </Link>
                                        </div>

                                        {/* Role Specific Portals */}
                                        {user?.role === 'admin' && (
                                            <Link
                                                to="/admin"
                                                onClick={() => setIsMoreMenuOpen(false)}
                                                className="mt-3 flex items-center justify-between p-3 bg-sffl-navy text-white rounded-xl shadow-sm font-bold text-xs uppercase tracking-wider active:scale-[0.98] transition-all"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <WrenchIcon className="w-4 h-4 text-sffl-red" />
                                                    <span>Admin Control Panel</span>
                                                </div>
                                                <ChevronRightIcon className="w-4 h-4 text-gray-300" />
                                            </Link>
                                        )}
                                        {user?.role === 'app_admin' && (
                                            <Link
                                                to="/admin"
                                                onClick={() => setIsMoreMenuOpen(false)}
                                                className="mt-3 flex items-center justify-between p-3 bg-gradient-to-r from-amber-500 to-yellow-600 text-white rounded-xl shadow-sm font-bold text-xs uppercase tracking-wider active:scale-[0.98] transition-all"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <WrenchIcon className="w-4 h-4 text-white" />
                                                    <span>App Admin Panel</span>
                                                </div>
                                                <ChevronRightIcon className="w-4 h-4 text-amber-100" />
                                            </Link>
                                        )}
                                        {user?.role === 'referee' && (
                                            <Link
                                                to="/admin/matches"
                                                onClick={() => setIsMoreMenuOpen(false)}
                                                className="mt-3 flex items-center justify-between p-3 bg-sffl-navy text-white rounded-xl shadow-sm font-bold text-xs uppercase tracking-wider active:scale-[0.98] transition-all"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <WrenchIcon className="w-4 h-4 text-sffl-red" />
                                                    <span>Referee Portal</span>
                                                </div>
                                                <ChevronRightIcon className="w-4 h-4 text-gray-300" />
                                            </Link>
                                        )}
                                        {user?.role === 'stats' && (
                                            <Link
                                                to="/admin/matches"
                                                onClick={() => setIsMoreMenuOpen(false)}
                                                className="mt-3 flex items-center justify-between p-3 bg-sffl-navy text-white rounded-xl shadow-sm font-bold text-xs uppercase tracking-wider active:scale-[0.98] transition-all"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <WrenchIcon className="w-4 h-4 text-amber-400" />
                                                    <span>Stats Portal</span>
                                                </div>
                                                <ChevronRightIcon className="w-4 h-4 text-gray-300" />
                                            </Link>
                                        )}
                                        {user?.role === 'team_head' && (
                                            <Link
                                                to="/team-head"
                                                onClick={() => setIsMoreMenuOpen(false)}
                                                className="mt-3 flex items-center justify-between p-3 bg-emerald-700 text-white rounded-xl shadow-sm font-bold text-xs uppercase tracking-wider active:scale-[0.98] transition-all"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <ShieldCheckIcon className="w-4 h-4 text-emerald-200" />
                                                    <span>Team Manager Hub</span>
                                                </div>
                                                <ChevronRightIcon className="w-4 h-4 text-emerald-200" />
                                            </Link>
                                        )}
                                        {user?.role === 'player' && (
                                            <Link
                                                to="/player-portal"
                                                onClick={() => setIsMoreMenuOpen(false)}
                                                className="mt-3 flex items-center justify-between p-3 bg-sffl-red text-white rounded-xl shadow-sm font-bold text-xs uppercase tracking-wider active:scale-[0.98] transition-all"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <UserCircleIcon className="w-4 h-4 text-white" />
                                                    <span>Player Portal</span>
                                                </div>
                                                <ChevronRightIcon className="w-4 h-4 text-red-100" />
                                            </Link>
                                        )}
                                        {user?.role === 'ticketer' && (
                                            <Link
                                                to="/admin/tickets"
                                                onClick={() => setIsMoreMenuOpen(false)}
                                                className="mt-3 flex items-center justify-between p-3 bg-sffl-navy text-white rounded-xl shadow-sm font-bold text-xs uppercase tracking-wider active:scale-[0.98] transition-all"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <TicketIcon className="w-4 h-4 text-sffl-red" />
                                                    <span>Ticketing Desk</span>
                                                </div>
                                                <ChevronRightIcon className="w-4 h-4 text-gray-300" />
                                            </Link>
                                        )}
                                        {user?.role === 'seller' && (
                                            <Link
                                                to="/seller"
                                                onClick={() => setIsMoreMenuOpen(false)}
                                                className="mt-3 flex items-center justify-between p-3 bg-emerald-700 text-white rounded-xl shadow-sm font-bold text-xs uppercase tracking-wider active:scale-[0.98] transition-all"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <ShoppingBagIcon className="w-4 h-4 text-emerald-200" />
                                                    <span>Store Merchant Portal</span>
                                                </div>
                                                <ChevronRightIcon className="w-4 h-4 text-emerald-200" />
                                            </Link>
                                        )}
                                    </>
                                ) : (
                                    <div className="flex items-center gap-2.5">
                                        <Link
                                            to="/login?role=fan"
                                            onClick={() => setIsMoreMenuOpen(false)}
                                            className="flex-1 bg-sffl-red hover:bg-[#A52323] text-white text-center font-black py-2.5 rounded-xl shadow-sm text-xs uppercase tracking-wider transition-all"
                                        >
                                            Sign In
                                        </Link>
                                        <Link
                                            to="/signup"
                                            onClick={() => setIsMoreMenuOpen(false)}
                                            className="flex-1 bg-white dark:bg-gray-700 text-sffl-navy dark:text-white border border-gray-300 dark:border-gray-600 text-center font-bold py-2.5 rounded-xl shadow-sm text-xs uppercase tracking-wider hover:bg-gray-50 dark:hover:bg-gray-600 transition-all"
                                        >
                                            Register
                                        </Link>
                                        <Link
                                            to="/store/cart"
                                            onClick={() => setIsMoreMenuOpen(false)}
                                            className="relative p-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-sffl-navy dark:text-white hover:text-sffl-red transition-colors shrink-0"
                                            aria-label={`Cart, ${cartCount} items`}
                                        >
                                            <ShoppingCartIcon className="w-5 h-5" />
                                            {cartCount > 0 && (
                                                <span className="absolute -top-1.5 -right-1.5 bg-sffl-red text-white text-[10px] font-black rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                                                    {cartCount > 99 ? '99+' : cartCount}
                                                </span>
                                            )}
                                        </Link>
                                    </div>
                                )}
                            </div>

                            {/* Section 1: League & Franchises (Brings back Teams!) */}
                            <div className="mb-5">
                                <div className="flex items-center justify-between mb-2 px-1">
                                    <span className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                                        League & Franchises
                                    </span>
                                    <span className="text-[10px] font-bold text-sffl-red uppercase">SFFL 2026</span>
                                </div>
                                <div className="grid grid-cols-2 gap-2.5">
                                    {/* Teams - Primary Emphasis for Missing Desktop Item */}
                                    <Link
                                        to="/teams"
                                        onClick={() => setIsMoreMenuOpen(false)}
                                        className="col-span-2 flex items-center justify-between p-3.5 bg-white dark:bg-gray-800 rounded-2xl border-2 border-sffl-red/30 dark:border-sffl-red/40 active:scale-[0.98] transition-all shadow-xs hover:border-sffl-red"
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-10 h-10 rounded-xl bg-sffl-red/10 dark:bg-sffl-red/20 text-sffl-red flex items-center justify-center shrink-0">
                                                <UserGroupIcon className="w-5 h-5" />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-black text-sm text-sffl-navy dark:text-white uppercase tracking-tight">
                                                        Teams
                                                    </span>
                                                    <span className="px-1.5 py-0.5 bg-sffl-red text-white text-[9px] font-black rounded-full uppercase">
                                                        8 Franchises
                                                    </span>
                                                </div>
                                                <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                                                    Rosters, Staff & Franchise Central
                                                </p>
                                            </div>
                                        </div>
                                        <ChevronRightIcon className="w-4 h-4 text-sffl-red shrink-0 ml-2" />
                                    </Link>

                                    {/* Matches */}
                                    <Link
                                        to="/matches"
                                        onClick={() => setIsMoreMenuOpen(false)}
                                        className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 active:scale-[0.98] transition-all shadow-xs hover:border-sffl-red/40"
                                    >
                                        <div className="w-9 h-9 rounded-xl bg-sffl-navy/10 dark:bg-sffl-navy/40 text-sffl-navy dark:text-white flex items-center justify-center shrink-0">
                                            <CalendarIcon className="w-5 h-5" />
                                        </div>
                                        <div className="min-w-0">
                                            <span className="font-black text-xs text-sffl-navy dark:text-white uppercase tracking-tight truncate block">
                                                Matches
                                            </span>
                                            <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                                                Fixtures & Scores
                                            </p>
                                        </div>
                                    </Link>

                                    {/* Standings */}
                                    <Link
                                        to="/standings"
                                        onClick={() => setIsMoreMenuOpen(false)}
                                        className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 active:scale-[0.98] transition-all shadow-xs hover:border-sffl-red/40"
                                    >
                                        <div className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 flex items-center justify-center shrink-0">
                                            <TableCellsIcon className="w-5 h-5" />
                                        </div>
                                        <div className="min-w-0">
                                            <span className="font-black text-xs text-sffl-navy dark:text-white uppercase tracking-tight truncate block">
                                                Standings
                                            </span>
                                            <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                                                Table & Rankings
                                            </p>
                                        </div>
                                    </Link>
                                </div>
                            </div>

                            {/* Section 2: Stats Hub & Categories */}
                            <div className="mb-5">
                                <div className="flex items-center justify-between mb-2 px-1">
                                    <span className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                                        Stats & Analytics
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 gap-2.5">
                                    <Link
                                        to="/stats?tab=players"
                                        onClick={() => setIsMoreMenuOpen(false)}
                                        className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 active:scale-[0.98] transition-all shadow-xs hover:border-sffl-red/40"
                                    >
                                        <div className="w-9 h-9 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                                            <UserCircleIcon className="w-5 h-5" />
                                        </div>
                                        <div className="min-w-0">
                                            <span className="font-black text-xs text-sffl-navy dark:text-white uppercase tracking-tight truncate block">
                                                Player Stats
                                            </span>
                                            <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                                                Passing, Rush, Tackles
                                            </p>
                                        </div>
                                    </Link>

                                    <Link
                                        to="/stats?tab=teams"
                                        onClick={() => setIsMoreMenuOpen(false)}
                                        className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 active:scale-[0.98] transition-all shadow-xs hover:border-sffl-red/40"
                                    >
                                        <div className="w-9 h-9 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                                            <ChartPieIcon className="w-5 h-5" />
                                        </div>
                                        <div className="min-w-0">
                                            <span className="font-black text-xs text-sffl-navy dark:text-white uppercase tracking-tight truncate block">
                                                Team Stats
                                            </span>
                                            <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                                                Efficiency & Drives
                                            </p>
                                        </div>
                                    </Link>

                                    <Link
                                        to="/stats"
                                        onClick={() => setIsMoreMenuOpen(false)}
                                        className="col-span-2 flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 active:scale-[0.98] transition-all shadow-xs hover:border-sffl-red/40"
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-9 h-9 rounded-xl bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                                                <ChartBarIcon className="w-5 h-5" />
                                            </div>
                                            <div className="min-w-0">
                                                <span className="font-black text-xs text-sffl-navy dark:text-white uppercase tracking-tight truncate block">
                                                    Full Stats Hub
                                                </span>
                                                <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                                                    All-time & Season Records
                                                </p>
                                            </div>
                                        </div>
                                        <ChevronRightIcon className="w-4 h-4 text-gray-400 shrink-0" />
                                    </Link>
                                </div>
                            </div>

                            {/* Section 3: Tickets, Merch & Orders */}
                            <div className="mb-5">
                                <div className="flex items-center justify-between mb-2 px-1">
                                    <span className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                                        Tickets & Official Store
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 gap-2.5">
                                    <Link
                                        to="/tickets"
                                        onClick={() => setIsMoreMenuOpen(false)}
                                        className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 active:scale-[0.98] transition-all shadow-xs hover:border-sffl-red/40"
                                    >
                                        <div className="w-9 h-9 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                                            <TicketIcon className="w-5 h-5" />
                                        </div>
                                        <div className="min-w-0">
                                            <span className="font-black text-xs text-sffl-navy dark:text-white uppercase tracking-tight truncate block">
                                                Gameday Tickets
                                            </span>
                                            <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                                                Arena Match Passes
                                            </p>
                                        </div>
                                    </Link>

                                    <Link
                                        to="/store"
                                        onClick={() => setIsMoreMenuOpen(false)}
                                        className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 active:scale-[0.98] transition-all shadow-xs hover:border-sffl-red/40"
                                    >
                                        <div className="w-9 h-9 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                                            <ShoppingBagIcon className="w-5 h-5" />
                                        </div>
                                        <div className="min-w-0">
                                            <span className="font-black text-xs text-sffl-navy dark:text-white uppercase tracking-tight truncate block">
                                                Merch Store
                                            </span>
                                            <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                                                Kits & Official Merch
                                            </p>
                                        </div>
                                    </Link>

                                    {isAuthenticated && (
                                        <Link
                                            to="/store/orders"
                                            onClick={() => setIsMoreMenuOpen(false)}
                                            className="col-span-2 flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 active:scale-[0.98] transition-all shadow-xs hover:border-sffl-red/40"
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 flex items-center justify-center shrink-0">
                                                    <ClipboardDocumentListIcon className="w-5 h-5" />
                                                </div>
                                                <div className="min-w-0">
                                                    <span className="font-black text-xs text-sffl-navy dark:text-white uppercase tracking-tight truncate block">
                                                        My Orders
                                                    </span>
                                                    <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                                                        View Tracking & Receipts
                                                    </p>
                                                </div>
                                            </div>
                                            <ChevronRightIcon className="w-4 h-4 text-gray-400 shrink-0" />
                                        </Link>
                                    )}
                                </div>
                            </div>

                            {/* Section 4: Fantasy & News */}
                            <div className="mb-5">
                                <div className="flex items-center justify-between mb-2 px-1">
                                    <span className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                                        Fantasy & Media
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 gap-2.5">
                                    <Link
                                        to="/fantasy"
                                        onClick={() => setIsMoreMenuOpen(false)}
                                        className="flex items-center gap-3 p-3 bg-gradient-to-br from-amber-500/10 to-yellow-500/10 dark:from-amber-950/40 dark:to-yellow-950/30 rounded-2xl border border-amber-300/50 dark:border-amber-700/50 active:scale-[0.98] transition-all shadow-xs"
                                    >
                                        <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center shrink-0">
                                            <TrophyIcon className="w-5 h-5" />
                                        </div>
                                        <div className="min-w-0">
                                            <span className="font-black text-xs text-amber-700 dark:text-yellow-400 uppercase tracking-tight truncate block">
                                                Fantasy League
                                            </span>
                                            <p className="text-[10px] text-amber-600/80 dark:text-amber-300/80 truncate">
                                                Build Squad & Win
                                            </p>
                                        </div>
                                    </Link>

                                    <Link
                                        to="/news"
                                        onClick={() => setIsMoreMenuOpen(false)}
                                        className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 active:scale-[0.98] transition-all shadow-xs hover:border-sffl-red/40"
                                    >
                                        <div className="w-9 h-9 rounded-xl bg-sffl-navy/10 dark:bg-sffl-navy/40 text-sffl-navy dark:text-white flex items-center justify-center shrink-0">
                                            <NewspaperIcon className="w-5 h-5" />
                                        </div>
                                        <div className="min-w-0">
                                            <span className="font-black text-xs text-sffl-navy dark:text-white uppercase tracking-tight truncate block">
                                                Latest News
                                            </span>
                                            <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                                                Articles & Bulletins
                                            </p>
                                        </div>
                                    </Link>
                                </div>
                            </div>

                            {/* Section 5: About Showtime Trigger */}
                            <div className="mb-5">
                                <button
                                    onClick={() => setActiveSubMenu('about')}
                                    className="w-full flex items-center justify-between p-3.5 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 active:scale-[0.98] transition-all text-left shadow-xs hover:border-sffl-red/40"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-9 h-9 rounded-xl bg-sffl-red/10 dark:bg-sffl-red/20 text-sffl-red flex items-center justify-center shrink-0">
                                            <InformationCircleIcon className="w-5 h-5" />
                                        </div>
                                        <div className="min-w-0">
                                            <span className="font-black text-xs text-sffl-navy dark:text-white uppercase tracking-tight block">
                                                About Showtime
                                            </span>
                                            <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                                                Rules, Arena, Governance & Policies
                                            </p>
                                        </div>
                                    </div>
                                    <ChevronRightIcon className="w-4 h-4 text-gray-400 shrink-0 ml-2" />
                                </button>
                            </div>

                            {/* Section 6: Auth Sign Out & Footer Info */}
                            {isAuthenticated && (
                                <div className="mb-4">
                                    <button
                                        onClick={() => {
                                            logout();
                                            setIsMoreMenuOpen(false);
                                        }}
                                        className="w-full flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/60 font-black py-3 rounded-xl active:scale-[0.98] transition-all text-xs uppercase tracking-wider"
                                    >
                                        <ArrowRightOnRectangleIcon className="w-4 h-4" />
                                        <span>Sign Out</span>
                                    </button>
                                </div>
                            )}

                            <p className="text-center text-[10px] text-gray-400 font-medium uppercase tracking-widest pt-2">
                                Showtime Flag Football League • Season 2026
                            </p>
                        </div>

                        {/* About Sub-Menu Slide */}
                        <div className="w-1/2 p-5 sm:p-6 overflow-y-auto overscroll-contain pb-[calc(9rem+2*env(safe-area-inset-bottom,0px))]">
                            {/* Back Header */}
                            <div className="flex items-center gap-3 mb-5 shrink-0">
                                <button
                                    onClick={() => setActiveSubMenu('main')}
                                    className="flex items-center gap-1.5 p-2 -ml-2 text-sffl-red hover:bg-sffl-red/10 rounded-xl font-black text-xs uppercase tracking-wider transition-all"
                                >
                                    <ChevronLeftIcon className="w-5 h-5" />
                                    <span>Back</span>
                                </button>
                                <div className="h-4 w-px bg-gray-200 dark:bg-gray-700" />
                                <h2 className="text-base font-black italic text-sffl-navy dark:text-white uppercase tracking-tight">
                                    About Showtime
                                </h2>
                            </div>

                            {/* Navigation Links in About */}
                            <div className="space-y-2">
                                <Link
                                    to="/about/showtime-flag"
                                    onClick={() => setIsMoreMenuOpen(false)}
                                    className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 active:scale-[0.98] transition-all shadow-xs"
                                >
                                    <div className="flex items-center gap-3">
                                        <InformationCircleIcon className="w-5 h-5 text-gray-400" />
                                        <span className="font-bold text-xs text-gray-900 dark:text-white">The League</span>
                                    </div>
                                    <ChevronRightIcon className="w-4 h-4 text-gray-400" />
                                </Link>

                                <Link
                                    to="/about/rules"
                                    onClick={() => setIsMoreMenuOpen(false)}
                                    className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 active:scale-[0.98] transition-all shadow-xs"
                                >
                                    <div className="flex items-center gap-3">
                                        <ScaleIcon className="w-5 h-5 text-gray-400" />
                                        <span className="font-bold text-xs text-gray-900 dark:text-white">Gameplay Rules</span>
                                    </div>
                                    <ChevronRightIcon className="w-4 h-4 text-gray-400" />
                                </Link>

                                <Link
                                    to="/about/arena"
                                    onClick={() => setIsMoreMenuOpen(false)}
                                    className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 active:scale-[0.98] transition-all shadow-xs"
                                >
                                    <div className="flex items-center gap-3">
                                        <MapPinIcon className="w-5 h-5 text-gray-400" />
                                        <span className="font-bold text-xs text-gray-900 dark:text-white">Showtime Arena</span>
                                    </div>
                                    <ChevronRightIcon className="w-4 h-4 text-gray-400" />
                                </Link>

                                <Link
                                    to="/about/byelaws"
                                    onClick={() => setIsMoreMenuOpen(false)}
                                    className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 active:scale-[0.98] transition-all shadow-xs"
                                >
                                    <div className="flex items-center gap-3">
                                        <BookOpenIcon className="w-5 h-5 text-gray-400" />
                                        <span className="font-bold text-xs text-gray-900 dark:text-white">Byelaws</span>
                                    </div>
                                    <ChevronRightIcon className="w-4 h-4 text-gray-400" />
                                </Link>

                                <Link
                                    to="/about/education"
                                    onClick={() => setIsMoreMenuOpen(false)}
                                    className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 active:scale-[0.98] transition-all shadow-xs"
                                >
                                    <div className="flex items-center gap-3">
                                        <AcademicCapIcon className="w-5 h-5 text-gray-400" />
                                        <span className="font-bold text-xs text-gray-900 dark:text-white">Education</span>
                                    </div>
                                    <ChevronRightIcon className="w-4 h-4 text-gray-400" />
                                </Link>

                                <Link
                                    to="/about/media-guidelines"
                                    onClick={() => setIsMoreMenuOpen(false)}
                                    className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 active:scale-[0.98] transition-all shadow-xs"
                                >
                                    <div className="flex items-center gap-3">
                                        <VideoCameraIcon className="w-5 h-5 text-gray-400" />
                                        <span className="font-bold text-xs text-gray-900 dark:text-white">Media Guidelines</span>
                                    </div>
                                    <ChevronRightIcon className="w-4 h-4 text-gray-400" />
                                </Link>

                                <Link
                                    to="/about/our-team"
                                    onClick={() => setIsMoreMenuOpen(false)}
                                    className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 active:scale-[0.98] transition-all shadow-xs"
                                >
                                    <div className="flex items-center gap-3">
                                        <UserGroupIcon className="w-5 h-5 text-gray-400" />
                                        <span className="font-bold text-xs text-gray-900 dark:text-white">Our Team</span>
                                    </div>
                                    <ChevronRightIcon className="w-4 h-4 text-gray-400" />
                                </Link>

                                <Link
                                    to="/about/sponsorships"
                                    onClick={() => setIsMoreMenuOpen(false)}
                                    className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 active:scale-[0.98] transition-all shadow-xs"
                                >
                                    <div className="flex items-center gap-3">
                                        <SparklesIcon className="w-5 h-5 text-amber-500" />
                                        <span className="font-bold text-xs text-gray-900 dark:text-white">Sponsorships</span>
                                    </div>
                                    <ChevronRightIcon className="w-4 h-4 text-gray-400" />
                                </Link>

                                <Link
                                    to="/about/faq"
                                    onClick={() => setIsMoreMenuOpen(false)}
                                    className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 active:scale-[0.98] transition-all shadow-xs"
                                >
                                    <div className="flex items-center gap-3">
                                        <QuestionMarkCircleIcon className="w-5 h-5 text-gray-400" />
                                        <span className="font-bold text-xs text-gray-900 dark:text-white">FAQs</span>
                                    </div>
                                    <ChevronRightIcon className="w-4 h-4 text-gray-400" />
                                </Link>

                                <Link
                                    to="/about/whistleblower"
                                    onClick={() => setIsMoreMenuOpen(false)}
                                    className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 rounded-xl active:scale-[0.98] transition-all border border-red-200 dark:border-red-900/50 shadow-xs"
                                >
                                    <div className="flex items-center gap-3">
                                        <ShieldCheckIcon className="w-5 h-5" />
                                        <span className="font-black text-xs uppercase italic">Whistleblower Hotline</span>
                                    </div>
                                    <ChevronRightIcon className="w-4 h-4" />
                                </Link>

                                <Link
                                    to="/about/privacy"
                                    onClick={() => setIsMoreMenuOpen(false)}
                                    className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 active:scale-[0.98] transition-all shadow-xs"
                                >
                                    <span className="font-bold text-xs text-gray-500 uppercase tracking-widest pl-1">
                                        Privacy Policy
                                    </span>
                                    <ChevronRightIcon className="w-4 h-4 text-gray-400" />
                                </Link>
                            </div>

                            <p className="mt-8 text-center text-[10px] text-gray-400 font-medium uppercase tracking-widest">
                                Season 2026 • v1.4.2
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
