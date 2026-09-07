import { useEffect, useRef, useState } from 'react';

interface Options {
    /**
     * How far down the page you must be before anything hides. Below this the
     * chrome always shows, so a small nudge at the top of a page never makes
     * the scores flicker away.
     */
    revealAbove?: number;
    /**
     * Movement smaller than this is treated as noise. Trackpads and iOS rubber
     * banding emit a stream of 1–2px events, and reacting to those would make
     * the strip twitch.
     */
    threshold?: number;
}

/**
 * Tracks whether the page is being scrolled down, for chrome that should get
 * out of the way while reading and come straight back on the way up.
 *
 * Reads are batched into an animation frame: the scroll event can fire far more
 * often than the screen repaints, and doing the work every time is wasted.
 */
export const useHideOnScrollDown = ({ revealAbove = 120, threshold = 6 }: Options = {}) => {
    const [hidden, setHidden] = useState(false);
    // Refs, not state: these change on every frame and must never re-render.
    const lastY = useRef(0);
    const lastHeight = useRef(0);
    const ticking = useRef(false);

    useEffect(() => {
        lastY.current = window.scrollY;
        lastHeight.current = document.documentElement.scrollHeight;

        const evaluate = () => {
            ticking.current = false;
            // Overscroll at either end reports past the real bounds on iOS.
            const y = Math.max(0, window.scrollY);
            const delta = y - lastY.current;

            // Hiding the strip shortens the page, and at the bottom the browser
            // pulls the scroll position up to compensate. That reads as a
            // scroll upward, which would reveal the strip, lengthen the page
            // again and start the whole thing over — the header would flap.
            // While the height is moving (this animation, a lazy-loaded image)
            // the delta means nothing, so resync and wait for it to settle.
            const height = document.documentElement.scrollHeight;
            if (height !== lastHeight.current) {
                lastHeight.current = height;
                lastY.current = y;
                return;
            }

            if (Math.abs(delta) < threshold) return;
            lastY.current = y;

            // Near the top there is nothing to reclaim, so stay open.
            if (y <= revealAbove) {
                setHidden(false);
                return;
            }
            setHidden(delta > 0);
        };

        const onScroll = () => {
            if (ticking.current) return;
            ticking.current = true;
            window.requestAnimationFrame(evaluate);
        };

        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, [revealAbove, threshold]);

    return hidden;
};
