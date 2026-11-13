import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getNews } from '../../services';
import { Pagination, Spinner, NewsCard } from '../../components';
import { NewspaperIcon } from '@heroicons/react/24/solid';

export const NewsList = () => {
    const [currentPage, setCurrentPage] = useState(1);
    const LIMIT = 9; // Grid 3x3

    const { data: newsData, isLoading: loading } = useQuery({
        queryKey: ['publicNews', currentPage],
        queryFn: () => getNews(currentPage, LIMIT),
    });

    const news = newsData?.data || [];
    const totalPages = newsData?.total_pages || 1;

    useEffect(() => {
        // Scroll to top on page change
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, [currentPage]);

    return (
        <div className="space-y-4 md:space-y-8">
            {/* Header */}
            <div className="bg-sffl-navy text-white p-4 md:p-8 shadow-xl">
                <h1 className="text-3xl md:text-5xl font-black italic">LEAGUE NEWS</h1>
                <p className="text-gray-300 mt-2 text-sm md:text-lg">Latest updates from the SFFL</p>
            </div>

            {loading && <Spinner label="Loading news…" className="py-16" />}

            {/* News Grid */}
            {!loading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                {news.map((article) => (
                    <NewsCard key={article.id} article={article} />
                ))}
            </div>
            )}

            {/* Empty state */}
            {!loading && news.length === 0 && (
                <div className="bg-gray-100 dark:bg-gray-800 p-6 sm:p-12 text-center">
                    <NewspaperIcon className="w-10 h-10 mx-auto mb-3 text-gray-400" aria-hidden="true" />
                    <p className="text-gray-500 text-lg font-semibold">No news articles yet.</p>
                </div>
            )}

            {/* Pagination Controls */}
            {!loading && totalPages > 1 && (
                <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                />
            )}
        </div>
    );
};
