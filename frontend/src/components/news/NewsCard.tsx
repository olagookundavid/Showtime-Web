import { Link } from 'react-router-dom';
import type { News } from '../../types';
import { parseYouTubeId, youTubeThumbnailUrl } from '../../utils';
import { LightboxImage } from '../ui';
import { PlayIcon } from '@heroicons/react/24/solid';
import { ArrowRightIcon } from '@heroicons/react/24/outline';

interface NewsCardProps {
  article: News;
}

export const NewsCard = ({ article }: NewsCardProps) => {
  const videoId =
    article.featured_media_type === 'youtube'
      ? parseYouTubeId(article.featured_youtube_url)
      : null;
  const featuredImg =
    article.featured_image ||
    (article.category === "Commissioner's Note"
      ? '/images/leadership/adebare_adejumo_2.webp'
      : null);

  return (
    <div className="group flex flex-col border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm hover:shadow-md hover:border-sffl-red/50 transition-all duration-300 overflow-hidden">
      {/* Featured Media */}
      <div className="h-48 overflow-hidden bg-gray-200 dark:bg-gray-700 relative">
        {videoId ? (
          <Link to={`/news/${article.slug}`} className="block w-full h-full relative">
            <img
              src={youTubeThumbnailUrl(videoId)}
              alt={article.title}
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-14 h-14 bg-sffl-red/90 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                <PlayIcon className="w-6 h-6 text-white ml-1" aria-hidden="true" />
              </div>
            </div>
          </Link>
        ) : featuredImg ? (
          <LightboxImage
            src={featuredImg}
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
      <Link to={`/news/${article.slug}`} className="p-4 sm:p-6 flex flex-col flex-1 cursor-pointer">
        {/* Eyebrow: category + date */}
        <div className="flex items-center justify-between gap-2 mb-3">
          {article.category && (
            <span className="bg-sffl-red text-white text-[10px] font-black px-2 py-1 uppercase tracking-wider">
              {article.category}
            </span>
          )}
          <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
            {new Date(article.published_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </span>
        </div>

        {/* Title */}
        <h2 className="font-black text-lg sm:text-xl wrap-break-word text-sffl-navy dark:text-white mb-2 group-hover:text-sffl-red transition-colors line-clamp-2">
          {article.title}
        </h2>

        {/* Excerpt */}
        <p className="text-gray-600 dark:text-gray-300 text-sm line-clamp-3 flex-1">
          {article.excerpt}
        </p>

        {/* Footer: author + read more */}
        <div className="flex items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400 mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
          <span className="truncate">{article.author}</span>
          <span className="inline-flex items-center gap-1 font-bold text-sffl-red whitespace-nowrap">
            Read more
            <ArrowRightIcon className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
          </span>
        </div>
      </Link>
    </div>
  );
};
