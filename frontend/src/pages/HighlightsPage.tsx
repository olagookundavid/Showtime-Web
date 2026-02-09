export const HighlightsPage = () => {
    return (
        <div className="space-y-8">
            <div className="text-center">
                <h1 className="text-4xl md:text-5xl font-black text-sffl-navy mb-4">GAME HIGHLIGHTS</h1>
                <p className="text-gray-600 text-lg">Relive the best moments from recent matches</p>
            </div>

            {/* Placeholder for Video Highlights */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-xl transition">
                        <div className="aspect-video bg-gradient-to-br from-sffl-navy to-sffl-red flex items-center justify-center">
                            <div className="text-white text-6xl opacity-50">▶</div>
                        </div>
                        <div className="p-4">
                            <h3 className="font-bold text-lg text-sffl-navy mb-1">Week {i} Highlights</h3>
                            <p className="text-sm text-gray-600">Epic plays and game-changing moments</p>
                            <button className="mt-3 text-sffl-red font-bold hover:underline">Watch Now →</button>
                        </div>
                    </div>
                ))}
            </div>

            <div className="bg-sffl-navy text-white p-8 rounded-2xl text-center">
                <p className="text-lg">Full highlight reels coming soon! Subscribe to our YouTube channel for updates.</p>
                <button className="mt-4 bg-white text-sffl-navy font-bold px-6 py-3 rounded-full hover:bg-gray-100 transition">
                    Subscribe on YouTube
                </button>
            </div>
        </div>
    );
};
