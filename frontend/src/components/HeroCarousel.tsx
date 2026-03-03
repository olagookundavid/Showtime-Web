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
        title: 'Get Your Tickets Now!',
        subtitle: 'Secure your spot for the next thrilling SFFL match',
        ctaText: 'Buy Tickets',
        ctaLink: '/tickets',
        bgColor: 'from-sffl-red to-red-800',
        image: 'https://images.unsplash.com/photo-1560272564-c83b66b1ad12?w=1200&q=80',
    },
    {
        id: 2,
        title: 'Join As A Fan',
        subtitle: 'Register now and get exclusive discounts on tickets',
        ctaText: 'Sign Up Free',
        ctaLink: '/signup',
        bgColor: 'from-sffl-navy to-blue-900',
        image: 'https://images.unsplash.com/photo-1566577739112-5180d4bf9390?w=1200&q=80',
    },
    {
        id: 3,
        title: 'View Gallery',
        subtitle: 'Check out photos from our recent matches',
        ctaText: 'See Photos',
        ctaLink: '/gallery',
        bgColor: 'from-purple-600 to-purple-900',
        image: 'https://images.unsplash.com/photo-1511886929837-354d827aae26?w=1200&q=80',
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
        <div className="relative h-[250px] md:h-[300px] overflow-hidden rounded-xl shadow-xl">
            {/* Slides */}
            {slides.map((slide, index) => (
                <div
                    key={slide.id}
                    className={`absolute inset-0 transition-all duration-700 ease-in-out ${index === currentSlide ? 'opacity-100 scale-100 z-10 pointer-events-auto' : 'opacity-0 scale-95 z-0 pointer-events-none'
                        }`}
                >
                    <Link to={slide.ctaLink} className="block w-full h-full">
                        {/* Background Image */}
                        <div
                            className="absolute inset-0 bg-cover bg-center"
                            style={{ backgroundImage: `url(${slide.image})` }}
                        >
                            <div className={`absolute inset-0 bg-gradient-to-r ${slide.bgColor} opacity-90`} />
                        </div>

                        {/* Content */}
                        <div className="relative h-full flex items-center justify-center text-center text-white px-4">
                            <div className="max-w-2xl">
                                <h2 className="text-3xl md:text-4xl font-black italic mb-2 drop-shadow-lg">
                                    {slide.title}
                                </h2>
                                <p className="text-base md:text-lg mb-4 drop-shadow-md">
                                    {slide.subtitle}
                                </p>
                                <span
                                    className="inline-block bg-white text-sffl-navy font-black text-sm px-6 py-2 rounded-full hover:bg-gray-100 transition-all transform hover:scale-105 shadow-lg"
                                >
                                    {slide.ctaText}
                                </span>
                            </div>
                        </div>
                    </Link>
                </div>
            ))}

            {/* Navigation Arrows */}
            <button
                onClick={(e) => { e.preventDefault(); prevSlide(); }}
                className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/30 hover:bg-white/50 text-white p-3 rounded-full backdrop-blur-sm transition-all z-20"
                aria-label="Previous slide"
            >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
                </svg>
            </button>
            <button
                onClick={(e) => { e.preventDefault(); nextSlide(); }}
                className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/30 hover:bg-white/50 text-white p-3 rounded-full backdrop-blur-sm transition-all z-20"
                aria-label="Next slide"
            >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
                </svg>
            </button>

            {/* Dot Indicators */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-20">
                {slides.map((_, index) => (
                    <button
                        key={index}
                        onClick={(e) => { e.preventDefault(); goToSlide(index); }}
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
