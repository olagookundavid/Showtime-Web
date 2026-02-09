import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

interface Slide {
    id: number;
    title: string;
    subtitle: string;
    ctaText: string;
    ctaLink: string;
    bgColor: string;
    image: string;
}

const slides: Slide[] = [
    {
        id: 1,
        title: 'Join the SFFL Family',
        subtitle: 'Register as a fan and enjoy exclusive ticket discounts',
        ctaText: 'Sign Up Now',
        ctaLink: '/signup',
        bgColor: 'from-sffl-red to-red-800',
        image: 'https://images.unsplash.com/photo-1560272564-c83b66b1ad12?w=1200&q=80',
    },
    {
        id: 2,
        title: 'Relive the Action',
        subtitle: 'Watch game highlights and top plays from every match',
        ctaText: 'Watch Now',
        ctaLink: '/highlights',
        bgColor: 'from-sffl-navy to-blue-900',
        image: 'https://images.unsplash.com/photo-1566577739112-5180d4bf9390?w=1200&q=80',
    },
    {
        id: 3,
        title: 'Game Day Memories',
        subtitle: 'Check out photos from recent matches and celebrations',
        ctaText: 'View Gallery',
        ctaLink: '/gallery',
        bgColor: 'from-purple-600 to-purple-900',
        image: 'https://images.unsplash.com/photo-1511886929837-354d827aae26?w=1200&q=80',
    },
    {
        id: 4,
        title: "Don't Miss Out",
        subtitle: 'Get your tickets for the next big game at Showtime Arena',
        ctaText: 'Buy Tickets',
        ctaLink: '/tickets',
        bgColor: 'from-green-600 to-green-900',
        image: 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=1200&q=80',
    },
];

export const HeroCarousel = () => {
    const [currentSlide, setCurrentSlide] = useState(0);

    // Auto-advance every 5 seconds
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentSlide((prev) => (prev + 1) % slides.length);
        }, 5000);

        return () => clearInterval(timer);
    }, []);

    const goToSlide = (index: number) => {
        setCurrentSlide(index);
    };

    const nextSlide = () => {
        setCurrentSlide((prev) => (prev + 1) % slides.length);
    };

    const prevSlide = () => {
        setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
    };

    return (
        <div className="relative h-[500px] md:h-[600px] overflow-hidden rounded-2xl shadow-2xl">
            {/* Slides */}
            {slides.map((slide, index) => (
                <div
                    key={slide.id}
                    className={`absolute inset-0 transition-all duration-700 ease-in-out ${index === currentSlide ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
                        }`}
                >
                    {/* Background Image */}
                    <div
                        className="absolute inset-0 bg-cover bg-center"
                        style={{ backgroundImage: `url(${slide.image})` }}
                    >
                        <div className={`absolute inset-0 bg-gradient-to-r ${slide.bgColor} opacity-90`} />
                    </div>

                    {/* Content */}
                    <div className="relative h-full flex items-center justify-center text-center text-white px-4">
                        <div className="max-w-3xl">
                            <h2 className="text-5xl md:text-6xl font-black italic mb-4 drop-shadow-lg animate-fade-in">
                                {slide.title}
                            </h2>
                            <p className="text-xl md:text-2xl mb-8 drop-shadow-md">
                                {slide.subtitle}
                            </p>
                            <Link
                                to={slide.ctaLink}
                                className="inline-block bg-white text-sffl-navy font-black text-lg px-8 py-4 rounded-full hover:bg-gray-100 transition-all transform hover:scale-110 shadow-xl"
                            >
                                {slide.ctaText}
                            </Link>
                        </div>
                    </div>
                </div>
            ))}

            {/* Navigation Arrows */}
            <button
                onClick={prevSlide}
                className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/30 hover:bg-white/50 text-white p-3 rounded-full backdrop-blur-sm transition-all"
                aria-label="Previous slide"
            >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
                </svg>
            </button>
            <button
                onClick={nextSlide}
                className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/30 hover:bg-white/50 text-white p-3 rounded-full backdrop-blur-sm transition-all"
                aria-label="Next slide"
            >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
                </svg>
            </button>

            {/* Dot Indicators */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
                {slides.map((_, index) => (
                    <button
                        key={index}
                        onClick={() => goToSlide(index)}
                        className={`w-3 h-3 rounded-full transition-all ${index === currentSlide
                                ? 'bg-white w-8'
                                : 'bg-white/50 hover:bg-white/75'
                            }`}
                        aria-label={`Go to slide ${index + 1}`}
                    />
                ))}
            </div>
        </div>
    );
};
