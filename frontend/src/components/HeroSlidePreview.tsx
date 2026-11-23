import { useRef } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRightIcon,
  ArrowTopRightOnSquareIcon,
} from "@heroicons/react/24/outline";
import type { HeroCarouselSlide } from "./MainHeroCarousel";

interface HeroSlidePreviewProps {
  slides: HeroCarouselSlide[];
  activeSlide: number;
  onSelect: (index: number) => void;
}

// Beyond this many, a static grid would wrap onto a second row — a single
// scrollable row with arrows (matching ReliveCarousel) replaces it instead.
const MAX_GRID_SLIDES = 5;

// A preview below the carousel showing every slide at once, so visitors can
// jump straight to one instead of waiting for autoplay or using the arrows.
export const HeroSlidePreview = ({
  slides,
  activeSlide,
  onSelect,
}: HeroSlidePreviewProps) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Nothing to browse with 0 or 1 slides.
  if (slides.length < 2) return null;

  const scrollLeft = () => {
    scrollContainerRef.current?.scrollBy({ left: -320, behavior: "smooth" });
  };
  const scrollRight = () => {
    scrollContainerRef.current?.scrollBy({ left: 320, behavior: "smooth" });
  };

  const scrollable = slides.length > MAX_GRID_SLIDES;

  const card = (slide: HeroCarouselSlide, index: number) => {
    const isExternal = !!slide.destination && /^https?:\/\//i.test(slide.destination);
    const isActive = index === activeSlide;

    return (
      <div
        key={slide.id}
        className={`${scrollable ? "flex-none w-36 sm:w-44 md:w-52 snap-start" : ""} group flex flex-col bg-white dark:bg-gray-800 border overflow-hidden transition-colors duration-300 ${isActive ? "border-sffl-red" : "border-gray-200 dark:border-gray-700 hover:border-sffl-red/50"}`}
      >
        <button
          type="button"
          onClick={() => onSelect(index)}
          aria-current={isActive ? "true" : undefined}
          className="relative w-full aspect-video overflow-hidden bg-gray-100 dark:bg-gray-900 cursor-pointer"
        >
          <img
            src={slide.mobile_image_url || slide.image_url}
            alt=""
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        </button>

        {slide.headline && (
          <div className="px-2.5 py-2 sm:px-3">
            {slide.destination ? (
              isExternal ? (
                <a
                  href={slide.destination}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-start gap-1 text-sm font-bold text-gray-900 dark:text-white hover:text-sffl-red dark:hover:text-red-400 transition-colors"
                >
                  {slide.headline}
                  <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
                </a>
              ) : (
                <Link
                  to={slide.destination}
                  className="inline-flex items-start gap-1 text-sm font-bold text-gray-900 dark:text-white hover:text-sffl-red dark:hover:text-red-400 transition-colors"
                >
                  {slide.headline}
                  <ArrowRightIcon className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
                </Link>
              )
            ) : (
              <span className="text-sm font-bold text-gray-900 dark:text-white">
                {slide.headline}
              </span>
            )}
          </div>
        )}
      </div>
    );
  };

  if (!scrollable) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
        {slides.map((slide, index) => card(slide, index))}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={scrollLeft}
        className="hidden sm:flex absolute -left-3 md:-left-4 top-1/2 -translate-y-1/2 z-20 bg-sffl-navy/90 hover:bg-sffl-red text-white p-2 min-h-11 min-w-11 rounded-full shadow-2xl backdrop-blur-md transition-all duration-300 items-center justify-center cursor-pointer border border-white/20 hover:scale-110 active:scale-95"
        aria-label="Scroll left"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <div
        ref={scrollContainerRef}
        className="flex overflow-x-auto gap-3 py-1 px-1 snap-x snap-mandatory no-scrollbar w-full items-stretch"
      >
        {slides.map((slide, index) => card(slide, index))}
      </div>

      <button
        onClick={scrollRight}
        className="hidden sm:flex absolute -right-3 md:-right-4 top-1/2 -translate-y-1/2 z-20 bg-sffl-navy/90 hover:bg-sffl-red text-white p-2 min-h-11 min-w-11 rounded-full shadow-2xl backdrop-blur-md transition-all duration-300 items-center justify-center cursor-pointer border border-white/20 hover:scale-110 active:scale-95"
        aria-label="Scroll right"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
};
