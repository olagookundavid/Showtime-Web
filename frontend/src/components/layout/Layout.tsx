import { Outlet, Link, useLocation } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { BottomNav } from './BottomNav';
import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { LatestMatchesCarousel, LatestMatchesInfoStrip } from './LatestMatchesCarousel';
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
    TicketIcon
} from '@heroicons/react/24/outline';

export const Layout = () => {
    const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
    const [activeSubMenu, setActiveSubMenu] = useState<'main' | 'about'>('main');
    const { isAuthenticated, user, logout } = useAuth();
    const location = useLocation();

    // Close menu on route change
    useEffect(() => {
        setIsMoreMenuOpen(false);
        setActiveSubMenu('main');
    }, [location.pathname]);


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
            <div className="sticky top-0 z-50">
                <Navbar onMoreClick={() => setIsMoreMenuOpen(true)} />
                <LatestMatchesCarousel />
            </div>
            {/* Home-only info strip sits below the sticky chrome and scrolls
                away with the rest of the page. */}
            {location.pathname === '/' && <LatestMatchesInfoStrip />}
            <main className="flex-grow w-full max-w-page mx-auto px-2 sm:px-6 lg:px-8 py-3 md:py-8 pb-8 md:pb-8 relative z-10 overscroll-y-none">
                <Outlet />
            </main>

            <Footer />

            <BottomNav onMoreClick={() => setIsMoreMenuOpen(prev => !prev)} />

            <NewsletterPopup />

            {/* "More" Mobile Drawer */}
            <div
                className={`fixed inset-0 z-[60] lg:hidden transition-all duration-300 ${isMoreMenuOpen ? 'opacity-100 visible' : 'opacity-0 invisible pointer-events-none'
                    }`}
            >
                {/* Backdrop */}
                <div
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    onClick={() => setIsMoreMenuOpen(false)}
                />

                {/* Drawer Content */}
                <div className={`absolute bottom-0 left-0 right-0 bg-white dark:bg-gray-900 rounded-t-3xl transition-transform duration-300 transform ${isMoreMenuOpen ? 'translate-y-0' : 'translate-y-full'
                    } overflow-hidden shadow-2xl border-t border-gray-100 dark:border-gray-800`}>

                    <div className={`transition-all duration-300 flex w-[200%] ${activeSubMenu === 'about' ? '-translate-x-1/2' : 'translate-x-0'}`}>
                        {/* Main Menu Slide */}
                        <div className="w-1/2 p-6 max-h-[calc(90dvh-1rem)] overflow-y-auto overscroll-contain pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))]">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-black italic text-sffl-navy dark:text-white uppercase tracking-tighter">DISCOVER</h2>
                                <button onClick={() => setIsMoreMenuOpen(false)} className="p-2 -mr-2 text-gray-400 dark:text-gray-500">
                                    <XMarkIcon className="w-6 h-6" />
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-3 pb-6 border-b border-gray-100 dark:border-gray-800 mb-6">
                                {user?.role === 'admin' && (
                                    <Link to="/admin" onClick={() => setIsMoreMenuOpen(false)} className="flex items-center gap-3 p-4 bg-sffl-navy dark:bg-gray-800 text-white rounded-2xl col-span-2 shadow-lg active:scale-[0.98] transition-all border border-transparent dark:border-gray-700">
                                        <WrenchIcon className="w-5 h-5 text-sffl-red" />
                                        <span className="font-black text-sm uppercase italic tracking-wider">Admin Panel</span>
                                    </Link>
                                )}
                                {user?.role === 'app_admin' && (
                                    <Link to="/admin" onClick={() => setIsMoreMenuOpen(false)} className="flex items-center gap-3 p-4 bg-gradient-to-r from-amber-500 to-yellow-600 text-white rounded-2xl col-span-2 shadow-lg active:scale-[0.98] transition-all border border-amber-300/40">
                                        <WrenchIcon className="w-5 h-5 text-white" />
                                        <span className="font-black text-sm uppercase italic tracking-wider">App Admin Panel</span>
                                    </Link>
                                )}
                                {user?.role === 'referee' && (
                                    <Link to="/admin/matches" onClick={() => setIsMoreMenuOpen(false)} className="flex items-center gap-3 p-4 bg-sffl-navy dark:bg-gray-800 text-white rounded-2xl col-span-2 shadow-lg active:scale-[0.98] transition-all border border-transparent dark:border-gray-700">
                                        <WrenchIcon className="w-5 h-5 text-sffl-red" />
                                        <span className="font-black text-sm uppercase italic tracking-wider">Referee Portal</span>
                                    </Link>
                                )}
                                {user?.role === 'stats' && (
                                    <Link to="/admin/matches" onClick={() => setIsMoreMenuOpen(false)} className="flex items-center gap-3 p-4 bg-sffl-navy dark:bg-gray-800 text-white rounded-2xl col-span-2 shadow-lg active:scale-[0.98] transition-all border border-transparent dark:border-gray-700">
                                        <WrenchIcon className="w-5 h-5 text-purple-500" />
                                        <span className="font-black text-sm uppercase italic tracking-wider">Stats Portal</span>
                                    </Link>
                                )}
                                {user?.role === 'ticketer' && (
                                    <Link to="/admin/tickets" onClick={() => setIsMoreMenuOpen(false)} className="flex items-center gap-3 p-4 bg-sffl-navy dark:bg-gray-800 text-white rounded-2xl col-span-2 shadow-lg active:scale-[0.98] transition-all border border-transparent dark:border-gray-700">
                                        <TicketIcon className="w-5 h-5 text-sffl-red" />
                                        <span className="font-black text-sm uppercase italic tracking-wider">Ticketing Portal</span>
                                    </Link>
                                )}
                                {user?.role === 'team_head' && (
                                    <Link to="/team-head" onClick={() => setIsMoreMenuOpen(false)} className="flex items-center gap-3 p-4 bg-sffl-navy dark:bg-gray-800 text-white rounded-2xl col-span-2 shadow-lg active:scale-[0.98] transition-all border border-transparent dark:border-gray-700">
                                        <ShieldCheckIcon className="w-5 h-5 text-sffl-red" />
                                        <span className="font-black text-sm uppercase italic tracking-wider">Team Manager</span>
                                    </Link>
                                )}

                                <Link to="/news" onClick={() => setIsMoreMenuOpen(false)} className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl active:scale-95 transition-all">
                                    <NewspaperIcon className="w-5 h-5 text-sffl-red" />
                                    <span className="font-black text-xs text-gray-900 dark:text-white uppercase tracking-tight">News</span>
                                </Link>
                                <Link to="/store" onClick={() => setIsMoreMenuOpen(false)} className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl active:scale-95 transition-all">
                                    <ShoppingBagIcon className="w-5 h-5 text-sffl-red" />
                                    <span className="font-black text-xs text-gray-900 dark:text-white uppercase tracking-tight">Store</span>
                                </Link>
                                <button
                                    onClick={() => setActiveSubMenu('about')}
                                    className="flex items-center justify-between gap-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl active:scale-95 transition-all text-left"
                                >
                                    <div className="flex items-center gap-3">
                                        <InformationCircleIcon className="w-5 h-5 text-sffl-red" />
                                        <span className="font-black text-xs text-gray-900 dark:text-white uppercase tracking-tight">About</span>
                                    </div>
                                    <ChevronRightIcon className="w-4 h-4 text-gray-400" />
                                </button>
                            </div>

                            {isAuthenticated ? (
                                <button
                                    onClick={() => { logout(); setIsMoreMenuOpen(false); }}
                                    className="w-full bg-red-600/10 text-red-600 font-black py-4 rounded-2xl active:scale-95 transition-transform text-sm uppercase tracking-widest"
                                >
                                    Logout
                                </button>
                            ) : (
                                <Link
                                    to="/login"
                                    onClick={() => setIsMoreMenuOpen(false)}
                                    className="block w-full bg-sffl-navy dark:bg-white dark:text-sffl-navy text-white text-center font-black py-4 rounded-2xl shadow-lg active:scale-95 transition-transform text-sm uppercase tracking-widest"
                                >
                                    Login / Join
                                </Link>
                            )}
                        </div>

                        {/* About Sub-Menu Slide */}
                        <div className="w-1/2 p-6 flex flex-col max-h-[calc(90dvh-1rem)] overflow-y-auto overscroll-contain pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))]">
                            <div className="flex items-center gap-4 mb-6">
                                <button onClick={() => setActiveSubMenu('main')} className="p-2 -ml-2 text-sffl-red hover:bg-sffl-red/10 rounded-full transition-all">
                                    <ChevronLeftIcon className="w-6 h-6" />
                                </button>
                                <h2 className="text-xl font-black italic text-sffl-navy dark:text-white uppercase tracking-tighter">ABOUT</h2>
                            </div>

                            <div className="space-y-2 pb-6">
                                <Link to="/about/showtime-flag" className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-xl active:scale-[0.98] transition-all">
                                    <div className="flex items-center gap-3">
                                        <InformationCircleIcon className="w-5 h-5 text-gray-400" />
                                        <span className="font-bold text-sm text-gray-900 dark:text-white">The League</span>
                                    </div>
                                    <ChevronRightIcon className="w-4 h-4 text-gray-400" />
                                </Link>
                                <Link to="/about/media-guidelines" className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-xl active:scale-[0.98] transition-all">
                                    <div className="flex items-center gap-3">
                                        <VideoCameraIcon className="w-5 h-5 text-gray-400" />
                                        <span className="font-bold text-sm text-gray-900 dark:text-white">Media Guidelines</span>
                                    </div>
                                    <ChevronRightIcon className="w-4 h-4 text-gray-400" />
                                </Link>
                                <Link to="/about/rules" className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-xl active:scale-[0.98] transition-all">
                                    <div className="flex items-center gap-3">
                                        <ScaleIcon className="w-5 h-5 text-gray-400" />
                                        <span className="font-bold text-sm text-gray-900 dark:text-white">Gameplay Rules</span>
                                    </div>
                                    <ChevronRightIcon className="w-4 h-4 text-gray-400" />
                                </Link>
                                <Link to="/about/byelaws" className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-xl active:scale-[0.98] transition-all">
                                    <div className="flex items-center gap-3">
                                        <BookOpenIcon className="w-5 h-5 text-gray-400" />
                                        <span className="font-bold text-sm text-gray-900 dark:text-white">Byelaws</span>
                                    </div>
                                    <ChevronRightIcon className="w-4 h-4 text-gray-400" />
                                </Link>
                                <Link to="/about/arena" className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-xl active:scale-[0.98] transition-all">
                                    <div className="flex items-center gap-3">
                                        <MapPinIcon className="w-5 h-5 text-gray-400" />
                                        <span className="font-bold text-sm text-gray-900 dark:text-white">Showtime Arena</span>
                                    </div>
                                    <ChevronRightIcon className="w-4 h-4 text-gray-400" />
                                </Link>
                                <Link to="/about/education" className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-xl active:scale-[0.98] transition-all">
                                    <div className="flex items-center gap-3">
                                        <AcademicCapIcon className="w-5 h-5 text-gray-400" />
                                        <span className="font-bold text-sm text-gray-900 dark:text-white">Education</span>
                                    </div>
                                    <ChevronRightIcon className="w-4 h-4 text-gray-400" />
                                </Link>
                                <Link to="/about/faq" className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-xl active:scale-[0.98] transition-all">
                                    <div className="flex items-center gap-3">
                                        <QuestionMarkCircleIcon className="w-5 h-5 text-gray-400" />
                                        <span className="font-bold text-sm text-gray-900 dark:text-white">FAQs</span>
                                    </div>
                                    <ChevronRightIcon className="w-4 h-4 text-gray-400" />
                                </Link>
                                <Link to="/about/whistleblower" className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl active:scale-[0.98] transition-all border border-red-200 dark:border-red-900/40">
                                    <div className="flex items-center gap-3">
                                        <ShieldCheckIcon className="w-5 h-5" />
                                        <span className="font-bold text-sm uppercase italic">Whistleblower</span>
                                    </div>
                                </Link>
                                <Link to="/privacy" className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-xl active:scale-[0.98] transition-all">
                                    <span className="font-bold text-xs text-gray-500 uppercase tracking-widest pl-1">Privacy</span>
                                    <ChevronRightIcon className="w-4 h-4 text-gray-400" />
                                </Link>
                            </div>

                            <p className="mt-auto text-center text-[10px] text-gray-400 font-medium uppercase tracking-widest pb-2">Season 2026 • v1.4.2</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
