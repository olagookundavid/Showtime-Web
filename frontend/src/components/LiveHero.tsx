import { useState } from 'react';

/** The homepage hero while the channel is live. It deliberately occupies the
 *  exact box MainHeroCarousel uses (same aspect ratio, height and corners) so
 *  the swap in and out is a straight replacement with no layout jump. */
export const LiveHero = ({ videoId, title }: { videoId: string; title?: string }) => {
    const [loaded, setLoaded] = useState(false);

    // Browsers block autoplay with sound, so a stream that starts unmuted just
    // doesn't start at all. Muted autoplay always works; the badge below tells
    // the viewer where the sound is. Standard youtube.com embed is used rather
    // than youtube-nocookie because nocookie frequently blocks or fails live playback.
    const src = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&playsinline=1&rel=0&enablejsapi=1&iv_load_policy=3&modestbranding=1`;

    return (
        <div className="relative aspect-[16/9] md:aspect-auto md:h-[650px] w-full overflow-hidden rounded-xl md:rounded-3xl shadow-2xl bg-black">
            {!loaded && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10">
                    <div className="w-10 h-10 border-4 border-gray-700 border-t-sffl-red rounded-full animate-spin" />
                    <span className="text-gray-400 text-sm font-semibold">Connecting to the live stream…</span>
                </div>
            )}

            <iframe
                className={`w-full h-full transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'}`}
                src={src}
                title={title || 'Showtime Flag Football — Live'}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                onLoad={() => setLoaded(true)}
            />
        </div>
    );
};
