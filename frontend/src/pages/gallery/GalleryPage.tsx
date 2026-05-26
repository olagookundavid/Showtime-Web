import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getGallery } from '../../services/api';
import { Loader } from '../../components/ui/Loader';
import { Pagination } from '../../components/ui/Pagination';

export const GalleryPage = () => {
    const [currentPage, setCurrentPage] = useState(1);
    const LIMIT = 10;

    const { data: galleryData, isLoading: loading } = useQuery({
        queryKey: ['publicGallery', currentPage],
        queryFn: () => getGallery(currentPage, LIMIT),
    });

    const gallery = galleryData?.data || [];
    const totalPages = galleryData?.total_pages || 1;

    useEffect(() => {
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
        <div className="space-y-4 md:space-y-8">
            {/* Header - High Density */}
            <div className="bg-sffl-navy text-white p-4 md:p-8 rounded-xl md:rounded-2xl shadow-xl">
                <h1 className="text-3xl md:text-5xl font-black italic">GALLERY</h1>
                <p className="text-gray-300 mt-1 text-sm md:text-lg">Game day memories</p>
            </div>

            {/* Description */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                    Relive the excitement of SFFL game days! Browse through our collection of photos
                    featuring players in action and fans bringing the energy. All photos are hosted on
                    Google Drive for easy access and sharing.
                </p>
            </div>

            {/* Gallery Content - Grid for Mobile, Table for Desktop */}
            <div className="hidden md:block bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
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
                            {gallery.map((entry: any, index: number) => (
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

            {/* Mobile View - High Density 2-Col Grid */}
            <div className="md:hidden grid grid-cols-2 gap-2">
                {gallery.map((entry: any) => (
                    <div key={entry.id} className="bg-white dark:bg-gray-800 rounded-xl p-3 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col gap-2">
                        <div>
                            <div className="text-[10px] text-sffl-red font-black uppercase tracking-widest">{entry.date}</div>
                            <div className="text-sm font-black text-sffl-navy dark:text-white truncate">{entry.game_week}</div>
                        </div>
                        <div className="grid grid-cols-1 gap-1.5 mt-auto">
                            <a
                                href={ensureAbsoluteUrl(entry.players_photo_url)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-center gap-2 bg-gray-50 dark:bg-gray-700 py-2 rounded-lg text-[10px] font-bold text-sffl-navy dark:text-white"
                            >
                                <span>🏈</span> Players
                            </a>
                            <a
                                href={ensureAbsoluteUrl(entry.fans_photo_url)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-center gap-2 bg-gray-50 dark:bg-gray-700 py-2 rounded-lg text-[10px] font-bold text-sffl-navy dark:text-white"
                            >
                                <span>⚡</span> Fans
                            </a>
                        </div>
                    </div>
                ))}
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
