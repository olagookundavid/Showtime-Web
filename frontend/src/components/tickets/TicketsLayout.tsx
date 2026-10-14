import { useEffect, useRef } from 'react';
import { Outlet } from 'react-router-dom';
import { useIsScrolled } from '../../hooks';
import { TicketModeTabs } from './TicketModeTabs';

/** Wraps /tickets and /tickets/game-pass with the Season Pass / Game Pass / Gameday Tickets picker. */
export const TicketsLayout = () => {
    // Shrinks to a compact bar once pinned under the Store/Tickets tabs, so it
    // doesn't permanently eat a large chunk of the viewport while scrolling.
    const compact = useIsScrolled();

    // Published so a page below can work out the full sticky-chrome height
    // (navbar + Store tabs + this bar) when scrolling one of its own panels
    // into view, so that panel doesn't land hidden underneath it.
    const tabsRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const el = tabsRef.current;
        if (!el) return;
        const publish = () =>
            document.documentElement.style.setProperty('--ticket-tabs-h', `${el.offsetHeight}px`);
        publish();
        const observer = new ResizeObserver(publish);
        observer.observe(el);
        return () => {
            observer.disconnect();
            document.documentElement.style.removeProperty('--ticket-tabs-h');
        };
    }, []);

    return (
        <div className="space-y-6 md:space-y-8">
            <div
                ref={tabsRef}
                className={`sticky z-30 bg-white transition-shadow duration-300 ease-out dark:bg-gray-900 ${
                    compact ? 'shadow-md dark:shadow-black/40' : 'shadow-none'
                }`}
                style={{ top: 'calc(var(--chrome-h) + var(--store-tabs-h))' }}
            >
                <TicketModeTabs compact={compact} />
            </div>
            <Outlet />
        </div>
    );
};
