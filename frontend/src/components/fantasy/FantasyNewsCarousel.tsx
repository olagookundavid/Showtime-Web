import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  ArrowRightIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PauseIcon,
  PlayIcon,
} from "@heroicons/react/24/outline";
import { ButtonLink, IconButton } from "../ui";
import { getFantasyCarousel } from "../../services/api";
import type { FantasyCarouselArticle } from "../../types";
import { parseYouTubeId, youTubeThumbnailUrl } from "../../utils";

const AUTOPLAY_DELAY_MS = 15_000;

const pad = (n: number) => String(n).padStart(2, "0");

/** The picture for a slide: the video's thumbnail, else the featured image, else none. */
const slideImage = (article: FantasyCarouselArticle): string => {
  if (article.featured_media_type === "youtube") {
    const videoId = parseYouTubeId(article.featured_youtube_url);
    if (videoId) return youTubeThumbnailUrl(videoId);
  }
  return article.featured_image || "";
};

const slideDate = (article: FantasyCarouselArticle): string => {
  const date = new Date(article.published_at);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};

/**
 * The carousel at the top of the Fantasy page. Editors choose which news
 * articles appear, and in what order, on the Fantasy Carousel admin page (up to
 * ten). With no visible slides it renders nothing, so the page takes up no space
 * until one has been added.
 */
export const FantasyNewsCarousel = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);

  const { data } = useQuery({
    queryKey: ["fantasyCarousel"],
    queryFn: getFantasyCarousel,
    staleTime: 60_000,
  });

  // The server returns visible slides only, already in display order.
  const articles = (data ?? []).map((slide) => slide.article);
  const slideCount = articles.length;
  // Derived rather than synced from an effect, so the index stays valid when
  // the number of articles changes under it.
  const activeSlide = slideCount > 0 ? currentSlide % slideCount : 0;
  const hasMultipleSlides = slideCount > 1;

  useEffect(() => {
    if (!isPlaying || !hasMultipleSlides) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slideCount);
    }, AUTOPLAY_DELAY_MS);

    return () => clearInterval(timer);
  }, [isPlaying, hasMultipleSlides, slideCount, activeSlide]);

  if (slideCount === 0) return null;

  const goTo = (index: number) =>
    setCurrentSlide(((index % slideCount) + slideCount) % slideCount);

  return (
    <section className="relative overflow-hidden rounded-xl md:rounded-2xl bg-sffl-navy text-white shadow-xl">
      <div
        className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 rounded-full bg-sffl-red/20 blur-3xl pointer-events-none"
        aria-hidden="true"
      />
      <div
        className="absolute bottom-0 left-0 -mb-8 -ml-8 w-64 h-64 rounded-full bg-blue-500/10 blur-3xl pointer-events-none"
        aria-hidden="true"
      />

      <div
        role="region"
        aria-roledescription="carousel"
        aria-label="Fantasy news"
        className="relative isolate grid"
      >
        {articles.map((article, index) => {
          const isActive = index === activeSlide;
          const image = slideImage(article);
          const date = slideDate(article);
          const summary = article.summary;
          const href = `/news/${article.slug}`;
          return (
            <div
              key={article.id}
              role="group"
              aria-roledescription="slide"
              aria-label={`${index + 1} of ${slideCount}`}
              aria-hidden={!isActive}
              className={`col-start-1 row-start-1 grid grid-cols-1 items-center gap-6 px-5 py-8 transition-opacity duration-700 ease-in-out motion-reduce:transition-none sm:px-8 sm:py-10 lg:grid-cols-2 lg:gap-10 lg:px-12 ${
                isActive ? "opacity-100" : "pointer-events-none opacity-0"
              }`}
            >
              <div className="order-2 min-w-0 space-y-4 lg:order-1">
                <p className="flex items-center gap-3 text-[11px] font-black uppercase tracking-[0.25em] text-white/80">
                  <span className="h-px w-8 shrink-0 bg-sffl-red" aria-hidden="true" />
                  <span className="min-w-0 truncate">
                    Fantasy news{date ? ` · ${date}` : ""}
                  </span>
                </p>
                <h2 className="line-clamp-4 break-words text-3xl font-black uppercase leading-[0.95] tracking-tight sm:text-4xl lg:text-5xl">
                  {article.title}
                </h2>
                {summary && (
                  <p className="line-clamp-3 max-w-lg text-sm text-white/85 sm:text-base">
                    {summary}
                  </p>
                )}
                <ButtonLink
                  to={href}
                  tone="dark"
                  variant="navy"
                  shape="square"
                  size="lg"
                  icon={ArrowRightIcon}
                  iconPosition="right"
                  tabIndex={isActive ? 0 : -1}
                >
                  Read the story
                </ButtonLink>
              </div>

              <div className="order-1 mx-auto w-full max-w-md lg:order-2 lg:max-w-none">
                {image ? (
                  <Link
                    to={href}
                    tabIndex={-1}
                    aria-hidden="true"
                    className="block aspect-video overflow-hidden bg-white shadow-xl dark:bg-gray-800"
                  >
                    <img
                      src={image}
                      alt=""
                      className="h-full w-full object-cover"
                      loading={index === 0 ? "eager" : "lazy"}
                    />
                  </Link>
                ) : (
                  <div
                    className="flex aspect-video items-center justify-center bg-white/5 p-8 shadow-xl"
                    aria-hidden="true"
                  >
                    <img
                      src="/images/branding/showtime-logo.webp"
                      alt=""
                      className="max-h-full max-w-full object-contain opacity-80"
                      loading="lazy"
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {hasMultipleSlides && (
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 pb-4 sm:px-8 lg:px-12">
          <div className="flex items-center gap-1.5">
            {articles.map((article, index) => (
              <button
                key={article.id}
                type="button"
                onClick={() => goTo(index)}
                aria-label={`Go to slide ${index + 1}: ${article.title}`}
                aria-current={index === activeSlide ? "true" : undefined}
                className="group flex min-h-11 items-center"
              >
                <span
                  className={`h-1 rounded-full transition-all ${
                    index === activeSlide
                      ? "w-8 bg-sffl-red"
                      : "w-4 bg-white/30 group-hover:bg-white/50"
                  }`}
                />
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 text-xs font-bold tabular-nums text-white/70">
            <span aria-live="polite" className="mr-1">
              {pad(activeSlide + 1)} / {pad(slideCount)}
            </span>
            <IconButton
              tone="dark"
              variant="ghost"
              icon={isPlaying ? PauseIcon : PlayIcon}
              label={isPlaying ? "Pause slideshow" : "Play slideshow"}
              onClick={() => setIsPlaying((prev) => !prev)}
            />
            <IconButton
              tone="dark"
              variant="ghost"
              icon={ChevronLeftIcon}
              label="Previous slide"
              onClick={() => goTo(activeSlide - 1)}
            />
            <IconButton
              tone="dark"
              variant="ghost"
              icon={ChevronRightIcon}
              label="Next slide"
              onClick={() => goTo(activeSlide + 1)}
            />
          </div>
        </div>
      )}
    </section>
  );
};
