import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { getNewsBySlug, getNews } from '../../services/api';
import { Loader } from '../../components/ui/Loader';
import { LightboxImage } from '../../components/ui';
import { NewsContent } from '../../components/news/NewsContent';
import { YouTubeEmbed } from '../../components/news/YouTubeEmbed';
import { parseYouTubeId } from '../../utils/newsContent';
import { CommentSection } from '../../components/comments/CommentSection';

export const NewsDetail = () => {
    const { slug } = useParams<{ slug: string }>();

    const { data: articleData, isLoading: loadingArticle } = useQuery({
        queryKey: ['publicNews', slug],
        queryFn: () => getNewsBySlug(slug!),
        enabled: !!slug,
    });

    const { data: relatedNewsData, isLoading: loadingRelated } = useQuery({
        queryKey: ['publicNews', 'related', 4],
        queryFn: () => getNews(1, 4),
    });

    const article = articleData || null;
    const relatedNews = relatedNewsData?.data || [];
    const loading = loadingArticle || loadingRelated;

    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, [slug]);

    if (loading) {
        return <Loader />;
    }

    if (!article) {
        return (
            <div className="text-center py-20">
                <h1 className="text-4xl font-black text-sffl-navy mb-4">Article Not Found</h1>
                <Link to="/news" className="text-sffl-red hover:underline">← Back to News</Link>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Back Button */}
            <Link to="/news" className="inline-flex items-center text-sffl-navy dark:text-white hover:text-sffl-red font-bold transition">
                <span className="mr-2">←</span> Back to News
            </Link>

            {/* Article Header */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-xl">
                {/* Featured Media: YouTube embed or photo */}
                {(() => {
                    const heroVideoId = article.featured_media_type === 'youtube'
                        ? parseYouTubeId(article.featured_youtube_url)
                        : null;
                    if (heroVideoId) {
                        return (
                            <div className="aspect-video w-full">
                                <YouTubeEmbed videoId={heroVideoId} title={article.title} />
                            </div>
                        );
                    }
                    const heroImg = article.featured_image || (article.category === "Commissioner's Note" ? '/images/leadership/adebare_adejumo.jpg' : null);
                    return (
                        <div className="h-96 overflow-hidden relative">
                            {heroImg ? (
                                <LightboxImage
                                    src={heroImg}
                                    alt={article.title}
                                    thumbnailClassName="w-full h-full"
                                    imgClassName="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="w-full h-full bg-gray-200 flex items-center justify-center">No Image</div>
                            )}
                        </div>
                    );
                })()}

                {/* Content */}
                <div className="p-8 md:p-12">
                    {/* Category */}
                    <div className="w-fit bg-sffl-red text-white text-sm font-bold px-4 py-2 rounded-full mb-4 uppercase">
                        {article.category}
                    </div>

                    {/* Title */}
                    <h1 className="text-4xl md:text-5xl font-black text-sffl-navy dark:text-white mb-4 leading-tight">
                        {article.title}
                    </h1>

                    {/* Meta */}
                    <div className="flex items-center gap-4 text-gray-600 dark:text-gray-400 mb-8 pb-6 border-b dark:border-gray-700">
                        <span className="font-semibold">{article.author}</span>
                        <span>•</span>
                        <span>{new Date(article.published_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                    </div>

                    {/* Article Body */}
                    <div className="prose prose-lg max-w-none text-gray-700 dark:text-gray-300 leading-relaxed space-y-4">
                        <NewsContent content={article.content} />
                    </div>

                    {/* Comments & Discussions */}
                    <CommentSection entityType="news" entityId={article.id} commentsEnabled={article.comments_enabled} />
                </div>
            </div>

            {/* Related Articles */}
            <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-xl">
                <h3 className="font-bold text-xl text-sffl-navy dark:text-white mb-4">More News</h3>
                <div className="space-y-3">
                    {relatedNews
                        .filter(a => a.id !== article.id)
                        .slice(0, 3)
                        .map(relatedArticle => (
                            <Link
                                key={relatedArticle.id}
                                to={`/news/${relatedArticle.slug}`}
                                className="block hover:bg-white dark:hover:bg-gray-700 p-3 rounded-lg transition"
                            >
                                <div className="font-bold text-sffl-navy dark:text-white hover:text-sffl-red line-clamp-1">
                                    {relatedArticle.title}
                                </div>
                                <div className="text-sm text-gray-500 dark:text-gray-400">{relatedArticle.category}</div>
                            </Link>
                        ))}
                </div>
            </div>
        </div>
    );
};
