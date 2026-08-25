import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getRelivePlaylist, type ReliveVideo } from '../services/api';
import { Loader } from './ui/Loader';
import { XMarkIcon, PlayIcon, ArrowRightIcon } from '@heroicons/react/24/outline';

const PLAYLIST_ID = 'PLCXiB8nftQ9A';

export const ReliveCarousel = () => {
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [selectedVideo, setSelectedVideo] = useState<ReliveVideo | null>(null);

    const { data: playlistData, isLoading, isError } = useQuery({
        queryKey: ['relivePlaylist', PLAYLIST_ID],
        queryFn: () => getRelivePlaylist(PLAYLIST_ID),
        staleTime: 5 * 60_000,
    });

    const videos = playlistData?.videos || [];

    const scrollLeft = () => {
        scrollContainerRef.current?.scrollBy({ left: -320, behavior: 'smooth' });
    };

    const scrollRight = () => {
        scrollContainerRef.current?.scrollBy({ left: 320, behavior: 'smooth' });
    };

    // Close modal on Escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setSelectedVideo(null);
        };
        if (selectedVideo) {
            window.addEventListener('keydown', handleKeyDown);
        }
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedVideo]);

    if (isLoading) {
        return (
            <div className="w-full py-8 flex justify-center">
                <Loader />
            </div>
        );
    }

    if (isError || videos.length === 0) {
        return null;
    }

    return (
        <div className="w-full relative select-none my-4 md:my-8">
            {/* Header */}
            <div className="flex items-center justify-between mb-4 px-2">
                <div className="flex items-center gap-2 md:gap-3">
                    <span className="w-3 h-3 md:w-3.5 md:h-3.5 rounded-full bg-sffl-red animate-pulse inline-block shadow-[0_0_12px_rgba(227,27,35,0.8)]" />
                    <h2 className="text-xl md:text-3xl font-black italic tracking-tighter text-sffl-navy dark:text-white uppercase">
                        RELIVE
                    </h2>
                </div>
                <a
                    href={`https://www.youtube.com/playlist?list=${PLAYLIST_ID}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs md:text-sm font-bold text-sffl-red hover:underline flex items-center gap-1"
                >
                    Full Playlist <ArrowRightIcon className="w-3.5 h-3.5" />
                </a>
            </div>

            {/* Carousel Container */}
            <div className="relative group">
                {/* Left Arrow Button */}
                <button
                    onClick={scrollLeft}
                    className="hidden sm:flex absolute -left-3 md:-left-4 top-1/2 -translate-y-1/2 z-20 bg-sffl-navy/90 hover:bg-sffl-red text-white p-2 rounded-full shadow-2xl backdrop-blur-md transition-all duration-300 items-center justify-center cursor-pointer border border-white/20 hover:scale-110 active:scale-95"
                    aria-label="Scroll left"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                    </svg>
                </button>

                {/* Video Cards Scroll Area */}
                <div
                    ref={scrollContainerRef}
                    className="flex overflow-x-auto gap-4 py-2 px-1 snap-x snap-mandatory no-scrollbar w-full items-stretch"
                >
                    {videos.map((video) => (
                        <div
                            key={video.id}
                            onClick={() => setSelectedVideo(video)}
                            className="flex-none w-[260px] sm:w-[300px] md:w-[320px] bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-lg border border-gray-100 dark:border-gray-700/60 transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl hover:border-sffl-red/40 cursor-pointer snap-start flex flex-col group/card"
                        >
                            {/* Thumbnail Container */}
                            <div className="relative aspect-video w-full overflow-hidden bg-black">
                                <img
                                    src={video.thumbnail}
                                    alt={video.title}
                                    className="w-full h-full object-cover transition-transform duration-700 group-hover/card:scale-105"
                                    loading="lazy"
                                    onError={(e) => {
                                        // Fallback thumbnail if maxres is missing
                                        (e.target as HTMLImageElement).src = `https://i2.ytimg.com/vi/${video.video_id}/hqdefault.jpg`;
                                    }}
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent group-hover/card:via-black/10 transition-colors" />

                                {/* Play Button Overlay */}
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-sffl-red/90 group-hover/card:bg-sffl-red text-white flex items-center justify-center shadow-xl group-hover/card:scale-110 transition-all duration-300 border border-white/30">
                                        <PlayIcon className="w-6 h-6 md:w-7 md:h-7 fill-white ml-0.5" />
                                    </div>
                                </div>

                                {/* YouTube Branding Badge */}
                                <div className="absolute top-2.5 left-2.5 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider text-white border border-white/10">
                                    Showtime TV
                                </div>
                            </div>

                            {/* Info Section */}
                            <div className="p-4 flex-1 flex flex-col justify-between">
                                <h3 className="font-black text-sm md:text-base text-sffl-navy dark:text-white line-clamp-2 leading-snug group-hover/card:text-sffl-red transition-colors">
                                    {video.title}
                                </h3>
                                <div className="mt-3 pt-2 border-t border-gray-100 dark:border-gray-700/50 flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400 font-bold">
                                    <span>
                                        {video.published_at
                                            ? new Date(video.published_at).toLocaleDateString('en-US', {
                                                  month: 'short',
                                                  day: 'numeric',
                                                  year: 'numeric',
                                              })
                                            : 'SFFL Highlight'}
                                    </span>
                                    <span className="text-sffl-red uppercase text-[10px] font-black tracking-wider flex items-center gap-1">
                                        Watch on YouTube <PlayIcon className="w-3 h-3 fill-sffl-red" />
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Right Arrow Button */}
                <button
                    onClick={scrollRight}
                    className="hidden sm:flex absolute -right-3 md:-right-4 top-1/2 -translate-y-1/2 z-20 bg-sffl-navy/90 hover:bg-sffl-red text-white p-2 rounded-full shadow-2xl backdrop-blur-md transition-all duration-300 items-center justify-center cursor-pointer border border-white/20 hover:scale-110 active:scale-95"
                    aria-label="Scroll right"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                    </svg>
                </button>
            </div>

            {/* In-App Interactive Video Player Modal */}
            {selectedVideo && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn" onClick={() => setSelectedVideo(null)}>
                    <div className="relative w-full max-w-4xl bg-sffl-navy dark:bg-gray-900 rounded-2xl overflow-hidden shadow-2xl border border-white/10" onClick={e => e.stopPropagation()}>
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 text-white">
                            <div className="flex items-center gap-2 min-w-0 pr-4">
                                <span className="w-2.5 h-2.5 rounded-full bg-sffl-red animate-ping" />
                                <h3 className="font-black text-base md:text-xl italic truncate">
                                    {selectedVideo.title}
                                </h3>
                            </div>
                            <button
                                onClick={() => setSelectedVideo(null)}
                                className="p-2 rounded-full bg-white/10 hover:bg-sffl-red text-white transition-all duration-200 cursor-pointer flex-shrink-0"
                                aria-label="Close video player"
                            >
                                <XMarkIcon className="w-6 h-6" />
                            </button>
                        </div>

                        {/* YouTube 16:9 Video Embed */}
                        <div className="relative aspect-video w-full bg-black">
                            <iframe
                                src={`https://www.youtube-nocookie.com/embed/${selectedVideo.video_id}?autoplay=1&rel=0&modestbranding=1`}
                                title={selectedVideo.title}
                                className="w-full h-full border-0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                allowFullScreen
                            />
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 md:p-6 flex flex-wrap items-center justify-between gap-4 text-white text-xs md:text-sm bg-black/40">
                            <div>
                                <span className="font-bold text-gray-300">Published: </span>
                                <span className="text-white font-medium">
                                    {selectedVideo.published_at
                                        ? new Date(selectedVideo.published_at).toLocaleDateString('en-US', {
                                              month: 'long',
                                              day: 'numeric',
                                              year: 'numeric',
                                          })
                                        : 'Showtime Flag'}
                                </span>
                            </div>
                            <a
                                href={selectedVideo.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-4 py-2 bg-sffl-red hover:bg-red-700 text-white font-bold rounded-xl transition-all duration-300 flex items-center gap-2 shadow-lg"
                            >
                                Open on YouTube <ArrowRightIcon className="w-4 h-4" />
                            </a>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
