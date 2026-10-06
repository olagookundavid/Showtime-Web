import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import { getHeroSlides } from "../services/api";
import { IconButton } from "./ui";

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
    }, 10_000);

    return () => clearInterval(timer);
  }, [hasMultipleSlides, slides.length]);

  if (slides.length === 0) return null;

  return (
    <div className="relative aspect-video md:aspect-2/1 w-full overflow-hidden rounded-xl md:rounded-3xl shadow-2xl bg-sffl-navy/5">
      {slides.map((slide, index) => {
        const className = `absolute inset-0 transition-all duration-1000 ease-in-out ${index === activeSlide ? "opacity-100 scale-100 z-10" : "opacity-0 scale-105 z-0"}`;
        const backgrounds = (
          <>
            {/* Mobile: square variant when provided, else the desktop image */}
            <div
              className="md:hidden w-full h-full bg-center bg-cover bg-no-repeat transition-transform duration-10000"
              style={{
                backgroundImage: `url(${slide.mobile_image_url || slide.image_url})`,
              }}
            />
            {/* Desktop: wide 2:1 image */}
            <div
              className="hidden md:block w-full h-full bg-center bg-cover bg-no-repeat transition-transform duration-10000"
              style={{ backgroundImage: `url(${slide.image_url})` }}
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
          <a
            key={slide.id}
            href={slide.destination}
            target="_blank"
            rel="noopener noreferrer"
            className={className}
          >
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

          {/* Dots: small marks inside 44px tap areas */}
          <div className="absolute bottom-1 md:bottom-3 left-1/2 -translate-x-1/2 z-20 flex">
            {slides.map((_, index) => (
              <button
                key={index}
                type="button"
                onClick={() => setCurrentSlide(index)}
                aria-label={`Go to slide ${index + 1}`}
                aria-current={index === currentSlide ? "true" : undefined}
                className="group min-h-11 min-w-11 flex items-center justify-center"
              >
                <span
                  className={`h-2 md:h-3 rounded-full transition-all ${index === currentSlide ? "bg-sffl-red w-6 md:w-8" : "w-2 md:w-3 bg-white/50 group-hover:bg-white"}`}
                />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
