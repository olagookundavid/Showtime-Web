import { useState } from 'react';

/** The homepage hero while the channel is live. It deliberately occupies the
 *  exact box MainHeroCarousel uses (same aspect ratio, height and corners) so
 *  the swap in and out is a straight replacement with no layout jump. */
export const LiveHero = ({ videoId, title }: { videoId: string; title?: string }) => {
    const [loaded, setLoaded] = useState(false);

    // Browsers block autoplay with sound, so a stream that starts unmuted just
    // doesn't start at all. Muted autoplay always works; the badge below tells
    // the viewer where the sound is.
    const src = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=1&playsinline=1&rel=0`;

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

            {/* Overlay chrome sits above the iframe but must not swallow clicks
                meant for the player controls — hence pointer-events-none. */}
            <div className="absolute top-3 left-3 md:top-5 md:left-5 z-20 flex items-center gap-2 pointer-events-none">
                <span className="flex items-center gap-2 bg-sffl-red text-white text-[10px] md:text-xs font-black uppercase tracking-widest px-3 py-1.5 rounded-full shadow-lg">
                    <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                    Live
                </span>
                {title && (
                    <span className="hidden sm:inline max-w-[50vw] truncate bg-black/60 backdrop-blur-md text-white text-xs md:text-sm font-bold px-3 py-1.5 rounded-full border border-white/10">
                        {title}
                    </span>
                )}
            </div>

            <div className="absolute bottom-3 right-3 md:bottom-5 md:right-5 z-20 pointer-events-none">
                <span className="bg-black/60 backdrop-blur-md text-gray-200 text-[10px] md:text-xs font-semibold px-3 py-1.5 rounded-full border border-white/10">
                    Tap the player for sound
                </span>
            </div>
        </div>
    );
};
