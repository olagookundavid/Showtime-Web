import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getHeroSlides } from '../services/api';

// Local seed shown if the API returns nothing (e.g. fresh deploy before an
// admin has added any slides). Lives in /public so it's bundled with the
// frontend deploy.
const FALLBACK_SLIDES = [
    { id: 'fallback-1', image_url: '/images/branding/main-hero-1.jpeg' },
];

export const MainHeroCarousel = () => {
    const [currentSlide, setCurrentSlide] = useState(0);

    const { data: apiSlides } = useQuery({
        queryKey: ['publicHeroSlides'],
        queryFn: getHeroSlides,
        staleTime: 60_000,
    });

    const slides = apiSlides && apiSlides.length > 0
        ? apiSlides.map(s => ({ id: s.id, image_url: s.image_url }))
        : FALLBACK_SLIDES;

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
        /* Fixed-height box (cap). The slide image fills it via background-size:
           100% 100% — stretches to fit exactly, no crop and no letterbox. The
           recommended 2:1 source ratio keeps distortion minimal at typical
           viewport sizes. */
        <div className="relative h-[350px] md:h-[650px] overflow-hidden rounded-xl md:rounded-3xl shadow-2xl bg-sffl-navy/5">
            {/* Slides */}
            {slides.map((slide, index) => (
                <div
                    key={slide.id}
                    className={`absolute inset-0 transition-all duration-1000 ease-in-out ${index === currentSlide ? 'opacity-100 scale-100 z-10' : 'opacity-0 scale-105 z-0'}`}
                >
                    <div
                        className="w-full h-full bg-center transition-transform duration-[10000ms]"
                        style={{ backgroundImage: `url(${slide.image_url})`, backgroundSize: '100% 100%', backgroundRepeat: 'no-repeat' }}
                    />
                </div>
            ))}

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
