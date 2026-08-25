import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
    NEWSLETTER_SESSION_KEY as SESSION_KEY,
    readNewsletterState,
    writeNewsletterState,
} from '../services/newsletter';

/** Dismissing buys a week of quiet. */
const REPROMPT_AFTER_MS = 7 * 24 * 60 * 60 * 1000;
/** Just long enough for the page to paint before the card slides in. */
const OPEN_DELAY_MS = 3_000;

// Routes where a newsletter popup would interrupt something the visitor cares
// about far more than our mailing list: signing in, or paying us money.
const SUPPRESSED_PATHS = [
    '/login',
    '/signup',
    '/forgot-password',
    '/store/cart',
    '/store/checkout',
    '/store/confirm',
    '/tickets/confirm',
];

/** Subscribed = never again. Dismissed = not for another week. Subscribing
 *  anywhere else on the site — the ticket checkout, say — writes the same
 *  record, so opting in there also silences the popup. */
function isEligible(): boolean {
    const state = readNewsletterState();
    if (!state) return true;
    if (state.status === 'subscribed') return false;
    return Date.now() - state.at > REPROMPT_AFTER_MS;
}

/**
 * Drives the newsletter popup: decides whether this visitor should see it,
 * and remembers the answer. Storage is per-device — someone who clears their
 * browser data or switches phones starts over, which is the accepted tradeoff
 * for keeping this entirely client-side.
 */
export function useNewsletterPrompt() {
    const [isOpen, setIsOpen] = useState(false);
    const location = useLocation();

    useEffect(() => {
        // Escape hatch for testing/demoing: ?newsletter=1 opens it immediately,
        // ignoring the delay, the session guard and any stored answer.
        if (new URLSearchParams(location.search).get('newsletter') === '1') {
            setIsOpen(true);
            return;
        }

        if (SUPPRESSED_PATHS.some(path => location.pathname.startsWith(path))) return;
        if (!isEligible()) return;
        // One appearance per browsing session, however much they navigate.
        if (sessionStorage.getItem(SESSION_KEY)) return;

        const timer = setTimeout(() => {
            sessionStorage.setItem(SESSION_KEY, '1');
            setIsOpen(true);
        }, OPEN_DELAY_MS);

        return () => clearTimeout(timer);
    }, [location.pathname, location.search]);

    const dismiss = useCallback(() => {
        writeNewsletterState('dismissed');
        setIsOpen(false);
    }, []);

    const markSubscribed = useCallback(() => {
        writeNewsletterState('subscribed');
    }, []);

    return { isOpen, dismiss, markSubscribed, close: () => setIsOpen(false) };
}
