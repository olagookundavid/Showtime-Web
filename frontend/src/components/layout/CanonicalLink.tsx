import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { SITE_URL } from '../../constants';

// Points Google at the clean URL for whatever page is open. Filters and context
// in the query string (?team=, ?match=, ?comp=, ?date=) show the same page, so
// without this each variant is indexed as a duplicate of /players/<id> etc.
export const CanonicalLink = () => {
    const { pathname } = useLocation();

    useEffect(() => {
        let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
        if (!link) {
            link = document.createElement('link');
            link.rel = 'canonical';
            document.head.appendChild(link);
        }
        link.href = SITE_URL + (pathname === '/' ? '/' : pathname.replace(/\/+$/, ''));
    }, [pathname]);

    return null;
};
