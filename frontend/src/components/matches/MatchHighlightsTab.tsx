import { FilmIcon, ArrowRightIcon } from "@heroicons/react/24/outline";
import { parseYouTubeId } from "../../utils";
import { buttonClass } from "../ui";
import { YouTubeEmbed } from "../news";

interface MatchHighlightsTabProps {
  highlightsUrl?: string;
  title: string;
}

export const MatchHighlightsTab = ({ highlightsUrl, title }: MatchHighlightsTabProps) => {
  if (!highlightsUrl) {
    return (
      <div className="bg-gray-100 dark:bg-gray-800 p-8 sm:p-16 text-center">
        <FilmIcon className="w-10 h-10 mx-auto mb-3 text-gray-400" aria-hidden="true" />
        <p className="text-gray-500 dark:text-gray-400 text-base sm:text-lg font-semibold">
          Highlights haven't been posted yet.
        </p>
        <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">
          Check back soon — we'll have them up after the match is reviewed.
        </p>
      </div>
    );
  }

  const videoId = parseYouTubeId(highlightsUrl);

  if (!videoId) {
    return (
      <div className="bg-gray-100 dark:bg-gray-800 p-8 sm:p-16 text-center">
        <FilmIcon className="w-10 h-10 mx-auto mb-3 text-gray-400" aria-hidden="true" />
        <p className="text-gray-500 dark:text-gray-400 text-base sm:text-lg font-semibold mb-5">
          Highlights are ready to watch.
        </p>
        <a
          href={highlightsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonClass("primary", "md", false, "mx-auto", "light", "square")}
        >
          Watch Highlights
          <ArrowRightIcon className="w-4 h-4" aria-hidden="true" />
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative aspect-video w-full bg-black overflow-hidden">
        <YouTubeEmbed videoId={videoId} title={title} autoplay />
      </div>
      <a
        href={highlightsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={buttonClass("primary", "md", false, "", "light", "square")}
      >
        Open on YouTube
        <ArrowRightIcon className="w-4 h-4" aria-hidden="true" />
      </a>
    </div>
  );
};
