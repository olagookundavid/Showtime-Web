import { useState } from 'react';
import { youTubeEmbedUrl } from '../../utils/newsContent';

// YouTube iframe with a visible loading state — the raw iframe paints as a
// black box for a second or two on slow connections, which reads as broken.
export const YouTubeEmbed = ({ videoId, title }: { videoId: string; title: string }) => {
    const [loaded, setLoaded] = useState(false);

    return (
        <div className="relative w-full h-full bg-gray-900">
            {!loaded && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                    <div className="w-10 h-10 border-4 border-gray-600 border-t-sffl-red rounded-full animate-spin" />
                    <span className="text-gray-400 text-sm font-semibold">Loading video…</span>
                </div>
            )}
            <iframe
                className={`w-full h-full transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
                src={youTubeEmbedUrl(videoId)}
                title={title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                onLoad={() => setLoaded(true)}
            />
        </div>
    );
};
