import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getHeroSlides } from '../services/api';

export const MainHeroCarousel = () => {
    const [currentSlide, setCurrentSlide] = useState(0);

    const { data: apiSlides } = useQuery({
        queryKey: ['publicHeroSlides'],
        queryFn: getHeroSlides,
        staleTime: 60_000,
    });

    // Admin-driven. With no slides we render nothing (see the early return
    // below) instead of a placeholder image, so the carousel takes up zero
    // space until an admin adds slides.
    const slides: { id: string; image_url: string; mobile_image_url?: string; news_slug?: string }[] =
        apiSlides && apiSlides.length > 0
            ? apiSlides.map(s => ({ id: s.id, image_url: s.image_url, mobile_image_url: s.mobile_image_url, news_slug: s.news_slug }))
            : [];

    const hasMultipleSlides = slides.length > 1;

    // Keep currentSlide in range if the slide count shrinks (e.g. admin deletes).
    useEffect(() => {
        if (currentSlide >= slides.length) setCurrentSlide(0);
    }, [slides.length, currentSlide]);

    useEffect(() => {
        if (!hasMultipleSlides) return;

        const timer = setInterval(() => {
            setCurrentSlide((prev) => (prev + 1) % slides.length);
        }, 5000);

        return () => clearInterval(timer);
    }, [hasMultipleSlides, slides.length]);

    if (slides.length === 0) return null;

    return (
        /* Fixed-height box (cap). Slides fill it with background-size: cover
           (aspect ratio preserved, cropped to fit) — NOT 100% 100%, which
           stretched the wide desktop image into the near-square mobile box and
           visibly deformed it. On phones we prefer a square mobile_image_url
           when the admin uploaded one, falling back to the desktop image. */
        <div className="relative aspect-[16/9] md:aspect-auto md:h-[650px] w-full overflow-hidden rounded-xl md:rounded-3xl shadow-2xl bg-sffl-navy/5">
            {/* Slides — clickable (opens the slide's article) when a news_slug is
                linked; plain, non-interactive divs otherwise (legacy slides with
                no article yet). */}
            {slides.map((slide, index) => {
                const className = `absolute inset-0 transition-all duration-1000 ease-in-out ${index === currentSlide ? 'opacity-100 scale-100 z-10' : 'opacity-0 scale-105 z-0'}`;
                const backgrounds = (
                    <>
                        {/* Mobile: square variant when provided, else the desktop image */}
                        <div
                            className="md:hidden w-full h-full bg-center bg-cover bg-no-repeat transition-transform duration-[10000ms]"
                            style={{ backgroundImage: `url(${slide.mobile_image_url || slide.image_url})` }}
                        />
                        {/* Desktop: wide 2:1 image */}
                        <div
                            className="hidden md:block w-full h-full bg-center bg-cover bg-no-repeat transition-transform duration-[10000ms]"
                            style={{ backgroundImage: `url(${slide.image_url})` }}
                        />
                    </>
                );
                return slide.news_slug ? (
                    <Link key={slide.id} to={`/news/${slide.news_slug}`} className={className}>
                        {backgrounds}
                    </Link>
                ) : (
                    <div key={slide.id} className={className}>
                        {backgrounds}
                    </div>
                );
            })}

            {/* Navigation Controls - Only if multiple slides */}
            {hasMultipleSlides && (
                <>
                    <button
                        onClick={() => setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length)}
                        className="absolute left-4 top-1/2 -translate-y-1/2 z-20 bg-black/20 hover:bg-sffl-red text-white p-2 md:p-3 rounded-full backdrop-blur-md transition-all border border-white/10"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <button
                        onClick={() => setCurrentSlide((prev) => (prev + 1) % slides.length)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 z-20 bg-black/20 hover:bg-sffl-red text-white p-2 md:p-3 rounded-full backdrop-blur-md transition-all border border-white/10"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </button>

                    {/* Dots */}
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex gap-2">
                        {slides.map((_, index) => (
                            <button
                                key={index}
                                onClick={() => setCurrentSlide(index)}
                                className={`w-2 md:w-3 h-2 md:h-3 rounded-full transition-all ${index === currentSlide ? 'bg-sffl-red w-6 md:w-8' : 'bg-white/50 hover:bg-white'}`}
                            />
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};
