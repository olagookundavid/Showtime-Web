import { useState, useEffect } from 'react';

interface Slide {
    id: number;
    image: string;
}

export const MainHeroCarousel = () => {
    const [currentSlide, setCurrentSlide] = useState(0);

    // Add more images to this array here
    const slides: Slide[] = [
        {
            id: 1,
            image: '/images/branding/main-hero-1.jpeg',
        },
    ];

    const hasMultipleSlides = slides.length > 1;

    useEffect(() => {
        if (!hasMultipleSlides) return;

        const timer = setInterval(() => {
            setCurrentSlide((prev) => (prev + 1) % slides.length);
        }, 5000);

        return () => clearInterval(timer);
    }, [hasMultipleSlides, slides.length]);

    if (slides.length === 0) return null;

    return (
        <div className="relative h-[350px] md:h-[650px] overflow-hidden rounded-xl md:rounded-3xl shadow-2xl bg-sffl-navy/5">
            {/* Slides */}
            {slides.map((slide, index) => (
                <div
                    key={slide.id}
                    className={`absolute inset-0 transition-all duration-1000 ease-in-out ${index === currentSlide ? 'opacity-100 scale-100 z-10' : 'opacity-0 scale-105 z-0'}`}
                >
                    <div
                        className="w-full h-full bg-cover bg-center transition-transform duration-[10000ms]"
                        style={{ backgroundImage: `url(${slide.image})` }}
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
