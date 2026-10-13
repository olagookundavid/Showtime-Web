import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackPageView } from '../../services/siteTracker';

/**
 * Reports every client-side navigation to our own analytics (the admin Traffic
 * page). Renders nothing. Mount once inside <BrowserRouter> (see App.tsx): a
 * React Router navigation never reloads the document, so each route change
 * has to be reported explicitly.
 */
export const PageViewTracker = () => {
    const { pathname } = useLocation();

    useEffect(() => {
        trackPageView(pathname);
    }, [pathname]);

    return null;
};
