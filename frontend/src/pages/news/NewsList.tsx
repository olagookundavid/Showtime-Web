import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getNews } from '../../services/api';
import { Pagination } from '../../components/ui/Pagination';
import { LightboxImage, Spinner } from '../../components/ui';

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
            <div className="bg-sffl-navy text-white p-8 rounded-2xl shadow-xl">
                <h1 className="text-5xl font-black italic">LEAGUE NEWS</h1>
                <p className="text-gray-300 mt-2 text-lg">Latest updates from the SFFL</p>
            </div>

            {loading && <Spinner label="Loading news…" className="py-16" />}

            {/* News Grid */}
            {!loading && (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {news.map((article) => (
                    <div
                        key={article.id}
                        className="group bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-md hover:shadow-2xl transition-all duration-300 hover:-translate-y-1"
                    >
                        {/* Featured Image */}
                        <div className="h-48 overflow-hidden bg-gray-200 dark:bg-gray-700 relative group-image">
                            {article.featured_image ? (
                                <LightboxImage
                                    src={article.featured_image}
                                    alt={article.title}
                                    thumbnailClassName="w-full h-full"
                                    imgClassName="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-400">
                                    No Image
                                </div>
                            )}
                        </div>

                        {/* Content */}
                        <Link 
                            to={`/news/${article.slug}`}
                            className="p-6 flex flex-col cursor-pointer"
                        >

                            {/* Title */}
                            <h2 className="font-black text-xl text-sffl-navy dark:text-white mb-2 group-hover:text-sffl-red transition-colors line-clamp-2">
                                {article.title}
                            </h2>

                            {/* Excerpt */}
                            <p className="text-gray-600 dark:text-gray-300 text-sm mb-4 line-clamp-3">
                                {article.excerpt}
                            </p>

                            {/* Meta */}
                            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                                <div className="flex items-center gap-2">
                                    <span>{article.author}</span>
                                    {article.category && (
                                        <span className="bg-sffl-red/10 text-sffl-red text-[10px] font-bold px-2 py-0.5 rounded-md uppercase">
                                            {article.category}
                                        </span>
                                    )}
                                </div>
                                <span>{new Date(article.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                            </div>
                        </Link>
                    </div>
                ))}
            </div>
            )}

            {/* Empty state */}
            {!loading && news.length === 0 && (
                <div className="bg-gray-100 dark:bg-gray-800 p-12 rounded-xl text-center">
                    <div className="text-4xl mb-3">📰</div>
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
