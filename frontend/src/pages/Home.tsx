export default function Home() {
    return (
        <div className="space-y-12">
            {/* Hero Section */}
            <section className="relative overflow-hidden rounded-3xl bg-gray-900 isolate">
                <div className="px-6 py-24 sm:px-6 sm:py-32 lg:px-8 text-center">
                    <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-6xl mb-6">
                        Welcome to the <span className="text-blue-500">Showtime</span>
                    </h1>
                    <p className="mx-auto max-w-2xl text-lg text-gray-400 mb-10">
                        The premier flag football league. Experience the thrill, stats, and glory of SFFL.
                    </p>
                    <div className="flex justify-center gap-4">
                        <a href="/matches" className="rounded-full bg-blue-600 px-8 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 transition-all">
                            View Schedule
                        </a>
                        <a href="/store" className="rounded-full bg-white/10 px-8 py-3 text-sm font-semibold text-white hover:bg-white/20 transition-all">
                            Get Tickets
                        </a>
                    </div>
                </div>
            </section>

            {/* Features Grid Placeholder */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="p-6 bg-gray-800 rounded-2xl border border-gray-700">
                    <h3 className="text-xl font-bold mb-2">Latest Matches</h3>
                    <p className="text-gray-400">Catch up on the latest scores and highlights.</p>
                </div>
                <div className="p-6 bg-gray-800 rounded-2xl border border-gray-700">
                    <h3 className="text-xl font-bold mb-2">League Standings</h3>
                    <p className="text-gray-400">See who's leading the race for the championship.</p>
                </div>
                <div className="p-6 bg-gray-800 rounded-2xl border border-gray-700">
                    <h3 className="text-xl font-bold mb-2">MVP Stats</h3>
                    <p className="text-gray-400">Track the league's top performers.</p>
                </div>
            </div>
        </div>
    );
}
