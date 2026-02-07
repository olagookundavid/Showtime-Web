import galleryData from '../../data/gallery.json';

export const GalleryPage = () => {
    return (
        <div className="max-w-6xl mx-auto space-y-8">
            {/* Header */}
            <div className="bg-sffl-navy text-white p-8 rounded-2xl shadow-xl">
                <h1 className="text-5xl font-black italic">SHOWTIME GALLERY</h1>
                <p className="text-gray-300 mt-2 text-lg">Game day memories</p>
            </div>

            {/* Description */}
            <div className="bg-white p-6 rounded-xl shadow-md">
                <p className="text-gray-700 leading-relaxed">
                    Relive the excitement of SFFL game days! Browse through our collection of photos
                    featuring players in action and fans bringing the energy. All photos are hosted on
                    Google Drive for easy access and sharing.
                </p>
            </div>

            {/* Gallery Table */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-sffl-navy text-white">
                            <tr>
                                <th className="px-6 py-4 text-left font-bold uppercase tracking-wide">Game Week</th>
                                <th className="px-6 py-4 text-left font-bold uppercase tracking-wide">Date</th>
                                <th className="px-6 py-4 text-center font-bold uppercase tracking-wide">Players</th>
                                <th className="px-6 py-4 text-center font-bold uppercase tracking-wide">Fans Zone</th>
                            </tr>
                        </thead>
                        <tbody>
                            {galleryData.map((entry, index) => (
                                <tr
                                    key={entry.id}
                                    className={`${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'} hover:bg-gray-100 transition`}
                                >
                                    <td className="px-6 py-4 font-bold text-sffl-navy">
                                        {entry.gameWeek}
                                    </td>
                                    <td className="px-6 py-4 text-gray-700">
                                        {entry.date}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <a
                                            href={entry.playersPhotoUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-2 bg-sffl-red hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition shadow-md"
                                        >
                                            <span>📸</span>
                                            <span>View Photos</span>
                                        </a>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <a
                                            href={entry.fansPhotoUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-2 bg-sffl-navy hover:bg-blue-900 text-white font-bold py-2 px-4 rounded-lg transition shadow-md"
                                        >
                                            <span>🎉</span>
                                            <span>View Photos</span>
                                        </a>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Info Box */}
            <div className="bg-gray-100 border-l-4 border-sffl-red p-6 rounded-lg">
                <p className="text-sm text-gray-700">
                    <strong>Note:</strong> Photos are stored in Google Drive. Click the buttons to access
                    each folder. You can download, share, and tag yourself in the photos!
                </p>
            </div>
        </div>
    );
};
