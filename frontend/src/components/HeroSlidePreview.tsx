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

// A grid below the carousel showing every slide at once, so visitors can jump
// straight to one instead of waiting for autoplay or using the arrows.
export const HeroSlidePreview = ({
  slides,
  activeSlide,
  onSelect,
}: HeroSlidePreviewProps) => {
  // Nothing to browse with 0 or 1 slides.
  if (slides.length < 2) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
      {slides.map((slide, index) => {
        const isExternal = !!slide.destination && /^https?:\/\//i.test(slide.destination);
        const isActive = index === activeSlide;

        return (
          <div
            key={slide.id}
            className={`group flex flex-col bg-white dark:bg-gray-800 border overflow-hidden transition-colors duration-300 ${isActive ? "border-sffl-red" : "border-gray-200 dark:border-gray-700 hover:border-sffl-red/50"}`}
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
      })}
    </div>
  );
};
