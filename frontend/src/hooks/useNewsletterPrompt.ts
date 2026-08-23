import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

const STORAGE_KEY = 'st_newsletter';
const SESSION_KEY = 'st_newsletter_seen';

/** Dismissing buys a week of quiet. */
const REPROMPT_AFTER_MS = 7 * 24 * 60 * 60 * 1000;
/** Let people actually look at the site before asking for anything. */
const OPEN_DELAY_MS = 25_000;

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

type PromptState = { status: 'subscribed' | 'dismissed'; at: number };

function readState(): PromptState | null {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as PromptState;
        if (parsed?.status !== 'subscribed' && parsed?.status !== 'dismissed') return null;
        return parsed;
    } catch {
        // Private mode, disabled storage, or hand-edited garbage. Treating this
        // as "no record" means the worst case is showing the prompt again.
        return null;
    }
}

function writeState(status: PromptState['status']) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ status, at: Date.now() }));
    } catch {
        /* nothing we can do — the prompt will simply come back */
    }
}

/** Subscribed = never again. Dismissed = not for another week. */
function isEligible(): boolean {
    const state = readState();
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
        if (SUPPRESSED_PATHS.some(path => location.pathname.startsWith(path))) return;
        if (!isEligible()) return;
        // One appearance per browsing session, however much they navigate.
        if (sessionStorage.getItem(SESSION_KEY)) return;

        const timer = setTimeout(() => {
            sessionStorage.setItem(SESSION_KEY, '1');
            setIsOpen(true);
        }, OPEN_DELAY_MS);

        return () => clearTimeout(timer);
    }, [location.pathname]);

    const dismiss = useCallback(() => {
        writeState('dismissed');
        setIsOpen(false);
    }, []);

    const markSubscribed = useCallback(() => {
        writeState('subscribed');
    }, []);

    return { isOpen, dismiss, markSubscribed, close: () => setIsOpen(false) };
}
