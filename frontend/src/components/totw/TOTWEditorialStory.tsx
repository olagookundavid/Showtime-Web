import React from "react";
import {
  NewspaperIcon,
  PencilSquareIcon,
  CalendarDaysIcon,
  UserIcon,
  ClockIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";
import type { TeamOfTheWeek } from "../../services/api";
import { NewsContent } from "../news/NewsContent";
import { YouTubeEmbed } from "../news/YouTubeEmbed";
import { Button, LightboxImage } from "../ui";
import { parseYouTubeId } from "../../utils/newsContent";

interface TOTWEditorialStoryProps {
  totw: TeamOfTheWeek;
  isAdmin: boolean;
  onEditClick: () => void;
}

export const TOTWEditorialStory: React.FC<TOTWEditorialStoryProps> = ({
  totw,
  isAdmin,
  onEditClick,
}) => {
  const news = totw.news;

  const formatDate = (dateString?: string) => {
    if (!dateString) return "";
    try {
      return new Date(dateString).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  const readingTime = (content?: string) => {
    if (!content) return "1 min read";
    const words = content.trim().split(/\s+/).length;
    const mins = Math.max(1, Math.ceil(words / 200));
    return `${mins} min read`;
  };

  const heroVideoId =
    news?.featured_media_type === "youtube" && news?.featured_youtube_url
      ? parseYouTubeId(news.featured_youtube_url)
      : null;

  return (
    <section className="space-y-6 pt-6 border-t border-gray-200 dark:border-gray-700">
      {/* ── Section Header ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sffl-navy/5 dark:bg-white/10 text-sffl-navy dark:text-gray-200 text-xs font-black uppercase tracking-wider">
            <NewspaperIcon className="w-3.5 h-3.5 text-sffl-red" />
            <span>Official Gameweek Editorial</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-black italic tracking-tight text-sffl-navy dark:text-white">
            GAMEWEEK BREAKDOWN
          </h2>
          <p className="text-xs md:text-sm text-gray-600 dark:text-gray-300">
            Official editorial coverage, key takeaways, and matchup highlights
            for {totw.week_title}.
          </p>
        </div>

        {isAdmin && (
          <Button
            variant="navy"
            icon={PencilSquareIcon}
            className="shrink-0 self-start sm:self-auto uppercase tracking-wider"
            onClick={onEditClick}
          >
            {news ? "Edit Editorial Story" : "Write Editorial Story"}
          </Button>
        )}
      </div>

      {/* ── Article Content or Empty State ─────────────────────────── */}
      {news ? (
        <article className="bg-white dark:bg-gray-800 rounded-2xl md:rounded-3xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden p-6 sm:p-8 md:p-12 space-y-8">
          {/* Header Metadata */}
          <div className="space-y-4 max-w-4xl">
            <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-sffl-red/10 text-sffl-red font-black uppercase tracking-wider text-[11px] border border-sffl-red/20">
                <SparklesIcon className="w-3 h-3" />
                <span>{news.category || "Team of the Week"}</span>
              </span>
              <span className="hidden sm:inline text-gray-300 dark:text-gray-600">
                •
              </span>
              <span className="inline-flex items-center gap-1 font-semibold text-gray-700 dark:text-gray-300">
                <UserIcon className="w-3.5 h-3.5 text-gray-400" />
                <span>By {news.author || "Showtime Editorial"}</span>
              </span>
              {news.created_at && (
                <>
                  <span className="hidden sm:inline text-gray-300 dark:text-gray-600">
                    •
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <CalendarDaysIcon className="w-3.5 h-3.5 text-gray-400" />
                    <span>{formatDate(news.created_at)}</span>
                  </span>
                </>
              )}
              <span className="hidden sm:inline text-gray-300 dark:text-gray-600">
                •
              </span>
              <span className="inline-flex items-center gap-1">
                <ClockIcon className="w-3.5 h-3.5 text-gray-400" />
                <span>{readingTime(news.content)}</span>
              </span>
            </div>

            {/* Headline Title */}
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black italic tracking-tighter text-sffl-navy dark:text-white leading-[1.1]">
              {news.title}
            </h1>

            {/* Sub-headline / Excerpt Lead */}
            {news.excerpt && (
              <div className="mt-3 p-4 sm:p-5 rounded-xl sm:rounded-2xl bg-gray-50 dark:bg-gray-700/40 border-l-4 border-sffl-red">
                <p className="text-base sm:text-lg text-gray-800 dark:text-gray-200 font-medium leading-relaxed italic">
                  "{news.excerpt}"
                </p>
              </div>
            )}
          </div>

          {/* Featured Hero Media */}
          {heroVideoId ? (
            <div className="aspect-video w-full rounded-2xl overflow-hidden shadow-lg border border-gray-200 dark:border-gray-700 bg-black">
              <YouTubeEmbed videoId={heroVideoId} title={news.title} />
            </div>
          ) : news.featured_image ? (
            <div className="rounded-2xl overflow-hidden shadow-md border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-900 max-h-130">
              <LightboxImage
                src={news.featured_image}
                alt={news.title}
                thumbnailClassName="w-full h-full"
                imgClassName="w-full h-full max-h-[520px] object-cover object-center"
              />
            </div>
          ) : null}

          {/* Editorial Body Content */}
          <div className="max-w-4xl text-gray-800 dark:text-gray-200 text-base md:text-lg leading-relaxed space-y-5">
            <NewsContent content={news.content} />
          </div>
        </article>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-2xl md:rounded-3xl border border-gray-200 dark:border-gray-700 p-8 sm:p-12 text-center space-y-4 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-700/60 flex items-center justify-center mx-auto text-gray-400">
            <NewspaperIcon className="w-7 h-7 text-sffl-red/80" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="text-lg md:text-xl font-black italic tracking-tight text-sffl-navy dark:text-white">
              No Editorial Breakdown Attached Yet
            </h3>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
              The official Showtime matchday analysis for this gameweek will be
              published here.
            </p>
          </div>
          {isAdmin && (
            <Button
              variant="primary"
              icon={PencilSquareIcon}
              className="uppercase tracking-wider"
              onClick={onEditClick}
            >
              Write Editorial Breakdown
            </Button>
          )}
        </div>
      )}
    </section>
  );
};
