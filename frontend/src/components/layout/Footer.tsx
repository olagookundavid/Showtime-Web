import { Link } from 'react-router-dom';
import { CopyableEmail } from '../common/CopyableEmail';

export const Footer = () => {
    // The footer carries the whole page's clearance for the fixed BottomNav, which
    // is lg:hidden — so the padding must revert at lg, not md. At md the nav is
    // still on screen and 2rem of padding leaves it covering the copyright line
    // (iPad portrait is exactly 768px).
    return (
        <footer className="bg-sffl-navy dark:bg-gray-950 text-white p-4 md:p-8 pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] lg:pb-8 mt-auto border-t border-gray-800 dark:border-gray-700">
            {/* Mobile: 1-col stack. Tablet: 2-col grid. Desktop: flex row with
                space evenly distributed between columns regardless of their
                content width, so the Branding column's wider wordmark doesn't
                visually distort the spacing of the link columns. */}
            <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-8 text-center sm:text-left lg:flex lg:flex-row lg:justify-between lg:items-start">
                {/* Branding */}
                <div className="flex flex-col items-center sm:items-start group cursor-pointer">
                    <div className="flex items-center mb-3 md:mb-4">
                        <span className="text-xl md:text-3xl font-black italic tracking-tighter transition-all duration-300 group-hover:scale-110">
                            SHOWTIME<span className="text-sffl-red">FLAG</span>
                        </span>
                    </div>
                    <p className="text-gray-400 text-sm leading-relaxed max-w-xs">
                        The premier flag football league in Lagos. Building community through sport.
                    </p>
                </div>

                {/* About — who/what Showtime is */}
                <div className="flex flex-col space-y-1 md:space-y-2">
                    <h4 className="font-bold uppercase text-sffl-red text-xs md:text-base mb-1 md:mb-2 tracking-widest">About</h4>
                    <Link to="/about/showtime-flag" className="text-gray-300 hover:text-white text-xs md:text-sm py-1 md:py-0 block">About Showtime</Link>
                    <Link to="/about/our-team" className="text-gray-300 hover:text-white text-xs md:text-sm py-1 md:py-0 block">Our Team</Link>
                    <Link to="/about/arena" className="text-gray-300 hover:text-white text-xs md:text-sm py-1 md:py-0 block">Showtime Arena</Link>
                    <Link to="/about/education" className="text-gray-300 hover:text-white text-xs md:text-sm py-1 md:py-0 block">Education</Link>
                    <Link to="/about/sponsorships" className="text-gray-300 hover:text-white text-xs md:text-sm py-1 md:py-0 block">Sponsorships</Link>
                </div>

                {/* Rules & Policy — game rules + conduct + media */}
                <div className="flex flex-col space-y-1 md:space-y-2">
                    <h4 className="font-bold uppercase text-sffl-red text-xs md:text-base mb-1 md:mb-2 tracking-widest">Rules &amp; Policy</h4>
                    <Link to="/about/rules" className="text-gray-300 hover:text-white text-xs md:text-sm py-1 md:py-0 block">Gameplay Rules</Link>
                    <Link to="/about/byelaws" className="text-gray-300 hover:text-white text-xs md:text-sm py-1 md:py-0 block">Showtime Byelaws</Link>
                    <Link to="/about/media-guidelines" className="text-gray-300 hover:text-white text-xs md:text-sm py-1 md:py-0 block">Media Guidelines</Link>
                    <Link to="/about/faq" className="text-gray-300 hover:text-white text-xs md:text-sm py-1 md:py-0 block">FAQs</Link>
                    <Link to="/about/whistleblower" className="text-gray-300 hover:text-white text-xs md:text-sm py-1 md:py-0 block">Whistleblower</Link>
                    <Link to="/about/privacy" className="text-gray-300 hover:text-white text-xs md:text-sm py-1 md:py-0 block">Privacy Policy</Link>
                </div>

                {/* Socials / Contact */}
                <div className="flex flex-col items-center sm:items-start">
                    <h4 className="font-bold uppercase text-sffl-red text-xs md:text-base mb-1 md:mb-2 tracking-widest">Connect</h4>
                    <p className="text-gray-400 text-[10px] md:text-sm">Follow us on social media for live updates.</p>
                    <div className="mt-3 md:mt-4 flex space-x-3 md:space-x-4">
                        <a
                            href="https://www.youtube.com/@ShowtimeFlagFootball"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-10 h-10 bg-gray-700 hover:bg-[#FF0000] rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110"
                            aria-label="YouTube"
                        >
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
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
                    </div>
                    <div className="mt-4 md:mt-6">
                        <CopyableEmail email="showtime@sffl.football" label="Contact Us:" className="bg-gray-800 dark:bg-gray-900 border border-gray-700 text-gray-300 hover:text-white px-3 py-1.5 md:px-4 md:py-2 rounded-xl text-[10px] md:text-sm transition-colors" />
                    </div>
                </div>
            </div>
            <div className="text-center text-gray-400 dark:text-gray-500 text-[10px] md:text-xs mt-6 md:mt-8 border-t border-gray-800 dark:border-gray-800/80 pt-3 md:pt-4">
                &copy; 2026 Showtime Flag Football League.
            </div>
        </footer>
    );
};
