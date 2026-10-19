import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { getRelivePlaylist } from "../services/api";
import type { ReliveVideo } from "../types";
import { Modal, Spinner } from "./ui";
import { buttonClass } from "./ui/buttonStyles";
import {
  PlayIcon,
  ArrowRightIcon,
  VideoCameraSlashIcon,
} from "@heroicons/react/24/outline";

// Linked when the backend couldn't say which playlist is configured.
const CHANNEL_URL = "https://www.youtube.com/@ShowtimeFlagFootball";

export const ReliveCarousel = () => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [selectedVideo, setSelectedVideo] = useState<ReliveVideo | null>(null);

  const {
    data: playlistData,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["relivePlaylist"],
    queryFn: getRelivePlaylist,
    staleTime: 5 * 60_000,
    // A nice-to-have section: when YouTube is slow the backend fails, and
    // retrying only keeps the spinner up longer before the section hides.
    retry: false,
  });

  const videos = playlistData?.videos || [];
  const playlistUrl = playlistData?.playlist_id
    ? `https://www.youtube.com/playlist?list=${encodeURIComponent(playlistData.playlist_id)}`
    : CHANNEL_URL;

  const scrollLeft = () => {
    scrollContainerRef.current?.scrollBy({ left: -320, behavior: "smooth" });
  };

  const scrollRight = () => {
    scrollContainerRef.current?.scrollBy({ left: 320, behavior: "smooth" });
  };

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 mb-4 px-2">
      <div className="flex items-center gap-2 md:gap-3">
        <span className="w-3 h-3 md:w-3.5 md:h-3.5 rounded-full bg-sffl-red animate-pulse inline-block shadow-[0_0_12px_rgba(227,27,35,0.8)]" />
        <h2 className="text-xl md:text-3xl font-black italic tracking-tighter text-sffl-navy dark:text-white uppercase">
          RELIVE
        </h2>
      </div>
      <a
        href={playlistUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="min-h-11 text-xs md:text-sm font-bold text-sffl-red hover:underline inline-flex items-center gap-1"
      >
        {playlistData?.playlist_id ? "Full Playlist" : "YouTube Channel"} <ArrowRightIcon className="w-3.5 h-3.5" aria-hidden="true" />
      </a>
    </div>
  );

  // The section keeps its own spot on the page: an inline spinner while the
  // playlist loads (never the full-screen <Loader />), and an empty state when
  // YouTube is unreachable or the playlist has no videos.
  if (isLoading || isError || videos.length === 0) {
    return (
      <div className="w-full my-4 md:my-8">
        {header}
        {isLoading ? (
          <Spinner label="Loading highlights…" className="py-12" />
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 text-center py-12 px-4 bg-gray-50 dark:bg-gray-800/20 rounded-3xl border border-dashed border-gray-200 dark:border-gray-700">
            <VideoCameraSlashIcon
              className="w-8 h-8 text-gray-400 dark:text-gray-500"
              aria-hidden="true"
            />
            <p className="text-gray-500 dark:text-gray-400 font-medium italic">
              No highlight videos available right now.
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Catch every game on the full playlist on YouTube.
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-full relative select-none my-4 md:my-8">
      {header}

      {/* Carousel Container */}
      <div className="relative group">
        {/* Left Arrow Button */}
        <button
          onClick={scrollLeft}
          className="hidden sm:flex absolute -left-3 md:-left-4 top-1/2 -translate-y-1/2 z-20 bg-sffl-navy/90 hover:bg-sffl-red text-white p-2 min-h-11 min-w-11 rounded-full shadow-2xl backdrop-blur-md transition-all duration-300 items-center justify-center cursor-pointer border border-white/20 hover:scale-110 active:scale-95"
          aria-label="Scroll left"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d="M15 19l-7-7 7-7"
            />
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
              className="flex-none w-65 sm:w-75 md:w-[320px] bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-lg border border-gray-100 dark:border-gray-700/60 transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl hover:border-sffl-red/40 cursor-pointer snap-start flex flex-col group/card"
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
                    (e.target as HTMLImageElement).src =
                      `https://i2.ytimg.com/vi/${video.video_id}/hqdefault.jpg`;
                  }}
                />
                <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent group-hover/card:via-black/10 transition-colors" />

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
                      ? new Date(video.published_at).toLocaleDateString(
                          "en-US",
                          {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          },
                        )
                      : "SFFL Highlight"}
                  </span>
                  <span className="text-sffl-red uppercase text-[10px] font-black tracking-wider flex items-center gap-1">
                    Watch on YouTube{" "}
                    <PlayIcon className="w-3 h-3 fill-sffl-red" />
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Right Arrow Button */}
        <button
          onClick={scrollRight}
          className="hidden sm:flex absolute -right-3 md:-right-4 top-1/2 -translate-y-1/2 z-20 bg-sffl-navy/90 hover:bg-sffl-red text-white p-2 min-h-11 min-w-11 rounded-full shadow-2xl backdrop-blur-md transition-all duration-300 items-center justify-center cursor-pointer border border-white/20 hover:scale-110 active:scale-95"
          aria-label="Scroll right"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      </div>

      {/* In-App Interactive Video Player */}
      {selectedVideo && (
        <Modal
          open
          onClose={() => setSelectedVideo(null)}
          title={selectedVideo.title}
          maxWidth="4xl"
          footer={
            <>
              <p className="text-xs text-gray-500 dark:text-gray-400 sm:mr-auto self-center">
                <span className="font-bold">Published: </span>
                {selectedVideo.published_at
                  ? new Date(selectedVideo.published_at).toLocaleDateString(
                      "en-US",
                      {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      },
                    )
                  : "Showtime Flag"}
              </p>
              <a
                href={selectedVideo.link}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonClass("primary", "md", false, "")}
              >
                Open on YouTube <ArrowRightIcon className="w-4 h-4" aria-hidden="true" />
              </a>
            </>
          }
        >
          {/* YouTube 16:9 Video Embed */}
          <div className="relative aspect-video w-full bg-black rounded-xl overflow-hidden">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${selectedVideo.video_id}?autoplay=1&rel=0&modestbranding=1`}
              title={selectedVideo.title}
              className="w-full h-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        </Modal>
      )}
    </div>
  );
};
