import { Outlet, Link } from 'react-router-dom';

export default function Layout() {
    return (
        <div className="min-h-screen bg-gray-950 text-white font-sans flex flex-col">
            {/* Navbar */}
            <nav className="border-b border-gray-800 bg-gray-900 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center">
                            <Link to="/" className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                                SFFL
                            </Link>
                            <div className="hidden md:block ml-10">
                                <div className="flex items-baseline space-x-4">
                                    <Link to="/matches" className="hover:bg-gray-800 px-3 py-2 rounded-md text-sm font-medium transition-colors">Matches</Link>
                                    <Link to="/standings" className="hover:bg-gray-800 px-3 py-2 rounded-md text-sm font-medium transition-colors">Standings</Link>
                                    <Link to="/stats" className="hover:bg-gray-800 px-3 py-2 rounded-md text-sm font-medium transition-colors">Stats</Link>
                                    <Link to="/store" className="hover:bg-gray-800 px-3 py-2 rounded-md text-sm font-medium transition-colors">Store</Link>
                                </div>
                            </div>
                        </div>
                        <div>
                            {/* Mobile menu button could go here */}
                        </div>
                    </div>
                </div>
            </nav>

            {/* Main Content */}
            <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
                <Outlet />
            </main>

            {/* Footer */}
            <footer className="border-t border-gray-800 bg-gray-900 py-6">
                <div className="max-w-7xl mx-auto px-4 text-center text-gray-500 text-sm">
                    &copy; {new Date().getFullYear()} Showtime Flag Football League. All rights reserved.
                </div>
            </footer>
        </div>
    );
}
