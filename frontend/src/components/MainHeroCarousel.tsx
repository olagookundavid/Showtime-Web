import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import { getHeroSlides } from "../services/api";
import { IconButton } from "./ui";

// Up to this many slides get one dot each; beyond it the row would overflow a
// phone (each dot is a 44px tap target), so a "3 / 12" counter replaces it.
const MAX_DOTS = 7;

export const MainHeroCarousel = () => {
  const [currentSlide, setCurrentSlide] = useState(0);

  const { data: apiSlides } = useQuery({
    queryKey: ["publicHeroSlides"],
    queryFn: getHeroSlides,
    staleTime: 60_000,
  });

  // Admin-driven. With no slides we render nothing (see the early return
  // below) instead of a placeholder image, so the carousel takes up zero
  // space until an admin adds slides.
  const slides: {
    id: string;
    image_url: string;
    mobile_image_url?: string;
    destination?: string;
  }[] =
    apiSlides && apiSlides.length > 0
      ? apiSlides.map((s) => ({
          id: s.id,
          image_url: s.image_url,
          mobile_image_url: s.mobile_image_url,
          // Prefer the free-text destination; fall back to the legacy
          // news_slug-derived path for any slide that missed the backfill.
          destination:
            s.destination_url ||
            (s.news_slug ? `/news/${s.news_slug}` : undefined),
        }))
      : [];

  const hasMultipleSlides = slides.length > 1;
  // Derive a valid index when the slide count changes instead of syncing state
  // from an effect (which can cause an unnecessary cascading render).
  const activeSlide = slides.length > 0 ? currentSlide % slides.length : 0;

  useEffect(() => {
    if (!hasMultipleSlides) return;

    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 60_000);

    return () => clearInterval(timer);
  }, [hasMultipleSlides, slides.length]);

  if (slides.length === 0) return null;

  // The number of slides is unlimited, so only the visible slide and its two
  // neighbours load their images. The rest stay empty until the carousel
  // reaches them, instead of every full-size image loading with the homepage.
  const isNearActive = (index: number) => {
    const distance = Math.abs(index - activeSlide);
    return Math.min(distance, slides.length - distance) <= 1;
  };

  return (
    <div className="relative aspect-video md:aspect-2/1 w-full overflow-hidden rounded-xl md:rounded-3xl shadow-2xl bg-sffl-navy/5">
      {slides.map((slide, index) => {
        const className = `absolute inset-0 transition-all duration-1000 ease-in-out ${index === activeSlide ? "opacity-100 scale-100 z-10" : "opacity-0 scale-105 z-0"}`;
        const load = isNearActive(index);
        const backgrounds = (
          <>
            {/* Mobile: square variant when provided, else the desktop image */}
            <div
              className="md:hidden w-full h-full bg-center bg-cover bg-no-repeat transition-transform duration-10000"
              style={
                load
                  ? {
                      backgroundImage: `url(${slide.mobile_image_url || slide.image_url})`,
                    }
                  : undefined
              }
            />
            {/* Desktop: wide 2:1 image */}
            <div
              className="hidden md:block w-full h-full bg-center bg-cover bg-no-repeat transition-transform duration-10000"
              style={
                load ? { backgroundImage: `url(${slide.image_url})` } : undefined
              }
            />
          </>
        );
        if (!slide.destination) {
          return (
            <div key={slide.id} className={className}>
              {backgrounds}
            </div>
          );
        }
        return /^https?:\/\//i.test(slide.destination) ? (
          <a key={slide.id} href={slide.destination} className={className}>
            {backgrounds}
          </a>
        ) : (
          <Link key={slide.id} to={slide.destination} className={className}>
            {backgrounds}
          </Link>
        );
      })}
      {/* Navigation Controls - Only if multiple slides */}
      {hasMultipleSlides && (
        <>
          <IconButton
            tone="dark"
            variant="secondary"
            icon={ChevronLeftIcon}
            label="Previous slide"
            className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 z-20 backdrop-blur-md"
            onClick={() =>
              setCurrentSlide(
                (prev) => (prev - 1 + slides.length) % slides.length,
              )
            }
          />
          <IconButton
            tone="dark"
            variant="secondary"
            icon={ChevronRightIcon}
            label="Next slide"
            className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 z-20 backdrop-blur-md"
            onClick={() =>
              setCurrentSlide((prev) => (prev + 1) % slides.length)
            }
          />

          {slides.length > MAX_DOTS ? (
            // Too many for one dot each: a position counter, with the arrows
            // above to move.
            <div
              className="absolute bottom-2 md:bottom-4 left-1/2 -translate-x-1/2 z-20 rounded-full bg-black/50 backdrop-blur-md px-3 py-1 text-xs md:text-sm font-bold text-white"
              aria-live="polite"
            >
              {activeSlide + 1} / {slides.length}
            </div>
          ) : (
            // Dots: small marks inside 44px tap areas
            <div className="absolute bottom-1 md:bottom-3 left-1/2 -translate-x-1/2 z-20 flex">
              {slides.map((_, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => setCurrentSlide(index)}
                  aria-label={`Go to slide ${index + 1}`}
                  aria-current={index === activeSlide ? "true" : undefined}
                  className="group min-h-11 min-w-11 flex items-center justify-center"
                >
                  <span
                    className={`h-2 md:h-3 rounded-full transition-all ${index === activeSlide ? "bg-sffl-red w-6 md:w-8" : "w-2 md:w-3 bg-white/50 group-hover:bg-white"}`}
                  />
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};
