import { useEffect, useState } from "react";
import {
  ArrowRightIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PauseIcon,
  PlayIcon,
} from "@heroicons/react/24/outline";
import { Button, IconButton } from "../ui";

const AUTOPLAY_DELAY_MS = 15_000;

interface SlideImage {
  src: string;
  alt: string;
}

interface Slide {
  id: string;
  kicker: string;
  headline: string;
  headlineAccent: string;
  description: string;
  ctaLabel: string;
  images: [SlideImage, SlideImage];
}

const SLIDES: Slide[] = [
  {
    id: "jerseys",
    kicker: "Your team. Your colours.",
    headline: "Wear the",
    headlineAccent: "game.",
    description:
      "From the first throw to the final whistle. Represent your team. Make it Showtime.",
    ctaLabel: "Shop team jerseys",
    images: [
      {
        src: "/images/store/raptors-jersey-1.png",
        alt: "Showtime Raptors jersey, front and back",
      },
      {
        src: "/images/store/greenbacks-jersey.png",
        alt: "Showtime Greenbacks jersey, front and back",
      },
    ],
  },
  {
    id: "essentials",
    kicker: "The everyday collection",
    headline: "Always",
    headlineAccent: "Showtime.",
    description:
      "For the arena. For the city. For you. Signature pieces that go beyond game day.",
    ctaLabel: "Shop the essentials",
    images: [
      {
        src: "/images/store/showtime-snapback-with-crest-black.png",
        alt: "Showtime snapback cap with crest logo",
      },
      {
        src: "/images/store/showtime-snapback-with-red-stripes-blue.png",
        alt: "Showtime snapback cap with red stripes",
      },
    ],
  },
  {
    id: "accessories",
    kicker: "Small details. Big identity.",
    headline: "Make it",
    headlineAccent: "your own.",
    description:
      "Finish your look with the Showtime signature. A little piece of the game, wherever you go.",
    ctaLabel: "Shop accessories",
    images: [
      {
        src: "/images/store/showtime-keychain.png",
        alt: "Showtime keychain",
      },
      {
        src: "/images/store/showtime-snapback-black.png",
        alt: "Showtime snapback cap",
      },
    ],
  },
];

const pad = (n: number) => String(n).padStart(2, "0");

interface StoreHeroCarouselProps {
  onShopClick: () => void;
}

export const StoreHeroCarousel = ({ onShopClick }: StoreHeroCarouselProps) => {
  const [activeSlide, setActiveSlide] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const slideCount = SLIDES.length;

  useEffect(() => {
    if (!isPlaying) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % slideCount);
    }, AUTOPLAY_DELAY_MS);

    return () => clearInterval(timer);
  }, [isPlaying, slideCount, activeSlide]);

  const goTo = (index: number) =>
    setActiveSlide(((index % slideCount) + slideCount) % slideCount);

  return (
    <section className="relative overflow-hidden bg-sffl-navy text-white">
      <div
        className="absolute inset-0 bg-cover bg-center opacity-20"
        style={{ backgroundImage: "url(/images/branding/store-hero.jpg)" }}
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 bg-linear-to-r from-sffl-navy via-sffl-navy/90 to-sffl-navy/60"
        aria-hidden="true"
      />
      <div
        role="region"
        aria-roledescription="carousel"
        aria-label="Store highlights"
        className="relative isolate grid"
      >
        {SLIDES.map((slide, index) => {
          const isActive = index === activeSlide;
          return (
            <div
              key={slide.id}
              role="group"
              aria-roledescription="slide"
              aria-label={`${index + 1} of ${slideCount}`}
              aria-hidden={!isActive}
              className={`col-start-1 row-start-1 grid grid-cols-1 items-center gap-8 px-5 py-14 transition-opacity duration-700 ease-in-out motion-reduce:transition-none sm:px-10 sm:py-20 lg:grid-cols-2 lg:gap-12 lg:px-16 lg:py-24 ${
                isActive
                  ? "opacity-100"
                  : "pointer-events-none opacity-0"
              }`}
            >
              <div className="order-2 space-y-6 lg:order-1">
                <p className="flex items-center gap-3 text-[11px] font-black uppercase tracking-[0.25em] text-white/80">
                  <span className="h-px w-8 bg-sffl-red" aria-hidden="true" />
                  {slide.kicker}
                </p>
                <h1 className="text-5xl font-black uppercase leading-[0.9] tracking-tight sm:text-6xl lg:text-7xl">
                  {slide.headline}
                  <span className="block text-sffl-red">
                    {slide.headlineAccent}
                  </span>
                </h1>
                <p className="max-w-md text-sm text-white/85 sm:text-base">
                  {slide.description}
                </p>
                <Button
                  tone="dark"
                  variant="navy"
                  shape="square"
                  size="lg"
                  icon={ArrowRightIcon}
                  iconPosition="right"
                  tabIndex={isActive ? 0 : -1}
                  onClick={onShopClick}
                >
                  {slide.ctaLabel}
                </Button>
              </div>

              <div className="order-1 mx-auto w-full max-w-xs lg:order-2 lg:max-w-md">
                <div className="relative mx-auto grid grid-cols-5 gap-3 sm:gap-4">
                  <div className="relative col-span-3 aspect-square self-start bg-white shadow-xl dark:bg-gray-800">
                    <img
                      src={slide.images[0].src}
                      alt={slide.images[0].alt}
                      className="h-full w-full object-contain p-4"
                      loading={index === 0 ? "eager" : "lazy"}
                    />
                  </div>
                  <div className="relative col-span-2 aspect-square translate-y-8 self-start bg-white shadow-xl sm:translate-y-10 dark:bg-gray-800">
                    <img
                      src={slide.images[1].src}
                      alt={slide.images[1].alt}
                      className="h-full w-full object-contain p-3"
                      loading={index === 0 ? "eager" : "lazy"}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="relative z-10 flex flex-wrap items-center justify-between gap-x-4 gap-y-3 px-5 pb-6 sm:px-10 sm:pb-8 lg:px-16">
        <div className="flex items-center gap-1.5">
          {SLIDES.map((slide, index) => (
            <button
              key={slide.id}
              type="button"
              onClick={() => goTo(index)}
              aria-label={`Go to slide ${index + 1}: ${slide.kicker}`}
              aria-current={index === activeSlide ? "true" : undefined}
              className="group flex min-h-11 items-center"
            >
              <span
                className={`h-1 rounded-full transition-all ${
                  index === activeSlide
                    ? "w-10 bg-sffl-red"
                    : "w-6 bg-white/30 group-hover:bg-white/50"
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
    </section>
  );
};
