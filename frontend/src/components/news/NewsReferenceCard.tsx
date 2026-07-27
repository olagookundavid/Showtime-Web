import { useQuery } from '@tanstack/react-query';
import { getNewsBySlug, type News } from '../../services/api';
import { parseYouTubeId, youTubeThumbnailUrl } from '../../utils/newsContent';

interface NewsReferenceCardProps {
    url: string;
    isInternal: boolean;
    slug?: string;
    domain?: string;
    title?: string;
}

export const NewsReferenceCard = ({
    url,
    isInternal,
    slug,
    domain,
    title,
}: NewsReferenceCardProps) => {
    // For internal news links, fetch article details by slug if available
    const { data: newsItem, isLoading } = useQuery<News | null>({
        queryKey: ['newsRef', slug],
        queryFn: () => (slug ? getNewsBySlug(slug) : Promise.resolve(null)),
        enabled: isInternal && !!slug,
        staleTime: 5 * 60 * 1000,
    });

    // Derive display metadata
    let cardTitle = title || '';
    let cardExcerpt = '';
    let imageSrc = '';
    let sourceLabel = domain || 'External News';
    let targetUrl = url;

    if (isInternal) {
        targetUrl = slug ? `/news/${slug}` : url;
        sourceLabel = 'SFFL News';

        if (newsItem) {
            cardTitle = newsItem.title || cardTitle || 'SFFL News Article';
            cardExcerpt = newsItem.excerpt || '';
            if (newsItem.featured_image) {
                imageSrc = newsItem.featured_image;
            } else if (newsItem.featured_media_type === 'youtube' && newsItem.featured_youtube_url) {
                const ytId = parseYouTubeId(newsItem.featured_youtube_url);
                if (ytId) imageSrc = youTubeThumbnailUrl(ytId);
            }
        } else if (!isLoading && !cardTitle) {
            cardTitle = slug ? `Article: ${slug.replace(/-/g, ' ')}` : 'SFFL News Article';
        }
    } else {
        // External link
        if (!cardTitle) {
            try {
                const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
                sourceLabel = parsed.hostname.replace(/^www\./, '');
                cardTitle = `News on ${sourceLabel}`;
            } catch {
                sourceLabel = domain || 'External Link';
                cardTitle = url;
            }
        }
        targetUrl = url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`;
    }

    if (isLoading) {
        return (
            <div className="my-6 p-4 rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-slate-900/50 animate-pulse flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl bg-gray-200 dark:bg-slate-800 flex-shrink-0" />
                <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 dark:bg-slate-800 rounded w-1/4" />
                    <div className="h-5 bg-gray-200 dark:bg-slate-800 rounded w-3/4" />
                </div>
            </div>
        );
    }

    return (
        <a
            href={targetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group my-6 block overflow-hidden rounded-2xl border border-gray-200 dark:border-white/10 bg-gradient-to-br from-white via-gray-50/50 to-gray-100/50 dark:from-slate-900/90 dark:via-slate-800/60 dark:to-slate-900/90 p-4 sm:p-5 shadow-sm hover:shadow-md hover:border-sffl-red/40 dark:hover:border-sffl-red/40 transition-all duration-300 transform hover:-translate-y-0.5 no-underline"
        >
            <div className="flex items-start sm:items-center gap-4">
                {imageSrc ? (
                    <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden flex-shrink-0 bg-slate-900/10 border border-black/5 dark:border-white/10">
                        <img
                            src={imageSrc}
                            alt={cardTitle}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                    </div>
                ) : (
                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-sffl-red/10 dark:bg-sffl-red/20 text-sffl-red flex items-center justify-center flex-shrink-0 border border-sffl-red/20">
                        {isInternal ? (
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                            </svg>
                        ) : (
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                            </svg>
                        )}
                    </div>
                )}

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                            isInternal
                                ? 'bg-sffl-red/10 text-sffl-red dark:bg-sffl-red/20 dark:text-red-300'
                                : 'bg-blue-500/10 text-blue-600 dark:bg-blue-400/20 dark:text-blue-300'
                        }`}>
                            {sourceLabel}
                        </span>
                        <span className="text-xs text-gray-400 dark:text-gray-500">• Reference</span>
                    </div>

                    <h4 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white group-hover:text-sffl-red transition-colors line-clamp-2 leading-snug">
                        {cardTitle}
                    </h4>

                    {cardExcerpt && (
                        <p className="mt-1 text-xs sm:text-sm text-gray-600 dark:text-gray-300 line-clamp-2 leading-relaxed">
                            {cardExcerpt}
                        </p>
                    )}
                </div>

                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 dark:bg-white/5 text-gray-400 group-hover:bg-sffl-red group-hover:text-white transition-all flex-shrink-0 self-center">
                    <svg className="w-4 h-4 transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                </div>
            </div>
        </a>
    );
};
