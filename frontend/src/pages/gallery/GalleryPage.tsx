import { useEffect, useState } from 'react';
import { getGallery, type Gallery } from '../../services/api';
import { Loader } from '../../components/ui/Loader';
import { Pagination } from '../../components/ui/Pagination';

export const GalleryPage = () => {
    const [gallery, setGallery] = useState<Gallery[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const LIMIT = 10;

    useEffect(() => {
        const fetchGallery = async () => {
            setLoading(true);
            try {
                const data = await getGallery(currentPage, LIMIT);
                setGallery(data.data);
                setTotalPages(data.total_pages);
            } catch (error) {
                console.error("Failed to fetch gallery:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchGallery();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, [currentPage]);

    const ensureAbsoluteUrl = (url: string) => {
        if (!url) return '#';
        if (url.startsWith('http://') || url.startsWith('https://')) return url;
        return `https://${url}`;
    };

    if (loading) {
        return <Loader />;
    }

    return (
        <div className="max-w-6xl mx-auto space-y-8">
            {/* Header */}
            <div className="bg-sffl-navy text-white p-8 rounded-2xl shadow-xl">
                <h1 className="text-5xl font-black italic">SHOWTIME GALLERY</h1>
                <p className="text-gray-300 mt-2 text-lg">Game day memories</p>
            </div>

            {/* Description */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                    Relive the excitement of SFFL game days! Browse through our collection of photos
                    featuring players in action and fans bringing the energy. All photos are hosted on
                    Google Drive for easy access and sharing.
                </p>
            </div>

            {/* Gallery Table */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
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
                            {gallery.map((entry, index) => (
                                <tr
                                    key={entry.id}
                                    className={`${index % 2 === 0 ? 'bg-gray-50 dark:bg-gray-700' : 'bg-white dark:bg-gray-800'} hover:bg-gray-100 dark:hover:bg-gray-600 transition duration-150`}
                                >
                                    <td className="px-6 py-4 font-bold text-sffl-navy dark:text-white">
                                        {entry.game_week}
                                    </td>
                                    <td className="px-6 py-4 text-gray-700 dark:text-gray-300">
                                        {entry.date}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <a
                                            href={ensureAbsoluteUrl(entry.players_photo_url)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="group inline-flex items-center gap-2 bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 text-white font-semibold py-2.5 px-5 rounded-full transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105"
                                        >
                                            <span className="text-lg">🏈</span>
                                            <span className="text-sm">Players</span>
                                        </a>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <a
                                            href={ensureAbsoluteUrl(entry.fans_photo_url)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="group inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-2.5 px-5 rounded-full transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105"
                                        >
                                            <span className="text-lg">⚡</span>
                                            <span className="text-sm">Fans</span>
                                        </a>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Pagination */}
            <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
            />

            {/* Info Box */}
            <div className="bg-gray-100 dark:bg-gray-800 border-l-4 border-sffl-red p-6 rounded-lg">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                    <strong>Note:</strong> Photos are stored in Google Drive. Click the buttons to access
                    each folder. You can download, share, and tag yourself in the photos!
                </p>
            </div>
        </div>
    );
};
