import { Outlet, Link, useLocation } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { BottomNav } from './BottomNav';
import { useTheme } from '../../contexts/ThemeContext';
import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
    XMarkIcon,
    InformationCircleIcon,
    ShoppingBagIcon,
    NewspaperIcon,
    PhotoIcon,
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
    const { isDarkMode, toggleDarkMode } = useTheme();
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
        <div className="flex flex-col min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-white dark:bg-gray-950 pb-14 lg:pb-0 transition-colors duration-300">
            <Navbar onMoreClick={() => setIsMoreMenuOpen(true)} />
            <main className="flex-grow w-full max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 py-3 md:py-8">
                <Outlet />
            </main>
            <Footer />

            <BottomNav onMoreClick={() => setIsMoreMenuOpen(prev => !prev)} />

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
                        <div className="w-1/2 p-6 max-h-[85vh] overflow-y-auto pb-20">
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
                                <Link to="/gallery" onClick={() => setIsMoreMenuOpen(false)} className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl active:scale-95 transition-all">
                                    <PhotoIcon className="w-5 h-5 text-sffl-red" />
                                    <span className="font-black text-xs text-gray-900 dark:text-white uppercase tracking-tight">Gallery</span>
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
                        <div className="w-1/2 p-6 flex flex-col max-h-[85vh] overflow-y-auto pb-20">
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

            {/* Global Mobile Dark Mode Toggle - Floating at 2/3 Height */}
            <button
                onClick={toggleDarkMode}
                className="lg:hidden fixed bottom-[33%] right-4 p-3 rounded-full bg-sffl-navy/80 dark:bg-white/90 backdrop-blur-md text-white dark:text-sffl-navy shadow-2xl hover:scale-110 active:scale-90 transition-all z-[70] flex items-center justify-center border-2 border-white/20 dark:border-sffl-navy/10 animate-pulse-subtle"
                aria-label="Toggle dark mode"
                style={{
                    boxShadow: isDarkMode ? '0 0 20px rgba(255,255,255,0.2)' : '0 0 20px rgba(0,21,50,0.2)'
                }}
            >
                {isDarkMode ? (
                    <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                    </svg>
                ) : (
                    <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                    </svg>
                )}
            </button>
        </div>
    );
};
