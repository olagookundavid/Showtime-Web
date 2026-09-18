import { useState } from 'react';

/** The homepage hero while the channel is live. It deliberately occupies the
 *  exact box MainHeroCarousel uses (same aspect ratio, height and corners) so
 *  the swap in and out is a straight replacement with no layout jump. */
export const LiveHero = ({
    videoId,
    title,
    isLive = true,
}: {
    videoId: string;
    title?: string;
    isLive?: boolean;
}) => {
    const [loaded, setLoaded] = useState(false);

    // Browsers block autoplay with sound, so a stream or video that starts unmuted
    // doesn't start at all. Muted autoplay always works.
    const src = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&playsinline=1&rel=0&enablejsapi=1&iv_load_policy=3&modestbranding=1`;

    return (
        <div className="relative aspect-[16/9] md:aspect-auto md:h-[650px] w-full overflow-hidden rounded-xl md:rounded-3xl shadow-2xl bg-black">
            {!loaded && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10">
                    <div className="w-10 h-10 border-4 border-gray-700 border-t-sffl-red rounded-full animate-spin" />
                    <span className="text-gray-400 text-sm font-semibold">
                        {isLive ? 'Connecting to the live stream…' : 'Loading video…'}
                    </span>
                </div>
            )}

            <iframe
                className={`w-full h-full transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'}`}
                src={src}
                title={title || (isLive ? 'Showtime Flag Football — Live' : 'Showtime Flag Football — Featured Video')}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                onLoad={() => setLoaded(true)}
            />
        </div>
    );
};
