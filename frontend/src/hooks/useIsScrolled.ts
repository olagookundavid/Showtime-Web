import { useEffect, useRef, useState } from 'react';

/**
 * Whether the page has been scrolled past `threshold`, for chrome that should
 * shrink once the user leaves the top of the page. Reads are batched into an
 * animation frame, same as `useHideOnScrollDown`.
 */
export const useIsScrolled = (threshold = 48) => {
    const [scrolled, setScrolled] = useState(false);
    const ticking = useRef(false);

    useEffect(() => {
        const evaluate = () => {
            ticking.current = false;
            setScrolled(window.scrollY > threshold);
        };

        const onScroll = () => {
            if (ticking.current) return;
            ticking.current = true;
            window.requestAnimationFrame(evaluate);
        };

        evaluate();
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, [threshold]);

    return scrolled;
};
