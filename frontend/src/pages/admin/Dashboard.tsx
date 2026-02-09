import { Link } from 'react-router-dom';

export const Dashboard = () => {
    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-4xl font-black text-sffl-navy mb-2">Dashboard</h1>
                <p className="text-gray-600">Welcome back! Here's what's happening with SFFL.</p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-md border-l-4 border-sffl-red">
                    <div className="text-gray-500 text-sm font-bold mb-1">Total Matches</div>
                    <div className="text-4xl font-black text-sffl-navy">24</div>
                    <div className="text-xs text-gray-500 mt-2">Current Season</div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-md border-l-4 border-sffl-navy">
                    <div className="text-gray-500 text-sm font-bold mb-1">Registered Fans</div>
                    <div className="text-4xl font-black text-sffl-navy">1,247</div>
                    <div className="text-xs text-green-600 mt-2">+12% this week</div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-md border-l-4 border-green-500">
                    <div className="text-gray-500 text-sm font-bold mb-1">Tickets Sold</div>
                    <div className="text-4xl font-black text-sffl-navy">892</div>
                    <div className="text-xs text-gray-500 mt-2">Next Match</div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-md border-l-4 border-purple-500">
                    <div className="text-gray-500 text-sm font-bold mb-1">News Articles</div>
                    <div className="text-4xl font-black text-sffl-navy">18</div>
                    <div className="text-xs text-gray-500 mt-2">Published</div>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-xl shadow-md p-6">
                <h2 className="text-2xl font-black text-sffl-navy mb-4">Quick Actions</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Link
                        to="/admin/matches"
                        className="flex items-center gap-3 p-4 border-2 border-gray-200 rounded-lg hover:border-sffl-red hover:bg-red-50 transition"
                    >
                        <div className="text-3xl">🏈</div>
                        <div>
                            <div className="font-bold text-sffl-navy">Add New Match</div>
                            <div className="text-sm text-gray-500">Schedule a game</div>
                        </div>
                    </Link>

                    <Link
                        to="/admin/news"
                        className="flex items-center gap-3 p-4 border-2 border-gray-200 rounded-lg hover:border-sffl-navy hover:bg-blue-50 transition"
                    >
                        <div className="text-3xl">📰</div>
                        <div>
                            <div className="font-bold text-sffl-navy">Publish News</div>
                            <div className="text-sm text-gray-500">Write an article</div>
                        </div>
                    </Link>

                    <Link
                        to="/admin/gallery"
                        className="flex items-center gap-3 p-4 border-2 border-gray-200 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition"
                    >
                        <div className="text-3xl">📸</div>
                        <div>
                            <div className="font-bold text-sffl-navy">Upload Photos</div>
                            <div className="text-sm text-gray-500">Add to gallery</div>
                        </div>
                    </Link>
                </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white rounded-xl shadow-md p-6">
                <h2 className="text-2xl font-black text-sffl-navy mb-4">Recent Activity</h2>
                <div className="space-y-3">
                    <div className="flex items-center justify-between py-3 border-b">
                        <div className="flex items-center gap-3">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            <div>
                                <div className="font-semibold">Match Added: Outlaws vs Dragons</div>
                                <div className="text-sm text-gray-500">2 hours ago</div>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center justify-between py-3 border-b">
                        <div className="flex items-center gap-3">
                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                            <div>
                                <div className="font-semibold">News Published: Season 2026 Kickoff</div>
                                <div className="text-sm text-gray-500">5 hours ago</div>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center justify-between py-3">
                        <div className="flex items-center gap-3">
                            <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                            <div>
                                <div className="font-semibold">Gallery Updated: Week 5 Photos</div>
                                <div className="text-sm text-gray-500">1 day ago</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
