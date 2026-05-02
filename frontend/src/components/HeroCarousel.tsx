import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface Slide {
    id: number;
    title: string;
    subtitle: string;
    ctaText: string;
    ctaLink: string;
    bgColor: string;
    image: string;
}

export const HeroCarousel = () => {
    const [currentSlide, setCurrentSlide] = useState(0);
    const { isAuthenticated } = useAuth();

    const slides: Slide[] = [
        {
            id: 1,
            title: 'Get Your Tickets Now!',
            subtitle: 'Secure your spot for the next thrilling SFFL match',
            ctaText: 'Buy Tickets',
            ctaLink: '/tickets',
            bgColor: 'from-sffl-red to-[#8B1C1C]',
            image: '/images/branding/hero-1.jpeg',
        },
        {
            id: 2,
            title: 'Join As A Fan',
            subtitle: 'Register now and get exclusive discounts on tickets',
            ctaText: 'Sign Up Free',
            ctaLink: isAuthenticated ? '/tickets' : '/signup',
            bgColor: 'from-sffl-navy to-blue-900',
            image: '/images/branding/hero-2.jpeg',
        },
        {
            id: 3,
            title: 'View Gallery',
            subtitle: 'Check out photos from our recent matches',
            ctaText: 'See Photos',
            ctaLink: '/gallery',
            bgColor: 'from-purple-600 to-purple-900',
            image: '/images/branding/hero-3.jpeg',
        },
    ];

    // Auto-advance every 5 seconds
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentSlide((prev) => (prev + 1) % slides.length);
        }, 5000);

        return () => clearInterval(timer);
    }, [slides.length]);

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
        <div className="relative h-[180px] md:h-[300px] overflow-hidden rounded-lg md:rounded-xl shadow-xl">
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
                        <div className="relative h-full flex items-center justify-center text-center text-white px-3 md:px-4">
                            <div className="max-w-2xl">
                                <h2 className="text-xl md:text-4xl font-black italic mb-1 drop-shadow-lg">
                                    {slide.title}
                                </h2>
                                <p className="text-xs md:text-lg mb-3 drop-shadow-md">
                                    {slide.subtitle}
                                </p>
                                <span
                                    className="inline-flex items-center justify-center bg-white text-sffl-navy font-black text-[10px] md:text-sm px-4 py-1.5 md:px-6 md:py-2 min-h-[32px] md:min-h-[44px] rounded-full hover:bg-gray-100 transition-all duration-300 transform hover:scale-105 active:scale-95 shadow-lg"
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
                className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 text-white p-2 md:p-3 min-h-[32px] md:min-h-[44px] min-w-[32px] md:min-w-[44px] flex items-center justify-center rounded-full backdrop-blur-sm transition-all duration-300 hover:scale-[1.02] active:scale-95 z-20"
                aria-label="Previous slide"
            >
                <svg className="w-4 h-4 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
                </svg>
            </button>
            <button
                onClick={(e) => { e.preventDefault(); nextSlide(); }}
                className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 text-white p-2 md:p-3 min-h-[32px] md:min-h-[44px] min-w-[32px] md:min-w-[44px] flex items-center justify-center rounded-full backdrop-blur-sm transition-all duration-300 hover:scale-[1.02] active:scale-95 z-20"
                aria-label="Next slide"
            >
                <svg className="w-4 h-4 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
                </svg>
            </button>

            {/* Dot Indicators */}
            <div className="absolute bottom-3 md:bottom-6 left-1/2 -translate-x-1/2 flex gap-1 md:gap-2 z-20">
                {slides.map((_, index) => (
                    <button
                        key={index}
                        onClick={(e) => { e.preventDefault(); goToSlide(index); }}
                        className="p-1 min-h-[32px] md:min-h-[44px] min-w-[32px] md:min-w-[44px] flex items-center justify-center group"
                        aria-label={`Go to slide ${index + 1}`}
                    >
                        <span className={`w-2 h-2 md:w-3 md:h-3 rounded-full transition-all duration-300 ${index === currentSlide ? 'bg-white w-6 md:w-8' : 'bg-white/50 group-hover:bg-white/75'}`} />
                    </button>
                ))}
            </div>
        </div>
    );
};
