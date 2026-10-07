import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import type { StoreProduct } from "../../types";
import { IconButton } from "../ui";
import { LazyImage } from "../ui/LazyImage";

type Props = {
  images: StoreProduct["images"];
  name: string;
  activeIndex: number;
  onChange: (index: number) => void;
};

const DESKTOP_QUERY = "(min-width: 768px)";

// Desktop: a native scroll-snap track with a thumbnail rail and arrows.
// Phones: one fixed photo, with a thumbnail carousel over its bottom-right
// corner. Tapping a thumbnail swaps the large photo; the dots below do the same.
// The parent owns the active index, so a variant can pin a photo.
export const ProductGallery = ({ images, name, activeIndex, onChange }: Props) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const thumbRefs = useRef<(HTMLButtonElement | null)[]>([]);
  // Set while the track is moving on its own, so the scroll events on the way
  // there don't report the in-between slides back to the parent.
  const pendingRef = useRef<number | null>(null);
  const count = images.length;

  // The track is only shown from md up. Tracking the breakpoint lets the track
  // re-align to the active photo when the screen grows into it.
  const [isDesktop, setIsDesktop] = useState(
    () => window.matchMedia(DESKTOP_QUERY).matches,
  );
  useEffect(() => {
    const query = window.matchMedia(DESKTOP_QUERY);
    const onChangeQuery = () => setIsDesktop(query.matches);
    query.addEventListener("change", onChangeQuery);
    return () => query.removeEventListener("change", onChangeQuery);
  }, []);

  // Move the track when the parent changes the photo (thumbnail, dot, arrow,
  // variant pin). Skipped when the track is hidden or already on that slide.
  useEffect(() => {
    const track = trackRef.current;
    if (!track || !track.clientWidth) return;
    const current = Math.round(track.scrollLeft / track.clientWidth);
    if (current === activeIndex) return;
    pendingRef.current = activeIndex;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    track.scrollTo({
      left: activeIndex * track.clientWidth,
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }, [activeIndex, isDesktop]);

  // Keep the active thumbnail visible in the phone carousel.
  useEffect(() => {
    const strip = stripRef.current;
    const thumb = thumbRefs.current[activeIndex];
    if (!strip || !thumb) return;
    const left = thumb.offsetLeft - (strip.clientWidth - thumb.offsetWidth) / 2;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    strip.scrollTo({ left, behavior: reduceMotion ? "auto" : "smooth" });
  }, [activeIndex]);

  // A finished programmatic scroll (or any user gesture) clears the pending move.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const clear = () => {
      pendingRef.current = null;
    };
    track.addEventListener("scrollend", clear);
    return () => track.removeEventListener("scrollend", clear);
  }, []);

  const handleScroll = () => {
    const track = trackRef.current;
    if (!track || !track.clientWidth) return;
    const index = Math.round(track.scrollLeft / track.clientWidth);
    if (pendingRef.current !== null) {
      if (index === pendingRef.current) pendingRef.current = null;
      return;
    }
    if (index !== activeIndex) onChange(index);
  };

  const step = (delta: number) => onChange((activeIndex + delta + count) % count);

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      step(1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      step(-1);
    }
  };

  if (count === 0) {
    return (
      <div className="flex aspect-square w-full items-center justify-center bg-stone-100 dark:bg-gray-900/60">
        <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
          No image yet
        </span>
      </div>
    );
  }

  const current = images[activeIndex] ?? images[0];

  return (
    <div className="flex gap-4">
      {count > 1 && (
        <div className="hidden max-h-136 w-20 shrink-0 flex-col gap-2 overflow-y-auto md:flex">
          {images.map((img, idx) => (
            <button
              key={img.id}
              type="button"
              onClick={() => onChange(idx)}
              aria-label={`Show photo ${idx + 1} of ${count}`}
              aria-current={idx === activeIndex ? "true" : undefined}
              className={`flex h-20 w-20 shrink-0 items-center justify-center border-2 bg-stone-100 dark:bg-gray-900/60 ${
                idx === activeIndex
                  ? "border-sffl-navy"
                  : "border-transparent hover:border-gray-300"
              }`}
            >
              <LazyImage src={img.image_url} alt="" objectFit="contain" className="p-1" />
            </button>
          ))}
        </div>
      )}

      <div className="relative min-w-0 flex-1">
        {/* Desktop: swipeable track with arrows. */}
        <div className="relative hidden md:block">
          <div
            ref={trackRef}
            role="region"
            aria-roledescription="carousel"
            aria-label={`${name} photos`}
            tabIndex={0}
            onScroll={handleScroll}
            onKeyDown={handleKeyDown}
            onPointerDown={() => {
              pendingRef.current = null;
            }}
            onTouchStart={() => {
              pendingRef.current = null;
            }}
            className="no-scrollbar flex w-full snap-x snap-mandatory overflow-x-auto scroll-smooth bg-stone-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-sffl-navy motion-reduce:scroll-auto dark:bg-gray-900/60"
          >
            {images.map((img, idx) => (
              <div
                key={img.id}
                role="group"
                aria-roledescription="slide"
                aria-label={`${idx + 1} of ${count}`}
                className="relative flex aspect-square w-full shrink-0 snap-center items-center justify-center"
              >
                <LazyImage
                  src={img.image_url}
                  alt={`${name}, photo ${idx + 1} of ${count}`}
                  objectFit="contain"
                />
              </div>
            ))}
          </div>

          {count > 1 && (
            <div className="pointer-events-none absolute inset-x-2 top-1/2 flex -translate-y-1/2 justify-between">
              <div className="pointer-events-auto overflow-hidden rounded-full bg-white/90 shadow-md dark:bg-gray-900/90">
                <IconButton
                  variant="secondary"
                  icon={ChevronLeftIcon}
                  label="Previous photo"
                  onClick={() => step(-1)}
                />
              </div>
              <div className="pointer-events-auto overflow-hidden rounded-full bg-white/90 shadow-md dark:bg-gray-900/90">
                <IconButton
                  variant="secondary"
                  icon={ChevronRightIcon}
                  label="Next photo"
                  onClick={() => step(1)}
                />
              </div>
            </div>
          )}
        </div>

        {/* Phones: one fixed photo. The thumbnail carousel sits over its bottom-right corner. */}
        <div className="relative aspect-square w-full bg-stone-100 md:hidden dark:bg-gray-900/60">
          <LazyImage
            key={current.id}
            src={current.image_url}
            alt={`${name}, photo ${activeIndex + 1} of ${count}`}
            objectFit="contain"
          />

          {count > 1 && (
            <div
              ref={stripRef}
              role="group"
              aria-label="Choose a photo"
              className="no-scrollbar absolute right-2 bottom-12 flex max-w-[calc(100%-1rem)] gap-2.5 overflow-x-auto"
            >
              {images.map((img, idx) => (
                <button
                  key={img.id}
                  ref={(el) => {
                    thumbRefs.current[idx] = el;
                  }}
                  type="button"
                  onClick={() => onChange(idx)}
                  aria-label={`Show photo ${idx + 1} of ${count}`}
                  aria-current={idx === activeIndex ? "true" : undefined}
                  className={`h-16 w-16 shrink-0 border-2 bg-stone-100 dark:bg-gray-900/60 ${
                    idx === activeIndex ? "border-sffl-navy" : "border-transparent"
                  }`}
                >
                  <LazyImage src={img.image_url} alt="" objectFit="contain" className="p-0.5" />
                </button>
              ))}
            </div>
          )}

          {count > 1 && (
            <div className="absolute bottom-0 left-1/2 flex -translate-x-1/2">
              {images.map((img, idx) => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => onChange(idx)}
                  aria-label={`Show photo ${idx + 1} of ${count}`}
                  aria-current={idx === activeIndex ? "true" : undefined}
                  className="flex h-11 w-8 items-center justify-center"
                >
                  <span
                    className={`block h-3.5 w-3.5 rounded-full ring-1 ring-white/80 transition-colors ${
                      idx === activeIndex ? "bg-sffl-navy" : "bg-gray-400"
                    }`}
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
